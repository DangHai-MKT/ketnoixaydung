import {and,asc,eq,ilike,isNotNull,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {companyContactAccess,partnerCompanies as companies} from '../db/schema';
import {getCurrentActor} from '../lib/auth/server';
import {unlockCompanyContact} from '../lib/site/company-contact-actions';
import {PartnerRequestForm} from './PartnerRequestForm';
import Icon from './MarketplaceIcon';
import {partnerSchemaUnavailable} from '../services/partner-requests';

export default async function PartnerCompanyResults({keyword,province,page,showRequest}:{keyword:string;province:string;page:number;showRequest:boolean}) {
  const actor=await getCurrentActor();
  const access=actor?.status==='active' ? await db.select({id:companyContactAccess.companyId}).from(companyContactAccess)
    .where(eq(companyContactAccess.buyerId,actor.id)).catch(error=>{
      if(partnerSchemaUnavailable(error))return [];throw error;
    }):[];
  const unlocked=new Set(access.map(row=>row.id));
  const rows=await db.select({id:companies.id,name:companies.name,trade:companies.trade,province:companies.province,
    website:companies.website,profile:companies.profile,source:companies.sourceUrl})
    .from(companies).where(and(isNotNull(companies.publishedAt),province ? eq(companies.province,province) : undefined,
      ...keyword.split(/\s+/).filter(Boolean).slice(0,10).map(word=>{
        const pattern='%'+word.replace(/[\\%_]/g,'\\$&')+'%';
        return or(ilike(companies.name,pattern),ilike(companies.trade,pattern),
          sql`concat_ws(' ', ${companies.profile}->>'market', ${companies.profile}->>'work', ${companies.profile}->>'experience') ILIKE ${pattern}`);
      })))
    .orderBy(asc(companies.name),asc(companies.id)).limit(21).offset((page-1)*20)
    .catch(error=>{if(partnerSchemaUnavailable(error)) return [];throw error;});
  const filters=new URLSearchParams({q:keyword,province});
  if(showRequest) filters.set('request','1');
  const href=(index:number)=>'?'+new URLSearchParams({...Object.fromEntries(filters),page:String(index)})+'#ket-qua';
  const requestHref='?'+new URLSearchParams({q:keyword,province,request:'1'})+'#dang-nhu-cau';
  return <section id="ket-qua" className="partner-results">
    <header className="partner-results-heading">
      <div><h2>{keyword ? 'Kết quả tìm đối tác' : 'Doanh nghiệp để bạn tìm hiểu'}</h2>
      {(keyword || province) && <p>{[keyword,province].filter(Boolean).join(' · ')}</p>}</div>
      <a className="button button-secondary" href={requestHref}>Nhờ sàn giới thiệu</a>
    </header>
    {rows.length ? <div className="partner-company-grid">
      {rows.slice(0,20).map(({id,name,trade,province,website,profile,source})=><article className="partner-card partner-company" key={id}>
        <div className="partner-company-top"><span className="partner-company-mark" aria-hidden="true"><Icon name="industrial" size={26}/></span>
          <div><p className="partner-company-region">{province}</p><h3>{name}</h3></div></div>
        <p className="partner-company-trade">{trade}</p>
        {(profile.work || profile.year || profile.market || profile.employees) && <dl className="partner-company-facts">
          {profile.work&&<div><dt>Loại công trình</dt><dd>{profile.work}</dd></div>}
          {profile.year&&<div><dt>Thành lập</dt><dd>{profile.year}</dd></div>}
          {profile.employees&&<div><dt>Số lượng nhân viên</dt><dd>{profile.employees}</dd></div>}
          {profile.market&&<div><dt>Khu vực theo hồ sơ</dt><dd>{profile.market}</dd></div>}
        </dl>}
        {profile.experience&&<p className="partner-company-experience">{profile.experience}</p>}
        {unlocked.has(id)?<div className="partner-contact-unlocked"><strong>Liên hệ nhà cung cấp · Đã mở khóa</strong>
        {profile.contactPerson&&<p>{profile.contactPerson}</p>}
        <div className="fw-actions partner-company-links">
          {profile.phone&&<a className="button button-primary" href={'tel:'+profile.phone.replace(/[^+0-9]/g,'')}>Gọi {profile.phone}</a>}
          {profile.zalo&&<a className="button button-secondary" href={profile.zalo} target="_blank" rel="noreferrer">Zalo</a>}
          {profile.email&&<a className="button button-secondary" href={'mailto:'+encodeURIComponent(profile.email)}>Gửi email</a>}
        </div></div>:<div className="partner-contact-locked"><strong>Liên hệ nhà cung cấp</strong>
          <p>{[profile.contactPerson&&'Người phụ trách',profile.phone&&'Điện thoại',profile.email&&'Email',profile.zalo&&'Zalo'].filter(Boolean).join(' · ') || 'Chưa có đầu mối liên hệ.'}</p>
          {[profile.phone,profile.email,profile.zalo].some(Boolean)?actor?.status==='active'?
            <details><summary>Mở liên hệ · 50 POINT</summary><p>Trừ 50 POINT một lần cho doanh nghiệp này. Những lần xem lại miễn phí.</p>
              <PartnerRequestForm action={unlockCompanyContact.bind(null,id)} label="Xác nhận mua · 50 POINT"/></details>
            :<a className="button button-primary" href="/login?next=%2Ffind-partners">Đăng nhập để mở liên hệ · 50 POINT</a>
            :<p>Đang cập nhật thông tin liên hệ.</p>}
        </div>}
        <details><summary>Địa chỉ và nguồn hồ sơ</summary>
          {profile.address&&<p>{profile.address}</p>}
          <div className="fw-actions">{website&&<a href={website} target="_blank" rel="noreferrer">Website</a>}
            <a href={source} target="_blank" rel="noreferrer">Xem nguồn ↗</a></div>
        </details>
      </article>)}
    </div> : <div className="partner-card partner-no-results"><h3>Chưa thấy doanh nghiệp phù hợp</h3>
      <p>Thử từ khóa ngắn hơn hoặc gửi nhu cầu để bộ phận hỗ trợ tìm thêm đơn vị.</p>
      <a className="button button-primary" href={requestHref}>Đăng nhu cầu tìm đối tác</a>
    </div>}
    {(page>1||rows.length>20)&&<nav className="fw-actions" aria-label="Phân trang danh bạ">
      {page>1&&<a href={href(page-1)}>Trang trước</a>}
      {rows.length>20&&page<9999&&<a href={href(page+1)}>Trang sau</a>}
    </nav>}
  </section>;
}
