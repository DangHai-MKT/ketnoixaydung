import { siteIdentity } from '../../../lib/site/navigation';
import { Suspense } from 'react';
import AuthExperience from '../../../components/AuthExperience';
import AuthForm from '../../../components/AuthForm';
export const metadata = { title: `Đăng nhập | ${siteIdentity.name}` };
export default function LoginPage() {
  return <AuthExperience variant="login" title="Đăng nhập" description="Chào mừng bạn trở lại. Đăng nhập để tiếp tục."><Suspense fallback={<p role="status">Đang chuẩn bị biểu mẫu…</p>}><AuthForm mode="login" /></Suspense></AuthExperience>;
}
