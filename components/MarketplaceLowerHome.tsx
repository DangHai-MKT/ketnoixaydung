import { siteIdentity } from '../lib/site/navigation';
import type { ReactNode } from 'react';
import {cmsEnabled,type listPublishedNews} from '../services/cms';
import { categoryLabels, formatPoints } from '../lib/projects/workflow';
import type { PublicProject } from '../lib/projects/contracts';
import { projectThumbnailUrl } from '../lib/projects/thumbnail';
import Icon from './MarketplaceIcon';

function Heading({ icon, title, description, href, children }: { icon: string; title: string; description?: string; href?: string; children?: ReactNode }) {
  return <div className="ml-heading"><span className="ml-heading-icon"><Icon name={icon} size={23} /></span><div><h2>{title} {children}</h2>{description && <p>{description}</p>}</div>{href && <a href={href}>Xem tất cả →</a>}</div>;
}
function elapsed(value: string | Date | null) {
  if (!value) return 'Đã công bố';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (!Number.isFinite(minutes)) return 'Đã công bố';
  if (minutes < 1) return 'Vừa công bố';
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  return `${Math.floor(minutes / 1440)} ngày trước`;
}
function Thumbnail({ project }: { project: PublicProject }) {
  return <span className={`ml-thumbnail ml-photo-${Object.hasOwn(categoryLabels, project.category) ? project.category : 'other'}`}>{project.imageUrl ? <img src={projectThumbnailUrl(project.imageUrl, 'small')} alt="" loading="lazy" decoding="async" /> : <small>Ảnh minh họa</small>}</span>;
}
const needs = [
  { title: 'Dự án sắp đấu thầu', hint: 'Tìm theo giai đoạn', icon: 'file', href: '/projects?stage=Chu%E1%BA%A9n%20b%E1%BB%8B%20%C4%91%E1%BA%A5u%20th%E1%BA%A7u', photo: 'cranes' },
  { title: 'Dự án đang mời thầu', hint: 'Khám phá cơ hội', icon: 'book', href: '/projects?stage=%C4%90ang%20m%E1%BB%9Di%20th%E1%BA%A7u', photo: 'engineers' },
  { title: 'Dự án đã phê duyệt', hint: 'Thông tin đã kiểm duyệt', icon: 'shield', href: '/projects', photo: 'city' },
  { title: 'Dự án tìm nhà thầu', hint: 'Kết nối cơ hội xây dựng', icon: 'helmet', href: '/projects?q=nh%C3%A0%20th%E1%BA%A7u', photo: 'team' },
  { title: 'Dự án tìm nhà cung cấp', hint: 'Kết nối nguồn cung', icon: 'handshake', href: '/projects?q=nh%C3%A0%20cung%20c%E1%BA%A5p', photo: 'factory' },
  { title: 'Dự án theo tỉnh thành', hint: 'Khám phá trên toàn quốc', icon: 'pin', href: '/projects', photo: 'skyline' },
];
const suppliers = [
  { name: 'Nhà thầu xây dựng', icon: 'helmet', caption: 'Thi công & xây lắp' },
  { name: 'Tư vấn thiết kế', icon: 'civil', caption: 'Kiến trúc & kỹ thuật' },
  { name: 'Vật liệu xây dựng', icon: 'industrial', caption: 'Vật tư & thiết bị' },
  { name: 'Cơ điện công trình', icon: 'energy', caption: 'Giải pháp cơ điện' },
  { name: 'Hạ tầng kỹ thuật', icon: 'infrastructure', caption: 'Hạ tầng & giao thông' },
  { name: 'Năng lượng', icon: 'agriculture', caption: 'Giải pháp bền vững' },
];
const articles = [
  { title: 'Tìm thông tin phù hợp trước khi kết nối dự án', image: 'factory', text: 'Sử dụng bộ lọc danh mục, tỉnh thành và giá POINT. Đọc mô tả công khai, giai đoạn và phiên bản đã được duyệt để chọn nguồn thông tin phù hợp với nhu cầu.', href: '/projects', action: 'Tìm kiếm dự án' },
  { title: 'Nhà cung cấp bắt đầu từ hồ sơ xác minh', image: 'city', text: 'Hoàn thiện thông tin liên hệ, chuẩn bị tài liệu cá nhân hoặc doanh nghiệp, sau đó gửi hồ sơ để được xét duyệt. Vai trò seller cần đi kèm trạng thái xác minh hợp lệ.', href: '/become-seller', action: 'Hoàn thiện hồ sơ' },
  { title: 'Giá niêm yết và nội dung theo từng phiên bản', image: 'team', text: 'Nhà cung cấp tự đặt giá bằng POINT. Bản sửa đang chờ duyệt không thay đổi nội dung và giá của bản đang công bố. Thông tin riêng được phân tách với phần xem công khai.', href: '/become-seller', action: 'Quản lý dự án' },
  { title: 'Kiểm duyệt thông tin, bảo vệ dữ liệu dự án', image: 'energy', text: 'Nội dung được kiểm tra ban đầu rồi xét duyệt trước khi công bố. Trang chủ không hiển thị thông tin liên hệ được bảo vệ, hồ sơ xác minh hay giao dịch riêng của người dùng.', href: '/guides', action: 'Xem hướng dẫn' },
];

export default function MarketplaceLowerHome({projects,unavailable,news}:{
  projects:PublicProject[];unavailable:boolean;news:PromiseSettledResult<Awaited<ReturnType<typeof listPublishedNews>>>;
}) {
  const latestNews=news.status==='fulfilled'?news.value.rows:[];
  return <div className="ml-home" id="marketplace-more"><div className="ml-container">
    <div className="ml-top-grid">
      <section className="ml-panel ml-activity" aria-labelledby="ml-activity-title"><div className="ml-heading"><span className="ml-heading-icon ml-red"><Icon name="handshake" size={23} /></span><div><h2 id="ml-activity-title">Hoạt động giao dịch <span className="ml-live"><i /> Công khai</span></h2><p>Cập nhật từ những dự án vừa được kiểm duyệt và công bố</p></div></div><ol className="ml-activity-list">{projects.map((project, index) => <li key={project.id}><span className={`ml-event-icon ml-event-${index % 5}`}><Icon name={['file', 'shield', 'all', 'book', 'industrial'][index % 5]} size={23} /></span><div><p>Dự án vừa được công bố</p><a href={`/projects/${project.id}`}>{project.title}</a></div><span className="ml-time">{elapsed(project.publishedAt)}</span></li>)}</ol>{!projects.length && <div className="ml-empty"><Icon name="clock" size={36} /><h3>{unavailable ? 'Chưa tải được hoạt động' : 'Chưa có hoạt động công khai'}</h3><p>Các lần công bố dự án sẽ được cập nhật tại đây.</p><a href="/projects">Khám phá dự án →</a></div>}<p className="ml-panel-note"><Icon name="shield" size={14} /> Chỉ hiển thị hoạt động công bố; không tiết lộ giao dịch cá nhân.</p></section>
      <section className="ml-panel ml-latest"><Heading icon="clock" title="Dự án mới nhất" href="/projects" /><div className="ml-latest-list">{projects.map(project => <article key={project.id}><a className="ml-thumb-link" href={`/projects/${project.id}`} aria-label={`Xem ${project.title}`}><Thumbnail project={project} /></a><div className="ml-latest-copy"><h3><a href={`/projects/${project.id}`}>{project.title}</a></h3><p><Icon name="pin" size={12} /> {project.provinceCode || 'Đang cập nhật địa điểm'}</p><div><span className="ml-chip">{Object.hasOwn(categoryLabels, project.category) ? categoryLabels[project.category] : project.category}</span>{project.projectStage && <span className="ml-chip ml-chip-blue">{project.projectStage}</span>}{project.purchased && <span className="market-purchased-badge"><span aria-hidden="true">✓</span> Đã mua</span>}</div></div><div className="ml-latest-meta"><span>{elapsed(project.publishedAt)}</span><strong>{formatPoints(project.pricePoints)} POINT</strong></div></article>)}</div>{!projects.length && <div className="ml-empty"><Icon name="all" size={36} /><h3>{unavailable ? 'Danh sách tạm thời chưa sẵn sàng' : 'Chờ những dự án mới'}</h3><p>Dự án sẽ xuất hiện sau khi được duyệt và công bố.</p><a href="/projects">Mở danh sách dự án →</a></div>}</section>
    </div>
    <section className="ml-needs"><Heading icon="clock" title="Tìm theo nhu cầu của bạn" description="Truy cập nhanh các nhóm dự án phù hợp với nhu cầu" href="/projects" /><div className="ml-needs-grid">{needs.map(need => <a className={`ml-need-card ml-need-${need.photo}`} href={need.href} key={need.title}><span className="ml-need-shade" /><div><Icon name={need.icon} size={28} /><h3>{need.title}</h3><p>{need.hint}</p></div><span className="ml-round-arrow" aria-hidden="true">→</span></a>)}</div></section>
    <div className="ml-bottom-grid"><div className="ml-business-column"><section className="ml-suppliers" id="trusted-suppliers"><Heading icon="shield" title="Nhà cung cấp uy tín" description="Tham gia mạng lưới đối tác xây dựng với hồ sơ được xác minh" href="/become-seller" /><div className="ml-supplier-grid">{suppliers.map((supplier, index) => <a href="/become-seller" className={`ml-supplier-card ml-supplier-${index}`} key={supplier.name}><span className="ml-supplier-symbol"><Icon name={supplier.icon} size={38} /></span><h3>{supplier.name}</h3><p>{supplier.caption}</p><span className="ml-supplier-check"><Icon name="shield" size={13} /> Xác minh hồ sơ</span><strong>Tham gia mạng lưới →</strong></a>)}</div><p className="ml-subtle-note">Danh bạ doanh nghiệp công khai đang được hoàn thiện. Các thẻ trên là nhóm đối tác, không phải hồ sơ doanh nghiệp hay xếp hạng.</p></section><section className="ml-transactions"><Heading icon="handshake" title="Giao dịch gần đây" description="Không gian cập nhật hoạt động mua thông tin dự án" /><div className="ml-table-wrap"><table><caption className="ml-sr-only">Giao dịch được phép công khai</caption><thead><tr><th>Thời gian</th><th>Dự án</th><th>Người mua</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody><tr><td colSpan={5}><div className="ml-table-empty"><span><Icon name="shield" size={30} /></span><strong>Chưa có dữ liệu giao dịch được phép công khai</strong><p>Thông tin người mua và lịch sử giao dịch cá nhân được bảo vệ.</p><a href="/account">Truy cập tài khoản của bạn →</a></div></td></tr></tbody></table></div></section></div>
    <section className="ml-news" id="market-updates">
      {cmsEnabled()&&<><Heading icon="book" title="Tin tức & thị trường" href="/news"/>
        {latestNews.length?<ul className="cms-home-news">{latestNews.map(item=><li key={item.slug}><a href={'/news/'+item.slug}>{item.title}</a>
          <time dateTime={item.publishedAt.toISOString()}>{item.publishedAt.toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</time></li>)}</ul>
          :<p>{news.status==='rejected'?'Tin tức tạm thời chưa tải được.':'Chưa có bài viết được xuất bản.'}</p>}</>}
      <Heading icon="book" title="Cẩm nang thực hành" /><p className="ml-news-note">Cẩm nang sử dụng nền tảng</p>
      <div className="ml-news-list">{articles.map(article => <details key={article.title}><summary><span className={`ml-news-photo ml-news-${article.image}`} /><span><strong>{article.title}</strong><small>Hướng dẫn nền tảng <b>＋</b></small></span></summary><div className="ml-news-detail"><p>{article.text}</p><a href={article.href}>{article.action} →</a></div></details>)}</div>
    </section></div>
  </div><section className="ml-join"><div className="ml-container ml-join-inner"><div className="ml-join-copy"><h2>Tham gia {siteIdentity.name}</h2><p>Tiếp cận thông tin dự án xây dựng trên toàn quốc<br />Mở rộng mạng lưới đối tác – Kết nối cơ hội kinh doanh</p><div><a className="ml-join-primary" href="/register">Đăng ký miễn phí</a><a className="ml-join-secondary" href="/guides">Tìm hiểu thêm</a></div></div><div className="ml-join-benefits"><div><span><Icon name="file" size={25} /></span><strong>Đăng ký tài khoản</strong><small>Bắt đầu kết nối</small></div><div><span><Icon name="search" size={25} /></span><strong>Khám phá dự án</strong><small>Tìm thông tin phù hợp</small></div><div><span><Icon name="handshake" size={25} /></span><strong>Kết nối đối tác</strong><small>Trên toàn quốc</small></div></div></div></section></div>;
}
