export const supportChannels = [
  { key: 'guidance', label: 'Gọi hướng dẫn', defaultHours: '08:00 – 21:30' },
  { key: 'complaints', label: 'Khiếu nại', defaultHours: '08:00 – 21:30' },
  { key: 'technical', label: 'Hỗ trợ kỹ thuật', defaultHours: '08:00 – 21:00' },
] as const;

export function supportPhone(value: unknown) {
  if (typeof value !== 'string') return '';
  const phone = value.trim();
  return phone.length <= 30 && /^\+?\d[\d .-]*$/.test(phone)
    && /^\+?\d{8,15}$/.test(phone.replace(/[ .-]/g, '')) ? phone : '';
}

export function supportHours(value: unknown) {
  if (typeof value !== 'string') return '';
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return '';
  const from = `${match[1]}:${match[2]}`, to = `${match[3]}:${match[4]}`;
  return from < to ? `${from} – ${to}` : '';
}

export function supportZaloUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 300) return '';
  return /^https:\/\/zalo\.me\/(?:[a-zA-Z0-9_-]+|s\/[a-zA-Z0-9_-]+)\/?$/.test(value.trim()) ? value.trim() : '';
}

export function readSupportSettings(value: Record<string, unknown> = {}) {
  return {
    lines: supportChannels.map(({ key, label, defaultHours }) => ({
      key, label, phone: supportPhone(value[`${key}Phone`]), hours: supportHours(value[`${key}Hours`]) || defaultHours,
    })),
    zaloUrl: supportZaloUrl(value.zaloUrl),
  };
}
