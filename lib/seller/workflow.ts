import { AccessError, requireRoles, type Actor } from '../auth/permissions';

export const sellerReviewRoles = ['content_moderator', 'super_admin'] as const;
export const documentTypes = ['identity', 'business_registration', 'authorization', 'supporting'] as const;
export type DocumentType = (typeof documentTypes)[number];
export type ApplicationState = 'draft' | 'pending' | 'needs_changes' | 'verified' | 'rejected' | 'suspended';
export type ReviewAction = 'approve' | 'reject' | 'request_changes' | 'suspend';

export function applicationState(profile: { verificationStatus: string; correctionRequestedAt: Date | string | null }): ApplicationState {
  if (profile.verificationStatus === 'unverified') return profile.correctionRequestedAt ? 'needs_changes' : 'draft';
  return profile.verificationStatus as ApplicationState;
}

export const stateLabels: Record<ApplicationState, string> = {
  draft: 'Bản nháp', pending: 'Chờ xét duyệt', needs_changes: 'Cần bổ sung',
  verified: 'Đã xác minh', rejected: 'Bị từ chối', suspended: 'Bị tạm đình chỉ',
};
export const documentLabels: Record<DocumentType, string> = {
  identity: 'Tài liệu xác minh cá nhân', business_registration: 'Đăng ký doanh nghiệp / mã số thuế',
  authorization: 'Tài liệu đại diện / ủy quyền', supporting: 'Tài liệu bổ sung',
};
export function editable(state: ApplicationState): boolean {
  return ['draft', 'needs_changes', 'rejected'].includes(state);
}
export function assertEditable(state: ApplicationState): void {
  if (!editable(state)) throw new AccessError(409, 'Hồ sơ hiện không cho phép chỉnh sửa hoặc thay tài liệu.');
}
export function assertRevision(actual: number, expected: number): void {
  if (actual !== expected) throw new AccessError(409, 'Hồ sơ đã thay đổi. Vui lòng tải lại trước khi tiếp tục.');
}
export function assertReview(actor: Actor, ownerId: string, state: ApplicationState, action: ReviewAction): void {
  requireRoles(actor, sellerReviewRoles);
  if (actor.id === ownerId) throw new AccessError(403, 'Không được xét duyệt hồ sơ của chính mình.');
  const allowed = action === 'suspend' ? state === 'verified'
    : action === 'request_changes' ? state === 'pending' || state === 'suspended'
      : state === 'pending';
  if (!allowed) throw new AccessError(409, 'Quyết định không phù hợp với trạng thái hồ sơ hiện tại.');
}
export function isVerifiedSeller(actor: Actor, profile: { verificationStatus: string } | null): boolean {
  return actor.status === 'active' && actor.roles.includes('seller') && profile?.verificationStatus === 'verified';
}
