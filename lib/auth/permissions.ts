export const roles = ['buyer', 'seller', 'content_moderator', 'finance_operator', 'support_operator', 'super_admin'] as const;
export type Role = (typeof roles)[number];
export type Actor = { id: string; displayName: string; email: string; status: string; roles: Role[] };
export const adminRoles: readonly Role[] = ['content_moderator', 'finance_operator', 'support_operator', 'super_admin'];

export class AccessError extends Error {
  constructor(public status: 401 | 403 | 400 | 404 | 409 | 413 | 415 | 503, message: string) {
    super(message);
  }
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roles.some((role) => role === value);
}

export function requireActive(actor: Actor | null): Actor {
  if (!actor) throw new AccessError(401, 'Vui lòng đăng nhập để tiếp tục.');
  if (actor.status !== 'active') throw new AccessError(403, 'Tài khoản hiện không được phép thực hiện thao tác này.');
  return actor;
}

export function requireRoles(actor: Actor | null, allowed: readonly Role[]): Actor {
  const active = requireActive(actor);
  if (!allowed.some((role) => active.roles.includes(role))) {
    throw new AccessError(403, 'Bạn không có quyền thực hiện thao tác này.');
  }
  return active;
}

// Call with an owner ID read from the resource in the database, never from request input.
export function requireOwner(actor: Actor | null, ownerId: string): Actor {
  const active = requireActive(actor);
  if (active.id !== ownerId) throw new AccessError(403, 'Bạn không có quyền truy cập tài nguyên này.');
  return active;
}

export function requireRoleGrant(actor: Actor | null, targetId: string, role: unknown): Role {
  const active = requireRoles(actor, ['super_admin']);
  if (active.id === targetId) throw new AccessError(403, 'Không được tự thay đổi vai trò của chính mình.');
  if (!isRole(role)) throw new AccessError(400, 'Vai trò không hợp lệ.');
  return role;
}
