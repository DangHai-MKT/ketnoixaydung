'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function ProfileForm({ profile }: {
    profile: {
        displayName: string;
        phone: string | null;
        updatedAt: string;
    };
}) { const router = useRouter(); const [version, setVersion] = useState(profile.updatedAt), [pending, setPending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''); return <form className="identity-form" aria-busy={pending} onSubmit={async (event) => { event.preventDefault(); if (pending)
    return; const data = new FormData(event.currentTarget); setPending(true); setError(''); setNotice(''); try {
    const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: data.get('displayName'), phone: data.get('phone'), updatedAt: version }) });
    const body = await response.json();
    if (!response.ok)
        throw new Error(body.error || 'Không thể lưu hồ sơ.');
    setVersion(body.profile.updatedAt);
    setNotice('Đã cập nhật hồ sơ cá nhân.');
    router.refresh();
}
catch (error) {
    setError(error instanceof Error ? error.message : 'Không thể kết nối.');
}
finally {
    setPending(false);
} }}><fieldset disabled={pending}><label>Họ và tên<input name="displayName" defaultValue={profile.displayName} required maxLength={200} autoComplete="name"/></label><label>Số điện thoại<input name="phone" defaultValue={profile.phone || ''} type="tel" maxLength={40} autoComplete="tel"/></label><p className="identity-hint">Thông tin này thuộc tài khoản cá nhân. Hồ sơ pháp lý nhà cung cấp được quản lý riêng.</p><button className="button button-primary">{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button></fieldset>{error && <p role="alert" className="auth-error">{error} <button type="button" onClick={() => window.location.reload()}>Tải lại hồ sơ</button></p>}{notice && <p role="status" className="identity-success">{notice}</p>}</form>; }
