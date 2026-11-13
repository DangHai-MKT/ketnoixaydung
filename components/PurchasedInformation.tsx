import ProjectParticipantCards from './ProjectParticipantCards';
import {getOwnPurchase,listOwnPurchases} from '../services/purchase-access';
import {requirePageActor} from '../lib/auth/server';
import {AccessError} from '../lib/auth/permissions';
import {IdentityHeader} from './PhaseOneUI';
import {DashboardPanel} from './DashboardPanels';
import {pointText} from '../lib/finance/labels';
import {WalletTime} from './WalletTransactions';
import {privateLabels} from '../lib/projects/workflow';
import {notFound} from 'next/navigation';
import {purchasedProjectPath} from '../lib/projects/purchased-path';
import {purchaseHistoryQuery} from '../lib/finance/purchase';
import {chatPath} from '../lib/projects/purchase-chat';
const states:Record<string,string>={created:'Đã tạo',completed:'Hoàn tất',failed:'Thất bại',refund_pending:'Chờ hoàn tiền',refunded:'Đã hoàn tiền',disputed:'Đang tranh chấp'};
export async function PurchaseList({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await requirePageActor('/account/purchases',['buyer']),params=await searchParams;
 const filters=new URLSearchParams();for(const [key,value]of Object.entries(params))for(const item of Array.isArray(value)?value:value===undefined?[]:[value])filters.append(key,item);
 let query;try{query=purchaseHistoryQuery(filters);}catch(error){if(!(error instanceof AccessError))throw error;return <main><h1>Bộ lọc không hợp lệ</h1><p role="alert">{error.message}</p><a href="/account/purchases">Về đơn đã mua</a></main>;}
 const result=await listOwnPurchases(actor,query.page,query.q);
 const pageUrl=(page:number)=>'?'+new URLSearchParams({page:String(page),...(query.q?{q:query.q}:{})});
 return <main className="fw-page"><IdentityHeader title="Dự án đã mua" description="Xem lại đơn mua và truy cập đúng phiên bản thông tin của bạn."/>
 <div className="fw-actions"><a className="dash-primary" href="/projects">Khám phá dự án</a><a href="/account/wallet">Xem ví điểm →</a></div>
 <form className="fw-filters" method="get"><label className="fw-search">Tìm dự án hoặc mã đơn<input name="q" type="search" maxLength={100} defaultValue={query.q} placeholder="Tên dự án hoặc mã đơn mua"/></label><div className="fw-filter-actions"><button className="dash-primary" type="submit">Tìm đơn mua</button><a href="/account/purchases">Đặt lại</a></div></form>
 <DashboardPanel title={result.total+' đơn mua'} icon="file"><div className="fw-orders">{result.rows.map(row=><article key={row.id}><a href={'/account/purchases/'+row.id}><strong>{row.title}</strong></a><span>Phiên bản {row.versionNo} · {pointText(row.pricePoints)} · {states[row.status]||'Chưa xác định'}</span><WalletTime date={row.createdAt}/><small>Mã đơn: {row.id}</small><a href={'/account/purchases/'+row.id}>{row.status==='completed'?'Xem chi tiết đơn →':'Xem trạng thái đơn →'}</a>{row.status==='completed'&&<a className="dash-primary" href={purchasedProjectPath(row.projectId,row.id)+'#thong-tin-da-mua'}>Xem đầy đủ thông tin dự án →</a>}{row.completedAt&&<a className="dash-outline" href={chatPath('buyer',row.id)}>Trao đổi với người bán</a>}</article>)}</div>{!result.rows.length&&<p className="fw-empty">Bạn chưa có đơn mua ở trang này. Khám phá dự án để bắt đầu.</p>}</DashboardPanel>
 <nav className="fw-pagination" aria-label="Phân trang đơn mua">{result.page>1&&<a href={pageUrl(result.page-1)}>Trang trước</a>}<span>Trang {result.page}</span>{result.page*20<result.total&&<a href={pageUrl(result.page+1)}>Trang sau</a>}</nav></main>;
}
export async function PurchaseDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params,actor=await requirePageActor('/account/purchases/'+id,['buyer']);
 let row;try{row=await getOwnPurchase(actor,id);}catch(error){if(error instanceof AccessError&&(error.status===404||error.status===400))notFound();throw error;}
 return <main className="fw-page"><IdentityHeader rootHref="/account/purchases" rootLabel="Dự án đã mua" title={row.title} description={'Thông tin phiên bản '+row.versionNo+' được ghi nhận trên đơn của bạn.'}/>
 <DashboardPanel title={row.status==='completed'?'Đơn mua hoàn tất':'Trạng thái đơn mua'} icon="file"><dl className="fw-details"><dt>Mã đơn</dt><dd className="fw-reference">{row.id}</dd><dt>Trạng thái</dt><dd>{states[row.status]}</dd><dt>Giá trên đơn</dt><dd>{pointText(row.pricePoints)}</dd><dt>Ngày mua</dt><dd><WalletTime date={row.completedAt??row.createdAt}/></dd></dl><a href="/account/wallet">Kiểm tra số dư và lịch sử ví →</a></DashboardPanel>
 {row.privateData?<><DashboardPanel title="Thông tin đã mở khóa" icon="shield"><ProjectParticipantCards participants={row.participants}/><p className="fw-note">Chỉ nội dung của phiên bản đã mua. Không chia sẻ tài liệu ngoài quyền được cấp.</p><dl className="fw-details">{Object.entries(privateLabels).map(([key,label])=><div key={key} className="fw-private-field"><dt>{label}</dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(row.privateData![key]||'Chưa cập nhật')}</dd></div>)}</dl></DashboardPanel><DashboardPanel title="Tài liệu được cấp quyền" icon="file">{row.files.length?<ul>{row.files.map(file=><li key={file.id}><a href={file.url}>{file.label}</a></li>)}</ul>:<p>Phiên bản này không có tệp được cấp quyền.</p>}</DashboardPanel></>:<p className="fw-info">Đơn hiện không cấp quyền truy cập nội dung bảo vệ. Vui lòng kiểm tra trạng thái hoặc liên hệ hỗ trợ.</p>}
 <div className="fw-actions">{row.privateData&&<a className="dash-primary" href={purchasedProjectPath(row.projectId,row.id)+'#thong-tin-da-mua'}>Xem đầy đủ thông tin dự án →</a>}{row.completedAt&&<a className="dash-outline" href={chatPath('buyer',row.id)}>Trao đổi với người bán</a>}{row.status==='completed'&&<a className="dash-outline" href={'/account/refunds/new?purchaseId='+row.id}>Đề nghị hoàn POINT</a>}{row.status==='completed'&&<a className="dash-outline" href={'/account/disputes/new?purchaseId='+row.id}>Báo cáo tin sai hoặc trùng</a>}<a href="/account/disputes">Hồ sơ tranh chấp của tôi</a><a className="dash-outline" href="/account/purchases">Về dự án đã mua</a><a href={'/projects/'+row.projectId}>Xem thông tin công khai hiện tại →</a></div></main>;
}
