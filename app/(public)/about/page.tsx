import { siteIdentity } from '../../../lib/site/navigation';
import {editorialMetadata} from '../../../components/EditorialPage';
import Icon from '../../../components/MarketplaceIcon';
import {breadcrumbJson} from '../../../lib/site/seo';
import './about.css';

export const metadata = editorialMetadata('/about');

const audiences = [
  {label:'Dành cho người mua',title:'Tìm đúng cơ hội xây dựng',icon:'search',href:'/projects',action:'Khám phá dự án',
    items:['Lọc dự án theo lĩnh vực, khu vực và giai đoạn.','Xem mô tả công khai và giá POINT trước khi mua.','Mở nội dung đã mua từ lịch sử đơn của bạn.']},
  {label:'Dành cho nhà cung cấp',title:'Đưa nguồn tin đến đúng người',icon:'helmet',href:'/become-seller',action:'Bắt đầu với hồ sơ nhà cung cấp',
    items:['Hoàn thiện hồ sơ xác minh để đăng tin.','Tự đặt giá và chọn thông tin được công khai.','Theo dõi phản hồi kiểm duyệt theo từng phiên bản.']},
];

const steps = [
  {number:'01',title:'Chuẩn bị và gửi tin',text:'Nhà cung cấp xác minh hồ sơ, soạn nội dung và tách riêng thông tin bảo vệ.'},
  {number:'02',title:'Kiểm duyệt và công bố',text:'Kiểm duyệt viên xem xét nội dung và quyền cung cấp. Phiên bản được duyệt mới hiển thị công khai.'},
  {number:'03',title:'Xem thông tin theo quyền',text:'Người mua xem trước phần công khai và dùng POINT để mở nội dung bảo vệ của phiên bản đã mua.'},
];

export default function Page() {
  const breadcrumb=breadcrumbJson([{label:'Trang chủ',path:'/'},{label:'Giới thiệu',path:'/about'}]);
  return <main className="about-page">
    {breadcrumb&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:breadcrumb}}/>}
    <header className="about-hero">
      <div className="about-wrap">
        <nav aria-label="Đường dẫn"><ol className="about-crumbs"><li><a href="/">Trang chủ</a></li><li aria-current="page">Giới thiệu</li></ol></nav>
        <div className="about-hero-grid">
          <div className="about-intro">
            <span className="about-kicker">Giới thiệu {siteIdentity.name}</span>
            <h1>Kết nối thông tin.<br/> <em>Mở cơ hội xây dựng.</em></h1>
            <p>Sàn thông tin dự án xây dựng tại Việt Nam, nơi nhà cung cấp đăng nguồn tin và doanh nghiệp tìm cơ hội phù hợp với nhu cầu của mình.</p>
            <div className="about-actions"><a className="about-primary" href="/projects">Khám phá dự án <span aria-hidden="true">→</span></a>
              <a className="about-outline" href="#cach-van-hanh">Sàn hoạt động thế nào? <span aria-hidden="true">↓</span></a></div>
          </div>
          <div className="about-hero-media" aria-hidden="true"><div><Icon name="industrial" size={22}/><span>NỀN TẢNG THÔNG TIN DỰ ÁN XÂY DỰNG</span></div></div>
        </div>
      </div>
    </header>

    <div className="about-wrap about-content">
      <section aria-labelledby="about-audiences">
        <div className="about-section-head"><span className="about-kicker">Hai cách tham gia</span>
          <h2 id="about-audiences">Tìm nguồn tin hoặc chia sẻ cơ hội</h2>
          <p>Chọn lối đi phù hợp với công việc của bạn trên sàn.</p></div>
        <div className="about-audience-grid">{audiences.map(item=><article className="about-audience" key={item.href}>
          <div className="about-audience-top"><span className="about-icon" aria-hidden="true"><Icon name={item.icon} size={24}/></span><span>{item.label}</span></div>
          <h3>{item.title}</h3>
          <ul>{item.items.map(text=><li key={text}><span aria-hidden="true">✓</span>{text}</li>)}</ul>
          <a href={item.href}>{item.action} <span aria-hidden="true">→</span></a>
        </article>)}</div>
      </section>

      <section className="about-flow" id="cach-van-hanh" aria-labelledby="about-flow-title">
        <div className="about-section-head"><span className="about-kicker">Quy trình trên sàn</span>
          <h2 id="about-flow-title">Từ bản nháp đến thông tin đã mua</h2></div>
        <ol>{steps.map(step=><li key={step.number}><span aria-hidden="true">{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
      </section>

      <aside className="about-protection" aria-labelledby="about-protection-title">
        <span className="about-icon" aria-hidden="true"><Icon name="shield" size={26}/></span>
        <div><h2 id="about-protection-title">Thông tin công khai và thông tin bảo vệ</h2>
          <p>Phần công khai giúp bạn đánh giá mức độ phù hợp. Thông tin liên hệ và tài liệu bảo vệ chỉ hiển thị theo quyền truy cập của từng phiên bản.</p></div>
        <a href="/guides">Xem hướng dẫn <span aria-hidden="true">→</span></a>
      </aside>
      <footer className="about-footer"><div><h2>Cần tìm hiểu thêm?</h2><p>Chọn chủ đề hỗ trợ về tài khoản, đăng tin hoặc giao dịch POINT.</p></div>
        <a className="about-primary" href="/contact">Liên hệ và hỗ trợ <span aria-hidden="true">→</span></a></footer>
    </div>
  </main>;
}
