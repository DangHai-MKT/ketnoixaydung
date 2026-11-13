import AuthExperience from '../../../components/AuthExperience';
import { getCurrentActor, hasVerifiedAccountAccess } from '../../../lib/auth/server';
import { emailConfigured } from '../../../lib/auth/email';
import EmailVerificationForm from '../../../components/EmailVerificationForm';

export const dynamic = 'force-dynamic';

export default async function VerifyEmail({searchParams}:{searchParams:Promise<{seller?:string}>}) {
  const seller = (await searchParams).seller === '1';
  const callbackURL = seller ? '/verify-email?seller=1' : '/verify-email';
  const actor = await getCurrentActor();

  return <AuthExperience variant="verify" title="Xác minh email" description="Hoàn thiện bước xác minh email cho tài khoản của bạn.">
    {actor?.status !== 'active' ? <p>Hãy <a href={'/login?next='+encodeURIComponent(callbackURL)}>đăng nhập</a> để kiểm tra trạng thái xác minh.</p>
      : await hasVerifiedAccountAccess(actor) ? <p role="status">{actor.emailVerified ? 'Email của bạn đã được xác minh.' : 'Quản trị viên đã xác thực quyền hoạt động của tài khoản.'} {seller
        ? <a href="/become-seller">Hoàn thiện hồ sơ nhà cung cấp</a>
        : <a href="/account">Vào tài khoản</a>}</p>
      : await emailConfigured() ? <>
        <p>Kiểm tra hộp thư đến và thư rác. Bạn cần xác minh email để vào khu vực người mua.</p>
        <EmailVerificationForm email={actor.email} callbackURL={callbackURL}/>
      </> : <p>Dịch vụ email hiện chưa sẵn sàng. Vui lòng thử lại sau hoặc <a href="/contact">liên hệ hỗ trợ</a>.</p>}
  </AuthExperience>;
}
