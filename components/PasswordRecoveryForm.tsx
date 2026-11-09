'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '../lib/auth/client';
export default function PasswordRecoveryForm({ mode, enabled }: {
    mode: 'request' | 'reset';
    enabled: boolean;
}) { const params = useSearchParams(), token = params.get('token'); const [pending, setPending] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false); if (!enabled)
    return <div className="identity-empty"><p>Dịch vụ email đang chờ cấu hình. Chức năng khôi phục mật khẩu hiện chưa khả dụng.</p><a href="/login">Về đăng nhập</a></div>; if (mode === 'reset' && (!token || params.get('error')))
    return <p role="alert">Liên kết không hợp lệ hoặc đã hết hạn. <a href="/forgot-password">Yêu cầu liên kết mới</a></p>; if (done)
    return <div role="status" className="identity-success">{mode === 'request' ? 'Yêu cầu đã được tiếp nhận. Nếu email có tài khoản, hãy kiểm tra hộp thư. Nếu chưa nhận được thư, vui lòng thử lại sau.' : 'Đã đặt lại mật khẩu. Các phiên cũ đã được thu hồi.'}<p><a href="/login">Về đăng nhập</a></p></div>; return <form className="identity-form" aria-busy={pending} onSubmit={async (event) => { event.preventDefault(); if (pending)
    return; const data = new FormData(event.currentTarget); if (mode === 'reset' && data.get('password') !== data.get('confirm')) {
    setError('Mật khẩu xác nhận chưa khớp.');
    return;
} setPending(true); setError(''); try {
    const result = mode === 'request' ? await authClient.requestPasswordReset({ email: String(data.get('email')).trim().toLowerCase(), redirectTo: '/reset-password' }) : await authClient.resetPassword({ token: token!, newPassword: String(data.get('password')) });
    if (result.error)
        throw new Error(result.error.status === 429 ? 'Bạn thao tác quá nhanh. Hãy thử lại sau.' : mode === 'reset' ? 'Liên kết không hợp lệ, đã dùng hoặc hết hạn. Hãy yêu cầu liên kết mới.' : 'Chưa thể xử lý yêu cầu. Vui lòng thử lại sau.');
    setDone(true);
}
catch (error) {
    setError(error instanceof Error ? error.message : 'Không thể kết nối.');
}
finally {
    setPending(false);
} }}><fieldset disabled={pending}>{mode === 'request' ? <label>Email đăng nhập<input name="email" type="email" required maxLength={320} autoComplete="email"/></label> : <><label>Mật khẩu mới<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></label><label>Xác nhận mật khẩu<input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></label></>}<button className="button button-primary">{pending ? 'Đang xử lý…' : mode === 'request' ? 'Gửi hướng dẫn' : 'Đặt lại mật khẩu'}</button></fieldset>{error && <p role="alert" className="auth-error">{error}</p>}</form>; }
