'use client';

import {useActionState,useState} from 'react';
import Link from 'next/link';
import {bulkCompanyPublication} from '../lib/site/partner-directory-actions';
import {directoryIssues,type DirectoryAdminRow} from '../lib/site/directory-review';
import {companySummary} from '../lib/site/company-display';

export default function CompanyDirectoryAdminTable({rows,returnTo}:{rows:DirectoryAdminRow[];returnTo:string}) {
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [result,submit,pending]=useActionState(bulkCompanyPublication,{message:'',ok:false});
  const [confirming,setConfirming]=useState('');
  const selectedRows=rows.filter(r=>selected.has(r.id));
  const warningCount=selectedRows.filter(r=>directoryIssues(r).length).length;
  function change(ids:string[]) {setSelected(new Set(ids));setConfirming('');}
  return <div className="directory-workspace">
    <div className="directory-selection-tools"><label><input type="checkbox" checked={!!rows.length&&selected.size===rows.length}
      onChange={e=>change(e.target.checked?rows.map(r=>r.id):[])}/> Chọn trang này</label>
      <button type="button" onClick={()=>change(rows.filter(r=>!directoryIssues(r).length).map(r=>r.id))}>Chọn hồ sơ đủ thông tin cơ bản</button>
      {selected.size>0&&<button type="button" onClick={()=>change([])}>Bỏ chọn</button>}
      <span>{selected.size} / {rows.length} đã chọn</span></div>
    {result.message&&<p className={'directory-result '+(result.ok?'is-success':'is-error')} role="status">{result.message}</p>}
    <form action={submit} onSubmit={()=>setConfirming('')}>
      {[...selected].map(id=><input type="hidden" name="companyId" value={id} key={id}/>)}
      <fieldset disabled={pending} className="directory-bulk-bar"><div><strong>{selected.size ? `${selected.size} hồ sơ đang chọn` : 'Xử lý nhiều doanh nghiệp cùng lúc'}</strong>
        <small>{selected.size ? (warningCount?`${warningCount} hồ sơ cần kiểm tra thông tin trước khi công khai.`:'Nhóm đã chọn có liên hệ và phường/xã được xác định.'):'Chọn từng hồ sơ hoặc chọn cả trang để công khai / ẩn.'}</small></div>
        <button type="button" className="button button-primary" disabled={!selected.size} onClick={()=>setConfirming('publish')}>Công khai đã chọn</button>
        <button type="button" className="button button-secondary" disabled={!selected.size} onClick={()=>setConfirming('hide')}>Ẩn đã chọn</button>
        {confirming&&<div className="directory-bulk-confirm"><input type="hidden" name="operation" value={confirming}/>
          <strong>{confirming==='publish'?'Công khai':'Ẩn'} {selected.size} doanh nghiệp đã chọn?</strong>
          {confirming==='publish' ? <label><input type="checkbox" name="reviewed" required/> Tôi đã kiểm tra nhóm hồ sơ và có quyền công khai các thông tin này.</label>
          : <p>Doanh nghiệp sẽ ngừng xuất hiện trong kết quả tìm kiếm công khai. Dữ liệu và quyền liên hệ đã mua vẫn được giữ lại.</p>}
          <div className="fw-actions"><button type="submit" className="button button-primary">{pending?'Đang xử lý…':'Xác nhận '+(confirming==='publish'?'công khai':'ẩn')}</button>
            <button type="button" className="button button-secondary" onClick={()=>setConfirming('')}>Hủy</button></div>
        </div>}
      </fieldset>
    </form>
    {rows.length ? <div className="directory-table-wrap"><table className="directory-table"><thead><tr>
      <th scope="col"><span className="sr-only">Chọn hồ sơ</span></th><th scope="col">Doanh nghiệp</th><th scope="col">Địa bàn</th>
      <th scope="col">Chất lượng hồ sơ</th><th scope="col">Hiển thị</th><th scope="col">Thao tác</th>
    </tr></thead><tbody>{rows.map(row=>{
      const issues=directoryIssues(row);
      return <tr key={row.id} className={selected.has(row.id)?'is-selected':''}>
        <td><input aria-label={'Chọn '+row.name} type="checkbox" checked={selected.has(row.id)} disabled={pending} onChange={e=>{
          const next=new Set(selected);if(e.target.checked)next.add(row.id);else next.delete(row.id);change([...next]);
        }}/></td>
        <td data-label="Doanh nghiệp"><Link className="directory-company-name" href={'/admin/partner-directory/'+row.id+'?returnTo='+encodeURIComponent(returnTo)}>{row.name}</Link>
          <span className="directory-company-trade">{companySummary(row.trade,105)}</span></td>
        <td data-label="Địa bàn"><strong>{row.province}</strong><small>{row.ward||'Chưa xác định phường/xã'}</small></td>
        <td data-label="Chất lượng">{issues.length?issues.map(issue=><span className="directory-badge is-warning" key={issue}>{issue}</span>):<span className="directory-badge is-ready">Đủ thông tin cơ bản</span>}</td>
        <td data-label="Hiển thị"><span className={'directory-badge '+(row.published?'is-public':'is-internal')}>{row.published?'Công khai':'Nội bộ'}</span></td>
        <td><Link className="directory-review-link" href={'/admin/partner-directory/'+row.id+'?returnTo='+encodeURIComponent(returnTo)}>Sửa / bổ sung →</Link></td>
      </tr>;
    })}</tbody></table></div>:<div className="directory-empty"><h3>Không có hồ sơ phù hợp</h3><p>Thử thay đổi từ khóa hoặc bộ lọc để tìm thêm doanh nghiệp.</p><Link href="/admin/partner-directory">Xóa bộ lọc</Link></div>}
  </div>;
}
