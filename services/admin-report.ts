import 'server-only';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLogs, disputes, projects, projectVersions, purchaseOrders, sellerProfiles, userRoles, users } from '../db/schema';
import { adminRoles, requireRoles, type Actor } from '../lib/auth/permissions';
import { adminCapabilities, shiftReportDay, type AdminReportWindow } from '../lib/dashboard/admin-report';

// Reporting only: no write, ledger posting, approval or privilege changes.
export async function getAdminReport(actor: Actor, window: AdminReportWindow) {
  requireRoles(actor, adminRoles);
  const caps = adminCapabilities(actor.roles);
  const pattern = `%${window.q.replace(/[\\%_]/g, '\\$&')}%`;
  const current = and(eq(projectVersions.projectId, projects.id), sql`${projectVersions.versionNo} = COALESCE(${projects.workingVersion}, ${projects.currentVersion})`);
  const dates = and(sql`${purchaseOrders.createdAt} >= ${window.from}`, sql`${purchaseOrders.createdAt} < ${window.until}`);
  const completedDates = and(eq(purchaseOrders.status, 'completed'), sql`${purchaseOrders.completedAt} >= ${window.from}`, sql`${purchaseOrders.completedAt} < ${window.until}`);

  const [projectData, userData, financeData, supportData] = await Promise.all([
    caps.review ? (async () => {
      const queueWhere = and(eq(projectVersions.submissionStatus, 'pending_review'), sql`${projects.status} <> 'archived'`, window.q ? ilike(projectVersions.title, pattern) : undefined);
      const [states, pending, queueCount, regionRows, sellers, activity] = await Promise.all([
        db.select({ status: projects.status, count: sql<number>`count(*)::int` }).from(projects).groupBy(projects.status),
        db.select({ id: projects.id, title: projectVersions.title, seller: users.displayName, province: projectVersions.provinceCode, category: projectVersions.category,
          points: sql<string>`${projectVersions.pricePoints}::text`, submittedAt: projectVersions.submittedAt }).from(projects)
          .innerJoin(projectVersions, and(eq(projectVersions.projectId, projects.id), eq(projectVersions.versionNo, projects.workingVersion)))
          .innerJoin(users, eq(users.id, projects.sellerId)).where(queueWhere)
          .orderBy(projectVersions.submittedAt, projects.id).limit(5),
        db.select({ total: sql<number>`count(*)::int` }).from(projects).innerJoin(projectVersions, and(eq(projectVersions.projectId, projects.id), eq(projectVersions.versionNo, projects.workingVersion))).where(queueWhere),
        db.select({ name: projectVersions.provinceCode, count: sql<number>`count(*)::int` }).from(projects).innerJoin(projectVersions, current)
          .groupBy(projectVersions.provinceCode).orderBy(sql`count(*) DESC`, projectVersions.provinceCode),
        db.select({ id: sellerProfiles.id, name: sellerProfiles.legalName, count: sql<number>`count(*)::int` }).from(projects)
          .innerJoin(sellerProfiles, eq(sellerProfiles.userId, projects.sellerId)).innerJoin(users, eq(users.id, projects.sellerId))
          .where(and(eq(projects.status, 'published'), eq(sellerProfiles.verificationStatus, 'verified'), eq(users.status, 'active'),
            sql`EXISTS (SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = ${projects.sellerId} AND ${userRoles.role} = 'seller')`))
          .groupBy(sellerProfiles.id, sellerProfiles.legalName).orderBy(sql`count(*) DESC`, sellerProfiles.id).limit(3),
        db.select({ id: auditLogs.id, action: auditLogs.action, title: projects.title, createdAt: auditLogs.createdAt }).from(auditLogs)
          .leftJoin(projects, and(eq(projects.id, auditLogs.entityId), eq(auditLogs.entityType, 'project')))
          .where(and(inArray(auditLogs.entityType, ['project', 'seller_profile']), inArray(auditLogs.action, ['project.created', 'project.submitted', 'project.review.approve', 'project.review.reject', 'project.review.request_changes', 'seller.application.submitted', 'seller.application.resubmitted', 'seller.review.approve', 'seller.review.reject'])))
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(5),
      ]);
      const total = states.reduce((sum, row) => sum + row.count, 0);
      const regions = regionRows.slice(0, 6).map(row => ({ name: row.name || 'Chưa cập nhật', count: row.count }));
      const otherRegions = regionRows.slice(6).reduce((sum, row) => sum + row.count, 0);
      if (otherRegions) regions.push({ name: 'Khu vực khác', count: otherRegions });
      return { states, total, pending, pendingTotal: queueCount[0].total, regions, sellers, activity };
    })() : null,
    caps.users ? (async () => {
      // Explicit names keep correlated references qualified in a single-table selection.
      const [row] = await db.select({ total: sql<number>`count(*)::int`, buyers: sql<number>`count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = "users"."id" AND ur.role = 'buyer'))::int`,
        sellers: sql<number>`count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = "users"."id" AND ur.role = 'seller'))::int` }).from(users);
      return row;
    })() : null,
    caps.finance ? (async () => {
      const [totals, daily, recent] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int`, gross: sql<string>`COALESCE(sum(${purchaseOrders.pricePoints}),0)::text`, fees: sql<string>`COALESCE(sum(${purchaseOrders.feePoints}),0)::text` }).from(purchaseOrders).where(completedDates),
        db.select({ day: sql<string>`to_char(${purchaseOrders.completedAt} AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD')`, count: sql<number>`count(*)::int`, gross: sql<string>`sum(${purchaseOrders.pricePoints})::text`, fees: sql<string>`sum(${purchaseOrders.feePoints})::text` })
          .from(purchaseOrders).where(completedDates).groupBy(sql`to_char(${purchaseOrders.completedAt} AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD')`),
        db.select({ id: purchaseOrders.id, buyer: caps.users ? users.displayName : sql<string>`'Người mua'`, title: projectVersions.title, points: sql<string>`${purchaseOrders.pricePoints}::text`, status: purchaseOrders.status, createdAt: purchaseOrders.createdAt })
          .from(purchaseOrders).innerJoin(projectVersions, eq(projectVersions.id, purchaseOrders.projectVersionId)).innerJoin(users, eq(users.id, purchaseOrders.buyerId))
          .where(and(dates, window.q ? or(ilike(projectVersions.title, pattern), sql`${purchaseOrders.id}::text ILIKE ${pattern}`, ...(caps.users ? [ilike(users.displayName, pattern)] : [])) : undefined))
          .orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.id)).limit(5),
      ]);
      const series: { label: string; count: number; gross: string; fees: string }[] = [];
      const step = window.interval === 'week' ? 7 : 1;
      for (let offset = 0; offset < window.days; offset += step) {
        const start = shiftReportDay(window.start, offset), end = shiftReportDay(start, step);
        const bucket = daily.filter(row => row.day >= start && row.day < end);
        series.push({ label: `${start.slice(8)}/${start.slice(5, 7)}`, count: bucket.reduce((sum, row) => sum + row.count, 0),
          gross: bucket.reduce((sum, row) => sum + BigInt(row.gross), 0n).toString(), fees: bucket.reduce((sum, row) => sum + BigInt(row.fees), 0n).toString() });
      }
      return { ...totals[0], series, recent };
    })() : null,
    caps.support ? (async () => {
      const [states, recent] = await Promise.all([
        db.select({ status: disputes.status, count: sql<number>`count(*)::int` }).from(disputes).groupBy(disputes.status),
        db.select({ id: disputes.id, reason: disputes.reasonCode, status: disputes.status, createdAt: disputes.createdAt }).from(disputes).orderBy(desc(disputes.createdAt), desc(disputes.id)).limit(4),
      ]);
      return { states, recent };
    })() : null,
  ]);
  return { caps, projects: projectData, users: userData, finance: financeData, support: supportData };
}
export type AdminReport = Awaited<ReturnType<typeof getAdminReport>>;
