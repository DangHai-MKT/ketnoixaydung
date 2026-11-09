import { AccessError } from '../auth/permissions';

export const ledgerStatuses = ['pending', 'posted', 'failed', 'reversed'] as const;
export function walletQuery(params: URLSearchParams) {
  const allowed = ['page', 'start', 'end', 'type', 'status', 'q'];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new AccessError(400, 'Bộ lọc giao dịch không hợp lệ.');
  }
  const pageText = params.get('page') || '1';
  if (!/^[1-9]\d{0,4}$/.test(pageText) || Number(pageText) > 10000) throw new AccessError(400, 'Trang phải nằm trong khoảng 1–10.000.');
  const start = params.get('start') || '', end = params.get('end') || '';
  for (const day of [start, end]) {
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '2000-01-01' || day > '9999-12-30'
      || !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day)) {
      throw new AccessError(400, 'Ngày lọc giao dịch không hợp lệ.');
    }
  }
  if (start && end && start > end) throw new AccessError(400, 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
  const type = params.get('type') || '', status = params.get('status') || '', q = (params.get('q') || '').trim();
  if (type && !/^[a-z][a-z0-9_]{0,59}$/.test(type)) throw new AccessError(400, 'Loại giao dịch không hợp lệ.');
  if (status && !ledgerStatuses.some(value => value === status)) throw new AccessError(400, 'Trạng thái giao dịch không hợp lệ.');
  if (q.length > 100) throw new AccessError(400, 'Mã tra cứu tối đa 100 ký tự.');
  return { page: Number(pageText), pageSize: 20, start, end, type, status, q,
    from: start ? new Date(`${start}T00:00:00+07:00`) : undefined,
    until: end ? new Date(new Date(`${end}T00:00:00+07:00`).getTime() + 86400000) : undefined };
}
export type WalletQuery = ReturnType<typeof walletQuery>;
export function walletId(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new AccessError(404, 'Không tìm thấy giao dịch.');
  return value;
}

export function walletPageUrl(base: string, query: WalletQuery, page: number) {
  const params = new URLSearchParams();
  for (const key of ['start', 'end', 'type', 'status', 'q'] as const) if (query[key]) params.set(key, query[key]);
  params.set('page', String(page));
  return `${base}?${params}`;
}
