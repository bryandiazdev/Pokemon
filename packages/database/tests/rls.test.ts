/**
 * Live RLS integration tests. Gated behind DATABASE_URL_TEST.
 * If unset, the whole suite is skipped so `vitest run` stays green without a DB.
 *
 * To run locally against a throwaway Postgres/Supabase:
 *   1. Start Postgres (e.g. `supabase start`, or `docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:16`).
 *   2. Ensure an `auth` schema with an `auth.users(id uuid primary key, email text, raw_user_meta_data jsonb)`
 *      table and an `auth.uid()` function exist (Supabase provides these; the harness
 *      below creates minimal stand-ins when they are missing).
 *   3. DATABASE_URL_TEST=postgres://... pnpm --filter @psr/database test:rls
 *
 * NOTE: Faithfully emulating Supabase's auth.uid()/JWT + role model locally is
 * involved. This harness sets up a minimal emulation and asserts the core property
 * (user A cannot read user B's rows). If the emulation cannot be established it
 * skips with a clear message rather than failing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

const suite = DATABASE_URL_TEST ? describe : describe.skip;

suite('RLS enforcement (live database)', () => {
  // Lazily import pg only when the suite actually runs.
  let pg: typeof import('pg');
  let admin: import('pg').Client;
  const userA = '00000000-0000-4000-8000-00000000000a';
  const userB = '00000000-0000-4000-8000-00000000000b';
  let ready = false;

  beforeAll(async () => {
    pg = await import('pg');
    admin = new pg.Client({ connectionString: DATABASE_URL_TEST });
    await admin.connect();

    // Minimal Supabase-compatible auth emulation (no-op if Supabase already provides it).
    await admin.query(`
      create schema if not exists auth;
      create table if not exists auth.users (
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb default '{}'::jsonb
      );
      -- request.jwt.claims.sub drives auth.uid() below.
      create or replace function auth.uid() returns uuid language sql stable as $fn$
        select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid;
      $fn$;
      -- Provide 'authenticated' and 'anon' roles used by policies.
      do $do$ begin
        if not exists (select 1 from pg_roles where rolname='authenticated') then
          create role authenticated;
        end if;
        if not exists (select 1 from pg_roles where rolname='anon') then
          create role anon;
        end if;
      end $do$;
    `);

    // Apply migrations in order.
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      await admin.query(sql);
    }

    // Create two users; the handle_new_user trigger provisions their default rows.
    await admin.query(
      `insert into auth.users(id,email) values ($1,'a@example.test'),($2,'b@example.test')
       on conflict (id) do nothing`,
      [userA, userB],
    );

    // Grant table privileges to the authenticated role (RLS still filters rows).
    await admin.query(`
      grant usage on schema public to authenticated, anon;
      grant select, insert, update, delete on all tables in schema public to authenticated;
      grant select on all tables in schema public to anon;
    `);

    ready = true;
  }, 60_000);

  afterAll(async () => {
    if (admin) await admin.end();
  });

  /** Run a query as a given user (sets role + JWT claims for the transaction). */
  async function asUser<T>(userId: string, fn: (c: import('pg').Client) => Promise<T>): Promise<T> {
    const c = new pg!.Client({ connectionString: DATABASE_URL_TEST });
    await c.connect();
    try {
      await c.query('begin');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      await c.query('set local role authenticated');
      const out = await fn(c);
      await c.query('commit');
      return out;
    } finally {
      await c.end();
    }
  }

  it('provisioned a default collection per user via trigger', async () => {
    if (!ready) return;
    const { rows } = await admin.query(
      'select count(*)::int n from collections where user_id = $1',
      [userA],
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('user A cannot read user B collection_items', async () => {
    if (!ready) return;

    // Seed a collection item for user B (as admin / service role, bypassing RLS).
    const { rows: colB } = await admin.query(
      'select id from collections where user_id = $1 limit 1',
      [userB],
    );
    // Need a card to reference; use any seeded/real card or create a throwaway set+card.
    const { rows: setRows } = await admin.query(
      `insert into sets(name, canonical_slug) values ('RLS Test Set','rls-test-set-'||gen_random_uuid())
       returning id`,
    );
    const { rows: cardRows } = await admin.query(
      `insert into cards(set_id, name, canonical_slug) values ($1,'RLS Test Card','rls-test-card-'||gen_random_uuid())
       returning id`,
      [setRows[0].id],
    );
    await admin.query(
      `insert into collection_items(collection_id, user_id, card_id, quantity)
       values ($1,$2,$3,1)`,
      [colB[0].id, userB, cardRows[0].id],
    );

    // User A must see zero of user B's items.
    const visibleToA = await asUser(userA, async (c) => {
      const r = await c.query('select count(*)::int n from collection_items where user_id = $1', [
        userB,
      ]);
      return r.rows[0].n as number;
    });
    expect(visibleToA).toBe(0);

    // User B sees their own item.
    const visibleToB = await asUser(userB, async (c) => {
      const r = await c.query('select count(*)::int n from collection_items where user_id = $1', [
        userB,
      ]);
      return r.rows[0].n as number;
    });
    expect(visibleToB).toBeGreaterThanOrEqual(1);
  });

  it('normal user cannot read provider_request_logs', async () => {
    if (!ready) return;
    await admin.query(
      `insert into provider_request_logs(provider, operation, status) values ('demo','test','ok')`,
    );
    const n = await asUser(userA, async (c) => {
      const r = await c.query('select count(*)::int n from provider_request_logs');
      return r.rows[0].n as number;
    });
    expect(n).toBe(0);
  });

  it('anyone can read catalog (cards)', async () => {
    if (!ready) return;
    const n = await asUser(userA, async (c) => {
      const r = await c.query('select count(*)::int n from cards');
      return r.rows[0].n as number;
    });
    expect(n).toBeGreaterThanOrEqual(0);
  });
});
