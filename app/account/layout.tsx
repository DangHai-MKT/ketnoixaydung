import { requirePageActor } from '../../lib/auth/server';
import AccountDashboard from '../../components/AccountDashboard';
export const dynamic = 'force-dynamic';
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor('/account', ['buyer']);
  return <AccountDashboard actor={actor}>{children}</AccountDashboard>;
}
