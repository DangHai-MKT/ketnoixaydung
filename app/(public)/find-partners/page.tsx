import '../projects/project-filters.css';
import {companySearch} from '../../../lib/site/company-search';
import {randomUUID} from 'node:crypto';
import {getCurrentActor} from '../../../lib/auth/server';
import {provinceOptions} from '../../../lib/projects/locations';
import {createPartnerAction} from '../../../lib/site/partner-actions';
import {listPartnerRequests,partnerSchemaUnavailable} from '../../../services/partner-requests';
import {PartnerRequestForm} from '../../../components/PartnerRequestForm';
import PartnerCompanyResults from '../../../components/PartnerCompanyResults';
import Icon from '../../../components/MarketplaceIcon';
import PartnerCompanySearch from '../../../components/PartnerCompanySearch';
import {breadcrumbJson,publicMetadata,privateRobots} from '../../../lib/site/seo';

export const dynamic = 'force-dynamic';
type Search = {page?:string;requests?:string;q?:string;province?:string;ward?:string;request?:string;sort?:string;size?:string;specialty?:string;minYear?:string;maxYear?:string};
export async function generateMetadata({searchParams}:{searchParams:Promise<Search>}) {
  const params=await searchParams;
  const metadata=publicMetadata('/find-partners','Tìm đối tác xây dựng, nhà thầu và đơn vị thi công',
    'Tìm doanh nghiệp xây dựng theo chuyên môn và tỉnh thành. Xem kinh nghiệm, mở thông tin liên hệ hoặc gửi nhu cầu để được giới thiệu đối tác.');
  return Object.values(params).some(Boolean) ? {...metadata,robots:privateRobots} : metadata;
}

export default async function Page({searchParams}:{searchParams:Promise<{page?:string;requests?:string;q?:string;province?:string;ward?:string;request?:string;sort?:string;size?:string;specialty?:string;minYear?:string;maxYear?:string}>}) {
  const [actor,params] = await Promise.all([getCurrentActor(),searchParams]);
  const signedIn = actor?.status === 'active';
  const pageNumber=(value:unknown)=>typeof value==='string' && /^[1-9]\d{0,3}$/.test(value) ? Number(value) : 1;
  const {keyword,province,ward,page,sort,size,specialty,minYear,maxYear}=companySearch(params);
  const requestPage=pageNumber(params.requests);
  const showRequest=params.request==='1';
  const filters={q:keyword,province,ward,sort,specialty,minYear,maxYear,size:String(size),...(page>1 ? {page:String(page)} : {})};
  const requestHref='?'+new URLSearchParams({...filters,request:'1'})+'#dang-nhu-cau';
  const requestHistory=(next:number)=>'?'+new URLSearchParams({...filters,request:'1',requests:String(next)})+'#nhu-cau-cua-ban';
  const rows = signedIn && showRequest ? await listPartnerRequests(actor,false,requestPage).catch(error=>{
    if (partnerSchemaUnavailable(error)) return null;
    throw error;
  }) : [];
  const breadcrumb=breadcrumbJson([{label:'Trang chủ',path:'/'},{label:'Tìm đối tác',path:'/find-partners'}]);
  return <main className="partner-page partner-hub">
    {breadcrumb&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:breadcrumb}}/>}
    <nav className="partner-breadcrumb" aria-label="Đường dẫn"><a href="/">Trang chủ</a><span>/</span><span aria-current="page">Tìm đối tác</span></nav>
    <header className="partner-hub-hero">
      <div className="partner-hero-copy">
      <h1>Tìm đối tác xây dựng</h1>
      <p>Đúng chuyên môn.<br/><strong>Thuận đường hợp tác.</strong></p>
      <span>Từ đội thi công đến nhà thầu trọn gói — tìm đơn vị cho công việc bạn đang cần.</span>
      </div>
      <PartnerCompanySearch key={JSON.stringify([keyword,province,ward,sort,size,specialty,minYear,maxYear])} keyword={keyword} province={province} ward={ward} sort={sort} size={size} specialty={specialty} minYear={minYear} maxYear={maxYear}/>
    </header>
    <div className="partner-help-strip">
      <div><Icon name="search" size={23}/><span><strong>Tìm theo công việc</strong><small>Chuyên môn và địa bàn rõ ràng</small></span></div>
      <div><Icon name="file" size={23}/><span><strong>Xem hồ sơ trước</strong><small>Loại công trình, kinh nghiệm, nguồn tin</small></span></div>
      <div><Icon name="users" size={23}/><span><strong>Kết nối khi phù hợp</strong><small>Mở liên hệ hoặc nhờ sàn giới thiệu</small></span></div>
    </div>
    {signedIn&&<div className="partner-hub-tools"><a href={requestHistory(1)}>Nhu cầu của tôi →</a></div>}
    <PartnerCompanyResults keyword={keyword} province={province} ward={ward} page={page} showRequest={showRequest} sort={sort} size={size} specialty={specialty} minYear={minYear} maxYear={maxYear}/>
    {showRequest ? <div id="dang-nhu-cau" className="partner-layout partner-request-panel">
    {rows===null ? <section className="partner-card"><p role="status">Tính năng đang được thiết lập. Vui lòng quay lại sau.</p></section> : signedIn ? <>
      <section className="partner-card"><h2>Đăng nhu cầu tìm đối tác</h2>
        <p>Gửi yêu cầu để sàn giới thiệu thêm đơn vị phù hợp. Bạn cũng có thể gửi liên kết mời người quen qua Zalo.</p>
        <PartnerRequestForm action={createPartnerAction} label="Gửi nhu cầu">
          <input type="hidden" name="requestId" value={randomUUID()}/>
          <label>Cần ai?<input name="trade" required maxLength={100} defaultValue={keyword} placeholder="Ví dụ: Đội thi công PCCC"/></label>
          <label>Ở đâu?<select name="province" required defaultValue={province}><option value="">Chọn tỉnh hoặc thành phố</option>{provinceOptions.map(name=><option key={name}>{name}</option>)}</select></label>
          <label>Làm gì?<textarea name="scope" rows={3} required maxLength={600} placeholder="Ví dụ: Lắp đặt hệ thống PCCC cho nhà xưởng"/></label>
          <label>Khi nào cần?<input name="timing" required maxLength={100} placeholder="Ví dụ: Trong tháng tới"/></label>
          <p>Ai có liên kết mời đều xem được bốn mục này. Giữ riêng tên công trình nhạy cảm, địa chỉ cụ thể và thông tin liên hệ.</p>
        </PartnerRequestForm>
      </section>
      <section id="nhu-cau-cua-ban" className="partner-card"><h2>Nhu cầu của tôi</h2>
        {rows.length ? <ul className="partner-items">{rows.slice(0,20).map(row=><li key={row.id}><a href={'/find-partners/'+row.id}>{row.trade}</a><small>{row.province} · {row.closedAt?'Đã đóng':'Đang tìm'}</small></li>)}</ul> : <p>Khi tạo nhu cầu, bạn có thể mở lại từ đây để xem phản hồi.</p>}
        <nav className="fw-actions">{requestPage>1&&<a href={requestHistory(requestPage-1)}>Trang trước</a>}{rows.length>20&&requestPage<9999&&<a href={requestHistory(requestPage+1)}>Trang sau</a>}</nav>
      </section>
    </> : <section className="partner-card"><h2>Nhờ sàn giới thiệu đối tác</h2><p>Đăng nhập để gửi nhu cầu và theo dõi phản hồi.</p>
      <a className="button button-primary" href={'/login?next='+encodeURIComponent('/find-partners'+requestHref.split('#')[0])}>Đăng nhập để đăng nhu cầu</a></section>}
    </div> : <section className="partner-card partner-request-panel partner-request-callout"><div>
      <h2>Chưa tìm được đội phù hợp?</h2><p>Cho biết bạn cần ai, ở đâu và khi nào. Bộ phận hỗ trợ có thể giới thiệu thêm doanh nghiệp.</p>
      </div><a className="button button-primary" href={requestHref}>Đăng nhu cầu</a></section>}
  </main>;
}
