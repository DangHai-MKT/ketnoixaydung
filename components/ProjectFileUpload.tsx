'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { ProjectDetail } from '../lib/projects/types';

export const accessLabels: Record<string, string> = {
  public_preview: 'Công khai sau khi duyệt',
  purchased_only: 'Bảo vệ — chỉ người đã mua đúng phiên bản',
  moderator_only: 'Chỉ chủ sở hữu và kiểm duyệt',
};

const images = '.jpeg,.jpg,.png,.webp';
const allFiles = images + ',.pdf,.doc,.docx';

export default function ProjectFileUpload({ detail, disabled, onSaved, onBusy }: {
  detail: ProjectDetail;
  disabled: boolean;
  onSaved: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const protectedInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const [advancedAccess, setAdvancedAccess] = useState('moderator_only');
  const locked = disabled || Boolean(pending) || needsReload;

  async function run(label: string, work: () => Promise<void>) {
    if (busy.current || disabled) return;
    busy.current = true;
    setPending(label);
    setError('');
    onBusy(true);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể kết nối. Vui lòng thử lại.');
    } finally {
      busy.current = false;
      setPending('');
      onBusy(false);
    }
  }

  async function reload() {
    try {
      await onSaved();
      setNeedsReload(false);
    } catch {
      setNeedsReload(true);
      throw new Error('Tệp đã lưu. Hãy cập nhật danh sách trước khi tải thêm.');
    }
  }

  async function upload(file: File, access: string, replaceId = '') {
    if (locked) return;
    await run('Đang tải ' + file.name + '…', async () => {
      const body = new FormData();
      body.set('file', file);
      body.set('accessLevel', access);
      body.set('revision', String(detail.project.revision));
      body.set('versionId', detail.version.id);
      if (replaceId) body.set('replaceId', replaceId);
      const response = await fetch(`/api/seller/projects/${detail.project.id}/files`, { method: 'POST', body });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Không thể tải tệp. Vui lòng thử lại.');
      await reload();
    });
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>, access: string) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void upload(file, access);
  }

  function advancedSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    const file = body.get('file');
    if (file instanceof File && file.name) {
      form.reset();
      void upload(file, advancedAccess, String(body.get('replaceId') ?? ''));
    }
  }

  return <section className="project-editor-section" aria-busy={Boolean(pending)}>
    <h2>Thêm ảnh hoặc tài liệu</h2>
    <p>Có thể bỏ qua bước này nếu chưa có tệp. Tệp sẽ tự tải lên ngay khi bạn chọn.</p>
    <div className="project-form-grid">
      <div className="p2-quick-panel">
        <h3>Ảnh công khai</h3>
        <p>JPEG, JPG, PNG, WebP. Ảnh đầu tiên làm ảnh đại diện sau khi tin được duyệt.</p>
        <input ref={photoInput} type="file" hidden accept={images} disabled={locked} onChange={event=>selectFile(event,'public_preview')}/>
        <button type="button" className="button button-primary" disabled={locked} onClick={()=>photoInput.current?.click()}>Thêm ảnh công khai</button>
      </div>
      <div className="p2-quick-panel">
        <h3>Tài liệu dành cho người mua</h3>
        <p>Ảnh, PDF hoặc Word. Người mua chỉ mở được tệp thuộc phiên bản đã mua.</p>
        <input ref={protectedInput} type="file" hidden accept={allFiles} disabled={locked} onChange={event=>selectFile(event,'purchased_only')}/>
        <button type="button" className="button button-secondary" disabled={locked} onClick={()=>protectedInput.current?.click()}>Chọn tài liệu</button>
      </div>
    </div>
    {disabled && <p>Lưu bản nháp trước khi tải tệp.</p>}
    {pending && <p role="status">{pending}</p>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    {needsReload && <button type="button" className="button button-secondary" disabled={disabled || Boolean(pending)}
      onClick={()=>void run('Đang cập nhật danh sách…', reload)}>Cập nhật danh sách tệp</button>}
    <details>
      <summary>Thay tệp hoặc gửi riêng cho kiểm duyệt</summary>
      <form className="auth-form" onSubmit={advancedSubmit}><fieldset disabled={locked}>
        <label>Tệp cần thay<select name="replaceId"><option value="">Thêm tệp mới</option>{detail.files.map(file=><option key={file.id} value={file.id}>{file.originalFilename}</option>)}</select></label>
        <label>Ai được xem?<select value={advancedAccess} onChange={event=>setAdvancedAccess(event.target.value)}>{Object.entries(accessLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Chọn tệp<input key={advancedAccess} name="file" type="file" accept={advancedAccess==='public_preview'?images:allFiles} required/></label>
        <button type="submit" className="button button-secondary">Lưu tệp</button>
      </fieldset></form>
    </details>
  </section>;
}
