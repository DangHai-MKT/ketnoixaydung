import AuthExperience from '../../../components/AuthExperience';
import { Suspense } from 'react';
import PasswordRecoveryForm from '../../../components/PasswordRecoveryForm';
import { emailConfigured } from '../../../lib/auth/email';
export const dynamic = 'force-dynamic';
export const metadata = { referrer: 'no-referrer' as const };
export default function ResetPassword() { return <AuthExperience variant="recovery" title="Đặt lại mật khẩu" description="Chọn mật khẩu mới, từ 8 đến 128 ký tự."><Suspense fallback={<p role="status">Đang tải…</p>}><PasswordRecoveryForm mode="reset" enabled={emailConfigured()}/></Suspense></AuthExperience>; }
