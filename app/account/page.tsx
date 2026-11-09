import { requirePageActor } from '../../lib/auth/server';
import { getOwnFinance, getOwnWallet, getUnreadCount } from '../../services/dashboard';
import { listPublicProjects, getPublicMarketplaceSummary } from '../../services/public-projects';
import BuyerOverview from '../../components/BuyerOverview';
import AccountSalesOverview from '../../components/AccountSalesOverview';
import { verifiedSellerProfile } from '../../lib/seller/server';
export default async function AccountPage() {
  const actor = await requirePageActor('/account');
  const [finance,balance,unread,listing,summary,seller] = await Promise.all([getOwnFinance(actor,'buyer'),getOwnWallet(actor),getUnreadCount(actor),listPublicProjects(new URLSearchParams({pageSize:'9'})),getPublicMarketplaceSummary(),verifiedSellerProfile(actor)]);
  return <BuyerOverview sellerOverview={seller ? <AccountSalesOverview actor={actor}/> : undefined} name={actor.displayName} finance={finance} balance={balance} unread={unread} projects={listing.data} summary={summary}/>;
}
