import type { Role } from '../auth/permissions';

export function adminCapabilities(roles: readonly Role[]) {
  const superAdmin = roles.includes('super_admin');
  return { review: superAdmin || roles.includes('content_moderator'), users: superAdmin,
    finance: superAdmin || roles.includes('finance_operator'), support: superAdmin || roles.includes('support_operator') };
}
export class AdminReportInputError extends Error {}
export function shiftReportDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function adminReportWindow(params: Record<string, string | string[] | undefined>, now = new Date()) {
  for (const key of ['start', 'end', 'range', 'interval', 'q']) if (Array.isArray(params[key])) throw new AdminReportInputError('Bộ lọc không hợp lệ.');
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const range = String(params.range || '30');
  if (!['7', '30', '90', 'custom'].includes(range)) throw new AdminReportInputError('Khoảng thời gian không hợp lệ.');
  const start = String(params.start || shiftReportDay(today, -(range === 'custom' ? 29 : Number(range) - 1)));
  const end = String(params.end || today);
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(start) || !validDate(end) || start > end || end > today) throw new AdminReportInputError('Ngày bắt đầu/kết thúc không hợp lệ hoặc nằm trong tương lai.');
  const from = new Date(`${start}T00:00:00+07:00`), until = new Date(new Date(`${end}T00:00:00+07:00`).getTime() + 86400000);
  const days = Math.round((until.getTime() - from.getTime()) / 86400000);
  if (days > 366) throw new AdminReportInputError('Mỗi báo cáo tối đa 366 ngày.');
  const interval = String(params.interval || 'day');
  if (!['day', 'week'].includes(interval)) throw new AdminReportInputError('Cách nhóm thời gian không hợp lệ.');
  const q = String(params.q || '').trim();
  if (q.length > 80) throw new AdminReportInputError('Từ khóa tối đa 80 ký tự.');
  return { start, end, today, range, from, until, days, interval: interval as 'day' | 'week', q };
}
export type AdminReportWindow = ReturnType<typeof adminReportWindow>;
