import type { Actor } from '../lib/auth/permissions';
import { getOwnFinance, getSellerOverview } from '../services/dashboard';
import { formatPoints } from '../lib/projects/workflow';
import { DashboardPanel, DashboardProjectTable, DashboardStats } from './DashboardPanels';
import SellerRevenueChart from './SellerRevenueChart';

export default async function AccountSalesOverview({ actor }: { actor: Actor }) {
  const [overview, finance] = await Promise.all([getSellerOverview(actor), getOwnFinance(actor, 'seller')]);
  return <section id="ban-thong-tin" className="account-sales-overview" aria-labelledby="account-sales-title">
    <div className="account-sales-heading">
      <div><h2 id="account-sales-title">Bán thông tin dự án</h2><p>Theo dõi tin đăng, doanh thu và yêu cầu rút tiền ngay trong tài khoản của bạn.</p></div>
      <a className="dash-primary" href="/seller/projects/new">Đăng dự án mới</a>
    </div>
    <DashboardStats items={[
      { label:'Tin đăng của tôi', value:overview.total, icon:'file', href:'/seller/projects' },
      { label:'Đã công bố', value:overview.published, icon:'shield', color:'green', href:'/seller/projects?status=published' },
      { label:'Đang chờ duyệt', value:overview.pending, icon:'clock', color:'orange', href:'/seller/projects?status=pending_review' },
      { label:'Giá trị bán sau phí', value:`${formatPoints(finance.points)} POINT`, icon:'wallet', color:'purple', href:'/seller/earnings' },
    ]}/>
    <div className="account-sales-panels">
      <DashboardPanel title="Tin đăng gần đây" icon="file" href="/seller/projects"><DashboardProjectTable rows={overview.rows}/></DashboardPanel>
      <SellerRevenueChart finance={finance}/>
    </div>
  </section>;
}
