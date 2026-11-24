'use client';

import {useState, type ChangeEvent} from 'react';
import {useRouter} from 'next/navigation';
import {directoryMaxBytes, parsePartnerDirectory} from '../lib/site/partner-directory-csv';

export default function PartnerDirectoryImport() {
  const router=useRouter();
  const [text,setText]=useState('');
  const [rows,setRows]=useState<ReturnType<typeof parsePartnerDirectory>>([]);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const errors=rows.filter(row=>row.error);

  async function preview(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];
    setText('');setRows([]);setError('');setNotice('');
    if (!file) return;
    setBusy(true);
    try {
      if(file.size>directoryMaxBytes) throw Error('Tệp vượt quá 10 MB.');
      const data=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      const response=await fetch('/api/admin/partner-directory',{method:'POST',
        headers:{'Content-Type':'text/csv;charset=utf-8','X-Preview-Only':'1'},body:data});
      const result=await response.json();
      if (!response.ok) throw Error(result.error || 'Chưa đối chiếu được địa chỉ. Hãy thử lại.');
      setRows(result.rows);setText(data);
    } catch(cause) {setError(cause instanceof TypeError?'Hãy lưu tệp dưới dạng CSV UTF-8.':(cause as Error).message);}
    finally {setBusy(false);}
  }

  async function confirm() {
    if (busy || !text || errors.length) return;
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/admin/partner-directory',{method:'POST',headers:{'Content-Type':'text/csv;charset=utf-8'},body:text});
      const result=await response.json();
      if(!response.ok) throw Error(result.error || 'Chưa nhập được danh bạ.');
      setNotice(`Đã nhập ${result.inserted} hồ sơ mới. Bỏ qua ${result.skipped} hồ sơ trùng.`);
      setText('');setRows([]);router.refresh();
    } catch(cause) {setError((cause as Error).message);}
    finally {setBusy(false);}
  }

  return <div className="partner-form"><fieldset disabled={busy}>
    <a href="/mau-ho-so-doanh-nghiep.csv" download>Tải CSV mẫu</a>
    <p>Tối đa 10 MB và 10.000 hồ sơ mỗi tệp CSV UTF-8.</p>
    <label>Chọn CSV UTF-8<input type="file" accept=".csv,text/csv" onChange={preview}/></label>
    {rows.length>0 && <p>{rows.length} hồ sơ · {errors.length} lỗi. Bản ghi trùng sẽ được bỏ qua khi nhập.</p>}
    {rows.length>0 && <p role="status">Đã đổi địa chỉ: {rows.filter(r=>r.company?.profile.addressStatus==='converted').length} ·
      Cần kiểm tra phường/xã: {rows.filter(r=>r.company?.profile.addressStatus==='review').length}.
      Địa chỉ chưa rõ sẽ được giữ nguyên và lưu hồ sơ với phường/xã để trống.</p>}
    {errors.length>0 && <ul>{errors.slice(0,50).map(row=><li key={row.row}>Hồ sơ {row.row}: {row.error}</li>)}</ul>}
    {errors.length>50&&<p>Đang hiển thị 50 / {errors.length} lỗi đầu tiên. Hãy sửa các lỗi này rồi chọn lại tệp.</p>}
    {rows.length>0 && <ul className="partner-items">{rows.filter(row=>row.company).slice(0,5).map(row=>
      <li key={row.row}><strong>{row.company?.name}</strong><small>{row.company?.trade} · {row.company?.province}</small>
        <p>{row.company?.profile.address}</p>
        <small>Phường/xã: {row.company?.profile.ward || 'Cần kiểm tra'} · {row.company?.profile.addressNote}</small>
        {row.company?.profile.addressStatus==='converted'&&<small>Địa chỉ gốc: {row.company.profile.addressOriginal}</small>}
      </li>)}</ul>}
    {rows.length>5&&<details><summary>Xem địa chỉ của các hồ sơ còn lại</summary><ul className="partner-items">
      {rows.filter(r=>r.company).slice(5,50).map(row=><li key={row.row}><strong>{row.company?.name}</strong>
        <p>{row.company?.profile.address}</p><small>Phường/xã: {row.company?.profile.ward || 'Cần kiểm tra'} · {row.company?.profile.addressNote}</small></li>)}
    </ul></details>}
    {rows.length>50&&<p>Chỉ hiển thị trước tối đa 50 hồ sơ. Toàn bộ {rows.length} hồ sơ đã được kiểm tra và sẽ được xử lý khi xác nhận nhập.</p>}
    <button type="button" className="button button-primary" disabled={!rows.length || !!errors.length || busy} onClick={confirm}>
      {busy?'Đang xử lý…':'Xác nhận nhập'}
    </button>
  </fieldset>
  {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</div>;
}
