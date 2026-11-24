import {and,asc,eq,ilike,isNotNull,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {companyContactAccess,partnerCompanies as companies} from '../db/schema';
import {getCurrentActor} from '../lib/auth/server';
import Icon from './MarketplaceIcon';
import Link from 'next/link';
import {companyPath,companySummary} from '../lib/site/company-display';
import {partnerSchemaUnavailable} from '../services/partner-requests';

export default async function PartnerCompanyResults({keyword,province,ward,page,showRequest}:{keyword:string;province:string;ward:string;page:number;showRequest:boolean}) {
  const actor=await getCurrentActor();
  const access=actor?.status==='active' ? await db.select({id:companyContactAccess.companyId}).from(companyContactAccess)
    .where(eq(companyContactAccess.buyerId,actor.id)).catch(error=>{
      if(partnerSchemaUnavailable(error))return [];throw error;
    }):[];
  const unlocked=new Set(access.map(row=>row.id));
  const rows=await db.select({id:companies.id,name:companies.name,trade:companies.trade,province:companies.province,
    year:sql<string>`coalesce(${companies.profile}->>'year','')`,
    employees:sql<string>`coalesce(${companies.profile}->>'employees','')`,
    market:sql<string>`left(coalesce(${companies.profile}->>'market',''),120)`})
    .from(companies).where(and(isNotNull(companies.publishedAt),province ? eq(companies.province,province) : undefined,
      ward ? sql`${companies.profile}->>'ward' = ${ward}` : undefined,
      ...keyword.split(/\s+/).filter(Boolean).slice(0,10).map(word=>{
        const pattern='%'+word.replace(/[\\%_]/g,'\\$&')+'%';
        return or(ilike(companies.name,pattern),ilike(companies.trade,pattern),
          sql`concat_ws(' ', ${companies.profile}->>'market', ${companies.profile}->>'work', ${companies.profile}->>'experience') ILIKE ${pattern}`);
      })))
    .orderBy(asc(companies.name),asc(companies.id)).limit(21).offset((page-1)*20)
    .catch(error=>{if(partnerSchemaUnavailable(error)) return [];throw error;});
  const provinceFilter=province;
  const filters=new URLSearchParams({q:keyword,province,ward});
  if(showRequest) filters.set('request','1');
  const href=(index:number)=>'?'+new URLSearchParams({...Object.fromEntries(filters),page:String(index)})+'#ket-qua';
  const requestHref='?'+new URLSearchParams({q:keyword,province,ward,request:'1'})+'#dang-nhu-cau';
  return <section id="ket-qua" className="partner-results">
    <header className="partner-results-heading">
      <div><h2>{keyword ? 'Kết quả tìm đối tác' : 'Doanh nghiệp để bạn tìm hiểu'}</h2>
      {(keyword || province) && <p>{[keyword,province,ward].filter(Boolean).join(' · ')}</p>}</div>
      <a className="button button-secondary" href={requestHref}>Nhờ sàn giới thiệu</a>
    </header>
    <p className="company-list-guide">Chọn doanh nghiệp để xem năng lực, dịch vụ và thông tin liên hệ.</p>
    {rows.length ? <ul className="company-directory-list">
      {rows.slice(0,20).map(({id,name,trade,province,year,employees,market})=>{
        const detail=companyPath(id)+'?'+new URLSearchParams({q:keyword,province:provinceFilter,ward,page:String(page)});
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
    {(page>1||rows.length>20)&&<nav className="fw-actions" aria-label="Phân trang danh bạ">
      {page>1&&<a href={href(page-1)}>Trang trước</a>}
      {rows.length>20&&page<9999&&<a href={href(page+1)}>Trang sau</a>}
    </nav>}
  </section>;
}
