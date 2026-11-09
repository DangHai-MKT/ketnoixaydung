'use client';

import { useRef, useState, type FormEvent } from 'react';
import { feedbackRatings, feedbackTopics } from '../lib/site/feedback';

export default function FeedbackForm() {
  const requestId = useRef('');
  const sending = useRef(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const data = new FormData(event.currentTarget);
    requestId.current ||= crypto.randomUUID();
    sending.current = true;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: Number(data.get('rating')), topic: data.get('topic'), comment: data.get('comment'), requestId: requestId.current }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        if (response.status === 400) requestId.current = '';
        throw new Error(result?.error || 'Chưa gửi được góp ý. Vui lòng thử lại.');
      }
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa gửi được góp ý. Vui lòng thử lại.');
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  if (sent) return <div className="identity-success" role="status">
    <strong>Cảm ơn bạn đã góp ý!</strong>
    <p>Đội ngũ Kết Nối Xây Dựng đã nhận được phản hồi của bạn.</p>
    <a href="/account">Về tài khoản →</a>
  </div>;

  return <form className="identity-form site-feedback-form" onSubmit={submit}>
    <fieldset disabled={pending}>
      <fieldset className="site-feedback-rating">
        <legend>Bạn thấy website dễ sử dụng đến mức nào?</legend>
        <div>{feedbackRatings.map((label, index) => <label key={label}>
          <input type="radio" name="rating" value={index + 1} required/>
          <span><strong>{index + 1}</strong>{label}</span>
        </label>)}</div>
      </fieldset>
      <label>Bạn muốn góp ý về phần nào?
        <select name="topic" defaultValue="general">{Object.entries(feedbackTopics).map(([key, label])=><option key={key} value={key}>{label}</option>)}</select>
      </label>
      <label>Điều gì có thể tốt hơn? (không bắt buộc)
        <textarea name="comment" maxLength={800} rows={4} placeholder="Bạn đang làm gì và gặp khó khăn ở bước nào?"/>
      </label>
      <p className="fw-note">Chỉ đội ngũ được phân quyền xem góp ý. Vui lòng bỏ qua mật khẩu, mã OTP và thông tin giao dịch riêng tư.</p>
      <button type="submit" className="button button-primary">{pending ? 'Đang gửi…' : 'Gửi góp ý'}</button>
    </fieldset>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </form>;
}
