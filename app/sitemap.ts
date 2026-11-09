import type {MetadataRoute} from 'next';
import {editorialPages} from '../lib/site/editorial';
import {publicOrigin} from '../lib/site/seo';
import {listProjectSitemapEntries} from '../services/public-projects';
import {cmsEnabled,listCmsSitemapEntries} from '../services/cms';
import {cmsPublicPath} from '../lib/cms/content';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin();
  if (!origin) return [];
  const paths = ['/', '/projects', ...Object.keys(editorialPages)];
  if (cmsEnabled()) paths.push('/news');
  const content = await listCmsSitemapEntries(50000 - paths.length);
  const projects = await listProjectSitemapEntries(50000 - paths.length - content.length);
  return [
    ...paths.map(path => ({url: origin + path})),
    ...content.map(row=>({url:origin+cmsPublicPath(row.kind,row.slug),lastModified:row.publishedAt})),
    ...projects.map(project => ({
      url: origin + '/projects/' + project.id,
      lastModified: project.approvedAt ?? undefined,
    })),
  ];
}
