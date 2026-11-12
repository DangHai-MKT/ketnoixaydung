import { getPublicMarketplaceSummary, listLatestPublicProjects } from '../services/public-projects';
import {listPublishedNews} from '../services/cms';
import { categoryLabels } from '../lib/projects/workflow';
import { provinceOptions } from '../lib/projects/locations';
import ProjectCard from './ProjectCard';
import MarketplaceRegion from './MarketplaceRegion';
import MarketplaceLowerHome from './MarketplaceLowerHome';
import Icon from './MarketplaceIcon';
import type { PublicProject } from '../lib/projects/contracts';

const keywords = ['Khu công nghiệp', 'Nhà xưởng', 'Hạ tầng giao thông', 'Khu đô thị', 'Năng lượng', 'Bệnh viện', 'Trường học'];
const guides = [
  { title: 'Tìm đúng dự án, mở rộng cơ hội hợp tác', text: 'Tìm theo từ khóa, loại công trình, tỉnh thành và khoảng giá POINT. Xem kỹ thông tin công khai và phiên bản đã được kiểm duyệt trước khi quyết định.', href: '/projects', action: 'Khám phá dự án', image: 'industry' },
  { title: 'Bắt đầu trở thành nhà cung cấp thông tin', text: 'Hoàn thiện hồ sơ, cung cấp tài liệu xác minh và gửi hồ sơ để quản trị viên xét duyệt. Chỉ nhà cung cấp đã xác minh mới được gửi dự án.', href: '/become-seller', action: 'Xác minh hồ sơ', image: 'city' },
  { title: 'Đăng tin minh bạch, tạo dựng niềm tin', text: 'Tách thông tin công khai và thông tin bảo vệ, tự đặt giá, xác nhận quyền cung cấp rồi gửi duyệt. Nội dung đã gửi được lưu theo phiên bản.', href: '/become-seller', action: 'Quản lý dự án', image: 'construction' },
  { title: 'An toàn thông tin trong mỗi kết nối', text: 'Trang công khai chỉ hiển thị phần thông tin đã được duyệt. Thông tin liên hệ và tài liệu bảo vệ được kiểm soát riêng theo quyền truy cập.', href: '/guides', action: 'Tìm hiểu quy trình', image: 'energy' },
];

export default async function MarketplaceHome() {
  const [listing,stats,news]=await Promise.allSettled([
    listLatestPublicProjects(5),
    getPublicMarketplaceSummary(),
    listPublishedNews('','',1,4),
  ]);
  const latest:PublicProject[]=listing.status==='fulfilled'?listing.value:[];
  const projects=latest.slice(0,4),unavailable=listing.status==='rejected';
  const summary=stats.status==='fulfilled'?stats.value:{total:0,categories:{} as Record<string,number>,provinces:{} as Record<string,number>,sellers:0};
  const number=(value:number)=>stats.status==='rejected'?'—':value.toLocaleString('vi-VN');
  return <main className="mk-home">
    <link rel="preload" as="image" href="/images/marketplace/construction-hero.webp" />
    <section className="mk-hero"><div className="mk-hero-shade" /><div className="mk-hero-content">
      <h1>Kết nối dự án xây dựng<br /><em>Tạo giá trị cho tương lai</em></h1>
      <p className="mk-hero-subtitle">Nền tảng giao dịch thông tin dự án xây dựng Việt Nam</p>
      <div className="mk-trust">{['Nhanh chóng', 'Minh bạch', 'An toàn', 'Hiệu quả'].map(item => <span key={item}><b>✓</b>{item}</span>)}</div>
      <form action="/projects" method="get" className="mk-search"><label className="mk-search-keyword"><Icon name="search" size={20} /><input name="q" aria-label="Từ khóa tìm dự án" placeholder="Tìm kiếm dự án, khu vực, loại công trình..." maxLength={100} /></label><label><Icon name="pin" size={19} /><select name="province" aria-label="Khu vực"><option value="">Toàn quốc</option>{provinceOptions.map(name => <option key={name}>{name}</option>)}</select></label><label><Icon name="file" size={18} /><select name="category" aria-label="Danh mục"><option value="">Tất cả danh mục</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button>Tìm kiếm</button></form>
      <div className="mk-keywords"><span>Từ khóa phổ biến:</span>{keywords.map(keyword => <a key={keyword} href={`/projects?q=${encodeURIComponent(keyword)}`}>{keyword}</a>)}</div>
    </div><aside className="mk-statistics" aria-label="Thông tin nền tảng"><div><Icon name="file" size={31} /><p><strong>{number(summary.total)}</strong><span>Dự án đang công bố</span></p></div><div><Icon name="users" size={32} /><p><strong>{number(summary.sellers)}</strong><span>Nhà cung cấp có dự án</span></p></div><div><Icon name="all" size={31} /><p><strong>{number(Object.keys(summary.categories).length)}</strong><span>Danh mục có dự án</span></p></div><div><Icon name="shield" size={32} /><p><strong>Kiểm duyệt</strong><span>Trước khi công bố</span></p></div></aside></section>
    <div className="mk-content"><div className="mk-top-grid"><nav className="mk-categories" aria-label="Danh mục dự án"><a className="mk-category-active" href="/projects"><Icon name="all" size={31} /><strong>Tất cả</strong><small>{number(summary.total)} dự án</small></a>{Object.entries(categoryLabels).map(([value, label]) => <a key={value} href={`/projects?category=${value}`}><Icon name={value} size={31} /><strong>{label}</strong><small>{number(summary.categories[value] ?? 0)} dự án</small></a>)}</nav>
      <section className="mk-audiences" id="features"><article className="mk-buyer"><Icon name="helmet" size={55} /><div><h2>Tôi là <strong>Người mua</strong></h2><ul><li>Tìm kiếm dự án phù hợp</li><li>Tiếp cận thông tin xác thực</li><li>Mở rộng cơ hội kinh doanh</li></ul><a href="/projects">Tìm dự án ngay <span>→</span></a></div></article><article className="mk-supplier"><Icon name="handshake" size={55} /><div><h2>Tôi là <strong>Nhà cung cấp</strong></h2><ul><li>Đăng dự án nhanh chóng</li><li>Tiếp cận đúng khách hàng</li><li>Quản lý dự án hiệu quả</li></ul><a href="/become-seller">Đăng dự án ngay <span>→</span></a></div></article></section></div>
    <div className="mk-main-grid"><div className="mk-left-column"><section className="mk-featured"><div className="mk-section-heading"><span className="mk-heading-icon"><Icon name="star" size={24} /></span><div><h2>Dự án mới công bố</h2><p>Giá theo POINT · Thông tin liên hệ và tài liệu thương mại được bảo vệ</p></div><a href="/projects">Xem tất cả dự án →</a></div><div className="mk-projects">{projects.map((project, index) => <ProjectCard key={project.id} project={project} priority={index === 0} />)}</div>{!projects.length && <div className="mk-empty"><Icon name="all" size={42} /><h3>{unavailable ? 'Danh sách tạm thời chưa sẵn sàng' : 'Chờ những cơ hội xây dựng đầu tiên'}</h3><p>{unavailable ? 'Vui lòng thử lại tại trang dự án.' : 'Dự án sẽ xuất hiện tại đây sau khi được kiểm duyệt và công bố.'}</p><a href={unavailable ? '/projects' : '/seller'}>{unavailable ? 'Mở danh sách dự án' : 'Trở thành nhà cung cấp'} →</a></div>}</section>
      <section className="mk-guides" id="market-guides"><div className="mk-section-heading"><span className="mk-heading-icon mk-purple"><Icon name="book" size={22} /></span><div><h2>Cẩm nang &amp; thị trường</h2><p>Thông tin hữu ích để bắt đầu kết nối dự án xây dựng</p></div><a href="/guides">Tìm hiểu thêm →</a></div><div className="mk-guide-grid">{guides.map(guide => <details className="mk-guide" key={guide.title}><summary><span className={`mk-guide-image mk-guide-${guide.image}`} /><span><strong>{guide.title}</strong><small>Hướng dẫn nền tảng <span>↗</span></small></span></summary><div className="mk-guide-detail"><p>{guide.text}</p><a href={guide.href}>{guide.action} →</a></div></details>)}</div></section></div>
      <aside className="mk-sidebar"><MarketplaceRegion total={summary.total} provinces={summary.provinces} unavailable={stats.status==='rejected'} /><a className="mk-national-banner" href="/become-seller"><span>Cùng xây dựng một</span><strong>VIỆT NAM PHÁT TRIỂN</strong><small>Kết nối hôm nay – Giá trị ngày mai</small><b aria-hidden="true">›</b></a></aside></div>
    </div>
    <MarketplaceLowerHome projects={latest} unavailable={unavailable} news={news} />
  </main>;
}


