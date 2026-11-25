import {and,asc,desc,eq,ilike,isNotNull,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {companyContactAccess,partnerCompanies as companies} from '../db/schema';
import {getCurrentActor} from '../lib/auth/server';
import {companyPageNumbers} from '../lib/site/company-search';
import Icon from './MarketplaceIcon';
import Link from 'next/link';
import {companyPath,companySummary} from '../lib/site/company-display';
import {partnerSchemaUnavailable} from '../services/partner-requests';

export default async function PartnerCompanyResults({keyword,province,ward,page:requestedPage,showRequest,sort='newest',size=12}:{keyword:string;province:string;ward:string;page:number;showRequest:boolean;sort?:string;size?:number}) {
  const actor=await getCurrentActor();
  const access=actor?.status==='active' ? await db.select({id:companyContactAccess.companyId}).from(companyContactAccess)
    .where(eq(companyContactAccess.buyerId,actor.id)).catch(error=>{
      if(partnerSchemaUnavailable(error))return [];throw error;
    }):[];
  const unlocked=new Set(access.map(row=>row.id));
  const where=and(isNotNull(companies.publishedAt),province ? eq(companies.province,province) : undefined,
      ward ? sql`${companies.profile}->>'ward' = ${ward}` : undefined,
      ...keyword.split(/\s+/).filter(Boolean).slice(0,10).map(word=>{
        const pattern='%'+word.replace(/[\\%_]/g,'\\$&')+'%';
        return or(ilike(companies.name,pattern),ilike(companies.trade,pattern),
          sql`concat_ws(' ', ${companies.profile}->>'market', ${companies.profile}->>'work', ${companies.profile}->>'experience') ILIKE ${pattern}`);
      }));
  const [count]=await db.select({total:sql<number>`count(*)::int`}).from(companies).where(where)
    .catch(error=>{if(partnerSchemaUnavailable(error))return [{total:0}];throw error;});
  const total=count.total,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requestedPage,pages);
  const rows=await db.select({id:companies.id,name:companies.name,trade:companies.trade,province:companies.province,
    year:sql<string>`coalesce(${companies.profile}->>'year','')`,
    employees:sql<string>`coalesce(${companies.profile}->>'employees','')`,
    market:sql<string>`left(coalesce(${companies.profile}->>'market',''),120)`})
    .from(companies).where(where)
    .orderBy(...(sort==='name_asc'?[asc(companies.name),asc(companies.id)]:sort==='name_desc'?[desc(companies.name),asc(companies.id)]:[desc(companies.publishedAt),desc(companies.id)])).limit(size).offset((page-1)*size)
    .catch(error=>{if(partnerSchemaUnavailable(error)) return [];throw error;});
  const provinceFilter=province;
  const filters=new URLSearchParams({q:keyword,province,ward,sort,size:String(size)});
  if(showRequest) filters.set('request','1');
  const href=(index:number)=>'?'+new URLSearchParams({...Object.fromEntries(filters),page:String(index)})+'#ket-qua';
  const requestHref='?'+new URLSearchParams({q:keyword,province,ward,sort,size:String(size),request:'1'})+'#dang-nhu-cau';
  return <section id="ket-qua" className="partner-results">
    <header className="partner-results-heading">
      <div><h2>{keyword ? 'Kết quả tìm đối tác' : 'Doanh nghiệp để bạn tìm hiểu'}</h2>
      {(keyword || province) && <p>{[keyword,province,ward].filter(Boolean).join(' · ')}</p>}</div>
      <a className="button button-secondary" href={requestHref}>Nhờ sàn giới thiệu</a>
    </header>
    <p className="company-list-guide"><strong>{total.toLocaleString('vi-VN')} doanh nghiệp phù hợp</strong> · Chọn doanh nghiệp để xem năng lực, dịch vụ và thông tin liên hệ.</p>
    {rows.length ? <ul className="company-directory-list">
      {rows.map(({id,name,trade,province,year,employees,market})=>{
        const detail=companyPath(id)+'?'+new URLSearchParams({q:keyword,province:provinceFilter,ward,page:String(page),sort,size:String(size)});
        return <li key={id}><article className="company-directory-row">
          <span className="company-directory-avatar" aria-hidden="true"><Icon name="industrial" size={28}/></span>
          <div className="company-directory-main">
            <div className="company-directory-tags"><span>{province}</span>{unlocked.has(id)&&<span className="company-access-badge">Đã mở liên hệ</span>}</div>
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
    {total>0&&<nav className="company-pagination" aria-label="Phân trang danh bạ">
      <p>Hiển thị {(page-1)*size+1}–{Math.min(page*size,total)} / {total.toLocaleString('vi-VN')} doanh nghiệp</p>
      {pages>1&&<div>{page>1&&<Link href={href(page-1)} aria-label="Trang trước">← Trước</Link>}
        {companyPageNumbers(page,pages).map((n,i,values)=><span key={n}>{i>0&&n>values[i-1]+1&&<span className="company-page-gap">…</span>}
          <Link href={href(n)} aria-label={'Trang '+n} aria-current={n===page?'page':undefined}>{n}</Link></span>)}
        {page<pages&&<Link href={href(page+1)} aria-label="Trang sau">Sau →</Link>}</div>}
    </nav>}
  </section>;
}
