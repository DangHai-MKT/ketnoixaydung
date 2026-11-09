import 'server-only';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { projects, projectVersions, purchaseOrders, sellerProfiles, wallets } from '../db/schema';
import { requireActive, requireRoles, type Actor } from '../lib/auth/permissions';
import { projectReviewerRoles } from '../lib/projects/workflow';
import { getWalletBalance } from './ledger';

export {getUnreadCount} from './notifications';
export async function getOwnWallet(actor: Actor) {
  requireActive(actor);
  const [wallet] = await db.select({ id: wallets.id }).from(wallets).where(and(eq(wallets.userId, actor.id), eq(wallets.unit, 'POINT'), eq(wallets.bucket, 'available'), eq(wallets.isSystem, false))).limit(1);
  return wallet ? (await getWalletBalance(wallet.id)).balance.toString() : null;
}
export async function getOwnFinance(actor: Actor, mode: 'buyer' | 'seller') {
  requireActive(actor);
  if (mode === 'seller') requireRoles(actor, ['seller']);
  const owner = eq(mode === 'seller' ? purchaseOrders.sellerId : purchaseOrders.buyerId, actor.id);
  const amount = mode === 'seller' ? purchaseOrders.sellerPoints : purchaseOrders.pricePoints;
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).formatToParts(new Date());
  const year = Number(parts.find(part => part.type === 'year')!.value), month = Number(parts.find(part => part.type === 'month')!.value);
  const since = new Date(Date.UTC(year, month - 6, 1, -7));
  const [totals, history, monthly] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`, completed: sql<number>`count(*) FILTER (WHERE ${purchaseOrders.status} = 'completed')::int`,
      points: sql<string>`COALESCE(sum(${amount}) FILTER (WHERE ${purchaseOrders.status} = 'completed'), 0)::text` }).from(purchaseOrders).where(owner),
    db.select({ id: purchaseOrders.id, projectId: purchaseOrders.projectId, title: projectVersions.title, status: purchaseOrders.status,
      points: sql<string>`${amount}::text`, createdAt: purchaseOrders.createdAt }).from(purchaseOrders)
      .innerJoin(projectVersions, eq(projectVersions.id, purchaseOrders.projectVersionId)).where(owner).orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.id)).limit(30),
    db.select({ month: sql<string>`to_char(${purchaseOrders.completedAt} AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM')`, points: sql<string>`sum(${amount})::text` })
      .from(purchaseOrders).where(and(owner, eq(purchaseOrders.status, 'completed'), sql`${purchaseOrders.completedAt} >= ${since}`))
      .groupBy(sql`to_char(${purchaseOrders.completedAt} AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM')`),
  ]);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 15));
    const key = date.toISOString().slice(0, 7);
    return { label: `Th${date.getUTCMonth() + 1}`, points: monthly.find(row => row.month === key)?.points ?? '0' };
  });
  return { ...totals[0], history, months };
}
export async function getSellerOverview(actor: Actor) {
  requireRoles(actor, ['seller']);
  const join = and(eq(projectVersions.projectId, projects.id), sql`${projectVersions.versionNo} = COALESCE(${projects.workingVersion}, ${projects.currentVersion})`);
  const [stats, rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`, published: sql<number>`count(*) FILTER (WHERE ${projects.status} = 'published')::int`,
      pending: sql<number>`count(*) FILTER (WHERE ${projectVersions.submissionStatus} = 'pending_review')::int`,
      rejected: sql<number>`count(*) FILTER (WHERE ${projectVersions.submissionStatus} = 'rejected')::int` })
      .from(projects).leftJoin(projectVersions, join).where(eq(projects.sellerId, actor.id)),
    db.select({ id: projects.id, title: projectVersions.title, province: projectVersions.provinceCode, category: projectVersions.category,
      points: sql<string>`COALESCE(${projectVersions.pricePoints}, ${projects.pricePoints})::text`, status: projects.status, submissionStatus: projectVersions.submissionStatus })
      .from(projects).leftJoin(projectVersions, join).where(eq(projects.sellerId, actor.id)).orderBy(desc(projects.updatedAt), desc(projects.id)).limit(6),
  ]);
  return { ...stats[0], rows };
}
export async function getAdminOverview(actor: Actor) {
  requireRoles(actor, projectReviewerRoles);
  const [stats, sellers, recent] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`, published: sql<number>`count(*) FILTER (WHERE ${projects.status} = 'published')::int`,
      pending: sql<number>`count(*) FILTER (WHERE ${projectVersions.submissionStatus} = 'pending_review')::int`,
      rejected: sql<number>`count(*) FILTER (WHERE ${projectVersions.submissionStatus} = 'rejected')::int` }).from(projects)
      .leftJoin(projectVersions, and(eq(projectVersions.projectId, projects.id), sql`${projectVersions.versionNo} = COALESCE(${projects.workingVersion}, ${projects.currentVersion})`)),
    db.select({ pending: sql<number>`count(*) FILTER (WHERE ${sellerProfiles.verificationStatus} = 'pending')::int`, verified: sql<number>`count(*) FILTER (WHERE ${sellerProfiles.verificationStatus} = 'verified')::int` }).from(sellerProfiles),
    db.select({ id: projects.id, title: projectVersions.title, province: projectVersions.provinceCode, category: projectVersions.category,
      points: sql<string>`${projectVersions.pricePoints}::text`, status: projects.status, submissionStatus: projectVersions.submissionStatus })
      .from(projects).innerJoin(projectVersions, and(eq(projectVersions.projectId, projects.id), eq(projectVersions.versionNo, projects.workingVersion)))
      .where(eq(projectVersions.submissionStatus, 'pending_review')).orderBy(projectVersions.submittedAt, projects.id).limit(6),
  ]);
  return { ...stats[0], sellers: sellers[0], rows: recent };
}
