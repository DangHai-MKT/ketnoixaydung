import type {Metadata} from 'next';
import {siteIdentity} from './navigation';

export const privateRobots = {index: false, follow: false, googleBot: {index: false, follow: false}} as const;
const siteDescription = 'Tìm và đăng thông tin dự án xây dựng đã qua kiểm duyệt tại Việt Nam.';
const shareImage = '/images/marketplace/construction-hero-v2.webp';

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
  description = description.replace(/\s+/g, ' ').trim() || siteDescription;
  if (description.length > 160) description = description.slice(0, 159).trimEnd() + '…';
  const origin = publicOrigin();
  if (!origin) return {title, description, robots: privateRobots};
  const url = origin + path;
  const images = [{url: origin + (image ?? shareImage), alt: image ? title : siteIdentity.tagline}];
  const displayTitle = title === siteIdentity.name ? title : `${title} | ${siteIdentity.name}`;
  return {
    title: displayTitle, description, robots: {index: true, follow: true, googleBot: {index: true, follow: true, 'max-image-preview': 'large'}}, alternates: {canonical: url},
    openGraph: {type: 'website', siteName: siteIdentity.name, locale: 'vi_VN', title: displayTitle, description, url, images},
    twitter: {card: 'summary_large_image', title: displayTitle, description, images},
  };
}

export function structuredData(value: Record<string, unknown>) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export function homeStructuredData() {
  const origin = publicOrigin();
  if (!origin) return null;
  return structuredData({
    '@context': 'https://schema.org',
    '@graph': [
      {'@type': 'Organization', '@id': origin + '/#organization', name: siteIdentity.name, url: origin + '/', logo: origin + siteIdentity.mark},
      {'@type': 'WebSite', '@id': origin + '/#website', name: siteIdentity.name, url: origin + '/',
        description: siteDescription, inLanguage: 'vi-VN', publisher: {'@id': origin + '/#organization'}},
    ],
  });
}

export function breadcrumbJson(items: {label: string; path: string}[]) {
  const origin = publicOrigin();
  if (!origin) return null;
  return structuredData({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(({label, path}, index) => ({
      '@type': 'ListItem', position: index + 1, name: label, item: origin + path,
    })),
  });
}
