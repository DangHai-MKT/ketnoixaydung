'use client';
import { useState } from 'react';
import { authClient } from '../lib/auth/client';
export default function AccountSecurityForm() { const [pending, setPending] = useState(false), [error, setError] = useState(''), [show, setShow] = useState(false); return <form className="identity-form" aria-busy={pending} onSubmit={async (event) => { event.preventDefault(); if (pending)
    return; const data = new FormData(event.currentTarget); if (data.get('newPassword') !== data.get('confirm')) {
    setError('Mật khẩu xác nhận chưa khớp.');
    return;
} setPending(true); setError(''); try {
    const result = await authClient.changePassword({ currentPassword: String(data.get('current')), newPassword: String(data.get('newPassword')), revokeOtherSessions: true });
    if (result.error)
        throw new Error('Không thể đổi mật khẩu. Kiểm tra mật khẩu hiện tại và thử lại.');
    await authClient.signOut();
    window.location.assign('/login?changed=1');
}
catch (error) {
    setError(error instanceof Error ? error.message : 'Không thể kết nối.');
    setPending(false);
} }}><fieldset disabled={pending}><label>Mật khẩu hiện tại<input name="current" type={show ? 'text' : 'password'} autoComplete="current-password" required maxLength={128}/></label><label>Mật khẩu mới<input name="newPassword" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128}/></label><label>Xác nhận mật khẩu mới<input name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128}/></label><button type="button" className="identity-text-button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</button><p className="identity-hint">Sau khi đổi, các phiên khác bị thu hồi và bạn sẽ đăng nhập lại.</p><button className="button button-primary">{pending ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</button></fieldset>{error && <p role="alert" className="auth-error">{error}</p>}</form>; }
