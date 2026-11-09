import { siteIdentity } from '../../../lib/site/navigation';
import {editorialMetadata} from '../../../components/EditorialPage';
import GuideFinder from '../../../components/GuideFinder';
import Icon from '../../../components/MarketplaceIcon';
import {breadcrumbJson} from '../../../lib/site/seo';

export const metadata = editorialMetadata('/guides');

const roles = [
  {label:'Người mua',title:'Tìm và mua thông tin dự án',text:'Từ lọc dự án và kiểm tra số dư đến mở thông tin đã mua.',
    icon:'search',href:'/guides/buyer',action:'Hướng dẫn người mua'},
  {label:'Nhà cung cấp',title:'Xác minh hồ sơ và đăng tin',text:'Từ đăng ký hồ sơ, tạo bản nháp và đặt giá đến gửi kiểm duyệt.',
    icon:'helmet',href:'/guides/seller',action:'Hướng dẫn người bán'},
];

export default function Page() {
  const breadcrumb=breadcrumbJson([{label:'Trang chủ',path:'/'},{label:'Hướng dẫn',path:'/guides'}]);
  return <main className="guide-page">
    {breadcrumb&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:breadcrumb}}/>}
    <header className="guide-hero"><div className="guide-wrap">
      <nav aria-label="Đường dẫn"><ol className="guide-crumbs"><li><a href="/">Trang chủ</a></li><li aria-current="page">Hướng dẫn</li></ol></nav>
      <div className="guide-hero-copy"><span className="guide-kicker">Cẩm nang {siteIdentity.name}</span>
        <h1>Hướng dẫn sử dụng sàn</h1><p>Tìm đúng hướng dẫn cho việc bạn đang làm, từ khám phá dự án đến đăng tin và theo dõi kiểm duyệt.</p>
        <a className="guide-primary" href="#tra-cuu">Tra cứu chủ đề <span aria-hidden="true">↓</span></a>
      </div>
    </div></header>
    <div className="guide-wrap guide-content">
      <section aria-labelledby="guide-roles-title">
        <div className="guide-section-heading"><span className="guide-kicker">Bắt đầu theo vai trò</span><h2 id="guide-roles-title">Chọn lộ trình của bạn</h2></div>
        <div className="guide-role-grid">{roles.map(role=><article className="guide-role" key={role.href}>
          <div><span className="guide-icon" aria-hidden="true"><Icon name={role.icon} size={24}/></span><span>{role.label}</span></div>
          <h3>{role.title}</h3><p>{role.text}</p><a href={role.href}>{role.action} <span aria-hidden="true">→</span></a>
        </article>)}</div>
      </section>
      <GuideFinder/>
      <aside className="guide-help"><span className="guide-icon" aria-hidden="true"><Icon name="help" size={23}/></span>
        <div><h2>Bạn vẫn cần trợ giúp?</h2><p>Tìm câu trả lời hoặc mở đúng khu vực hỗ trợ.</p></div>
        <a href="/faq">Câu hỏi thường gặp →</a><a href="/contact">Liên hệ và hỗ trợ →</a>
      </aside>
    </div>
  </main>;
}
