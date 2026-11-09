import { AccessError, requireRoles, type Actor } from '../auth/permissions';
export const projectReviewerRoles = ['content_moderator', 'super_admin'] as const;
export const categoryLabels: Record<string, string> = { civil: 'Dân dụng', industrial: 'Công nghiệp', infrastructure: 'Hạ tầng', energy: 'Năng lượng', commercial: 'Thương mại', agriculture: 'Nông nghiệp', healthcare: 'Y tế', education: 'Giáo dục', other: 'Khác' };
export const projectLabels: Record<string, string> = { draft: 'Bản nháp', pending_auto_check: 'Đang kiểm tra ban đầu', pending_review: 'Chờ kiểm duyệt', needs_correction: 'Cần chỉnh sửa', rejected: 'Bị từ chối', published: 'Đã duyệt', paused: 'Ngừng công bố', archived: 'Đã lưu trữ' };
export const privateLabels: Record<string, string> = { investorName: 'Chủ đầu tư', projectReference: 'Mã định danh công trình (nếu có)', packageScope: 'Hạng mục và phạm vi gói thông tin (nếu có)', contactPerson: 'Người liên hệ', contactPhone: 'Điện thoại liên hệ', contactEmail: 'Email liên hệ', exactLocation: 'Vị trí chính xác', procurementNotes: 'Thông tin mời thầu / mua sắm', technicalNotes: 'Tài liệu / thông tin kỹ thuật bảo vệ' };
export type ReviewAction = 'approve' | 'reject' | 'request_changes' | 'suspend' | 'restore';
export function assertProjectRevision(actual: number, expected: number) {
  if (actual !== expected) throw new AccessError(409, 'Dự án đã thay đổi. Hãy tải lại để tránh ghi đè phiên bản mới.');
}
export function assertDraft(version: { submittedAt: Date | null; approvedAt: Date | null; submissionStatus: string | null }) {
  if (version.submittedAt || version.approvedAt || version.submissionStatus !== 'draft') throw new AccessError(409, 'Chỉ chỉnh sửa bản nháp chưa gửi. Hãy tạo phiên bản đề xuất mới.');
}
export function assertProjectReviewer(actor: Actor, sellerId: string) {
  requireRoles(actor, projectReviewerRoles);
  if (actor.id === sellerId) throw new AccessError(403, 'Bạn không được tự kiểm duyệt dự án của mình.');
}
export function formatPoints(value: string | bigint): string { return BigInt(value).toLocaleString('vi-VN'); }
