'use client';
import { useState } from 'react';
import type { ApplicationView } from '../lib/seller/types';
import { documentLabels, documentTypes } from '../lib/seller/workflow';

export default function SellerDocumentUpload({ application, disabled, onSaved, onBusy }: { application: ApplicationView; disabled: boolean; onSaved: () => Promise<void>; onBusy: (busy: boolean) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set('revision', String(application.profile.revision));
    if (!body.get('replaceDocumentId')) body.delete('replaceDocumentId');
    setPending(true); onBusy(true); setError('');
    try {
      const response = await fetch('/api/seller/application/documents', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không thể tải tài liệu.');
      form.reset();
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kết nối.'); }
    finally { setPending(false); onBusy(false); }
  }
  return <section><h2>Tài liệu xác minh</h2><p>Chỉ dùng ảnh JPEG/PNG rõ nét, tối đa 5 MB/tệp theo cấu hình mặc định. Không gửi thông tin không cần thiết; có thể che phần không liên quan. Tệp được lưu riêng tư.</p>
    {disabled && <p role="status">Hãy lưu thông tin đang chỉnh sửa trước khi tải tài liệu.</p>}
    <form className="auth-form" onSubmit={upload} aria-busy={pending}><fieldset disabled={pending || disabled}>
      <label>Loại tài liệu<select name="documentType">{documentTypes.map((type) => <option key={type} value={type}>{documentLabels[type]}</option>)}</select></label>
      <label>Thay tài liệu hiện có (nếu cần)<select name="replaceDocumentId"><option value="">Thêm tài liệu mới</option>{application.documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.originalFilename}</option>)}</select></label>
      <label>Chọn ảnh<input name="file" type="file" accept="image/jpeg,image/png" required /></label>
      <button type="submit" className="button button-secondary">{pending ? 'Đang tải và kiểm tra ảnh…' : 'Tải tài liệu riêng tư'}</button>
    </fieldset>{error && <p className="auth-error" role="alert">{error}</p>}</form>
  </section>;
}
