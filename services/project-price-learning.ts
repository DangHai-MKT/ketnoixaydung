import 'server-only';
import {and, desc, eq, gte, inArray, isNotNull, lte, ne, notExists, sql} from 'drizzle-orm';
import {alias} from 'drizzle-orm/pg-core';
import {db} from '../db/client';
import {disputes, projects, projectVersions, purchaseOrders, refunds, sellerEarnings, users} from '../db/schema';
import {AccessError} from '../lib/auth/permissions';
import {learnProjectPrice, type PriceContext, type PriceSample} from '../lib/projects/price-learning';
import {priceInput} from '../lib/projects/validation';
import {originalPurchaseProof} from './settlement-core';

const buyer = alias(users, 'price_buyer');
const seller = alias(users, 'price_seller');
const fixtureEmail = '(^qa[-_]|@example[.]invalid$|[.]test$)';

export async function suggestProjectPrice(actorId: string, target: PriceContext) {
  const now = Date.now();
  const since = new Date(now - 180 * 86400000);
  const maxPoints = process.env.PROJECT_MAX_PRICE_POINTS || '1000000000';
  priceInput('1', maxPoints);
  const cap = BigInt(maxPoints) < 1000000000n ? BigInt(maxPoints) : 1000000000n;
  const samples = await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
    const eligible = tx.selectDistinctOn([purchaseOrders.projectId], {
      orderId: purchaseOrders.id,
      completedAt: purchaseOrders.completedAt,
    }).from(purchaseOrders)
      .innerJoin(buyer, eq(buyer.id, purchaseOrders.buyerId))
      .innerJoin(seller, eq(seller.id, purchaseOrders.sellerId))
      .innerJoin(projects, and(eq(projects.id, purchaseOrders.projectId), eq(projects.sellerId, seller.id)))
      .innerJoin(projectVersions, and(eq(projectVersions.id, purchaseOrders.projectVersionId),
        eq(projectVersions.projectId, projects.id), eq(projectVersions.pricePoints, purchaseOrders.pricePoints)))
      .innerJoin(sellerEarnings, eq(sellerEarnings.purchaseId, purchaseOrders.id))
      .where(and(eq(purchaseOrders.status, 'completed'), gte(purchaseOrders.completedAt, since),
        lte(purchaseOrders.completedAt, new Date(now)), gte(purchaseOrders.pricePoints, 1n),
        lte(purchaseOrders.pricePoints, cap), eq(projectVersions.category, target.category),
        isNotNull(projectVersions.approvedAt), eq(buyer.status, 'active'), eq(seller.status, 'active'),
        inArray(sellerEarnings.status, ['held', 'available', 'reserved', 'paid']),
        ne(buyer.id, seller.id), ne(buyer.id, actorId), ne(seller.id, actorId),
        sql`${buyer.email} !~* ${fixtureEmail} AND ${seller.email} !~* ${fixtureEmail}`,
        notExists(tx.select({id: disputes.id}).from(disputes).where(and(
          eq(disputes.purchaseId, purchaseOrders.id), inArray(disputes.status, ['open', 'under_review'])))),
        notExists(tx.select({id: refunds.id}).from(refunds).where(and(
          eq(refunds.purchaseId, purchaseOrders.id), inArray(refunds.status, ['requested', 'approved', 'completed'])))),
      )).orderBy(purchaseOrders.projectId, desc(purchaseOrders.completedAt), desc(purchaseOrders.id)).as('eligible');
    const candidates = await tx.select({
      order: purchaseOrders,
      earning: sellerEarnings,
      provinceCode: projectVersions.provinceCode,
      projectStage: projectVersions.projectStage,
      sizeMinSqm: projectVersions.sizeMinSqm,
      sizeMaxSqm: projectVersions.sizeMaxSqm,
      constructionType: sql<string | null>`${projectVersions.publicData}->>'constructionType'`,
    }).from(eligible)
      .innerJoin(purchaseOrders, eq(purchaseOrders.id, eligible.orderId))
      .innerJoin(sellerEarnings, eq(sellerEarnings.purchaseId, purchaseOrders.id))
      .innerJoin(projectVersions, eq(projectVersions.id, purchaseOrders.projectVersionId))
      .orderBy(desc(eligible.completedAt), desc(eligible.orderId)).limit(180);
    const verified: PriceSample[] = [];
    const perSeller = new Map<string, number>();
    for (const candidate of candidates) {
      if (verified.length >= 120) break;
      const {order, earning} = candidate;
      const count = perSeller.get(order.sellerId) ?? 0;
      if (count >= 10) continue;
      try {
        const {original} = await originalPurchaseProof(tx, order, earning, false, false);
        if (['synthetic', 'simulated', 'qaFixture'].some(key => String(original.metadata[key]) === 'true')) continue;
        verified.push({
          category: target.category, projectId: order.projectId, sellerId: order.sellerId,
          points: order.pricePoints.toString(), completedAt: order.completedAt!.getTime(),
          provinceCode: candidate.provinceCode ?? '', projectStage: candidate.projectStage ?? '',
          constructionType: candidate.constructionType ?? '', sizeMinSqm: candidate.sizeMinSqm ?? '',
          sizeMaxSqm: candidate.sizeMaxSqm ?? '',
        });
        perSeller.set(order.sellerId, count + 1);
      } catch (error) {
        if (!(error instanceof AccessError)) throw error;
      }
    }
    return verified;
  }, {accessMode: 'read only', isolationLevel: 'repeatable read'});
  return learnProjectPrice(samples, target, {now, maxPoints});
}
