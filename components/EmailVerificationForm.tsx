'use client';
import { useState } from 'react';
import { authClient } from '../lib/auth/client';
export default function EmailVerificationForm({ email }: {
    email: string;
}) { const [pending, setPending] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(false); return <div><button className="button button-primary" disabled={pending} onClick={async () => { setPending(true); setMessage(''); try {
    const result = await authClient.sendVerificationEmail({ email, callbackURL: '/verify-email' });
    if (result.error)
        throw new Error();
    setError(false);
    setMessage('Đã gửi yêu cầu xác minh. Vui lòng kiểm tra hộp thư.');
}
catch {
    setError(true);
    setMessage('Không thể gửi email. Vui lòng thử lại sau.');
}
finally {
    setPending(false);
} }}>{pending ? 'Đang gửi…' : 'Gửi email xác minh'}</button>{message && <p role={error ? 'alert' : 'status'}>{message}</p>}</div>; }
