/**
 * Pure schema invariants — no database required. These parse the migration SQL
 * as text and assert critical security/correctness properties. They MUST pass in CI.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

function readMigration(prefix: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.startsWith(prefix));
  if (!file) throw new Error(`Migration starting with ${prefix} not found`);
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
}

const ALL_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n');

/** Collapse whitespace for tolerant substring matching. */
function squish(s: string): string {
  return s.replace(/\s+/g, ' ').toLowerCase();
}
/** Strip `-- ...` line comments so prose can't create false matches. */
function stripLineComments(s: string): string {
  return s
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}
const RLS_SQL = squish(readMigration('0011'));
const ALL = squish(ALL_SQL);
const ALL_CODE = squish(stripLineComments(ALL_SQL));
const RLS_CODE = squish(stripLineComments(readMigration('0011')));

// Tables owned by a user; each must have RLS enabled.
const USER_OWNED_TABLES = [
  'profiles',
  'subscriptions',
  'entitlements',
  'usage_periods',
  'collections',
  'collection_items',
  'user_tags',
  'collection_item_tags',
  'portfolio_snapshots',
  'scan_sessions',
  'scan_images',
  'recognition_candidates',
  'grade_reports',
  'grade_findings',
  'actual_grading_results',
  'grade_training_examples',
  'watchlist_items',
  'price_alerts',
  'notifications',
  'email_preferences',
  'saved_searches',
  'import_jobs',
  'export_jobs',
  'api_keys',
];

const CATALOG_TABLES = ['sets', 'cards', 'card_variants', 'price_points', 'currency_rates'];

// All tables that must have RLS enabled (owner + catalog + ops + deny-by-default).
const ALL_TABLES = [
  ...USER_OWNED_TABLES,
  ...CATALOG_TABLES,
  'admin_roles',
  'stripe_webhook_events',
  'external_id_mappings',
  'provider_request_logs',
  'provider_sync_runs',
  'background_jobs',
  'feature_flags',
  'audit_logs',
  'data_quality_issues',
];

describe('RLS is enabled on every table', () => {
  it.each(ALL_TABLES)('table %s has enable row level security', (table) => {
    expect(RLS_SQL).toContain(`alter table ${table} enable row level security`);
  });
});

describe('owner tables carry a user_id / id ownership policy', () => {
  it('every user-owned table (except profiles) is in the owner policy loop', () => {
    for (const table of USER_OWNED_TABLES) {
      if (table === 'profiles') continue;
      expect(RLS_SQL).toContain(`'${table}'`);
    }
  });

  it('profiles restricts select and update to id = auth.uid()', () => {
    expect(RLS_SQL).toContain('profiles_select_own');
    expect(RLS_SQL).toContain('profiles_update_own');
    expect(RLS_SQL).toContain('id = auth.uid()');
  });

  it('owner policy uses user_id = auth.uid()', () => {
    expect(RLS_SQL).toContain('user_id = auth.uid()');
  });
});

describe('catalog / market tables are world-readable', () => {
  it('has a public read policy mechanism', () => {
    expect(RLS_SQL).toContain('public_read');
    expect(RLS_SQL).toContain('to anon, authenticated');
  });

  it.each(CATALOG_TABLES)('catalog table %s is in the public read set', (table) => {
    expect(RLS_SQL).toContain(`'${table}'`);
  });
});

describe('provider_request_logs is NOT readable by normal users', () => {
  // Extract the contents of a `<name> text[] := array[ ... ]` literal.
  function arrayLiteral(name: string): string {
    const anchor = `${name} text[] := array[`;
    const start = RLS_CODE.indexOf(anchor);
    if (start === -1) return '';
    const contentStart = start + anchor.length;
    return RLS_CODE.slice(contentStart, RLS_CODE.indexOf(']', contentStart));
  }

  it('is not present in the public read set', () => {
    expect(arrayLiteral('public_read_tables')).not.toContain('provider_request_logs');
  });

  it('is admin-read only', () => {
    expect(arrayLiteral('admin_read_tables')).toContain('provider_request_logs');
    expect(RLS_CODE).toContain('is_admin()');
  });

  it('has no anon/authenticated select policy targeting it directly', () => {
    expect(RLS_SQL).not.toMatch(/provider_request_logs[^;]*for select to anon/);
  });
});

describe('is_admin helper exists', () => {
  it('defines function is_admin()', () => {
    expect(RLS_SQL).toContain('function is_admin()');
    expect(RLS_SQL).toContain('admin_roles');
  });
});

describe('price_points duplicate-prevention unique index', () => {
  const sql = squish(readMigration('0007'));
  it('has the daily uniqueness index', () => {
    expect(sql).toContain('uq_price_points_daily');
    expect(sql).toContain('unique index');
  });
  it('uses coalesce sentinels so NULL dimensions still dedupe', () => {
    // Extract the uq_price_points_daily index definition body.
    const start = sql.indexOf('uq_price_points_daily');
    const body = sql.slice(start, sql.indexOf(';', start));
    expect(body).toContain('coalesce(card_variant_id');
    // enum dimensions wrapped for immutability but still coalesced with a sentinel.
    expect(body).toContain('coalesce(immutable_enum_label(condition)');
    expect(body).toContain('coalesce(immutable_enum_label(grading_company)');
    expect(body).toContain('coalesce(grade');
    expect(body).toContain('recorded_for_date');
  });
});

describe('external_id_mappings uniqueness', () => {
  const sql = squish(readMigration('0005'));
  it('is unique on (provider, entity_type, external_id)', () => {
    expect(sql).toContain('unique (provider, entity_type, external_id)');
  });
});

describe('money columns are integer minor units', () => {
  const MONEY_COLUMNS = [
    'purchase_price_minor',
    'estimated_value_minor',
    'value_minor',
    'low_value_minor',
    'high_value_minor',
    'total_market_value_minor',
    'total_cost_basis_minor',
    'unrealized_gain_minor',
  ];
  it.each(MONEY_COLUMNS)('%s is declared integer', (col) => {
    // Match "<col> integer" (integer starts with "int"), tolerant of whitespace.
    const re = new RegExp(`${col}\\s+integer`, 'i');
    expect(ALL).toMatch(re);
  });

  it('no money minor column is declared as a float/numeric/real/double', () => {
    const badMoney = /_minor\s+(numeric|real|double|float|money)/i;
    expect(ALL).not.toMatch(badMoney);
  });
});

describe('security definer is used safely', () => {
  it('every security definer function pins search_path', () => {
    // Operate on comment-stripped SQL so prose mentions don't count. Each real
    // "security definer" clause must be immediately followed by "set search_path".
    const idxs: number[] = [];
    let from = 0;
    while (true) {
      const i = ALL_CODE.indexOf('security definer', from);
      if (i === -1) break;
      idxs.push(i);
      from = i + 1;
    }
    expect(idxs.length).toBeGreaterThan(0);
    for (const i of idxs) {
      const after = ALL_CODE.slice(i, i + 80);
      expect(after).toContain('set search_path');
    }
  });
});

describe('updated_at trigger helper and usage', () => {
  it('defines set_updated_at()', () => {
    expect(squish(readMigration('0001'))).toContain('function set_updated_at()');
  });
  it('attaches before update triggers', () => {
    expect(ALL).toContain('before update on profiles');
    expect(ALL).toContain('execute function set_updated_at()');
  });
});

describe('new-user provisioning trigger', () => {
  const sql = squish(readMigration('0003'));
  it('defines handle_new_user and an auth.users trigger', () => {
    expect(sql).toContain('function handle_new_user()');
    expect(sql).toContain('after insert on auth.users');
  });
  it('provisions profile, entitlements, and default collection', () => {
    expect(sql).toContain('insert into public.profiles');
    expect(sql).toContain('insert into public.entitlements');
    expect(sql).toContain('insert into public.collections');
  });
});

describe('all enum types are created', () => {
  const sql = squish(readMigration('0002'));
  const ENUMS = [
    'subscription_status',
    'plan_tier',
    'ownership_type',
    'grading_company',
    'raw_condition',
    'card_finish',
    'scan_type',
    'scan_status',
    'capture_type',
    'alert_direction',
    'alert_cadence',
    'notification_type',
    'valuation_type',
    'collection_visibility',
    'job_status',
    'data_quality_severity',
    'submission_recommendation',
  ];
  it.each(ENUMS)('creates enum %s', (e) => {
    expect(sql).toContain(`create type ${e} as enum`);
  });
});

describe('extensions', () => {
  const sql = squish(readMigration('0001'));
  it.each(['pgcrypto', 'citext', 'pg_trgm', 'vector'])('enables %s', (ext) => {
    expect(sql).toContain(`create extension if not exists ${ext}`);
  });
});
