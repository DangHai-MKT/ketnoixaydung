import { AccessError } from '../auth/permissions';

export const projectScopeLabels = {
  whole: 'Toàn dự án', phase: 'Giai đoạn / dự án thành phần', package: 'Gói thầu / hạng mục',
} as const;

export const projectFactFields = {
  purpose: { label: 'Công năng / mục đích sử dụng', max: 240 },
  locationCoverage: { label: 'Địa bàn khác của dự án (nếu có)', max: 240 },
  landAreaSqm: { label: 'Diện tích đất (m²)', max: 16 },
  floorAreaSqm: { label: 'Diện tích sàn (m²)', max: 16 },
  scaleSummary: { label: 'Quy mô theo loại công trình (công suất, số tầng, chiều dài…)', max: 240 },
  scopeType: { label: 'Phạm vi tin', max: 10, options: projectScopeLabels },
  packageCode: { label: 'Mã gói thầu / hạng mục công khai (nếu có)', max: 80 },
  investmentAmount: { label: 'Vốn đầu tư', max: 22 },
  investmentCurrency: { label: 'Đơn vị tiền tệ', max: 3, options: { VND: 'VND', USD: 'USD', EUR: 'EUR', JPY: 'JPY' } },
  investmentBasis: { label: 'Căn cứ và phạm vi vốn', max: 160 },
  expectedStart: { label: 'Dự kiến khởi công', max: 120 },
  actualStart: { label: 'Khởi công thực tế', max: 10, date: true },
  expectedCompletion: { label: 'Hoàn thành dự kiến', max: 10, date: true },
  factsSource: { label: 'Nguồn đối chiếu được phép công khai', max: 240 },
  factsCheckedOn: { label: 'Ngày đối chiếu', max: 10, date: true },
} as const;

export const projectFactKeys = Object.keys(projectFactFields) as (keyof typeof projectFactFields)[];
export const publicProjectDataKeys = ['constructionType', 'technicalSummary', 'scopeSummary', ...projectFactKeys] as const;
export const emptyProjectFacts = Object.fromEntries(projectFactKeys.map(key => [key, ''])) as Record<typeof projectFactKeys[number], string>;

function isDate(value: string, partial: boolean) {
  if (partial && /^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$/.test(value)) return true;
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateProjectFacts(facts: typeof emptyProjectFacts) {
  for (const key of projectFactKeys) {
    const value = facts[key], field = projectFactFields[key];
    if (!value) continue;
    if (('options' in field && !Object.hasOwn(field.options, value)) ||
      ('date' in field && !isDate(value, key !== 'factsCheckedOn')) ||
      (key === 'expectedStart' && /^\d{4}-\d{2}(?:-\d{2})?$/.test(value) && !isDate(value, true))) {
      throw new AccessError(400, `${field.label} không hợp lệ.`);
    }
  }
  for (const key of ['landAreaSqm', 'floorAreaSqm', 'investmentAmount'] as const) {
    const value = facts[key];
    if (value && (!(key === 'investmentAmount' ? /^\d{1,19}(?:\.\d{1,2})?$/ : /^\d{1,12}(?:\.\d{1,2})?$/).test(value) || !/[1-9]/.test(value))) {
      throw new AccessError(400, `${projectFactFields[key].label} phải là số dương, dùng dấu chấm cho phần thập phân.`);
    }
  }
  if (Boolean(facts.investmentAmount) !== Boolean(facts.investmentCurrency)) throw new AccessError(400, 'Nhập cả số tiền và đơn vị tiền tệ của khoản vốn.');
  return facts;
}

export function projectDateLabel(value: string) {
  return isDate(value, true) ? value.split('-').reverse().join('/') : value;
}

export function formatInvestmentInput(value: string) {
  const [whole, fraction] = value.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction === undefined ? '' : ',' + fraction);
}

export function parseInvestmentInput(value: string): string | null {
  const raw = value.replace(/[.\s]/g, '').replace(',', '.');
  return /^(?:\d{1,19}(?:\.\d{0,2})?)?$/.test(raw) ? raw : null;
}
