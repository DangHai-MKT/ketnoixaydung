'use client';
import { useState } from 'react';
import { authClient } from '../lib/auth/client';

export default function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setPending(true); setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      window.location.assign('/login');
    } catch { setError('Chưa thể đăng xuất. Vui lòng thử lại.'); setPending(false); }
  }
  return <span><button className="button button-secondary" type="button" onClick={logout} disabled={pending}>{pending ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>{error && <span role="alert">{error}</span>}</span>;
}
