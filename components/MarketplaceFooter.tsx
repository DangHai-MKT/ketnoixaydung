'use client';
import SiteBrandMark from './SiteBrandMark';
import { Suspense, useEffect } from 'react';
import PublicAnalytics from './PublicAnalytics';
import Icon from './MarketplaceIcon';
import { footerNavigation, siteIdentity } from '../lib/site/navigation';

type SupportLine = { label: string; phone: string; hours: string };

export default function MarketplaceFooter({ supportLines, analyticsId }: { supportLines: SupportLine[]; analyticsId: string }) {
  const configuredLines = supportLines.filter(line => line.phone);
  useEffect(() => {
    const reveal = () => {
      const panel = document.getElementById(window.location.hash.slice(1));
      if (panel instanceof HTMLDetailsElement && panel.closest('.ml-footer')) panel.open = true;
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  return <footer className="ml-footer" id="contact"><div className="ml-container"><div className="ml-footer-grid">
    <div className="ml-footer-about"><a className="ml-footer-brand" href="/"><SiteBrandMark /><span><strong>{siteIdentity.name}</strong><small>{siteIdentity.tagline}</small></span></a><p>Nền tảng giao dịch thông tin dự án xây dựng Việt Nam. Kết nối doanh nghiệp, hợp tác và tạo giá trị cho tương lai.</p><div className="ml-footer-values"><span><Icon name="shield" size={18} /></span><span><Icon name="file" size={18} /></span><span><Icon name="handshake" size={18} /></span><small>Minh bạch · Bảo vệ dữ liệu · Kết nối</small></div>
      <section className="ml-footer-hotlines" aria-labelledby="footer-hotlines">
        <h2 id="footer-hotlines">Tổng đài hỗ trợ</h2>
        {configuredLines.length ? <ul>{configuredLines.map(({ label, phone, hours }) => (
          <li key={label}>
            {label}{': '}<a href={`tel:${phone.replace(/[ .-]/g, '')}`}>{phone}</a> <span>({hours})</span>
          </li>
        ))}</ul> : <a href="/contact">Xem các kênh liên hệ hỗ trợ →</a>}
      </section>
    </div>
    <nav aria-label="Liên kết nhanh"><h2>Liên kết nhanh</h2>{footerNavigation.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
    <div className="ml-footer-help"><h2>Hỗ trợ khách hàng</h2><details id="how-it-works"><summary>Hướng dẫn sử dụng</summary><p>1. Tạo tài khoản và tìm dự án phù hợp.<br />2. Nhà cung cấp hoàn thiện hồ sơ xác minh.<br />3. Tin và giá được xét duyệt theo phiên bản trước khi công bố.</p><a href="/projects">Khám phá dự án →</a></details><details id="market-faq"><summary>Câu hỏi thường gặp</summary><p>Muốn đăng tin? Hãy xác minh hồ sơ người bán. Muốn tìm dự án? Dùng bộ lọc từ khóa, tỉnh thành, danh mục và giá POINT. Bản sửa chờ duyệt không thay đổi tin đang công khai.</p></details><details id="market-terms"><summary>Quy định &amp; điều khoản</summary><p>Bộ điều khoản chính thức đang được hoàn thiện trước khi vận hành thương mại. Nội dung hướng dẫn hiện có không thay thế điều khoản sử dụng.</p></details><details id="market-privacy"><summary>Chính sách bảo mật</summary><p>Trang chủ chỉ hiển thị dữ liệu dự án công khai đã duyệt. Hồ sơ xác minh, dữ liệu bảo vệ và thông tin giao dịch cá nhân không được đưa lên trang chủ. Chính sách chính thức sẽ được cập nhật trước khi vận hành thương mại.</p></details><a href="/contact">Liên hệ hỗ trợ tài khoản →</a></div>
    <div className="ml-footer-contact">
      <section className="ml-footer-newsletter"><h2>Đăng ký nhận tin</h2><p>Cập nhật dự án mới và thông tin thị trường.</p><p className="ml-newsletter-status">Tính năng nhận tin qua email chưa mở.</p><a href="/register">Tạo tài khoản để bắt đầu kết nối →</a></section>
    </div>
  </div><div className="ml-footer-bottom"><span>© {new Date().getFullYear()} {siteIdentity.name}. Tất cả quyền được bảo lưu.</span><nav aria-label="Thông tin nền tảng"><a href="#market-terms">Điều khoản</a><a href="#market-privacy">Chính sách bảo mật</a><a href="/contact">Liên hệ</a>{analyticsId&&<Suspense><PublicAnalytics key={analyticsId} measurementId={analyticsId}/></Suspense>}</nav></div></div></footer>;
}
