import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const files = [
  'migrations/0000_initial.sql',
  'migrations/0001_hardening.sql',
  'migrations/0002_ledger_concurrency_hardening.sql',
  'migrations/0003_ledger_reversal_transactions.sql',
  'manual-migrations/0004_better_auth.sql',
  'migrations/0004_default_buyer_role.sql',
  'migrations/0005_seller_onboarding.sql',
  'migrations/0006_project_listing_workflow.sql',
  'migrations/0007_dispute_casework.sql',
  'migrations/0008_dispute_resolution_event.sql',
  'migrations/0009_seller_payout_workflow.sql',
  'migrations/0010_cms_publication.sql',
  'migrations/0011_notification_email.sql',
  'migrations/0012_project_watch.sql',
];

class BootstrapError extends Error {}

export function stagingTarget(env) {
  const mode = env.STAGING_BOOTSTRAP;
  if (!mode) return null;
  if (!['check', 'apply'].includes(mode)) throw new BootstrapError('STAGING_BOOTSTRAP phải là check hoặc apply.');
  if (env.CONSTRUCTION_AUTH_TEST === '1') throw new BootstrapError('Không dùng chế độ kiểm thử cục bộ trên Vibe Host.');
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new BootstrapError('DATABASE_URL chưa hợp lệ.'); }
  const database = env.STAGING_BOOTSTRAP_DB;
  const host = env.STAGING_BOOTSTRAP_HOST;
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !/^vays-db-[a-z0-9-]+-postgresql-\d+$/.test(host ?? '')
    || url.hostname !== host
    || !/^[a-zA-Z0-9_-]+$/.test(database ?? '')
    || decodeURIComponent(url.pathname.slice(1)) !== database
    || !database || database === 'construction_marketplace_migration_test'
    || [...url.searchParams.keys()].some(key => !['sslmode'].includes(key))) {
    throw new BootstrapError('Đích không khớp host nội bộ và tên database staging đã khai báo.');
  }
  return { mode, database, connectionString: env.DATABASE_URL };
}

function migrationPlan() {
  const digest = createHash('sha256');
  const plan = files.map(file => {
    let source = readFileSync(new URL('../db/' + file, import.meta.url), 'utf8')
      .replace(/^\uFEFF/, '')
      .replaceAll('\r\n', '\n');
    digest.update(file + '\n' + source + '\n');
    if (file.startsWith('manual-migrations/')) {
      if (!/^BEGIN;$/m.test(source) || !/\nCOMMIT;\s*$/.test(source)) throw new BootstrapError('Bọc giao dịch của SQL Better Auth đã thay đổi.');
      source = source.replace(/^BEGIN;$/m, '').replace(/\nCOMMIT;\s*$/, '');
    }
    if (/^\s*(?:BEGIN|COMMIT|ROLLBACK|START TRANSACTION);\s*$/im.test(source)) {
      throw new BootstrapError('Phát hiện lệnh giao dịch riêng trong ' + file + '.');
    }
    return { file, source };
  });
  return { plan, fingerprint: digest.digest('hex') };
}

async function assertSchema(client) {
  const required = ['users', 'user_roles', 'session', 'account', 'verification', 'projects', 'system_settings',
    'ledger_transactions', 'project_versions', 'dispute_case_events', 'withdrawal_allocations', 'cms_contents',
    'notification_email_deliveries', 'project_watch_periods'];
  const { rows } = await client.query(
    'SELECT name FROM unnest($1::text[]) AS name WHERE to_regclass(\'public.\' || name) IS NULL', [required],
  );
  if (rows.length) throw new BootstrapError('Thiếu bảng sau khi kiểm tra: ' + rows.map(row => row.name).join(', '));
  const { rowCount } = await client.query(`SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.users'::regclass AND tgname='trg_users_default_buyer_role' AND tgenabled='O'`);
  if (rowCount !== 1) throw new BootstrapError('Thiếu trigger gán vai trò người mua.');
}

export async function bootstrapStaging(client, { mode, database }, report = console.log) {
  if (!['check', 'apply'].includes(mode)) throw new BootstrapError('Chế độ khởi tạo không hợp lệ.');
  const { plan, fingerprint } = migrationPlan();
  let step = 'kiểm tra đích';
  await client.query(mode === 'check' ? 'BEGIN READ ONLY' : 'BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SET LOCAL search_path=public,pg_catalog");
    const { rows: [target] } = await client.query('SELECT current_database() AS name');
    if (target.name !== database) throw new BootstrapError('PostgreSQL đang kết nối đến database khác.');
    if (mode === 'apply') await client.query('SELECT pg_advisory_xact_lock(671280391)');
    const { rows: [marker] } = await client.query("SELECT to_regclass('public.staging_schema_bootstrap') IS NOT NULL AS present");
    if (marker.present) {
      const { rows } = await client.query('SELECT fingerprint FROM public.staging_schema_bootstrap');
      if (rows.length !== 1 || rows[0].fingerprint !== fingerprint) throw new BootstrapError('Dấu khởi tạo không khớp bộ SQL hiện tại.');
      await assertSchema(client);
      await client.query('COMMIT');
      report('[staging-bootstrap] READY: cơ sở dữ liệu đã khởi tạo, không chạy lại SQL.');
      return;
    }
    const { rows: [existing] } = await client.query(`SELECT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
      UNION ALL
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typtype IN ('e','d')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')
      UNION ALL
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
    ) AS present`);
    if (existing.present) throw new BootstrapError('Schema public đã có đối tượng nhưng chưa có dấu khởi tạo. Cần rà soát riêng.');
    if (mode === 'check') {
      await client.query('COMMIT');
      report('[staging-bootstrap] EMPTY: đúng database, schema public rỗng. Chưa ghi dữ liệu.');
      return;
    }
    for (const { file, source } of plan) {
      step = file;
      await client.query(source);
      report('[staging-bootstrap] Đã kiểm tra SQL trong giao dịch: ' + file);
    }
    step = 'xác nhận cấu trúc';
    await assertSchema(client);
    await client.query('CREATE TABLE public.staging_schema_bootstrap (fingerprint text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    await client.query('INSERT INTO public.staging_schema_bootstrap(fingerprint) VALUES ($1)', [fingerprint]);
    await client.query('COMMIT');
    report('[staging-bootstrap] APPLIED: đã khởi tạo schema staging.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof BootstrapError) throw error;
    const code = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'UNKNOWN';
    throw new BootstrapError(`Thất bại ở ${step} (mã ${code}); kiểm tra trạng thái bằng chế độ check trước khi thử lại.`);
  }
}

async function runFromEnvironment() {
  const target = stagingTarget(process.env);
  if (!target) return;
  const client = new pg.Client({ connectionString: target.connectionString, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await bootstrapStaging(client, target);
  } finally {
    await client.end().catch(() => {});
  }
}

let startup;
export function runStagingBootstrap() {
  startup ??= runFromEnvironment().catch(error => {
    const code = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'UNKNOWN';
    throw new BootstrapError(error instanceof BootstrapError ? error.message : `Không thể kiểm tra PostgreSQL (mã ${code}).`);
  });
  return startup;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runStagingBootstrap().catch(error => {
    console.error('[staging-bootstrap] ' + error.message);
    process.exitCode = 1;
  });
}
