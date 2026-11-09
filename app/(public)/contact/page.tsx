import { siteIdentity } from '../../../lib/site/navigation';
import {editorialMetadata} from '../../../components/EditorialPage';
import Icon from '../../../components/MarketplaceIcon';
import {breadcrumbJson} from '../../../lib/site/seo';
import './contact.css';

export const metadata = editorialMetadata('/contact');

const topics = [
  {number:'01', icon:'search', group:'Người mua', title:'Tìm và mua thông tin',
    text:'Tìm dự án phù hợp, kiểm tra giá POINT và mở thông tin bạn đã mua.',
    href:'/account/help', action:'Hướng dẫn người mua'},
  {number:'02', icon:'helmet', group:'Nhà cung cấp', title:'Hồ sơ và đăng tin',
    text:'Theo dõi kết quả xác minh, kiểm tra phản hồi kiểm duyệt và quản lý tin dự án.',
    href:'/seller/help', action:'Hướng dẫn nhà cung cấp'},
  {number:'03', icon:'wallet', group:'POINT và giao dịch', title:'Kiểm tra giao dịch',
    text:'Đối chiếu số dư, lịch sử nạp điểm hoặc mở đơn mua để xem cách xử lý phù hợp.',
    href:'/account/wallet', action:'Mở ví và lịch sử POINT'},
];

const questions = [
  {title:'Tôi đã mua dự án nhưng chưa tìm thấy thông tin.', text:'Mở Dự án đã mua và chọn đúng đơn. Chi tiết đơn hiển thị nội dung được cấp quyền theo phiên bản bạn đã mua.', href:'/account/purchases', action:'Mở Dự án đã mua'},
  {title:'Tôi cần kiểm tra tiến độ xác minh nhà cung cấp.', text:'Mở hồ sơ nhà cung cấp để xem trạng thái hiện tại và phản hồi nếu hồ sơ cần bổ sung.', href:'/seller/application', action:'Xem hồ sơ nhà cung cấp'},
  {title:'Tôi cần gửi yêu cầu liên quan đến một đơn mua.', text:'Mở chi tiết đơn mua để xem các lựa chọn xử lý phù hợp với trạng thái giao dịch, chẳng hạn yêu cầu hoàn POINT hoặc mở hồ sơ tranh chấp.', href:'/account/purchases', action:'Tìm đơn mua của tôi'},
];

export default function Page() {
  const breadcrumb=breadcrumbJson([{label:'Trang chủ',path:'/'},{label:'Liên hệ',path:'/contact'}]);
  return <main className="contact-page">
    {breadcrumb&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:breadcrumb}}/>}
    <header className="contact-hero">
      <div className="contact-wrap">
        <nav aria-label="Đường dẫn"><ol className="contact-crumbs">
          <li><a href="/">Trang chủ</a></li><li aria-current="page">Liên hệ</li>
        </ol></nav>
        <div className="contact-intro">
          <span className="contact-kicker">{siteIdentity.name}</span>
          <h1>Liên hệ và hỗ trợ</h1>
          <p>Tìm đúng nơi xử lý các vấn đề về tài khoản, hồ sơ nhà cung cấp, tin dự án và giao dịch POINT.</p>
          <div className="contact-hero-actions">
            <a className="contact-primary" href="#kenh-ho-tro">Chọn chủ đề hỗ trợ <span aria-hidden="true">↓</span></a>
            <a className="contact-secondary" href="/guides">Xem cẩm nang <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </div>
    </header>

    <div className="contact-wrap contact-main">
      <section id="kenh-ho-tro" aria-labelledby="contact-topics-title">
        <div className="contact-section-head">
          <span className="contact-kicker">Hỗ trợ theo chủ đề</span>
          <h2 id="contact-topics-title">Bạn cần hỗ trợ về việc gì?</h2>
          <p>Các mục cá nhân sẽ yêu cầu đăng nhập để bảo vệ thông tin tài khoản và giao dịch.</p>
        </div>
        <div className="contact-topic-grid">
          {topics.map(topic=><article className="contact-topic" key={topic.number}>
            <div className="contact-topic-top"><span className="contact-icon" aria-hidden="true"><Icon name={topic.icon} size={25}/></span>
              <span className="contact-topic-number" aria-hidden="true">{topic.number}</span></div>
            <p className="contact-topic-group">{topic.group}</p>
            <h3>{topic.title}</h3><p>{topic.text}</p>
            <a href={topic.href}>{topic.action} <span aria-hidden="true">↗</span></a>
          </article>)}
        </div>
      </section>

      <div className="contact-lower">
        <section aria-labelledby="contact-questions-title">
          <div className="contact-section-head"><span className="contact-kicker">Tình huống thường gặp</span>
            <h2 id="contact-questions-title">Tìm hướng xử lý</h2></div>
          <div className="contact-questions">
            {questions.map(question=><details key={question.title}>
              <summary>{question.title}</summary>
              <div><p>{question.text}</p><a href={question.href}>{question.action} <span aria-hidden="true">→</span></a></div>
            </details>)}
          </div>
          <a className="contact-more" href="/faq">Xem tất cả câu hỏi thường gặp <span aria-hidden="true">→</span></a>
        </section>

        <aside className="contact-checklist" aria-labelledby="contact-checklist-title">
          <span className="contact-icon" aria-hidden="true"><Icon name="file" size={24}/></span>
          <h2 id="contact-checklist-title">Thông tin cần chuẩn bị</h2>
          <ol>
            <li><strong>Mã đơn hoặc tên dự án</strong><span>Lấy từ trang chi tiết để tìm đúng hồ sơ.</span></li>
            <li><strong>Thời điểm và nội dung cần xử lý</strong><span>Ghi lại bước bạn đã thao tác và thông báo lỗi nếu có.</span></li>
            <li><strong>Ảnh minh họa khi cần</strong><span>Che thông tin ngân hàng và dữ liệu cá nhân trước khi chia sẻ.</span></li>
          </ol>
          <p className="contact-privacy"><Icon name="shield" size={18}/> Giữ mật khẩu và mã xác thực cho riêng bạn.</p>
        </aside>
      </div>
    </div>
  </main>;
}
