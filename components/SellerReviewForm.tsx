'use client';
import { useEffect, useState } from 'react';
import type { ApplicationView } from '../lib/seller/types';
import SellerApplicationStatus from './SellerApplicationStatus';

export default function SellerReviewForm({ applicationId, reviewerId }: { applicationId: string; reviewerId: string }) {
  const [application, setApplication] = useState<ApplicationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    const response = await fetch(`/api/admin/sellers/${applicationId}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Không thể tải hồ sơ.');
    setApplication(body.application);
  }
  useEffect(() => { load().catch((cause) => setError(cause.message)).finally(() => setLoading(false)); }, [applicationId]);
  async function review(action: string) {
    if (!application || pending) return;
    if (action !== 'approve' && !reason.trim()) { setError('Vui lòng ghi lý do hoặc thông tin cần bổ sung.'); return; }
    setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/sellers/${applicationId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason, revision: application.profile.revision }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không thể xét duyệt.');
      await load(); setReason(''); setNotice('Đã ghi nhận quyết định và gửi thông báo trong ứng dụng.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kết nối.'); }
    finally { setPending(false); }
  }
  if (loading) return <p role="status">Đang tải chi tiết hồ sơ…</p>;
  return <div className="seller-workspace">{application && <><SellerApplicationStatus application={application} reviewer />
    {application.profile.userId === reviewerId ? <p>Bạn không được xét duyệt hồ sơ của chính mình.</p> : ['pending', 'verified', 'suspended'].includes(application.state) && <section className="auth-form"><h2>Quyết định xét duyệt</h2><fieldset disabled={pending}>
      <label>Lý do / hướng dẫn bổ sung<textarea value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></label><small>Phản hồi này được người nộp hồ sơ xem. Không nhập dữ liệu xác minh nhạy cảm.</small>
      <div className="seller-actions">{application.state === 'pending' && <><button className="button button-primary" onClick={() => void review('approve')}>Phê duyệt</button><button className="button button-secondary" onClick={() => void review('reject')}>Từ chối</button></>}
        {['pending', 'suspended'].includes(application.state) && <button className="button button-secondary" onClick={() => void review('request_changes')}>Yêu cầu bổ sung</button>}
        {application.state === 'verified' && <button className="button button-secondary" onClick={() => void review('suspend')}>Tạm đình chỉ</button>}
      </div></fieldset>{pending && <p role="status">Đang ghi nhận quyết định…</p>}</section>}
  </>}{error && <div role="alert"><p className="auth-error">{error}</p><button className="button button-secondary" onClick={() => window.location.reload()}>Tải lại hồ sơ</button></div>}{notice && <p role="status">{notice}</p>}</div>;
}
