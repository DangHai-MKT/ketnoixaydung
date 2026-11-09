'use client';
import { useEffect, useState } from 'react';
import { authClient } from '../lib/auth/client';
import { adminRoles, type Actor } from '../lib/auth/permissions';
import {defaultWorkspace} from '../lib/dashboard/navigation';
import LogoutButton from './LogoutButton';

export default function AccountNavigation() {
  const { data: session, isPending, error } = authClient.useSession();
  const [account, setAccount] = useState<{ sessionId: string; actor: Actor | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const sessionId = session?.session.id;
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    setFailed(false);
    fetch('/api/account', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (response.status === 401 || response.status === 403) { setAccount({ sessionId, actor: null }); return; }
      if (!response.ok) throw new Error();
      const body = await response.json();
      setAccount({ sessionId, actor: body.user });
    }).catch((cause: unknown) => {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setFailed(true);
    });
    return () => controller.abort();
  }, [sessionId]);
  if (isPending) return <span role="status">Đang tải tài khoản…</span>;
  if (error) return <a href="/login">Mở tài khoản</a>;
  if (!session) return <><a className="login-link" href="/login">Đăng nhập</a><a className="register-link" href="/register">Đăng ký</a></>;
  const actor = account && account.sessionId === sessionId ? account.actor : null;
  return <><a href={actor ? defaultWorkspace(actor.roles) : "/workspace"}>{actor?.displayName || 'Tài khoản'}</a>{actor && adminRoles.some((role) => actor.roles.includes(role)) && <a href="/admin">Quản trị</a>}{failed && <span role="status">Chưa tải được quyền truy cập.</span>}<LogoutButton /></>;
}
