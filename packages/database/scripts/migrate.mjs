#!/usr/bin/env node
/**
 * Applies every SQL file in packages/database/migrations in sorted order using
 * the `pg` client. Each file is run inside its own transaction. A lightweight
 * schema_migrations ledger records applied files so re-runs are cheap.
 *
 * Usage: DATABASE_URL=postgres://... node scripts/migrate.mjs [--force]
 *   --force  re-apply all migrations even if already recorded (files are written
 *            to be re-runnable, so this is safe).
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const DATABASE_URL = process.env.DATABASE_URL;
const FORCE = process.argv.includes('--force');

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

async function main() {
  const entries = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (entries.length === 0) {
    console.error(`No .sql migrations found in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename    text primary key,
        applied_at  timestamptz not null default now()
      );
    `);

    const { rows } = await client.query('select filename from schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    for (const file of entries) {
      if (applied.has(file) && !FORCE) {
        console.log(`• skip   ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`→ apply  ${file} ... `);
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query(
          'insert into schema_migrations(filename) values ($1) on conflict (filename) do update set applied_at = now()',
          [file],
        );
        await client.query('commit');
        console.log('ok');
      } catch (err) {
        await client.query('rollback');
        console.log('FAILED');
        console.error(err);
        process.exit(1);
      }
    }

    console.log('\nAll migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
