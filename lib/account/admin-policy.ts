import { AccessError } from '../auth/permissions';
export function assertAdminContinuity(targetRoles: readonly string[], action: unknown, role: unknown, status: unknown, otherActiveAdmins: number) {
    if (targetRoles.includes('super_admin') && ((action === 'revoke' && role === 'super_admin') || (action === 'status' && status === 'suspended')) && otherActiveAdmins < 1)
        throw new AccessError(409, 'Phải giữ ít nhất một quản trị viên đang hoạt động.');
}
