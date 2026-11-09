import { requirePageActor } from '../../lib/auth/server';
import { adminRoles } from '../../lib/auth/permissions';
import { AdminReportInputError, adminReportWindow } from '../../lib/dashboard/admin-report';
import { getAdminReport } from '../../services/admin-report';
import AdminOverview from '../../components/AdminOverview';
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePageActor('/admin', adminRoles);
  let window;
  try { window = adminReportWindow(await searchParams); }
  catch (error) {
    if (error instanceof AdminReportInputError) return <main className="ar-overview"><h1>Bộ lọc không hợp lệ</h1><p role="alert">{error.message}</p><a className="dash-outline" href="/admin">Về tổng quan →</a></main>;
    throw error;
  }
  const report = await getAdminReport(actor, window);
  return <AdminOverview name={actor.displayName} report={report} window={window} />;
}
