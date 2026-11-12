import { requirePageActor } from '../../../../lib/auth/server';
import { IdentityHeader } from '../../../../components/PhaseOneUI';
import { DashboardPanel } from '../../../../components/DashboardPanels';
import { SepayRetry } from '../../../../components/SepayForms';
import { WalletTime } from '../../../../components/WalletTransactions';
import { listSepayLiveEvents } from '../../../../services/sepay-live';

const labels: Record<string, string> = {
  received: 'Đã nhận, chờ đối soát',
  processed: 'Đã khớp đơn',
  failed: 'Cần kiểm tra',
  ignored: 'Bỏ qua',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const actor = await requirePageActor('/admin/payments/sepay-live', ['finance_operator', 'super_admin']);
  const { page } = await searchParams;
  const pageNumber = page === undefined ? 1 : typeof page === 'string' && /^\d+$/.test(page) ? Number(page) : 0;
  if (pageNumber < 1 || pageNumber > 10000) return <main className="fw-page"><p role="alert">Trang không hợp lệ.</p><a href="/admin/payments/sepay-live">Về danh sách</a></main>;
  const data = await listSepayLiveEvents(actor, pageNumber);
  return <main className="fw-page">
    <IdentityHeader rootHref="/admin/payments" rootLabel="Đơn nạp" title="Đối soát SePay Live"
      description="Kiểm tra webhook, giao dịch ngân hàng và đơn nạp tương ứng." />
    <p className="fw-info">Đã khớp đơn chỉ xác nhận bằng chứng chuyển khoản. Admin vẫn xác nhận cộng POINT theo quy trình nạp thủ công.</p>
    {actor.roles.includes('super_admin') && <div className="fw-actions"><a href="/admin/settings#sepay-live">Cấu hình SePay Live</a></div>}
    <DashboardPanel title="Webhook giao dịch" icon="file">
      <div className="fw-orders">
        {data.rows.map(row => <article key={row.id}>
          <strong>{labels[row.status] ?? row.status} · {BigInt(row.amountVnd).toLocaleString('vi-VN')} VND</strong>
          <span className="fw-reference">{row.reference ?? 'Không có mã đơn phù hợp'}</span>
          <span>Giao dịch {row.bankReference} · tài khoản …{row.accountLast4}</span>
          <WalletTime date={row.receivedAt} />
          {row.error && <p>{row.error}</p>}
          {row.orderId && <a href={`/admin/payments/${row.orderId}`}>Xem đơn nạp →</a>}
          {['failed', 'received'].includes(row.status) && <SepayRetry id={row.id} mode="live" />}
        </article>)}
        {!data.rows.length && <p className="fw-empty">Chưa có webhook SePay Live.</p>}
      </div>
    </DashboardPanel>
    <nav className="fw-pagination" aria-label="Phân trang webhook">
      {data.page > 1 && <a href={`?page=${data.page - 1}`}>Trang trước</a>}
      <span>Trang {data.page}</span>
      {data.hasMore && data.page < 10000 && <a href={`?page=${data.page + 1}`}>Trang sau</a>}
    </nav>
  </main>;
}
