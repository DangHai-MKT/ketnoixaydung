import { siteIdentity } from '../../../lib/site/navigation';
import { Suspense } from 'react';
import AuthExperience from '../../../components/AuthExperience';
import AuthForm from '../../../components/AuthForm';
export const metadata = { title: `Đăng ký | ${siteIdentity.name}` };
export default function RegisterPage() {
  return <AuthExperience variant="register" title="Tạo tài khoản" description="Chọn nhu cầu của bạn. Một tài khoản cho cả mua và cung cấp thông tin."><Suspense fallback={<p role="status">Đang chuẩn bị biểu mẫu…</p>}><AuthForm mode="register" /></Suspense></AuthExperience>;
}
