import {requirePageActor} from '../../../lib/auth/server';
import {projectReviewerRoles,categoryLabels,formatPoints} from '../../../lib/projects/workflow';
import {listModerationProjects} from '../../../services/project-moderation';
import {projectQuery,projectPageParams} from '../../../lib/projects/query';
import {AccessError} from '../../../lib/auth/permissions';
import {IdentityHeader,IdentityPanel} from '../../../components/PhaseOneUI';
import ProjectStatusBadge from '../../../components/ProjectStatusBadge';
import ProjectFilters from '../../../components/ProjectFilters';
import ProjectPagination from '../../../components/ProjectPagination';
const statuses=['pending_review','needs_correction','rejected','published','paused','archived'];
export default async function ModerationQueue({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await requirePageActor('/admin/projects',projectReviewerRoles),params=projectPageParams(await searchParams);

 let result,query;try{projectQuery(params,statuses);if(!params.get('status'))params.set('status','pending_review');if(!params.has('sort'))params.set('sort','oldest');query=projectQuery(params,statuses);result=await listModerationProjects(actor,query.status,query.page,query.q,query.sort,query);}catch(error){if(error instanceof AccessError)return <main className="identity-page"><h1>Bộ lọc không hợp lệ</h1><p role="alert">{error.message}</p><a href="/admin/projects">Về hàng chờ</a></main>;throw error;}
 return <main className="identity-page p2-work"><IdentityHeader rootHref="/admin" rootLabel="Quản trị" title="Kiểm duyệt dự án" description="Kiểm tra đúng phiên bản gửi duyệt, nội dung bảo vệ và quyền cung cấp thông tin."/><div className="p2-queue-summary"><strong>{result.pendingCount}</strong><span>phiên bản đang chờ kiểm duyệt trên toàn hệ thống</span></div><IdentityPanel title="Hàng chờ và lịch sử dự án"><ProjectFilters action="/admin/projects" q={query.q} status={query.status} sort={query.sort} statuses={statuses} allowAll={false}/><div className="p2-table-scroll"><table className="p2-table"><thead><tr><th>Dự án</th><th>Nhà cung cấp</th><th>Phiên bản / trạng thái</th><th>Giá (POINT)</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>{result.data.map(row=><tr key={row.versionId}><td><a className="p2-title-link" href={`/admin/projects/${row.id}`}>{row.title}</a><small>{categoryLabels[row.category]||row.category}</small></td><td>{row.sellerName}<small>{row.sellerStatus==='verified'?'Đã xác minh':'Chưa đủ điều kiện công bố'}</small></td><td><strong>v{row.versionNo}</strong><ProjectStatusBadge status={row.status} submissionStatus={row.submissionStatus}/></td><td className="p2-price">{formatPoints(row.pricePoints)}</td><td>{row.submittedAt?.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})||'Dữ liệu trước workflow'}</td><td><a className="dash-outline" href={`/admin/projects/${row.id}`}>Kiểm tra phiên bản →</a></td></tr>)}</tbody></table>{!result.data.length&&<p className="p2-empty">Không có dự án phù hợp với bộ lọc.</p>}</div><ProjectPagination base="/admin/projects" params={params} page={query.page} total={result.total} pageSize={query.pageSize}/></IdentityPanel></main>;
}

