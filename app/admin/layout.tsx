import { requirePageActor } from '../../lib/auth/server';
import { adminRoles } from '../../lib/auth/permissions';
import DashboardShell from '../../components/DashboardShell';
import { getUnreadCount } from '../../services/dashboard';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor('/admin', adminRoles);
  return <DashboardShell mode="admin" name={actor.displayName} roles={actor.roles} unread={await getUnreadCount(actor)}>{children}</DashboardShell>;
}
