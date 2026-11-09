import { IdentityHeader } from '../../../components/PhaseOneUI';
import { DashboardPanel } from '../../../components/DashboardPanels';
import { WalletTime } from '../../../components/WalletTransactions';
import { requirePageActor } from '../../../lib/auth/server';
import { feedbackRatings, feedbackRoles, feedbackTopics } from '../../../lib/site/feedback';
import { listFeedback } from '../../../services/feedback';

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ page?: string; rating?: string }> }) {
  const actor = await requirePageActor('/admin/feedback', feedbackRoles);
  const query = await searchParams;
  const page = typeof query.page === 'string' && /^[1-9]\d{0,3}$/.test(query.page) ? Number(query.page) : 1;
  const rating = typeof query.rating === 'string' && /^[1-5]$/.test(query.rating) ? Number(query.rating) : undefined;
  const { rows, hasNext } = await listFeedback(actor, page, rating);
  const pageLink = (target: number) => '?' + new URLSearchParams({ page: String(target), ...(rating ? { rating: String(rating) } : {}) });
  return <main className="fw-page">
    <IdentityHeader rootHref="/admin" rootLabel="Quản trị" title="Góp ý trải nghiệm"
      description="Đọc phản hồi mới nhất và lọc theo mức đánh giá để tìm những điểm người dùng gặp khó khăn."/>
    <form className="fw-filters" method="get">
      <label>Mức đánh giá<select name="rating" defaultValue={rating ?? ''}>
        <option value="">Tất cả đánh giá</option>
        {feedbackRatings.map((label,index)=><option key={label} value={index + 1}>{index + 1}/5 · {label}</option>)}
      </select></label>
      <div className="fw-filter-actions"><button className="dash-primary">Lọc góp ý</button><a href="/admin/feedback">Đặt lại</a></div>
    </form>
    <DashboardPanel title="Phản hồi người dùng" icon="file">
      {!rows.length && <p className="fw-empty">Chưa có góp ý phù hợp.</p>}
      <div className="fw-orders">{rows.map(row => {
        const topic = String(row.metadata.topic);
        const score = Number(row.metadata.rating);
        return <article key={row.id}>
          <strong>{feedbackTopics[topic as keyof typeof feedbackTopics] ?? 'Trải nghiệm chung'}</strong>
          <span>{score}/5 · {feedbackRatings[score - 1]}</span>
          <WalletTime date={row.createdAt}/>
          {row.comment && <p className="case-text">{row.comment}</p>}
        </article>;
      })}</div>
    </DashboardPanel>
    <nav className="fw-pagination" aria-label="Phân trang góp ý">
      {page > 1 && <a href={pageLink(page - 1)}>Trang trước</a>}<span>Trang {page}</span>
      {hasNext && page < 9999 && <a href={pageLink(page + 1)}>Trang sau</a>}
    </nav>
  </main>;
}
