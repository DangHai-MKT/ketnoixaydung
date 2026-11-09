import { getWalletTransactions, getWalletTransaction } from '../services/wallet';
import { requirePageActor } from '../lib/auth/server';
import { requireVerifiedSeller } from '../lib/seller/server';
import { AccessError } from '../lib/auth/permissions';
import { walletQuery, walletPageUrl } from '../lib/finance/validation';
import { pointText, changeText, directionLabel, statusLabels, transactionLabel } from '../lib/finance/labels';
import WalletTransactions, { WalletStatus, WalletTime } from './WalletTransactions';
import { IdentityHeader } from './PhaseOneUI';
import { DashboardPanel } from './DashboardPanels';
import { notFound } from 'next/navigation';

export type WalletSearchParams = Promise<Record<string, string | string[] | undefined>>;
export async function WalletHistory({ searchParams, seller = false }: { searchParams: WalletSearchParams; seller?: boolean }) {
  const base = seller ? '/seller/wallet' : '/account/wallet';
  const actor = seller ? (await requireVerifiedSeller()).actor : await requirePageActor(`${base}/transactions`, ['buyer']);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  let query;
  try { query = walletQuery(params); } catch (error) {
    if (!(error instanceof AccessError)) throw error;
    return <main className="fw-page"><h1>Bộ lọc không hợp lệ</h1><p role="alert">{error.message}</p><a href={`${base}/transactions`}>Đặt lại bộ lọc</a></main>;
  }
  const result = await getWalletTransactions(actor, query);
  const types = [...new Set([...result.types, ...(query.type ? [query.type] : [])])];
  return <main className="fw-page"><IdentityHeader rootHref={base} rootLabel="Ví điểm" title="Lịch sử giao dịch" description="Tra cứu biến động POINT của khoản khả dụng và đang giữ. Thời gian theo Việt Nam (UTC+7)."/>
    <form className="fw-filters" method="get"><label>Từ ngày<input type="date" name="start" defaultValue={query.start}/></label><label>Đến ngày<input type="date" name="end" defaultValue={query.end}/></label>
      <label>Loại giao dịch<select name="type" defaultValue={query.type}><option value="">Tất cả loại</option>{types.map((type, i) => <option value={type} key={type}>{transactionLabel(type)}{transactionLabel(type) === 'Giao dịch khác' ? ` (${i + 1})` : ''}</option>)}</select></label>
      <label>Trạng thái<select name="status" defaultValue={query.status}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="fw-search">Mã giao dịch hoặc mã đơn<input type="search" name="q" maxLength={100} defaultValue={query.q} placeholder="Nhập toàn bộ hoặc một phần mã"/></label><div className="fw-filter-actions"><button className="dash-primary" type="submit">Lọc giao dịch</button><a href={`${base}/transactions`}>Đặt lại</a></div></form>
    <DashboardPanel title={`${result.total.toLocaleString('vi-VN')} giao dịch`} icon="file"><WalletTransactions rows={result.rows} base={`${base}/transactions`}/></DashboardPanel>
    <nav className="fw-pagination" aria-label="Phân trang giao dịch">{query.page > 1 && <a href={walletPageUrl(`${base}/transactions`, query, query.page - 1)}>← Trang trước</a>}<span>Trang {query.page} / {Math.max(1, Math.ceil(result.total / result.pageSize))}</span>{query.page * result.pageSize < result.total && <a href={walletPageUrl(`${base}/transactions`, query, query.page + 1)}>Trang sau →</a>}</nav>
    <p className="fw-note">Lọc theo ngày tạo giao dịch. Các khoản ở trạng thái chờ/thất bại chưa làm thay đổi số dư. Đơn nạp chưa có bút toán được xem riêng tại tổng quan ví.</p>
  </main>;
}
export async function WalletDetail({ params, seller = false }: { params: Promise<{ id: string }>; seller?: boolean }) {
  const base = seller ? '/seller/wallet' : '/account/wallet';
  const actor = seller ? (await requireVerifiedSeller()).actor : await requirePageActor(`${base}/transactions`, ['buyer']);
  let row;
  try { row = await getWalletTransaction(actor, (await params).id); } catch (error) {
    if (error instanceof AccessError && error.status === 404) notFound();
    throw error;
  }
  return <main className="fw-page"><IdentityHeader rootHref={`${base}/transactions`} rootLabel="Lịch sử giao dịch" title={transactionLabel(row.type)} description="Chi tiết phần biến động liên quan đến ví của bạn."/>
    <DashboardPanel title="Thông tin giao dịch" icon="file"><WalletStatus status={row.status}/><dl className="fw-details"><dt>Mã giao dịch</dt><dd className="fw-reference">{row.id}</dd><dt>Ngày tạo</dt><dd><WalletTime date={row.createdAt}/></dd><dt>Ngày ghi sổ</dt><dd>{row.postedAt ? <WalletTime date={row.postedAt}/> : 'Chưa có mốc ghi sổ'}</dd><dt>Loại biến động</dt><dd>{directionLabel(row.available, row.held, row.reserved)}</dd><dt>Khả dụng</dt><dd>{changeText(row.available)}</dd><dt>Đang giữ</dt><dd>{changeText(row.held)}</dd><dt>Giữ chỗ chi trả</dt><dd>{changeText(row.reserved)}</dd><dt>Thay đổi tổng điểm</dt><dd>{changeText((BigInt(row.available) + BigInt(row.held) + BigInt(row.reserved)).toString())}</dd>{row.referenceId && <><dt>{row.referenceType}</dt><dd className="fw-reference">{row.referenceId}</dd></>}</dl>
      <p className="fw-info">{row.status === 'posted' ? 'Giao dịch đã được tính vào số dư. Các con số trên là biến động của giao dịch, không phải số dư hiện tại.' : 'Các con số là giá trị của bút toán; giao dịch này không được tính vào số dư hiện tại.'}</p><p className="fw-note">Chuyển giữa khoản khả dụng và đang giữ có thể làm tổng điểm thay đổi {pointText('0')} nhưng vẫn thay đổi từng khoản.</p>
      <div className="fw-actions"><a className="dash-outline" href={`${base}/transactions`}>Về lịch sử giao dịch</a><a href={base}>Xem số dư hiện tại →</a></div></DashboardPanel>
  </main>;
}
