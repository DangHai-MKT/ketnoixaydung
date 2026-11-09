'use client';

import {useEffect,useRef,useState} from 'react';
import {newsPageSize,type NewsBatch,type NewsListItem} from '../lib/cms/news-list';
import {CmsImage} from './CmsContent';
import Icon from './MarketplaceIcon';
import LoadMoreButton from './LoadMoreButton';

const formatDate=new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeZone:'Asia/Ho_Chi_Minh'});
function NewsCard({row,featured=false}:{row:NewsListItem;featured?:boolean}) {
  const href='/news/'+row.slug;
  return <article className={'news-story'+(featured?' news-story-featured':'')}>
    <div className="news-story-cover">
      {row.imageId?<CmsImage id={row.imageId} alt={row.alt} priority={featured}/>:<span aria-hidden="true"><Icon name="book" size={40}/></span>}
    </div>
    <div className="news-story-body">
      {featured&&<span className="news-eyebrow">Bài mới nhất</span>}
      <div className="news-story-meta">{row.category&&<span>{row.category}</span>}
        <time dateTime={row.publishedAt}>{formatDate.format(new Date(row.publishedAt))}</time></div>
      <h3><a href={href}>{row.title}</a></h3>
      <p>{row.summary}</p>
      <a href={href} className="news-read" aria-label={'Đọc bài: '+row.title}>Đọc bài viết <span aria-hidden="true">→</span></a>
    </div>
  </article>;
}

export default function NewsFeed({initial,q,category}:{initial:NewsBatch;q:string;category:string}) {
  const [batch,setBatch]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  const featured=initial.page===1&&!q&&!category?batch.rows[0]:undefined;
  const articles=featured?batch.rows.slice(1):batch.rows;
  useEffect(()=>()=>request.current?.abort(),[]);
  async function loadMore() {
    if(request.current)return;
    const controller=new AbortController();
    request.current=controller;setBusy(true);setError('');
    try {
      const params=new URLSearchParams({q,category,page:String(batch.page+1)});
      const response=await fetch('/api/news?'+params,{signal:controller.signal,cache:'no-store'});
      const result=await response.json().catch(()=>null);
      if(!response.ok||!Array.isArray(result?.rows))throw new Error('Không thể tải thêm bài viết. Vui lòng thử lại.');
      if(controller.signal.aborted)return;
      const next=result as NewsBatch;
      const seen=new Set(batch.rows.map(row=>row.slug));
      setBatch({...next,rows:[...batch.rows,...next.rows.filter(row=>!seen.has(row.slug))]});
    } catch(cause) {
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Không thể tải thêm bài viết.');
    } finally {
      if(request.current===controller){request.current=null;if(!controller.signal.aborted)setBusy(false);}
    }
  }
  return <>
    {featured&&<NewsCard row={featured} featured/>}
    {articles.length>0&&<div className="news-story-grid">{articles.map(row=><NewsCard row={row} key={row.slug}/>)}</div>}
    {batch.hasNext&&batch.page<10000&&<LoadMoreButton label="bài viết" remaining={Math.max(0,batch.total-batch.page*newsPageSize)}
      busy={busy} error={error} onClick={loadMore}/>}
  </>;
}
