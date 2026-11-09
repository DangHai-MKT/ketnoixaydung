import type { WalletTransaction } from '../services/wallet';
import { changeText, directionLabel, statusLabels, transactionLabel } from '../lib/finance/labels';

export function WalletStatus({ status }: { status: string }) {
  return <span className={`fw-status fw-status-${status}`}>{statusLabels[status] ?? 'Chưa xác định'}</span>;
}
export function WalletTime({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time>;
}
export default function WalletTransactions({ rows, base }: { rows: WalletTransaction[]; base: string }) {
  if (!rows.length) return <div className="fw-empty"><strong>Chưa có giao dịch phù hợp</strong><p>Biến động liên quan đến ví POINT của bạn sẽ xuất hiện tại đây. Bạn có thể điều chỉnh bộ lọc nếu đang tìm giao dịch cũ.</p></div>;
  return <div className="fw-transactions">{rows.map(row => <article className="fw-transaction" key={row.id}>
    <div className="fw-transaction-name"><a href={`${base}/${row.id}`}>{transactionLabel(row.type)}</a><small>Mã: {row.id}</small><WalletTime date={row.createdAt}/></div>
    <div className="fw-changes"><span>Khả dụng <b>{changeText(row.available)}</b></span><span>Đang giữ <b>{changeText(row.held)}</b></span>{BigInt(row.reserved)!==0n&&<span>Giữ chỗ chi trả <b>{changeText(row.reserved)}</b></span>}<small>{directionLabel(row.available, row.held, row.reserved)}</small></div>
    <div className="fw-transaction-state"><WalletStatus status={row.status}/>{row.status !== 'posted' && <small>Không tính vào số dư hiện tại</small>}<a href={`${base}/${row.id}`} aria-label={`Xem giao dịch ${row.id}`}>Chi tiết →</a></div>
  </article>)}</div>;
}
