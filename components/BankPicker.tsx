'use client';
import {useState} from 'react';
import {vietnamBanks} from '../lib/finance/banks';
export default function BankPicker({bank,enabled}:{bank:Record<string,unknown>|null;enabled:boolean}){
 const [choice,setChoice]=useState(vietnamBanks.some(b=>b.bin===bank?.bankBin)?String(bank?.bankBin):bank?.bankName?'custom':''),[name,setName]=useState(String(bank?.bankName||'')),[bin,setBin]=useState(String(bank?.bankBin||''));
 const selected=vietnamBanks.find(b=>b.bin===choice);
 return <><label>Ngân hàng nhận<select value={choice} required={enabled} onChange={e=>setChoice(e.target.value)}><option value="">Chọn ngân hàng nhận tiền</option>{vietnamBanks.map(b=><option key={b.bin} value={b.bin}>{b.label} · {b.name}</option>)}<option value="custom">Ngân hàng khác · nhập thông tin đã xác minh</option></select></label>
 {selected?<><input type="hidden" name="bankName" value={selected.name}/><input type="hidden" name="bankBin" value={selected.bin}/><p className="fw-note">{selected.name} · mã ngân hàng {selected.bin}. Vui lòng xác minh đúng tài khoản thụ hưởng trước khi mở nạp.</p></>:choice==='custom'?<div className="settings-field-grid"><label>Tên ngân hàng<input name="bankName" value={name} onChange={e=>setName(e.target.value)} required={enabled} maxLength={200}/></label><label>Mã ngân hàng BIN<input name="bankBin" value={bin} onChange={e=>setBin(e.target.value)} required={enabled} inputMode="numeric" pattern="[0-9]{6}" maxLength={6}/><small>Dùng mã BIN 6 chữ số do ngân hàng xác nhận.</small></label></div>:null}</>;
}
