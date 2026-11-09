export const analyticsOrigin = 'https://ketnoixaydung.vn';
export const analyticsKey = 'site_analytics';
const publicPaths = new Set(['/', '/projects', '/news', '/about', '/contact', '/faq', '/guides', '/guides/buyer', '/guides/seller']);

export function ga4MeasurementId(value: unknown) {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^G-[A-Z0-9]{4,30}$/.test(id) ? id : '';
}

export function readAnalyticsSettings(value?: Record<string, unknown>) {
  return {
    enabled: value?.enabled === true,
    measurementId: ga4MeasurementId(value?.measurementId),
    enhancedMeasurementDisabled: value?.enhancedMeasurementDisabled === true,
  };
}

export function analyticsPageLocation(pathname: string) {
  if (publicPaths.has(pathname)) return analyticsOrigin + pathname;
  if (/^\/news\/[^/]+$/.test(pathname)) return analyticsOrigin + '/news/article';
  return null;
}

export function analyticsReferrer(referrer: string) {
  try {
    const url = new URL(referrer);
    return ['https:', 'http:'].includes(url.protocol) && url.origin !== analyticsOrigin ? url.origin + '/' : '';
  } catch {
    return '';
  }
}
