import { AccessError } from '../auth/permissions';
import { documentTypes, type DocumentType, type ReviewAction } from './workflow';

export type ApplicationInput = {
  sellerType: 'individual' | 'business'; legalName: string;
  businessRegistrationNo: string | null; taxCode: string | null;
  contactPhone: string | null; contactEmail: string | null; contactAddress: string | null;
  authorizedRepresentative: string | null;
};
export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError(400, 'Dữ liệu không hợp lệ.');
  return value as Record<string, unknown>;
}
function text(body: Record<string, unknown>, key: string, max: number): string {
  const value = body[key] ?? '';
  if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new AccessError(400, 'Thông tin nhập không hợp lệ hoặc vượt quá độ dài cho phép.');
  }
  return value.trim();
}
export function applicationInput(value: unknown): ApplicationInput {
  const body = objectInput(value);
  const keys = ['revision', 'sellerType', 'legalName', 'businessRegistrationNo', 'taxCode', 'contactPhone', 'contactEmail', 'contactAddress', 'authorizedRepresentative'];
  if (Object.keys(body).some((key) => !keys.includes(key))) throw new AccessError(400, 'Hồ sơ chứa trường không được phép thay đổi.');
  if (body.sellerType !== 'individual' && body.sellerType !== 'business') throw new AccessError(400, 'Vui lòng chọn loại người bán.');
  const legalName = text(body, 'legalName', 300);
  if (!legalName) throw new AccessError(400, 'Vui lòng nhập họ tên hoặc tên pháp lý doanh nghiệp.');
  const email = text(body, 'contactEmail', 320).toLowerCase();
  const phone = text(body, 'contactPhone', 40);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccessError(400, 'Email liên hệ không hợp lệ.');
  if (phone && !/^\+?[0-9 ()-]{8,40}$/.test(phone)) throw new AccessError(400, 'Số điện thoại liên hệ không hợp lệ.');
  return {
    sellerType: body.sellerType, legalName,
    businessRegistrationNo: body.sellerType === 'business' ? text(body, 'businessRegistrationNo', 100) || null : null,
    taxCode: body.sellerType === 'business' ? text(body, 'taxCode', 100) || null : null,
    contactPhone: phone || null, contactEmail: email || null,
    contactAddress: text(body, 'contactAddress', 500) || null,
    authorizedRepresentative: body.sellerType === 'business' ? text(body, 'authorizedRepresentative', 200) || null : null,
  };
}
export function missingInformation(profile: ApplicationInput, types: string[]): string[] {
  const missing: string[] = [];
  if (!profile.legalName.trim()) missing.push('Họ tên / tên pháp lý');
  if (!profile.contactPhone) missing.push('Số điện thoại liên hệ');
  if (!profile.contactEmail) missing.push('Email liên hệ');
  if (!profile.contactAddress) missing.push('Địa chỉ liên hệ');
  if (profile.sellerType === 'business') {
    if (!profile.businessRegistrationNo && !profile.taxCode) missing.push('Mã đăng ký doanh nghiệp hoặc mã số thuế');
    if (!profile.authorizedRepresentative) missing.push('Người đại diện');
    if (!types.includes('business_registration')) missing.push('Ảnh đăng ký doanh nghiệp / mã số thuế');
  } else if (!types.includes('identity')) missing.push('Tài liệu xác minh cá nhân');
  return missing;
}
export function revisionInput(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 2_000_000_000) throw new AccessError(400, 'Phiên bản hồ sơ không hợp lệ.');
  return value as number;
}
export function uuidInput(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new AccessError(400, 'Mã hồ sơ hoặc tài liệu không hợp lệ.');
  return value.toLowerCase();
}
export function documentTypeInput(value: unknown): DocumentType {
  if (!documentTypes.some((type) => type === value)) throw new AccessError(400, 'Loại tài liệu không hợp lệ.');
  return value as DocumentType;
}
export function reviewInput(value: unknown): { action: ReviewAction; revision: number; reason: string } {
  const body = objectInput(value);
  if (Object.keys(body).some((key) => !['action', 'revision', 'reason'].includes(key))) throw new AccessError(400, 'Yêu cầu chứa trường không được phép.');
  if (!['approve', 'reject', 'request_changes', 'suspend'].includes(String(body.action))) throw new AccessError(400, 'Quyết định không hợp lệ.');
  const reason = text(body, 'reason', 1000);
  if (body.action !== 'approve' && !reason) throw new AccessError(400, 'Vui lòng ghi lý do hoặc thông tin cần bổ sung.');
  return { action: body.action as ReviewAction, reason, revision: revisionInput(body.revision) };
}
