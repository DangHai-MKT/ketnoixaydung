import { requirePageActor } from '../../lib/auth/server';
import AccountDashboard from '../../components/AccountDashboard';
import FloatingPurchaseChat from '../../components/FloatingPurchaseChat';
import { verifiedSellerProfile } from '../../lib/seller/server';
export const dynamic = 'force-dynamic';
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor('/seller');
  const seller = await verifiedSellerProfile(actor);
  return <AccountDashboard actor={actor}>{children}{seller && <FloatingPurchaseChat side="seller" />}</AccountDashboard>;
}
