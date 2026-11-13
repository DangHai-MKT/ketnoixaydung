import AuthExperience from '../../../components/AuthExperience';
import { getCurrentActor } from '../../../lib/auth/server';
import { getOwnProfile } from '../../../services/account-profile';
import { emailConfigured } from '../../../lib/auth/email';
import EmailVerificationForm from '../../../components/EmailVerificationForm';
export const dynamic = 'force-dynamic';
export default async function VerifyEmail() { const actor = await getCurrentActor(); const profile = actor?.status === 'active' ? await getOwnProfile(actor) : null; return <AuthExperience variant="verify" title="Xác minh email" description="Hoàn thiện bước xác minh email cho tài khoản của bạn.">{!profile ? <p>Hãy <a href="/login?next=%2Fverify-email">đăng nhập</a> để kiểm tra trạng thái xác minh.</p> : profile.emailVerified ? <p role="status">Email của bạn đã được xác minh. <a href="/account/profile">Về hồ sơ</a></p> : (await emailConfigured()) ? <><p>Gửi liên kết xác minh đến email đăng nhập của bạn.</p><EmailVerificationForm email={profile.email}/><p className="identity-hint">Chưa nhận được email? Bạn có thể liên hệ đơn vị vận hành để admin xác thực quyền hoạt động độc lập với email.</p></> : <p>Dịch vụ email đang chờ cấu hình. Bạn có thể liên hệ đơn vị vận hành để admin xác thực quyền hoạt động của tài khoản, không phụ thuộc xác minh email.</p>}</AuthExperience>; }
