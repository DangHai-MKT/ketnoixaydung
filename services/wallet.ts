import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { ledgerEntries, ledgerTransactions, paymentOrders, wallets } from '../db/schema';
import { AccessError, requireRoles, type Actor } from '../lib/auth/permissions';
import { walletId, type WalletQuery } from '../lib/finance/validation';

// Read-only projections: no wallet creation, ledger posting or payment confirmation.
function ownWallets(actor: Actor) {
  return and(eq(wallets.userId, actor.id), eq(wallets.isSystem, false), eq(wallets.unit, 'POINT'), inArray(wallets.bucket, ['available', 'held', 'seller_payable']));
}
const projection = {
  id: ledgerTransactions.id, type: ledgerTransactions.transactionType, status: ledgerTransactions.status,
  createdAt: ledgerTransactions.createdAt, postedAt: ledgerTransactions.postedAt,
  available: sql<string>`COALESCE(sum(${ledgerEntries.amount}) FILTER (WHERE ${wallets.bucket} = 'available'), 0)::text`,
  reserved: sql<string>`COALESCE(sum(${ledgerEntries.amount}) FILTER (WHERE ${wallets.bucket} = 'seller_payable'), 0)::text`,
  held: sql<string>`COALESCE(sum(${ledgerEntries.amount}) FILTER (WHERE ${wallets.bucket} = 'held'), 0)::text`,
};
export async function getWalletOverview(actor: Actor) {
  requireRoles(actor, ['buyer']);
  return db.transaction(async tx => {
    const balances = await tx.select({ bucket: wallets.bucket, count: sql<number>`count(DISTINCT ${wallets.id})::int`,
      points: sql<string>`COALESCE(sum(${ledgerEntries.amount}) FILTER (WHERE ${ledgerTransactions.status} = 'posted'), 0)::text` })
      .from(wallets).leftJoin(ledgerEntries, eq(ledgerEntries.walletId, wallets.id))
      .leftJoin(ledgerTransactions, eq(ledgerTransactions.id, ledgerEntries.transactionId)).where(ownWallets(actor)).groupBy(wallets.bucket);
    const recent = await tx.select(projection).from(ledgerTransactions)
      .innerJoin(ledgerEntries, eq(ledgerEntries.transactionId, ledgerTransactions.id)).innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
      .where(ownWallets(actor)).groupBy(ledgerTransactions.id).orderBy(desc(ledgerTransactions.createdAt), desc(ledgerTransactions.id)).limit(5);
    const pending = await tx.select({ id: paymentOrders.id, amountVnd: sql<string>`${paymentOrders.amountVnd}::text`,
      points: sql<string>`${paymentOrders.pointsToCredit}::text`, createdAt: paymentOrders.createdAt, expiresAt: paymentOrders.expiresAt })
      .from(paymentOrders).where(and(eq(paymentOrders.userId, actor.id), eq(paymentOrders.status, 'pending')))
      .orderBy(desc(paymentOrders.createdAt), desc(paymentOrders.id)).limit(5);
    const [pendingCount] = await tx.select({ total: sql<number>`count(*)::int` }).from(paymentOrders)
      .where(and(eq(paymentOrders.userId, actor.id), eq(paymentOrders.status, 'pending')));
    const available = balances.find(row => row.bucket === 'available')?.points ?? '0';
    const held = balances.find(row => row.bucket === 'held')?.points ?? '0';
    const reserved = balances.find(row => row.bucket === 'seller_payable')?.points ?? '0';
    return { available, held, reserved, total: (BigInt(available) + BigInt(held) + BigInt(reserved)).toString(), initialized: balances.length > 0, recent, pending, pendingCount: pendingCount.total };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
export async function getWalletTransactions(actor: Actor, query: WalletQuery) {
  requireRoles(actor, ['buyer']);
  const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
  const where = and(ownWallets(actor),
    query.from ? sql`${ledgerTransactions.createdAt} >= ${query.from}` : undefined,
    query.until ? sql`${ledgerTransactions.createdAt} < ${query.until}` : undefined,
    query.type ? eq(ledgerTransactions.transactionType, query.type) : undefined,
    query.status ? eq(ledgerTransactions.status, query.status as 'pending' | 'posted' | 'failed' | 'reversed') : undefined,
    query.q ? sql`(${ledgerTransactions.id}::text ILIKE ${pattern} OR ${ledgerTransactions.referenceId}::text ILIKE ${pattern})` : undefined);
  return db.transaction(async tx => {
    const rows = await tx.select(projection).from(ledgerTransactions)
      .innerJoin(ledgerEntries, eq(ledgerEntries.transactionId, ledgerTransactions.id)).innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
      .where(where).groupBy(ledgerTransactions.id).orderBy(desc(ledgerTransactions.createdAt), desc(ledgerTransactions.id))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [count] = await tx.select({ total: sql<number>`count(DISTINCT ${ledgerTransactions.id})::int` }).from(ledgerTransactions)
      .innerJoin(ledgerEntries, eq(ledgerEntries.transactionId, ledgerTransactions.id)).innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId)).where(where);
    const types = await tx.selectDistinct({ type: ledgerTransactions.transactionType }).from(ledgerTransactions)
      .innerJoin(ledgerEntries, eq(ledgerEntries.transactionId, ledgerTransactions.id)).innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
      .where(ownWallets(actor)).orderBy(asc(ledgerTransactions.transactionType));
    return { rows, total: count.total, types: types.map(row => row.type), page: query.page, pageSize: query.pageSize };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
export async function getWalletTransaction(actor: Actor, id: string) {
  requireRoles(actor, ['buyer']); walletId(id);
  const [row] = await db.select({ ...projection, referenceId: ledgerTransactions.referenceId,
    referenceType: ledgerTransactions.referenceType }).from(ledgerTransactions)
    .innerJoin(ledgerEntries, eq(ledgerEntries.transactionId, ledgerTransactions.id)).innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
    .where(and(ownWallets(actor), eq(ledgerTransactions.id, id))).groupBy(ledgerTransactions.id);
  if (!row) throw new AccessError(404, 'Không tìm thấy giao dịch.');
  // Do not expose system/counterparty wallet IDs, raw description or ledger metadata.
  return { ...row, referenceId: ['purchase_order', 'payment_order'].includes(row.referenceType ?? '') ? row.referenceId : null,
    referenceType: row.referenceType === 'purchase_order' ? 'Đơn mua thông tin' : row.referenceType === 'payment_order' ? 'Đơn nạp điểm' : null };
}
export type WalletTransaction = Awaited<ReturnType<typeof getWalletTransactions>>['rows'][number];
