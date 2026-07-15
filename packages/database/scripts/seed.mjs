#!/usr/bin/env node
/**
 * Seeds CLEARLY-LABELED DEMO catalog + pricing fixtures by executing seed/demo.sql.
 * Idempotent (fixed UUIDs + ON CONFLICT DO NOTHING). Does NOT insert into auth.users.
 *
 * Usage: DATABASE_URL=postgres://... node scripts/seed.mjs
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, '..', 'seed', 'demo.sql');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

async function main() {
  const sql = await readFile(SEED_FILE, 'utf8');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    console.log('Seeding DEMO data from seed/demo.sql ...');
    await client.query(sql);
    const { rows } = await client.query(
      "select count(*)::int as n from price_points where provider = 'demo'",
    );
    console.log(`Done. Demo price_points in DB: ${rows[0]?.n ?? 0}`);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
