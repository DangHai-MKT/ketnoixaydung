import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '../../auth';
import { db } from '../../db/client';
import { users, userRoles } from '../../db/schema';
import { AccessError, isRole, requireActive, requireRoles, type Actor, type Role } from './permissions';
import { safeErrorCode } from './error-diagnostics';
import { isSameOrigin } from './request-origin';
import { randomUUID } from 'node:crypto';

// No cross-request caching: current status and roles are read for every protected request.
export async function getCurrentActor(requestHeaders?: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: requestHeaders ?? await headers() });
  if (!session) return null;
  const [user] = await db.select({ id: users.id, displayName: users.displayName, email: users.email, status: users.status })
    .from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) return null;
  const grants = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
  return { ...user, roles: grants.map((grant) => grant.role).filter(isRole) };
}

export async function requireApiActor(request: Request, allowed?: readonly Role[]): Promise<Actor> {
  const actor = await getCurrentActor(request.headers);
  return allowed ? requireRoles(actor, allowed) : requireActive(actor);
}

export async function requirePageActor(path: string, allowed?: readonly Role[]): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect(`/login?next=${encodeURIComponent(path)}`);
  try { return allowed ? requireRoles(actor, allowed) : requireActive(actor); }
  catch (error) {
    if (error instanceof AccessError) redirect('/access-denied');
    throw error;
  }
}

export function accessErrorResponse(error: unknown): Response {
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  const reference = randomUUID();
  const code = safeErrorCode(error);
  console.error('Account request failed', { reference, code });
  return Response.json({ error: `Không thể xử lý yêu cầu lúc này. Mã tra cứu: ${reference}.`, reference },
    { status: 500, headers: { 'Cache-Control': 'no-store' } });
}

export function requireSameOrigin(request: Request): void {
  if (!isSameOrigin(request)) {
    throw new AccessError(403, 'Nguồn yêu cầu không hợp lệ.');
  }
}
