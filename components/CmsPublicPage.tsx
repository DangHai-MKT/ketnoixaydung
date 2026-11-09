import {cache} from 'react';
import {notFound} from 'next/navigation';
import {cmsPublicPath,type CmsKind} from '../lib/cms/content';
import {breadcrumbJson,publicMetadata,publicOrigin} from '../lib/site/seo';
import {getPublishedContent} from '../services/cms';
import CmsContent from './CmsContent';

const load=cache(async(kind:CmsKind,slug:string)=>{
  if (slug.length>100||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  const row=await getPublishedContent(kind,slug);
  if(!row) notFound();
  return row;
});
export async function cmsPublicMetadata(kind:CmsKind,slug:string) {
  const row=await load(kind,slug), content=row.content;
  const metadata=publicMetadata(cmsPublicPath(kind,slug),content.seoTitle||content.title,content.seoDescription||content.summary.slice(0,160),
    content.featuredMediaId?'/api/cms/media/'+content.featuredMediaId:undefined);
  if(kind==='news'&&metadata.openGraph) metadata.openGraph={...metadata.openGraph,type:'article',publishedTime:row.publishedAt.toISOString()};
  return metadata;
}
export default async function CmsPublicPage({kind,slug}:{kind:CmsKind;slug:string}) {
  const row=await load(kind,slug);
  const crumbs=[{label:'Trang chủ',path:'/'},...(kind==='news'?[{label:'Tin tức',path:'/news'}]:[]),{label:row.content.title,path:cmsPublicPath(kind,slug)}];
  const json=breadcrumbJson(crumbs);
  const origin=publicOrigin();
  const article=kind==='news'&&origin?JSON.stringify({
    '@context':'https://schema.org','@type':'Article',
    mainEntityOfPage:origin+cmsPublicPath(kind,slug), headline:row.content.title,
    description:row.content.summary, dateModified:row.publishedAt.toISOString(),
    image:row.content.featuredMediaId?origin+'/api/cms/media/'+row.content.featuredMediaId:undefined,
  }).replaceAll('<','\\u003c'):null;
  return <main className={'editorial-page cms-public'+(kind==='news'?' news-detail':' info-detail')}>
    {json&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:json}}/>}
    {article&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:article}}/>}
    <nav aria-label="Đường dẫn"><ol className="editorial-crumbs">{crumbs.map((item,index)=><li key={item.path}>
      {index===crumbs.length-1?<span aria-current="page">{item.label}</span>:<a href={item.path}>{item.label}</a>}</li>)}</ol></nav>
    <CmsContent content={row.content} outline={kind==='page'} byline={kind==='news'?<div className="news-story-meta">
      {row.category&&<a href={'/news?category='+encodeURIComponent(row.categorySlug??'')}>{row.category}</a>}
      <time dateTime={row.publishedAt.toISOString()}>{row.publishedAt.toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</time>
    </div>:<span className="news-eyebrow">Thông tin nền tảng</span>}/>
    {kind==='news'&&<footer className="news-detail-footer"><a href="/news">← Quay lại trang tin</a></footer>}
    {kind==='page'&&<footer className="info-related"><h2>Tìm hiểu thêm</h2>
      <a href="/guides">Hướng dẫn sử dụng →</a><a href="/contact">Liên hệ và hỗ trợ →</a>
    </footer>}
  </main>;
}
