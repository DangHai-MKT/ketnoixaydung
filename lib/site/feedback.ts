import { AccessError } from '../auth/permissions';
import { uuidInput } from '../seller/validation';

export const feedbackRoles = ['support_operator', 'super_admin'] as const;
export const feedbackTopics = {
  general: 'Trải nghiệm chung',
  search: 'Tìm kiếm dự án',
  purchase: 'Mua thông tin và ví POINT',
  seller: 'Đăng tin và bán thông tin',
  display: 'Giao diện và tốc độ',
} as const;
export const feedbackRatings = ['Rất khó dùng', 'Khó dùng', 'Bình thường', 'Dễ dùng', 'Rất dễ dùng'];

export function feedbackInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError(400, 'Phản hồi không hợp lệ.');
  const body = value as Record<string, unknown>;
  const { rating, topic, comment, requestId } = body;
  if (Object.keys(body).some(key => !['rating', 'topic', 'comment', 'requestId'].includes(key))
    || typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5
    || typeof topic !== 'string' || !Object.hasOwn(feedbackTopics, topic)
    || typeof comment !== 'string' || comment.length > 800 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(comment)
    || typeof requestId !== 'string') throw new AccessError(400, 'Chọn mức đánh giá từ 1 đến 5 và nhập tối đa 800 ký tự.');
  return { rating, topic, comment: comment.trim(), requestId: uuidInput(requestId) };
}
