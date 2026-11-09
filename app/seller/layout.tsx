import { requirePageActor } from '../../lib/auth/server';
import AccountDashboard from '../../components/AccountDashboard';
export const dynamic = 'force-dynamic';
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor('/seller');
  return <AccountDashboard actor={actor}>{children}</AccountDashboard>;
}
