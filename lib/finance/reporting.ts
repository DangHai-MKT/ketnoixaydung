import {AccessError} from '../auth/permissions';
import {walletQuery} from './validation';
export const earningLabels:Record<string,string>={held:'Đang giữ',due:'Đến mốc · chờ giải phóng',available:'Khả dụng theo hồ sơ',reserved:'Đã giữ chỗ',paid:'Đã đánh dấu chi trả',reversed:'Đã đảo',disputed:'Đang tranh chấp',blocked:'Có hồ sơ cần xử lý'};
export const orderLabels:Record<string,string>={created:'Đã tạo',completed:'Hoàn tất',failed:'Thất bại',refund_pending:'Chờ hoàn tiền',refunded:'Đã hoàn tiền',disputed:'Đang tranh chấp'};
export function earningsQuery(params:URLSearchParams){
 for(const k of params.keys())if(!['page','start','end','q','state','status'].includes(k)||params.getAll(k).length!==1)throw new AccessError(400,'Bộ lọc thu nhập không hợp lệ.');
 const state=params.get('state')||'',status=params.get('status')||'';
 if(state&&!Object.hasOwn(earningLabels,state)||status&&!Object.hasOwn(orderLabels,status))throw new AccessError(400,'Trạng thái lọc không hợp lệ.');
 const copy=new URLSearchParams(params);copy.delete('state');copy.delete('status');return {...walletQuery(copy),state,orderStatus:status};
}
export function financeWindow(params:URLSearchParams,now=new Date()){
 for(const k of params.keys())if(!['start','end'].includes(k)||params.getAll(k).length!==1)throw new AccessError(400,'Bộ lọc báo cáo tài chính không hợp lệ.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const end=params.get('end')||today;walletQuery(new URLSearchParams({end}));const start=params.get('start')||new Date(Date.parse(end+'T00:00:00Z')-29*86400000).toISOString().slice(0,10);
 const q=walletQuery(new URLSearchParams({start,end}));if(!q.from||!q.until||q.until.getTime()-q.from.getTime()>366*86400000)throw new AccessError(400,'Chọn tối đa 366 ngày cho một báo cáo.');
 return {start,end,from:q.from,until:q.until};
}
export function earningState(row:{status:string|null;heldUntil:Date|null;blocked:boolean},now=new Date()){
 return row.blocked||row.status==='disputed'?'blocked':row.status==='held'&&row.heldUntil&&row.heldUntil<=now?'due':row.status||'missing';
}
