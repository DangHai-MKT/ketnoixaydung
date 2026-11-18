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
      if(file.size>directoryMaxBytes) throw Error('Tệp vượt quá 256 KB.');
      const data=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      setRows(parsePartnerDirectory(data));setText(data);
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
    <label>Chọn CSV UTF-8<input type="file" accept=".csv,text/csv" onChange={preview}/></label>
    {rows.length>0 && <p>{rows.length} hồ sơ · {errors.length} lỗi. Bản ghi trùng sẽ được bỏ qua khi nhập.</p>}
    {errors.length>0 && <ul>{errors.map(row=><li key={row.row}>Hồ sơ {row.row}: {row.error}</li>)}</ul>}
    {rows.length>0 && <ul className="partner-items">{rows.filter(row=>row.company).slice(0,5).map(row=>
      <li key={row.row}><strong>{row.company?.name}</strong><small>{row.company?.trade} · {row.company?.province}</small></li>)}</ul>}
    <button type="button" className="button button-primary" disabled={!rows.length || !!errors.length || busy} onClick={confirm}>
      {busy?'Đang xử lý…':'Xác nhận nhập'}
    </button>
  </fieldset>
  {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</div>;
}
