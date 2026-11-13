'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '../lib/auth/client';
import { safeReturnTo, validateCredentials, initialRegistrationIntent, registrationDestination, type RegistrationIntent } from '../lib/auth/validation';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const params = useSearchParams();
  const registering = mode === 'register';
  const next = safeReturnTo(params.get('next'), '/workspace');
  const [intent, setIntent] = useState<RegistrationIntent>(() => initialRegistrationIntent(params.get('next')));
  const destination = registering ? registrationDestination(intent, next) : next;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const password = String(data.get('password') ?? '');
    const name = registering ? String(data.get('name') ?? '').trim() : undefined;
    const validation = validateCredentials(email, password, name);
    if (validation) { setError(validation); return; }
    if (registering && password !== data.get('confirmPassword')) { setError('Mật khẩu xác nhận chưa khớp.'); return; }
    setPending(true); setError('');
    try {
      const result = registering ? await authClient.signUp.email({ email, password, name: name!, callbackURL: '/verify-email' }) : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.status === 429 ? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' : registering ? 'Không thể đăng ký. Vui lòng kiểm tra thông tin hoặc đăng nhập nếu đã có tài khoản.' : 'Không thể đăng nhập. Vui lòng kiểm tra thông tin và trạng thái tài khoản.');
        setPending(false); return;
      }
      window.location.assign(destination);
    } catch { setError('Không thể kết nối. Vui lòng thử lại.'); setPending(false); }
  }
  return <form className="auth-form" onSubmit={submit} aria-busy={pending}>{!registering && params.get('changed') === '1' && <p role="status" className="identity-success">Mật khẩu đã cập nhật. Vui lòng đăng nhập lại.</p>}<fieldset disabled={pending}>
    {registering && <><fieldset className="registration-intent" aria-describedby="registration-next"><legend>Bạn muốn bắt đầu như thế nào?</legend><div className="registration-options"><label className={intent==='buyer'?'registration-option is-selected':'registration-option'}><input type="radio" name="registrationIntent" value="buyer" checked={intent==='buyer'} onChange={()=>setIntent('buyer')}/><span><strong>Người mua</strong><small>Tìm dự án và cơ hội kinh doanh</small></span></label><label className={intent==='seller'?'registration-option is-selected':'registration-option'}><input type="radio" name="registrationIntent" value="seller" checked={intent==='seller'} onChange={()=>setIntent('seller')}/><span><strong>Người bán</strong><small>Cung cấp thông tin dự án</small></span></label></div></fieldset><div className="registration-next" id="registration-next" role="status"><strong>{intent==='seller'?'Bước 1/2 · Tạo tài khoản':'Bắt đầu với tài khoản người mua'}</strong><p>{intent==='seller'?'Tiếp theo: hoàn thiện hồ sơ nhà cung cấp. Bạn chỉ cần tạo tài khoản một lần; quyền đăng tin được mở sau khi hồ sơ được duyệt.':'Sau khi đăng ký, bạn có thể khám phá dự án ngay. Bạn vẫn có thể đăng ký trở thành người bán sau này.'}</p></div></>}
    {registering && <label htmlFor="auth-name">Tên hiển thị<input id="auth-name" name="name" autoComplete="name" maxLength={200} required /></label>}
    <label htmlFor="auth-email">Email<input id="auth-email" name="email" type="email" autoComplete="email" maxLength={320} required /></label>
    <label htmlFor="auth-password">Mật khẩu<input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required aria-describedby="password-help" /></label><small id="password-help">Từ 8 đến 128 ký tự.</small>
    {registering && <label htmlFor="auth-confirm">Nhập lại mật khẩu<input id="auth-confirm" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required /></label>}
    <div className="auth-password-actions"><button type="button" className="identity-text-button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</button>{!registering && <a className="identity-forgot" href="/forgot-password">Quên mật khẩu?</a>}</div>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button button-primary" type="submit">{pending ? 'Đang xử lý…' : registering ? intent==='seller'?'Tạo tài khoản và tiếp tục →':'Tạo tài khoản' : 'Đăng nhập'}</button></fieldset>
    <p>{registering ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}<a href={`/${registering ? 'login' : 'register'}?next=${encodeURIComponent(destination)}`}>{registering ? 'Đăng nhập' : 'Đăng ký'}</a></p></form>;
}


