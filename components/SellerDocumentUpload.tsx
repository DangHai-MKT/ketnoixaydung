'use client';
import { useState } from 'react';
import type { ApplicationView } from '../lib/seller/types';
import { documentLabels, documentTypes, type DocumentType } from '../lib/seller/workflow';

export default function SellerDocumentUpload({ application, disabled, onContinue, onBack, onBusy }: {
  application: ApplicationView;
  disabled: boolean;
  onContinue: (uploaded: boolean, requiredType: DocumentType) => Promise<boolean>;
  onBack: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [hasSelection, setHasSelection] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const requiredType = application.profile.sellerType === 'business' ? 'business_registration' : 'identity';
  const requiredLabel = documentLabels[requiredType];
  const hasRequired = application.documents.some((doc) => doc.documentType === requiredType);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    const file = body.get('file');
    const uploading = file instanceof File && file.name !== '';
    if (!uploading && !hasRequired && !refreshRequired) {
      setError('Chọn ảnh tài liệu xác minh để tiếp tục.');
      return;
    }
    setPending(true); onBusy(true); setError('');
    try {
      if (uploading) {
        body.set('revision', String(application.profile.revision));
        if (!advanced) body.set('documentType', requiredType);
        if (!body.get('replaceDocumentId')) body.delete('replaceDocumentId');
        const response = await fetch('/api/seller/application/documents', { method: 'POST', body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Không thể tải tài liệu.');
        form.reset();
        setHasSelection(false);
        setAdvanced(false);
        setRefreshRequired(true);
      }
      const complete = await onContinue(uploading || refreshRequired, requiredType);
      setRefreshRequired(false);
      if (!complete) setError(`Hồ sơ vẫn cần: ${requiredLabel}. Hãy chọn ảnh tài liệu này để tiếp tục.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kết nối.'); }
    finally { setPending(false); onBusy(false); }
  }
  return <section><h2>Tài liệu xác minh</h2>
    <p><strong>{hasRequired ? 'Đã lưu' : 'Cần bổ sung'} · {requiredLabel}</strong></p>
    <p>{hasRequired ? 'Bạn có thể tiếp tục ngay hoặc chọn thêm ảnh.' : 'Chọn ảnh và bấm “Lưu ảnh và tiếp tục” để chuyển sang bước kiểm tra hồ sơ.'}</p>
    {application.documents.length > 0 && <ul className="seller-documents" aria-label="Tài liệu đã lưu">
      {application.documents.map((doc) => <li key={doc.id}><a href={`/api/seller/documents/${doc.id}`}>{doc.originalFilename}</a></li>)}
    </ul>}
    {disabled && !pending && <p role="status">Hãy lưu thông tin đang chỉnh sửa trước khi tiếp tục.</p>}
    <form className="auth-form" onSubmit={upload} aria-busy={pending}><fieldset disabled={pending || disabled}>
      <label>{hasRequired ? 'Chọn ảnh nếu cần bổ sung' : 'Chọn ảnh tài liệu'}<input name="file" type="file" accept="image/jpeg,image/png" disabled={refreshRequired} required={!hasRequired || advanced} onChange={(event) => { setHasSelection(Boolean(event.target.files?.length)); setError(''); }} /></label>
      <p>Ảnh JPEG hoặc PNG rõ nét, mặc định tối đa 5 MB. Tệp được lưu riêng tư. Bạn có thể che thông tin không liên quan.</p>
      {!refreshRequired && <button type="button" className="identity-text-button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>{advanced ? 'Ẩn tùy chọn tài liệu' : 'Đổi loại tài liệu hoặc thay ảnh đã lưu'}</button>}
      {advanced && <>
        <label>Loại tài liệu<select name="documentType" defaultValue={requiredType}>{documentTypes.map((type) => <option key={type} value={type}>{documentLabels[type]}</option>)}</select></label>
        {application.documents.length > 0 && <label>Thay ảnh đã lưu<select name="replaceDocumentId"><option value="">Thêm ảnh mới</option>{application.documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.originalFilename}</option>)}</select></label>}
      </>}
      <div className="identity-actions">
        <button type="button" className="button button-secondary" onClick={onBack}>← Thông tin</button>
        <button type="submit" className="button button-primary">{pending ? 'Đang xử lý…' : refreshRequired ? 'Tải lại thông tin hồ sơ' : hasSelection || !hasRequired ? 'Lưu ảnh và tiếp tục →' : 'Tiếp tục kiểm tra hồ sơ →'}</button>
      </div>
    </fieldset>{error && <p className="auth-error" role="alert">{error}</p>}</form>
  </section>;
}
