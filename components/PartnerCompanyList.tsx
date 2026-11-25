'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Icon from './MarketplaceIcon';
import LoadMoreButton from './LoadMoreButton';
import {companyPath,companySummary} from '../lib/site/company-display';
import type {CompanyDirectoryResult} from '../services/company-directory';
export default function PartnerCompanyList({initial,queryString,requestHref}:{initial:CompanyDirectoryResult;queryString:string;requestHref:string}) {
  const [result,setResult]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>{pending.current?.abort();},[]);
  const params=new URLSearchParams(queryString);
  const keyword=params.get('q')??'',provinceFilter=params.get('province')??'',ward=params.get('ward')??'',sort=params.get('sort')??'newest',size=result.pagination.pageSize;
  const specialty=params.get('specialty')??'',minYear=params.get('minYear')??'',maxYear=params.get('maxYear')??'';
  const {data:rows,pagination:{page,total,totalPages}}=result;
  async function more() {
    if(pending.current)return;
    const controller=new AbortController();pending.current=controller;setBusy(true);setError('');
    try {
      const query=new URLSearchParams(queryString);query.set('page',String(page+1));
      const response=await fetch('/api/partner-companies?'+query,{cache:'no-store',signal:controller.signal});
      const next:CompanyDirectoryResult&{error?:string}=await response.json();
      if(!response.ok)throw Error(next.error||'Chưa tải được doanh nghiệp. Vui lòng thử lại.');
      if(controller.signal.aborted)return;
      setResult(old=>{const seen=new Set(old.data.map(row=>row.id));return {...next,data:[...old.data,...next.data.filter(row=>!seen.has(row.id))]};});
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Chưa tải được kết quả.');}
    finally{if(!controller.signal.aborted){setBusy(false);pending.current=null;}}
  }
  return <div>
    {rows.length ? <ul className="company-directory-list">
      {rows.map(({id,name,trade,province,year,employees,market,unlocked})=>{
        const detail=companyPath(id)+'?'+new URLSearchParams({q:keyword,province:provinceFilter,ward,page:String(page),sort,size:String(size),specialty,minYear,maxYear});
        return <li key={id}><article className="company-directory-row">
          <span className="company-directory-avatar" aria-hidden="true"><Icon name="industrial" size={28}/></span>
          <div className="company-directory-main">
            <div className="company-directory-tags"><span>{province}</span>{unlocked&&<span className="company-access-badge">Đã mở liên hệ</span>}</div>
            <h3><Link href={detail}>{name}</Link></h3>
            <p className="company-directory-trade">{companySummary(trade)}</p>
            <dl className="company-directory-facts">
              {year&&<div><dt>Thành lập</dt><dd>{year}</dd></div>}
              {employees&&<div><dt>Nhân sự</dt><dd>{employees}</dd></div>}
              {market&&<div><dt>Nhận việc</dt><dd>{companySummary(market,65)}</dd></div>}
            </dl>
          </div>
          <div className="company-directory-action"><Link className="button button-primary" href={detail}>Xem hồ sơ <span aria-hidden="true">→</span></Link>
            <small>Thông tin năng lực &amp; liên hệ</small></div>
        </article></li>;
      })}
    </ul> : <div className="partner-card partner-no-results"><h3>Chưa thấy doanh nghiệp phù hợp</h3>
      <p>Thử từ khóa ngắn hơn hoặc gửi nhu cầu để bộ phận hỗ trợ tìm thêm đơn vị.</p>
      <a className="button button-primary" href={requestHref}>Đăng nhu cầu tìm đối tác</a>
    </div>}
    {rows.length>0&&<p className="company-loaded-count" role="status">Đang hiển thị {rows.length.toLocaleString('vi-VN')} / {total.toLocaleString('vi-VN')} doanh nghiệp</p>}
    {page<totalPages&&<><LoadMoreButton label="doanh nghiệp" remaining={Math.max(0,total-page*size)} busy={busy} error={error} onClick={more}/>
      <noscript><a href={'/find-partners?'+new URLSearchParams({...Object.fromEntries(params),page:String(page+1)})+'#ket-qua'}>Xem thêm doanh nghiệp</a></noscript></>}
  </div>;
}
