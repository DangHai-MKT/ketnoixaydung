import { siteIdentity } from '../../../lib/site/navigation';
import { requirePageActor } from '../../../lib/auth/server';
import { applicationState, sellerReviewRoles, stateLabels, type ApplicationState } from '../../../lib/seller/workflow';
import { listApplications } from '../../../services/seller-reviews';
import { AccessError } from '../../../lib/auth/permissions';

export const metadata = { title: `Xét duyệt người bán | ${siteIdentity.name}` };
export default async function SellerReviewQueue({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requirePageActor('/admin/sellers', sellerReviewRoles);
  const params = await searchParams;
  const state = params.status ?? 'pending';
  const page = Number(params.page ?? 1);
  let result;
  try { result = await listApplications(actor, state, page); }
  catch (error) {
    if (error instanceof AccessError) return <main className="account-page"><h1>Bộ lọc không hợp lệ</h1><p>{error.message}</p><a href="/admin/sellers">Về danh sách xét duyệt</a></main>;
    throw error;
  }
  return <main className="account-page seller-page"><h1>Xét duyệt người bán</h1><p><a href="/admin">Về quản trị</a></p>
    <form className="seller-filter" method="get"><label>Trạng thái <select name="status" defaultValue={state}>{Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button button-secondary">Lọc hồ sơ</button></form>
    <p>{result.pagination.total} hồ sơ phù hợp.</p><div className="seller-queue">{result.data.map((profile) => <article className="seller-queue-card" key={profile.id}>
      <h2><a href={`/admin/sellers/${profile.id}`}>{profile.legalName}</a></h2><p>{profile.sellerType === 'business' ? 'Doanh nghiệp' : 'Cá nhân'} · {stateLabels[profile.state]}</p>
      <p>Ngày gửi: {profile.submittedAt ? profile.submittedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa gửi'}</p><a href={`/admin/sellers/${profile.id}`}>Xem hồ sơ và tài liệu</a>
    </article>)}</div>
    {!result.data.length && <p>Không có hồ sơ ở trạng thái này.</p>}
    <nav className="account-links" aria-label="Phân trang hồ sơ">{page > 1 && <a href={`?status=${encodeURIComponent(state)}&page=${page - 1}`}>Trang trước</a>}{page * 20 < result.pagination.total && <a href={`?status=${encodeURIComponent(state)}&page=${page + 1}`}>Trang sau</a>}</nav>
  </main>;
}
