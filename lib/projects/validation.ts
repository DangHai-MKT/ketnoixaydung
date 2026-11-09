import { AccessError } from '../auth/permissions';
import { objectInput, revisionInput, uuidInput } from '../seller/validation';
import { privateLabels, type ReviewAction } from './workflow';
import {categoryLabels} from './workflow';
import {projectPrivacyIssues} from './privacy';
import {templateIssues} from './quick-create';
import {projectParticipants, type ProjectParticipant} from './participants';
export { objectInput, revisionInput, uuidInput };
export type ProjectInput = { title: string; category: string; provinceCode: string | null; districtName: string | null; projectStage: string | null;
  sizeMinSqm: string | null; sizeMaxSqm: string | null; publicSummary: string; publicData: { constructionType: string; technicalSummary: string; scopeSummary: string };
  pricePoints: bigint; privateData: Record<string, string | ProjectParticipant[]>; rightsConfirmed: boolean; rightsDeclaration: string };
const pgMax = 9223372036854775807n;
export function priceInput(value: unknown, configured = process.env.PROJECT_MAX_PRICE_POINTS || '1000000000'): bigint {
  if (!/^[1-9][0-9]{0,18}$/.test(configured) || BigInt(configured) > pgMax) throw new AccessError(503, 'Cấu hình giới hạn giá không hợp lệ.');
  if (typeof value !== 'string' || !/^[0-9]{1,19}$/.test(value)) throw new AccessError(400, 'Giá phải là số điểm nguyên dương, không dùng dấu phân cách hoặc số mũ.');
  const price = BigInt(value);
  if (price < 1n || price > pgMax || price > BigInt(configured)) throw new AccessError(400, `Giá phải từ 1 đến ${BigInt(configured).toLocaleString('vi-VN')} POINT.`);
  return price;
}
function text(body: Record<string, unknown>, key: string, max: number): string {
  const value = body[key] ?? '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new AccessError(400, 'Nội dung không hợp lệ hoặc vượt độ dài cho phép.');
  return value.trim();
}
function area(value: unknown): string | null {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^[0-9]{1,12}(\.[0-9]{1,2})?$/.test(value)) throw new AccessError(400, 'Diện tích phải là số không âm, tối đa hai chữ số thập phân.');
  return value;
}
const scaled = (value: string) => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')); };
export function projectInput(value: unknown): ProjectInput {
  const body = objectInput(value);
  const allowed = ['requestId', 'revision', 'versionId', 'title', 'category', 'provinceCode', 'districtName', 'projectStage', 'sizeMinSqm', 'sizeMaxSqm', 'publicSummary', 'publicData', 'pricePoints', 'privateData', 'rightsConfirmed', 'rightsDeclaration'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new AccessError(400, 'Dữ liệu chứa trường không được phép thay đổi.');
  const title = text(body, 'title', 300), category = text(body, 'category', 100);
  if (!title || !category) throw new AccessError(400, 'Vui lòng nhập tên và danh mục dự án trước khi lưu nháp.');
  if(!Object.hasOwn(categoryLabels,category))throw new AccessError(400,'Chọn danh mục dự án trong danh sách được hỗ trợ.');
  const publicData = objectInput(body.publicData ?? {});
  if (Object.keys(publicData).some((key) => !['constructionType', 'technicalSummary', 'scopeSummary'].includes(key))) throw new AccessError(400, 'Thông tin công khai chứa trường không được phép.');
  const privateData = objectInput(body.privateData ?? {});
  if (Object.keys(privateData).some((key) => key !== 'participants' && !Object.hasOwn(privateLabels, key))) throw new AccessError(400, 'Thông tin bảo vệ chứa trường không được hỗ trợ.');
  const participants = projectParticipants(privateData.participants);
  const protectedFields: Record<string, string> = {};
  for (const key of Object.keys(privateLabels)) protectedFields[key] = text(privateData, key, key.endsWith('Notes') ? 5000 : 500);
  if (protectedFields.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(protectedFields.contactEmail)) throw new AccessError(400, 'Email liên hệ trong phần bảo vệ không hợp lệ.');
  if (body.rightsConfirmed !== undefined && typeof body.rightsConfirmed !== 'boolean') throw new AccessError(400, 'Xác nhận quyền cung cấp dữ liệu không hợp lệ.');
  const sizeMinSqm = area(body.sizeMinSqm), sizeMaxSqm = area(body.sizeMaxSqm);
  if (sizeMinSqm && sizeMaxSqm && scaled(sizeMinSqm) > scaled(sizeMaxSqm)) throw new AccessError(400, 'Diện tích tối đa phải lớn hơn hoặc bằng tối thiểu.');
  return { title, category, provinceCode: text(body, 'provinceCode', 20) || null, districtName: text(body, 'districtName', 120) || null,
    projectStage: text(body, 'projectStage', 80) || null, sizeMinSqm, sizeMaxSqm, publicSummary: text(body, 'publicSummary', 5000),
    publicData: { constructionType: text(publicData, 'constructionType', 120), technicalSummary: text(publicData, 'technicalSummary', 3000), scopeSummary: text(publicData, 'scopeSummary', 240) },
    pricePoints: priceInput(body.pricePoints), privateData: { ...protectedFields, ...(Object.hasOwn(privateData, 'participants') ? { participants } : {}) }, rightsConfirmed: body.rightsConfirmed === true, rightsDeclaration: text(body, 'rightsDeclaration', 1000) };
}
export function autoCheck(input: ProjectInput, files: { accessLevel: string; mimeType: string; checksumSha256: string | null }[]): string[] {
  const errors: string[] = [];
  errors.push(...projectPrivacyIssues(input,input.privateData));
  errors.push(...templateIssues([input.title,input.publicSummary,input.publicData.constructionType,input.publicData.technicalSummary,input.publicData.scopeSummary]));
  if (input.title.length < 5) errors.push('Tên dự án cần tối thiểu 5 ký tự.');
  if (input.publicSummary.length < 20) errors.push('Mô tả công khai cần tối thiểu 20 ký tự.');
  if (!input.provinceCode) errors.push('Cần bổ sung tỉnh/thành.');
  if (!input.projectStage) errors.push('Cần bổ sung giai đoạn dự án.');
  if (!Object.entries(input.privateData).some(([key, field]) => key !== 'projectReference' && key !== 'packageScope' && (typeof field === 'string' ? field.trim() : field.length))) errors.push('Cần có thông tin bảo vệ có giá trị cho người mua.');
  if (!input.rightsConfirmed || !input.rightsDeclaration) errors.push('Cần xác nhận và khai báo quyền cung cấp thông tin/tài liệu.');
  if (files.some((file) => file.mimeType !== 'image/png' || !file.checksumSha256 || !['public_preview', 'purchased_only', 'moderator_only'].includes(file.accessLevel))) errors.push('Một số tệp chưa đạt kiểm tra định dạng hoặc mức truy cập.');
  return errors;
}
export function versionCommand(value: unknown): { revision: number; versionId: string } {
  const body = objectInput(value);
  if (Object.keys(body).some((key) => !['revision', 'versionId'].includes(key))) throw new AccessError(400, 'Yêu cầu chứa trường không được phép.');
  return { revision: revisionInput(body.revision), versionId: uuidInput(String(body.versionId)) };
}
export function reviewCommand(value: unknown) {
  const body = objectInput(value);
  if (Object.keys(body).some((key) => !['revision', 'versionId', 'action', 'reason'].includes(key))) throw new AccessError(400, 'Yêu cầu kiểm duyệt không hợp lệ.');
  if (!['approve', 'reject', 'request_changes', 'suspend', 'restore'].includes(String(body.action))) throw new AccessError(400, 'Quyết định không hợp lệ.');
  const reason = text(body, 'reason', 1000);
  if (!reason) throw new AccessError(400, 'Vui lòng ghi lý do cho quyết định kiểm duyệt.');
  return { revision: revisionInput(body.revision), versionId: uuidInput(String(body.versionId)), action: body.action as ReviewAction, reason };
}
