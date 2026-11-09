'use client';
import { useState } from 'react';
import type { ProjectDetail } from '../lib/projects/types';
export const accessLabels: Record<string, string> = { public_preview: 'Công khai sau khi duyệt', purchased_only: 'Bảo vệ — chỉ người đã mua đúng phiên bản', moderator_only: 'Chỉ chủ sở hữu và kiểm duyệt' };
export default function ProjectFileUpload({ detail, disabled, onSaved, onBusy }: { detail: ProjectDetail; disabled: boolean; onSaved: () => Promise<void>; onBusy: (busy: boolean) => void }) {
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || disabled) return;
    const form = event.currentTarget, body = new FormData(form);
    body.set('revision', String(detail.project.revision)); body.set('versionId', detail.version.id);
    if (!body.get('replaceId')) body.delete('replaceId');
    setPending(true); onBusy(true); setError('');
    try {
      const response = await fetch(`/api/seller/projects/${detail.project.id}/files`, { method: 'POST', body });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Không thể tải tệp.');
      form.reset(); await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kết nối.'); }
    finally { setPending(false); onBusy(false); }
  }
  return <section className="project-editor-section"><h2>Ảnh và tài liệu dự án</h2><p>JPEG/PNG, mặc định tối đa 5 MB/tệp và 5 tệp mỗi phiên bản. Tệp công khai cũng phải chờ duyệt. Không tải tài liệu bạn chưa có quyền chia sẻ.</p>
    {disabled && <p>Lưu thông tin đang sửa trước khi tải tệp.</p>}<form className="auth-form" onSubmit={upload}><fieldset disabled={disabled || pending}>
      <label>Mức truy cập<select name="accessLevel" defaultValue="purchased_only">{Object.entries(accessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p>Chọn công khai chỉ với ảnh không chứa liên hệ, vị trí chính xác hoặc dữ liệu thương mại nhạy cảm. Tài liệu bảo vệ mặc định chỉ mở cho người đã mua đúng phiên bản.</p>
      <label>Thay thế tệp (nếu cần)<select name="replaceId"><option value="">Thêm tệp mới</option>{detail.files.map((file) => <option key={file.id} value={file.id}>{file.originalFilename}</option>)}</select></label>
      <label>Chọn ảnh<input name="file" type="file" accept="image/png,image/jpeg" required /></label><button className="button button-secondary">{pending ? 'Đang kiểm tra và tải tệp…' : 'Tải tệp riêng tư'}</button>
    </fieldset>{error && <p role="alert" className="auth-error">{error}</p>}</form>
  </section>;
}
