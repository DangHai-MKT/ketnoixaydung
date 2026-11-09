import { getWalletOverview } from '../services/wallet';
import { requirePageActor } from '../lib/auth/server';
import { requireVerifiedSeller } from '../lib/seller/server';
import { IdentityHeader } from './PhaseOneUI';
import { DashboardPanel } from './DashboardPanels';
import { pointText } from '../lib/finance/labels';
import WalletTransactions, { WalletTime } from './WalletTransactions';
import Icon from './MarketplaceIcon';

export default async function WalletOverview({ seller = false }: { seller?: boolean }) {
  const base = seller ? '/seller/wallet' : '/account/wallet';
  const actor = seller ? (await requireVerifiedSeller()).actor : await requirePageActor(base, ['buyer']);
  const wallet = await getWalletOverview(actor);
  const now = Date.now();
  return <main className="fw-page"><IdentityHeader rootHref={seller ? '/seller' : '/account'} rootLabel={seller ? 'Nhà cung cấp' : 'Tài khoản'} title="Ví điểm của tôi" description="Theo dõi điểm khả dụng, khoản đang giữ và lịch sử biến động của bạn."/>
    <nav className="fw-actions" aria-label="Điều hướng ví"><a className="dash-primary" href="/account/wallet/top-up">Nạp POINT</a><a className="dash-outline" href="/account/wallet/top-ups">Đơn nạp của tôi</a><a className="dash-primary" href={`${base}/transactions`}>Lịch sử giao dịch</a><a className="dash-outline" href="/projects">Khám phá dự án →</a>{seller && <><a className="dash-outline" href="/seller/transactions">Lịch sử bán</a><a className="dash-outline" href="/seller/withdrawals">Rút thu nhập</a><a className="dash-outline" href="/seller/payout-accounts">Tài khoản nhận</a></>}</nav>
    <div className="fw-balances">{[
      { label: 'Điểm khả dụng', value: wallet.available, icon: 'wallet', note: 'Số điểm có thể dùng để mua thông tin dự án đủ điều kiện.' },
      { label: 'Điểm đang giữ', value: wallet.held, icon: 'clock', note: 'Chưa thể sử dụng. Không tự chuyển thành khả dụng khi hết thời hạn giữ.' },
      ...(BigInt(wallet.reserved)>0n?[{label:'Giữ chỗ chi trả',value:wallet.reserved,icon:'shield',note:'Đã dành cho yêu cầu rút, chưa thể dùng để mua dự án hoặc rút lần hai.'}]:[]),
      { label: 'Tổng điểm trong ví', value: wallet.total, icon: 'file', note: 'Khả dụng + đang giữ + giữ chỗ chi trả. Không bao gồm đơn nạp chưa xác nhận.' },
    ].map(item => <section className="fw-balance" key={item.label}><span className="fw-balance-icon"><Icon name={item.icon} size={25}/></span><h2>{item.label}</h2><strong>{pointText(item.value)}</strong><p>{item.note}</p></section>)}</div>
    {!wallet.initialized && <p className="fw-info">Bạn chưa có ví POINT khả dụng hoặc đang giữ. Số dư hiển thị là 0; xem trang này không tự tạo ví.</p>}
    <div className="fw-columns"><div><DashboardPanel title="Biến động gần đây" icon="wallet" href={`${base}/transactions`}><WalletTransactions rows={wallet.recent} base={`${base}/transactions`}/></DashboardPanel>
      <DashboardPanel title={`Đơn nạp chờ xác nhận (${wallet.pendingCount})`} icon="clock"><p className="fw-note">Hiển thị tối đa 5 đơn gần nhất đang mang trạng thái chờ. Các đơn này chưa được cộng vào số dư.</p>{wallet.pending.length ? <div className="fw-orders">{wallet.pending.map(order => <article key={order.id}><strong>{BigInt(order.amountVnd).toLocaleString('vi-VN')} VND → {pointText(order.points)}</strong><a href={`/account/wallet/top-ups/${order.id}`}>Xem đơn nạp →</a><small>Mã đơn: {order.id}</small><WalletTime date={order.createdAt}/><span>{order.expiresAt && order.expiresAt.getTime() <= now ? 'Đã quá hạn thanh toán · Chờ cập nhật trạng thái' : 'Chờ xác nhận thanh toán'}</span></article>)}</div> : <p className="fw-empty">Bạn không có đơn nạp đang chờ.</p>}</DashboardPanel></div>
      <aside><DashboardPanel title="Hiểu về số dư" icon="shield"><p>Chỉ bút toán đã ghi sổ được tính vào số dư. Giao dịch chờ hoặc thất bại không làm tăng điểm.</p><p>Khoản thu bán thông tin được giữ theo chính sách chốt lúc mua. Xem ngày đủ điều kiện trên từng khoản thu; đến hạn không đồng nghĩa đã hoàn tất ghi sổ giải phóng khoản giữ.</p><p>Cùng một tài khoản dùng chung ví khi chuyển giữa không gian người mua và người bán.</p><a href={`${base}/transactions`}>Kiểm tra lịch sử của tôi →</a></DashboardPanel><DashboardPanel title="Nạp và sử dụng điểm" icon="file"><p>Bạn có thể dùng POINT khả dụng để mua thông tin dự án đã duyệt. Bạn có thể tạo đơn nạp và theo dõi xác nhận tiền thực nhận. Người bán đã xác minh có thể yêu cầu rút phần thu nhập đủ điều kiện trong không gian nhà cung cấp.</p><p className="fw-note">Không chuyển tiền theo hướng dẫn chưa được nền tảng xác minh.</p><a href="/projects">Xem thông tin dự án công khai →</a></DashboardPanel></aside></div>
    <p className="fw-note">Đơn vị hiển thị: POINT. Phạm vi ví: khoản khả dụng, đang giữ và giữ chỗ chi trả của tài khoản. Thời gian: Việt Nam (UTC+7).</p>
  </main>;
}
