import LogoutButton from '../../../components/LogoutButton';
export default function AccessDeniedPage() {
  return <main className="auth-page"><section className="auth-card"><h1>Không thể truy cập</h1><p>Tài khoản chưa có quyền truy cập khu vực này hoặc hiện không hoạt động. Vui lòng liên hệ đơn vị vận hành nếu cần hỗ trợ.</p><p><a href="/">Về trang chủ</a></p><LogoutButton /></section></main>;
}
