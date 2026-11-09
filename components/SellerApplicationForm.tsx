'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ApplicationView } from '../lib/seller/types';
import { editable } from '../lib/seller/workflow';
import SellerApplicationStatus from './SellerApplicationStatus';
import SellerDocumentUpload from './SellerDocumentUpload';

type Fields = { sellerType: 'individual' | 'business'; legalName: string; businessRegistrationNo: string; taxCode: string; contactPhone: string; contactEmail: string; contactAddress: string; authorizedRepresentative: string };
const empty: Fields = { sellerType: 'individual', legalName: '', businessRegistrationNo: '', taxCode: '', contactPhone: '', contactEmail: '', contactAddress: '', authorizedRepresentative: '' };
const labels: Record<Exclude<keyof Fields, 'sellerType'>, string> = { legalName: 'Họ tên / tên pháp lý doanh nghiệp', businessRegistrationNo: 'Mã đăng ký doanh nghiệp', taxCode: 'Mã số thuế', contactPhone: 'Số điện thoại liên hệ', contactEmail: 'Email liên hệ', contactAddress: 'Địa chỉ liên hệ / địa chỉ đăng ký doanh nghiệp', authorizedRepresentative: 'Người đại diện được ủy quyền' };
const maximums = { legalName: 300, businessRegistrationNo: 100, taxCode: 100, contactPhone: 40, contactEmail: 320, contactAddress: 500, authorizedRepresentative: 200 };

export default function SellerApplicationForm({ mode }: { mode: 'edit' | 'status' }) {
  const [application, setApplication] = useState<ApplicationView | null>(null);
  const [fields, setFields] = useState<Fields>(empty);
  const [loading, setLoading] = useState(true);
  const [failedLoad, setFailedLoad] = useState(false);
  const [pending, setPending] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState(1);
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/seller/application', { cache: 'no-store', signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Không thể tải hồ sơ.');
    const value = body.application as ApplicationView | null;
    setApplication(value);
    const next = { ...empty };
    if (value) for (const key of Object.keys(next) as (keyof Fields)[]) Object.assign(next, { [key]: value.profile[key] ?? '' });
    setFields(next); setDirty(false); setFailedLoad(false);
    setStep(current => current === 1 && value ? (editable(value.state) ? 2 : 5) : current);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((cause) => {
      if (!controller.signal.aborted) { setFailedLoad(true); setError(cause.message || 'Không thể tải hồ sơ.'); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);
  async function mutate(url: string, method: string, body: unknown, message: string) {
    setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không thể xử lý hồ sơ.');
      await load(); setNotice(message);
      if (method === 'PUT') setStep(3);
      if (url.endsWith('/submit')) setStep(5);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kết nối.'); }
    finally { setPending(false); }
  }
  if (loading) return <p role="status">Đang tải hồ sơ người bán…</p>;
  if (failedLoad) return <div role="alert"><p>{error}</p><button className="button button-secondary" onClick={() => window.location.reload()}>Thử lại</button></div>;
  const canEdit = !application || editable(application.state);
  const editing = mode === 'edit' && canEdit;
  const keys = (Object.keys(labels) as (Exclude<keyof Fields, 'sellerType'>)[]).filter((key) => fields.sellerType === 'business' || !['businessRegistrationNo', 'taxCode', 'authorizedRepresentative'].includes(key));
  return <div className="seller-workspace identity-seller">
    {mode === 'edit' && <nav className="identity-steps" aria-label="Tiến trình hồ sơ">{['Loại người bán','Thông tin','Tài liệu','Kiểm tra','Theo dõi'].map((label,index)=><span key={label} aria-current={step===index+1?'step':undefined}><b>{index+1}</b>{label}</span>)}</nav>}
    {application && <SellerApplicationStatus application={application} />}
    {!application && mode === 'status' && <p>Bạn chưa có hồ sơ. <a href="/seller/register">Đăng ký người bán</a></p>}
    {mode === 'status' && application && canEdit && <p><a className="button button-primary" href="/seller/register">Chỉnh sửa và bổ sung hồ sơ</a></p>}
    {application?.state === 'verified' && <p><a href="/seller">Mở khu vực người bán</a></p>}
    {mode === 'edit' && !canEdit && <p>Hồ sơ hiện không được chỉnh sửa. <a href="/seller/application">Theo dõi kết quả xét duyệt</a></p>}
    {editing && <>
      <section hidden={step > 2}><h2>{application ? 'Chỉnh sửa thông tin' : 'Đăng ký người bán'}</h2><p>Lưu bản nháp trước, sau đó bổ sung tài liệu và gửi xét duyệt. Không cần nhập số định danh cá nhân vào biểu mẫu.</p>
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (!pending) void mutate('/api/seller/application', 'PUT', { ...fields, revision: application?.profile.revision ?? 0 }, 'Đã lưu bản nháp.'); }} aria-busy={pending}>
          <fieldset disabled={pending || documentBusy}><label>Loại người bán<select value={fields.sellerType} onChange={(event) => { setFields({ ...fields, sellerType: event.target.value as Fields['sellerType'] }); setDirty(true); }}><option value="individual">Cá nhân</option><option value="business">Doanh nghiệp</option></select></label>
            {step === 2 && keys.map((key) => <label key={key}>{labels[key]}<input type={key === 'contactEmail' ? 'email' : key === 'contactPhone' ? 'tel' : 'text'} value={fields[key]} maxLength={maximums[key]} required={key === 'legalName'} onChange={(event) => { setFields({ ...fields, [key]: event.target.value }); setDirty(true); }} /></label>)}
            {step === 1 ? <button type="button" className="button button-primary" onClick={()=>setStep(2)}>Tiếp tục nhập thông tin →</button> : <div className="identity-actions"><button type="button" className="button button-secondary" onClick={()=>setStep(1)}>← Loại người bán</button><button className="button button-primary" type="submit">{pending ? 'Đang xử lý…' : 'Lưu bản nháp và tiếp tục'}</button></div>}
          </fieldset>
        </form>
      </section>
      {application && <>
        <div hidden={step !== 3}><SellerDocumentUpload application={application} disabled={dirty || pending} onBusy={setDocumentBusy} onSaved={async () => { await load(); setNotice('Đã lưu tài liệu riêng tư.'); }} /><div className="identity-actions"><button type="button" className="button button-secondary" disabled={pending||documentBusy} onClick={()=>setStep(2)}>← Thông tin</button><button type="button" className="button button-primary" disabled={pending||documentBusy||dirty} onClick={()=>setStep(4)}>Kiểm tra hồ sơ →</button></div></div>
        <section hidden={step !== 4}><h2>Kiểm tra trước khi gửi</h2><dl className="identity-details">{keys.map(key=><div key={key}><dt>{labels[key]}</dt><dd>{fields[key]||'Chưa cung cấp'}</dd></div>)}</dl><p>{application.documents.length} tài liệu riêng tư đã lưu.</p><button type="button" className="identity-text-button" disabled={pending||documentBusy} onClick={()=>setStep(3)}>← Quay lại tài liệu</button><h2>Gửi xét duyệt</h2><p>Sau khi gửi, thông tin và tài liệu được khóa trong thời gian xét duyệt. Chỉ gửi tài liệu bạn có quyền cung cấp.</p>
          <button type="button" className="button button-primary" disabled={pending || documentBusy || dirty || application.missing.length > 0} onClick={() => void mutate('/api/seller/application/submit', 'POST', { revision: application.profile.revision }, 'Đã gửi hồ sơ. Bạn có thể theo dõi tại trang trạng thái.')}>{pending ? 'Đang xử lý…' : 'Gửi hồ sơ xét duyệt'}</button>
          {dirty && <p>Hãy lưu thay đổi trước khi gửi.</p>}
        </section>
      </>}
    </>}
    {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="seller-success" role="status">{notice}</p>}
  </div>;
}

