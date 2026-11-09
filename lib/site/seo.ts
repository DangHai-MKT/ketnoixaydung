import type {Metadata} from 'next';
import {siteIdentity} from './navigation';

export const privateRobots = {index: false, follow: false} as const;

export function publicOrigin(value = process.env.SITE_URL) {
  if (process.env.CONSTRUCTION_AUTH_TEST === '1' || !value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash ||
      url.username || url.password || !url.hostname.includes('.') || url.hostname.startsWith('[') ||
      /^[\d.]+$/.test(url.hostname) || /\.(localhost|local|test|invalid|example|internal)$/.test(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function publicMetadata(path: string, title: string, description: string, image?: string): Metadata {
  const origin = publicOrigin();
  if (!origin) return {title, description, robots: privateRobots};
  const url = origin + path;
  const images = image ? [origin + image] : undefined;
  return {
    title, description, robots: {index: true, follow: true}, alternates: {canonical: url},
    openGraph: {type: 'website', siteName: siteIdentity.name, locale: 'vi_VN', title, description, url, images},
    twitter: {card: images ? 'summary_large_image' : 'summary', title, description, images},
  };
}

export function breadcrumbJson(items: {label: string; path: string}[]) {
  const origin = publicOrigin();
  if (!origin) return null;
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(({label, path}, index) => ({
      '@type': 'ListItem', position: index + 1, name: label, item: origin + path,
    })),
  }).replaceAll('<', '\\u003c');
}
