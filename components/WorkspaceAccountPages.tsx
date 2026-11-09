import WalletOverview from './WalletOverview';
import {getNotificationPage} from '../services/notifications';
import NotificationCenter from './NotificationCenter';
import {notificationEmailEnabled} from '../services/notification-email-preferences';
import { getOwnActivity, activityLabels } from '../services/account-activity';
import AccountSecurityForm from './AccountSecurityForm';
import {roleLabels} from '../lib/account/labels';
import { requirePageActor } from '../lib/auth/server';
import { getOwnProfile } from '../services/account-profile';
import { IdentityHeader, IdentityPanel, AccountTabs } from './PhaseOneUI';
import ProfileForm from './ProfileForm';
import {adminRoles} from '../lib/auth/permissions';
import {dashboardBase,dashboardNames,type DashboardMode} from '../lib/dashboard/navigation';
export async function WorkspaceProfile({mode='buyer'}:{mode?:DashboardMode}) { const actor = await requirePageActor(`${dashboardBase(mode)}/profile`, mode==='admin'?adminRoles:mode==='seller'?undefined:['buyer']); const profile = await getOwnProfile(actor); return <main className="identity-page"><IdentityHeader rootHref={dashboardBase(mode)} rootLabel={dashboardNames[mode]} title="Hồ sơ cá nhân" description="Quản lý thông tin liên hệ và danh tính tài khoản của bạn."/><AccountTabs mode={mode} active="profile"/><div className="identity-columns"><IdentityPanel title="Thông tin cá nhân"><ProfileForm profile={{ ...profile, updatedAt: profile.updatedAt.toISOString() }}/></IdentityPanel><IdentityPanel title="Thông tin tài khoản"><dl className="identity-details"><dt>Email đăng nhập</dt><dd>{profile.email}</dd><dt>Xác minh email</dt><dd>{profile.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</dd><dt>Trạng thái</dt><dd>Đang hoạt động</dd><dt>Ngày đăng ký</dt><dd>{profile.createdAt.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</dd><dt>Vai trò</dt><dd>{actor.roles.map(role=>roleLabels[role]||role).join(', ')}</dd></dl><p className="identity-hint">Email đăng nhập chưa cho phép thay đổi trực tiếp.</p><p><a href="/verify-email">Kiểm tra / xác minh email →</a></p></IdentityPanel></div></main>; }
export async function WorkspaceSecurity({mode='buyer'}:{mode?:DashboardMode}) { await requirePageActor(`${dashboardBase(mode)}/security`, mode==='admin'?adminRoles:mode==='seller'?undefined:['buyer']); return <main className="identity-page"><IdentityHeader rootHref={dashboardBase(mode)} rootLabel={dashboardNames[mode]} title="Bảo mật tài khoản" description="Bảo vệ thông tin đăng nhập và quản lý mật khẩu."/><AccountTabs mode={mode} active="security"/><IdentityPanel title="Đổi mật khẩu"><AccountSecurityForm /></IdentityPanel></main>; }
export async function WorkspaceActivity({mode='buyer',searchParams}:{mode?:DashboardMode;searchParams:Promise<{page?:string}>}) { const actor = await requirePageActor(`${dashboardBase(mode)}/activity`, mode==='admin'?adminRoles:mode==='seller'?undefined:['buyer']); const params = await searchParams; const page = Number(params.page || 1); if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    return <main className="identity-page"><h1>Trang không hợp lệ</h1><a href={`${dashboardBase(mode)}/activity`}>Về lịch sử</a></main>; const result = await getOwnActivity(actor, page); return <main className="identity-page"><IdentityHeader rootHref={dashboardBase(mode)} rootLabel={dashboardNames[mode]} title="Hoạt động tài khoản" description="Các sự kiện thực tế liên quan đến tài khoản và hồ sơ người bán của bạn."/><AccountTabs mode={mode} active="activity"/><IdentityPanel title="Lịch sử hoạt động"><ol className="identity-timeline">{result.rows.map(row => <li key={row.id}><strong>{activityLabels[row.action]}</strong><time>{row.createdAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></li>)}</ol>{!result.rows.length && <p className="identity-empty">Chưa có sự kiện được ghi nhận.</p>}<nav className="identity-tabs" aria-label="Phân trang hoạt động">{page > 1 && <a href={`?page=${page - 1}`}>Trang trước</a>}<span>Trang {page}</span>{page * 20 < result.total && <a href={`?page=${page + 1}`}>Trang sau</a>}</nav></IdentityPanel></main>; }
export async function WorkspaceNotifications({mode,searchParams}:{mode:DashboardMode;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const base=dashboardBase(mode)+'/notifications';
  const actor=await requirePageActor(base,mode==='admin'?adminRoles:mode==='seller'?undefined:['buyer']);
  const params=await searchParams;
  const filter=params.filter==='unread'?'unread':'all';
  const page=typeof params.page==='string'&&/^[1-9][0-9]{0,3}$/.test(params.page)?Number(params.page):1;
  return <NotificationCenter key={base+filter+page} base={base} filter={filter} page={page} initial={await getNotificationPage(actor,filter,page,20)} emailEnabled={notificationEmailEnabled()}/>;
}
export async function WorkspaceWallet({mode='buyer'}:{mode?:DashboardMode}) {
  return <WalletOverview seller={mode==='seller'}/>;
}
