'use client';

import { useActionState, useState } from 'react';
import { chatMessageLimit } from '../lib/projects/purchase-chat';

const prompts = [
  'Tôi nên liên hệ đơn vị nào trước để tiếp cận hạng mục này?',
  'Dự án hiện có tiếp nhận hồ sơ năng lực hoặc báo giá không?',
  'Đầu mối và tiến độ trong hồ sơ được cập nhật lần gần nhất khi nào?',
];

export default function PurchaseChatForm({ action, buyer }: {
  action: (previous: string, data: FormData) => Promise<string>;
  buyer: boolean;
}) {
  const [error, submit, pending] = useActionState(action, '');
  const [message, setMessage] = useState('');
  return <form action={submit} className="purchase-chat-form">
    {buyer && <details><summary>Gợi ý câu hỏi</summary><div className="fw-actions">
      {prompts.map(prompt => <button className="dash-outline" type="button" key={prompt}
        disabled={pending || !!message.trim()} onClick={() => setMessage(prompt)}>{prompt}</button>)}
    </div></details>}
    <label htmlFor="purchase-message">Tin nhắn</label>
    <textarea id="purchase-message" name="message" rows={4} required maxLength={chatMessageLimit}
      value={message} onChange={event => setMessage(event.target.value)} readOnly={pending}
      placeholder="Nhập nội dung bạn muốn trao đổi về dự án…" />
    {error && <p role="alert">{error}</p>}
    <div className="fw-actions">
      <button className="dash-primary" type="submit" disabled={pending || !message.trim()}>
        {pending ? 'Đang gửi…' : 'Gửi tin nhắn'}
      </button>
      <small>{message.length.toLocaleString('vi-VN')} / 2.000</small>
    </div>
  </form>;
}
