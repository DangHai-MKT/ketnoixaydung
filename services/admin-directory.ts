import 'server-only';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { userRoles, users, sellerProfiles } from '../db/schema';
import { isRole, requireRoles, type Actor } from '../lib/auth/permissions';
import { AdminReportInputError } from '../lib/dashboard/admin-report';
export async function getAdminDirectory(actor: Actor, params: Record<string, string | string[] | undefined>) {
  requireRoles(actor, ['super_admin']);
  for (const key of ['role', 'q', 'page', 'status']) if (Array.isArray(params[key])) throw new AdminReportInputError('Bộ lọc người dùng không hợp lệ.');
  const state = String(params.status || '');
  if(state && !['active','suspended','closed'].includes(state)) throw new AdminReportInputError('Trạng thái không hợp lệ.');
  const role = String(params.role || ''), q = String(params.q || '').trim(), page = Number(params.page || 1);
  if ((role && !isRole(role)) || q.length > 80 || !Number.isSafeInteger(page) || page < 1 || page > 10000) throw new AdminReportInputError('Bộ lọc người dùng không hợp lệ.');
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const where = and(state ? eq(users.status,state as 'active'|'suspended'|'closed') : undefined, role ? sql`EXISTS(SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = ${users.id} AND ${userRoles.role} = ${role})` : undefined,
    q ? or(ilike(users.displayName, pattern), ilike(users.email, pattern), sql`${users.id}::text ILIKE ${pattern}`) : undefined);
  const [rows, totals] = await Promise.all([
    db.select({ id: users.id, name: users.displayName, email: users.email, status: users.status, createdAt: users.createdAt, emailVerified:users.emailVerified,lastLoginAt:users.lastLoginAt, sellerStatus:sql<string | null>`(SELECT sp.verification_status FROM seller_profiles sp WHERE sp.user_id = "users"."id")`,
      roles: sql<string[]>`COALESCE((SELECT array_agg(ur.role ORDER BY ur.role) FROM user_roles ur WHERE ur.user_id = "users"."id"),ARRAY[]::varchar[])` })
      .from(users).where(where).orderBy(desc(users.createdAt), desc(users.id)).limit(20).offset((page - 1) * 20),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return { rows, total: totals[0].n, page, role, q, state };
}


