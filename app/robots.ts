import type {MetadataRoute} from 'next';
import {publicOrigin} from '../lib/site/seo';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();
  if (!origin) return {rules: {userAgent: '*', disallow: '/'}};
  return {
    rules: {userAgent: '*', allow: ['/', '/api/projects/*/files/', '/api/cms/media/'], disallow: ['/api/']},
    sitemap: origin + '/sitemap.xml',
  };
}
