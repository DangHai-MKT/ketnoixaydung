'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {provinceOptions} from '../lib/projects/locations';
import {directoryColumns,parsePartnerDirectory,profileFields} from '../lib/site/partner-directory-csv';
import {extractYellowPages,listingMaxBytes} from '../lib/site/yellow-pages';

type Listing = ReturnType<typeof extractYellowPages>;
const quote = (value:string) => '"' + value.replaceAll('"','""') + '"';
function csv(item:Listing) {
  return directoryColumns.join(',')+'\r\n'+[item.name,item.trade,item.province,item.taxCode,item.website,item.sourceUrl,
    ...profileFields.map(([key])=>item.profile[key])].map(quote).join(',')+'\r\n';
}

export default function YellowPagesImport() {
  const router=useRouter();
  const [url,setUrl]=useState('');
  const [item,setItem]=useState<Listing>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  async function read(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file=new FormData(event.currentTarget).get('html');
    setBusy(true);setError('');setNotice('');setItem(undefined);
    try {
      if (file instanceof File && file.size) {
        if (file.size>listingMaxBytes) throw Error('Tệp HTML vượt quá 2 MB.');
        setItem(extractYellowPages(await file.text(),url));
      } else {
        const response=await fetch('/api/admin/partner-directory/yellow-pages',{method:'POST',
          headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
        const result=await response.json();
        if (!response.ok) throw Error(result.error || 'Chưa lấy được hồ sơ.');
        setItem(result);
      }
    } catch(cause) {setError((cause as Error).message);}
    finally {setBusy(false);}
  }
  async function save(event:FormEvent<HTMLFormElement>, draft:Listing) {
    event.preventDefault();
    setBusy(true);setError('');setNotice('');
    try {
      const text=csv(draft);
      const [row]=parsePartnerDirectory(text);
      if (row.error) throw Error(row.error);
      const response=await fetch('/api/admin/partner-directory',{method:'POST',
        headers:{'Content-Type':'text/csv;charset=utf-8','X-Refresh-Company':'1'},body:text});
      const result=await response.json();
      if (!response.ok) throw Error(result.error || 'Chưa lưu được hồ sơ.');
      setNotice(result.inserted ? 'Đã thêm doanh nghiệp vào danh bạ.' : result.updated ? 'Đã cập nhật hồ sơ nội bộ.' : 'Hồ sơ bị trùng. Kiểm tra tên, tỉnh/thành, nguồn hoặc trạng thái công khai.');
      router.refresh();
    } catch(cause) {setError((cause as Error).message);}
    finally {setBusy(false);}
  }
  function download(draft:Listing) {
    const text=csv(draft);
    try {
      const [row]=parsePartnerDirectory(text);
      if (row.error) throw Error(row.error);
      if ([draft.name,draft.trade,...Object.values(draft.profile)].some(value=>/^[=@-]|^\+(?!\d)/.test(value.trim()))) throw Error('Hồ sơ có ô bắt đầu bằng ký tự công thức. Hãy kiểm tra trước khi xuất CSV.');
    } catch(cause) {setError((cause as Error).message);return;}
    setError('');
    const href=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=href;link.download='trang-vang-'+draft.listingId+'.csv';link.click();
    setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  return <>
    <form className="partner-form" onSubmit={read}><fieldset disabled={busy}>
      <label>Liên kết hồ sơ trên Trang Vàng<input type="url" required value={url} onChange={event=>setUrl(event.target.value)}
        placeholder="https://trangvangvietnam.com/listings/…"/></label>
      <details><summary>Dùng tệp HTML đã lưu nếu Trang Vàng chặn truy cập trực tiếp</summary>
        <label>Tệp HTML<input type="file" name="html" accept=".html,.htm,text/html"/></label>
      </details>
      <button type="submit" className="button button-primary">{busy?'Đang xử lý…':'Lấy dữ liệu'}</button>
    </fieldset></form>
    {item&&<form className="partner-form" onSubmit={event=>void save(event,item)}><fieldset disabled={busy}>
      <h3>Kiểm tra hồ sơ trước khi lưu</h3>
      <p>Mã hồ sơ Trang Vàng {item.listingId}. {item.address ? 'Địa chỉ nguồn: '+item.address : 'Chưa tìm thấy địa chỉ nguồn.'}</p>
      <label>Tên công ty<input required maxLength={200} value={item.name} onChange={event=>setItem({...item,name:event.target.value})}/></label>
      <label>Chuyên môn<input required maxLength={200} value={item.trade} onChange={event=>setItem({...item,trade:event.target.value})}/></label>
      <label>Tỉnh/thành<select required value={item.province} onChange={event=>setItem({...item,province:event.target.value})}>
        <option value="">Chọn tỉnh/thành</option>{provinceOptions.map(name=><option key={name}>{name}</option>)}
      </select></label>
      <label>Mã số thuế<input value={item.taxCode} onChange={event=>setItem({...item,taxCode:event.target.value})}/></label>
      <label>Website<input type="url" value={item.website} onChange={event=>setItem({...item,website:event.target.value})}/></label>
      {profileFields.map(([key,,label,max])=><label key={key}>{label}<input maxLength={max} value={item.profile[key]}
        onChange={event=>setItem({...item,profile:{...item.profile,[key]:event.target.value}})} /></label>)}
      <div className="fw-actions"><button className="button button-primary" type="submit">Lưu vào danh bạ</button>
        <button className="button button-secondary" type="button" onClick={()=>download(item)}>Tải CSV</button></div>
    </fieldset></form>}
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </>;
}
