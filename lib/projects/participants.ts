import { AccessError } from '../auth/permissions';

export const participantRoles = {
  investor: 'Chủ đầu tư', general_contractor: 'Tổng thầu thi công', main_contractor: 'Nhà thầu chính',
  construction_contractor: 'Nhà thầu thi công', subcontractor: 'Nhà thầu phụ', consultant: 'Đơn vị tư vấn',
  supervisor: 'Tư vấn giám sát', supplier: 'Nhà cung cấp', unknown: 'Chưa xác định vai trò',
} as const;
export const participantStatuses = {
  unverified: 'Chưa xác minh', tendering: 'Đang mời thầu', announced: 'Đã công bố kết quả lựa chọn',
} as const;
export const maxProjectParticipants = 8;
export const participantLimits = { name: 150, scope: 180, stage: 80, source: 240, checkedOn: 10, contact: 160 };
export type ProjectParticipant = {
  role: keyof typeof participantRoles; status: keyof typeof participantStatuses;
} & Record<keyof typeof participantLimits, string>;
export const protectedParticipantKeys = ['name', 'contact'] as const;

export function projectParticipants(value: unknown): ProjectParticipant[] {
  if (value === undefined) return [];
  const invalid = () => new AccessError(400, 'Danh sách đơn vị tham gia không hợp lệ hoặc vượt quá 8 thẻ.');
  if (!Array.isArray(value) || value.length > maxProjectParticipants) throw invalid();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid();
    const row = item as Record<string, unknown>;
    if (Object.keys(row).some(key => key !== 'role' && key !== 'status' && !Object.hasOwn(participantLimits, key))
      || typeof row.role !== 'string' || !Object.hasOwn(participantRoles, row.role)
      || typeof row.status !== 'string' || !Object.hasOwn(participantStatuses, row.status)) throw invalid();
    const fields = Object.fromEntries(Object.entries(participantLimits).map(([key, limit]) => {
      const field = row[key] ?? '';
      if (typeof field !== 'string' || field.length > limit || /[\u0000-\u001f\u007f]/.test(field)) throw invalid();
      return [key, field.trim()];
    })) as Record<keyof typeof participantLimits, string>;
    if (!fields.name) throw new AccessError(400, 'Nhập tên cho từng đơn vị tham gia.');
    if (fields.checkedOn) {
      const date = new Date(fields.checkedOn);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.checkedOn) || Number.isNaN(date.getTime())
        || date.toISOString().slice(0, 10) !== fields.checkedOn) throw new AccessError(400, 'Ngày đối chiếu không hợp lệ.');
    }
    if (row.status === 'announced' && (!fields.source || !fields.checkedOn)) {
      throw new AccessError(400, 'Kết quả lựa chọn đã công bố cần có nguồn và ngày đối chiếu.');
    }
    return { ...fields, role: row.role as ProjectParticipant['role'], status: row.status as ProjectParticipant['status'] };
  });
}

export function readProjectParticipants(value: unknown): ProjectParticipant[] {
  try { return projectParticipants(value); } catch { return []; }
}
