import AuthExperience from '../../../components/AuthExperience';
import { Suspense } from 'react';
import PasswordRecoveryForm from '../../../components/PasswordRecoveryForm';
import { emailConfigured } from '../../../lib/auth/email';
export const dynamic = 'force-dynamic';
export default function ForgotPassword() { return <AuthExperience variant="recovery" title="Quên mật khẩu?" description="Nhập email đăng ký để nhận hướng dẫn khôi phục truy cập."><Suspense fallback={<p role="status">Đang tải…</p>}><PasswordRecoveryForm mode="request" enabled={emailConfigured()}/></Suspense></AuthExperience>; }
