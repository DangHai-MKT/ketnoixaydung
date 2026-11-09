import {verificationLabels} from '../../../../lib/account/labels';
import { notFound } from 'next/navigation';
import { requirePageActor } from '../../../../lib/auth/server';
import { getAdminUser } from '../../../../services/admin-users';
import { IdentityHeader, IdentityPanel } from '../../../../components/PhaseOneUI';
import AdminAccountVerification from '../../../../components/AdminAccountVerification';
import AdminUserActions from '../../../../components/AdminUserActions';
import RoleGrantForm from '../../../../components/RoleGrantForm';
import { AccessError } from '../../../../lib/auth/permissions';
import { db } from '../../../../db/client';
import { auditLogs } from '../../../../db/schema';
import { activityLabels } from '../../../../services/account-activity';
import { and, desc, eq } from 'drizzle-orm';
export default async function UserDetail({ params, searchParams }: {
    params: Promise<{
        userId: string;
    }>;
    searchParams: Promise<{
        page?: string;
    }>;
}) { const actor = await requirePageActor('/admin/users', ['super_admin']); const { userId } = await params; const page = Number((await searchParams).page || 1); if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    notFound(); let user; try {
    user = await getAdminUser(actor, userId);
}
catch (error) {
    if (error instanceof AccessError && (error.status === 404 || error.status === 400))
        notFound();
    throw error;
} const events = await db.select({ id: auditLogs.id, action: auditLogs.action, at: auditLogs.createdAt, reason: auditLogs.reason, actorId: auditLogs.actorId }).from(auditLogs).where(and(eq(auditLogs.entityType, 'user'), eq(auditLogs.entityId, userId))).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(21).offset((page - 1) * 20); return <main className="identity-page"><IdentityHeader rootHref="/admin/users" rootLabel="Người dùng" title="Chi tiết người dùng" description="Thông tin và quyền truy cập tài khoản."/><a href="/admin/users">← Danh sách người dùng</a><div className="identity-columns"><IdentityPanel title={user.displayName}><dl className="identity-details"><dt>Email</dt><dd>{user.email} · {user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</dd><dt>Vai trò</dt><dd>{user.roles.join(', ')}</dd><dt>Trạng thái</dt><dd>{user.status === 'active' ? 'Đang hoạt động' : user.status === 'suspended' ? 'Tạm khóa' : 'Đã đóng'}</dd><dt>Đăng ký</dt><dd>{user.createdAt.toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'})}</dd><dt>Hồ sơ người bán</dt><dd>{user.seller ? <a href={`/admin/sellers/${user.seller.id}`}>{user.seller.name} · {verificationLabels[user.seller.status] || 'Chưa xác minh'}</a> : 'Chưa đăng ký'}</dd></dl></IdentityPanel><IdentityPanel title="Trạng thái và vai trò"><AdminUserActions userId={userId} roles={user.roles} status={user.status} updatedAt={user.updatedAt.toISOString()} self={actor.id === userId}/></IdentityPanel></div><section id="account-verification"><IdentityPanel title="Xác thực người dùng và quyền hoạt động"><AdminAccountVerification userId={userId} name={user.displayName} email={user.email} status={user.status} updatedAt={user.updatedAt.toISOString()} self={actor.id===userId} seller={user.seller} approvals={user.approvals.map(item=>item.role)}/></IdentityPanel></section>{actor.id !== userId && user.status === 'active' && <IdentityPanel title="Cấp thêm vai trò"><RoleGrantForm targetId={userId}/></IdentityPanel>}<IdentityPanel title="Lịch sử quản trị tài khoản"><ol className="identity-timeline">{events.slice(0, 20).map(e => <li key={e.id}><strong>{activityLabels[e.action] || 'Cập nhật tài khoản'}</strong><time>{e.at.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time><small>Người thực hiện: {e.actorId || 'Hệ thống'}</small>{e.reason && <p className="identity-hint">Lý do: {e.reason}</p>}</li>)}</ol>{!events.length && <p>Chưa có sự kiện.</p>}<nav className="identity-tabs" aria-label="Phân trang audit">{page > 1 && <a href={`?page=${page - 1}`}>Trang trước</a>}<span>Trang {page}</span>{events.length > 20 && <a href={`?page=${page + 1}`}>Trang sau</a>}</nav></IdentityPanel></main>; }


