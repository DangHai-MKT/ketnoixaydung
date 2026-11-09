'use client';
import { useRef, useState } from 'react';
import ConfirmActionDialog from './ConfirmActionDialog';
import {roleLabels} from '../lib/account/labels';
import { useRouter } from 'next/navigation';

type Props = { userId: string; roles: string[]; status: string; updatedAt: string; self: boolean };
export default function AdminUserActions({ userId, roles, status, updatedAt, self }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState('status');
  const [review, setReview] = useState({ role: '', reason: '' });
  if (self || status === 'closed') return <p>Không được thay đổi chính mình hoặc tài khoản đã đóng.</p>;

  async function confirm() {
    setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, role: review.role || undefined, status: status === 'active' ? 'suspended' : 'active', reason: review.reason, updatedAt }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không thể cập nhật.');
      setConfirmOpen(false); setNotice('Đã cập nhật tài khoản và ghi nhận lịch sử.'); router.refresh();
    } catch (cause) {
      setConfirmOpen(false); setError(cause instanceof Error ? cause.message : 'Không thể kết nối.');
    } finally { setPending(false); }
  }
  return <>
    <form ref={form} className="identity-form" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      setReview({ role: String(data.get('role') || ''), reason: String(data.get('reason') || '') }); setConfirmOpen(true);
    }}>
      <fieldset disabled={pending}>
        <label>Thao tác<select name="action" value={action} onChange={event => setAction(event.target.value)}>
          <option value="status">{status === 'active' ? 'Tạm khóa tài khoản' : 'Mở lại tài khoản'}</option><option value="revoke" disabled={!roles.some(role=>role!=='buyer')}>Thu hồi vai trò</option>
        </select></label>
        {action === 'revoke' && <label>Vai trò<select name="role" required defaultValue=""><option value="" disabled>Chọn vai trò</option>{roles.filter(role => role !== 'buyer').map(role => <option key={role} value={role}>{roleLabels[role] || role}</option>)}</select></label>}
        <label>Lý do<textarea name="reason" required maxLength={1000}/></label>
        <button className="button button-primary">Xem lại và xác nhận</button>
      </fieldset>
      {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status" className="identity-success">{notice}</p>}
    </form>
    <ConfirmActionDialog open={confirmOpen} pending={pending} title="Xác nhận thay đổi tài khoản" onClose={()=>{if(!pending)setConfirmOpen(false);}} onConfirm={confirm}>

      <p className="identity-hint">Tài khoản: {userId}</p>
      <p>{action === 'revoke' ? `Thu hồi vai trò ${review.role} và kết thúc các phiên đăng nhập.` : status === 'active' ? 'Tạm khóa tài khoản và kết thúc các phiên đăng nhập.' : 'Mở lại tài khoản; giữ nguyên trạng thái xác minh người bán.'}</p>
      <p>Lý do: {review.reason}</p>
    </ConfirmActionDialog>
  </>;
}



