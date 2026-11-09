import pg from 'pg';
import { stagingTarget } from './bootstrap-staging.mjs';

const action = 'user.role.staging_bootstrap';
class AdminBootstrapError extends Error {}

export async function bootstrapStagingAdmin(client, { mode, database, email }) {
  if (!['check', 'apply'].includes(mode)) throw new AdminBootstrapError('Chế độ cấp quyền không hợp lệ.');
  await client.query(mode === 'check' ? 'BEGIN READ ONLY' : 'BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s'");
    const { rows: [target] } = await client.query("SELECT current_database() AS name, to_regclass('public.staging_schema_bootstrap') IS NOT NULL AS initialized");
    if (target.name !== database || !target.initialized) {
      throw new AdminBootstrapError('Đích không phải cơ sở dữ liệu staging đã khởi tạo.');
    }
    if (mode === 'apply') await client.query('LOCK TABLE public.user_roles IN SHARE ROW EXCLUSIVE MODE');

    const { rows: [user] } = await client.query(
      `SELECT u.id, u.status, EXISTS (
        SELECT 1 FROM public.account a
        WHERE a.user_id=u.id AND a.provider_id='credential' AND NULLIF(a.password,'') IS NOT NULL
      ) AS credential FROM public.users u WHERE u.email=$1` + (mode === 'apply' ? ' FOR UPDATE OF u' : ''),
      [email],
    );
    if (!user || user.status !== 'active' || !user.credential) {
      throw new AdminBootstrapError('Cần tài khoản staging đang hoạt động và có mật khẩu đăng nhập.');
    }
    const { rows: [state] } = await client.query(`SELECT
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role='buyer') AS buyer,
      EXISTS (SELECT 1 FROM public.user_roles WHERE role='super_admin') AS has_admin,
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role='super_admin') AS target_admin,
      EXISTS (SELECT 1 FROM public.audit_logs WHERE action=$2) AS used,
      EXISTS (SELECT 1 FROM public.audit_logs WHERE action=$2 AND entity_id=$1) AS target_audited`, [user.id, action]);
    if (state.target_admin && state.target_audited) {
      await client.query('COMMIT');
      return 'READY: tài khoản đã được cấp quyền qua tác vụ này.';
    }
    if (state.has_admin || state.used) throw new AdminBootstrapError('Staging đã có super_admin hoặc tác vụ đã được sử dụng.');
    if (!state.buyer) throw new AdminBootstrapError('Tài khoản thiếu vai trò buyer.');
    if (mode === 'check') {
      await client.query('COMMIT');
      return 'ELIGIBLE: tài khoản đủ điều kiện. Chưa cấp quyền.';
    }

    await client.query("INSERT INTO public.user_roles(user_id, role) VALUES ($1, 'super_admin')", [user.id]);
    await client.query(`INSERT INTO public.audit_logs(action, entity_type, entity_id, reason, metadata)
      VALUES ($1, 'user', $2, 'Khởi tạo quản trị viên đầu tiên trên staging', '{"role":"super_admin"}'::jsonb)`, [action, user.id]);
    await client.query('COMMIT');
    return 'APPLIED: đã cấp super_admin và ghi nhật ký.';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function runFromEnvironment(env) {
  if (env.STAGING_BOOTSTRAP) throw new AdminBootstrapError('Tắt tác vụ khởi tạo schema trước khi cấp quyền.');
  const target = stagingTarget({
    ...env,
    STAGING_BOOTSTRAP: env.STAGING_ADMIN_BOOTSTRAP,
    STAGING_BOOTSTRAP_HOST: env.STAGING_ADMIN_HOST,
    STAGING_BOOTSTRAP_DB: env.STAGING_ADMIN_DB,
  });
  if (!target) return;
  const email = env.STAGING_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new AdminBootstrapError('STAGING_ADMIN_EMAIL chưa hợp lệ.');
  }
  const client = new pg.Client({ connectionString: target.connectionString, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    console.log('[staging-admin] ' + await bootstrapStagingAdmin(client, { ...target, email }));
  } finally {
    await client.end().catch(() => {});
  }
}

let startup;
export function runStagingAdminBootstrap() {
  startup ??= runFromEnvironment(process.env).catch(error => {
    const code = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'UNKNOWN';
    const message = error instanceof AdminBootstrapError ? error.message : `Kiểm tra hoặc cấp quyền thất bại (mã ${code}).`;
    throw new Error('[staging-admin] ' + message);
  });
  return startup;
}
