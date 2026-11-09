import 'server-only';
import {ledgerCheck} from '../lib/finance/reconciliation';
import {and,asc,desc,eq,inArray,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs,ledgerEntries,ledgerTransactions,paymentOrders,purchaseOrders,sellerEarnings,userRoles,users,wallets} from '../db/schema';
import {AccessError,isRole,requireRoles,type Actor} from '../lib/auth/permissions';
import {walletId,type WalletQuery} from '../lib/finance/validation';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export const financeMonitorRoles=['finance_operator','super_admin'] as const;
async function active(tx:Tx,actor:Actor){const [u]=await tx.select().from(users).where(eq(users.id,actor.id));const roles=await tx.select().from(userRoles).where(eq(userRoles.userId,actor.id));requireRoles(u?{...u,roles:roles.map(r=>r.role).filter(isRole)}:null,financeMonitorRoles);}
const projection={id:ledgerTransactions.id,type:ledgerTransactions.transactionType,status:ledgerTransactions.status,createdAt:ledgerTransactions.createdAt,postedAt:ledgerTransactions.postedAt,referenceType:ledgerTransactions.referenceType,referenceId:ledgerTransactions.referenceId,reversalOf:ledgerTransactions.reversalOfTransactionId};
const entriesProjection={id:ledgerEntries.id,transactionId:ledgerEntries.transactionId,amount:sql<string>`${ledgerEntries.amount}::text`,unit:wallets.unit,bucket:wallets.bucket,isSystem:wallets.isSystem,ownerId:wallets.userId,ownerName:users.displayName};
export async function listFinanceTransactions(actor:Actor,query:WalletQuery){
 requireRoles(actor,financeMonitorRoles);const pattern='%'+query.q.replace(/[\\%_]/g,'\\$&')+'%';
 const where=and(query.type?eq(ledgerTransactions.transactionType,query.type):undefined,query.status?eq(ledgerTransactions.status,query.status as 'posted'|'pending'|'failed'|'reversed'):undefined,query.from?sql`${ledgerTransactions.createdAt}>=${query.from}`:undefined,query.until?sql`${ledgerTransactions.createdAt}<${query.until}`:undefined,query.q?sql`(${ledgerTransactions.id}::text ILIKE ${pattern} OR ${ledgerTransactions.referenceId}::text ILIKE ${pattern})`:undefined);
 return db.transaction(async tx=>{await active(tx,actor);await tx.execute(sql`SET LOCAL statement_timeout='15s'`);
 const rows=await tx.select(projection).from(ledgerTransactions).where(where).orderBy(desc(ledgerTransactions.createdAt),desc(ledgerTransactions.id)).limit(query.pageSize).offset((query.page-1)*query.pageSize);
 const entries=rows.length?await tx.select({transactionId:ledgerEntries.transactionId,unit:wallets.unit,amount:sql<string>`${ledgerEntries.amount}::text`}).from(ledgerEntries).innerJoin(wallets,eq(wallets.id,ledgerEntries.walletId)).where(inArray(ledgerEntries.transactionId,rows.map(r=>r.id))):[];
 const counts=await tx.select({status:ledgerTransactions.status,total:sql<number>`count(*)::int`}).from(ledgerTransactions).where(where).groupBy(ledgerTransactions.status);
 const types=await tx.selectDistinct({type:ledgerTransactions.transactionType}).from(ledgerTransactions).orderBy(asc(ledgerTransactions.transactionType));
 const [unmatchedPayments]=await tx.select({total:sql<number>`count(*)::int`}).from(paymentOrders).where(sql`${paymentOrders.status}='paid' AND (SELECT count(*) FROM ledger_transactions lt WHERE lt.reference_type='payment_order' AND lt.reference_id=${paymentOrders.id} AND lt.status='posted' AND lt.transaction_type<>'reversal')<>1`);
 const [unmatchedPurchases]=await tx.select({total:sql<number>`count(*)::int`}).from(purchaseOrders).where(sql`${purchaseOrders.status}='completed' AND (SELECT count(*) FROM ledger_transactions lt WHERE lt.reference_type='purchase_order' AND lt.reference_id=${purchaseOrders.id} AND lt.status='posted' AND lt.transaction_type<>'reversal')<>1`);
 return {rows:rows.map(row=>({...row,check:ledgerCheck(row.status,entries.filter(e=>e.transactionId===row.id))})),total:counts.reduce((n,c)=>n+c.total,0),counts,unmatchedPayments:unmatchedPayments.total,unmatchedPurchases:unmatchedPurchases.total,types:types.map(t=>t.type),page:query.page,pageSize:query.pageSize};
 },{isolationLevel:'repeatable read',accessMode:'read only'});
}
export async function getFinanceTransaction(actor:Actor,id:string){requireRoles(actor,financeMonitorRoles);walletId(id);return db.transaction(async tx=>{
 await active(tx,actor);await tx.execute(sql`SET LOCAL statement_timeout='15s'`);
 const [row]=await tx.select(projection).from(ledgerTransactions).where(eq(ledgerTransactions.id,id));if(!row)throw new AccessError(404,'Không tìm thấy giao dịch.');
 const entries=await tx.select(entriesProjection).from(ledgerEntries).innerJoin(wallets,eq(wallets.id,ledgerEntries.walletId)).leftJoin(users,eq(users.id,wallets.userId)).where(eq(ledgerEntries.transactionId,id)).orderBy(asc(ledgerEntries.id));
 const check=ledgerCheck(row.status,entries),findings:string[]=[];
 let payment:null|{id:string;status:string;amountVnd:string;points:string}=null,purchase:null|{id:string;status:string;price:string;fee:string;seller:string;heldUntil:Date|null}=null;
 if(row.referenceType==='payment_order'&&row.referenceId){const [p]=await tx.select({id:paymentOrders.id,ownerId:paymentOrders.userId,status:paymentOrders.status,amountVnd:sql<string>`${paymentOrders.amountVnd}::text`,points:sql<string>`${paymentOrders.pointsToCredit}::text`}).from(paymentOrders).where(eq(paymentOrders.id,row.referenceId));payment=p??null;
  if(!p)findings.push('Không tìm thấy đơn nạp được tham chiếu.');else if(row.type==='topup'&&row.status==='posted'){
   if(p.status!=='paid')findings.push('Bút toán nạp đã ghi sổ nhưng đơn chưa ở trạng thái đã thanh toán.');
   if(entries.length!==2||entries.some(e=>e.unit!=='POINT')||!entries.some(e=>e.isSystem&&e.bucket==='issuance'&&BigInt(e.amount)===-BigInt(p.points))||!entries.some(e=>!e.isSystem&&e.ownerId===p.ownerId&&e.bucket==='available'&&BigInt(e.amount)===BigInt(p.points)))findings.push('Cấu trúc bút toán nạp khác mô hình POINT phát hành được duyệt.');
  }
 }
 if(row.referenceType==='purchase_order'&&row.referenceId){const [p]=await tx.select({id:purchaseOrders.id,buyerId:purchaseOrders.buyerId,sellerId:purchaseOrders.sellerId,status:purchaseOrders.status,price:sql<string>`${purchaseOrders.pricePoints}::text`,fee:sql<string>`${purchaseOrders.feePoints}::text`,seller:sql<string>`${purchaseOrders.sellerPoints}::text`,heldUntil:sellerEarnings.heldUntil}).from(purchaseOrders).leftJoin(sellerEarnings,eq(sellerEarnings.purchaseId,purchaseOrders.id)).where(eq(purchaseOrders.id,row.referenceId));purchase=p??null;
  if(!p)findings.push('Không tìm thấy đơn mua được tham chiếu.');else if(row.type==='project_purchase'&&row.status==='posted'){
   if(p.status!=='completed'){const confirmed=(await tx.execute(sql`SELECT r.id FROM refunds r JOIN ledger_transactions l ON l.id=r.ledger_transaction_id WHERE r.purchase_id=${p.id} AND r.status='completed' AND r.amount_points=${p.price}::bigint AND l.status='posted' AND l.transaction_type='reversal' AND l.reference_type='refund' AND l.reference_id=r.id AND l.reversal_of_transaction_id=${row.id}`)).rows;if(p.status!=='refunded'||confirmed.length!==1)findings.push('Đơn mua cần đối chiếu trạng thái hoàn tiền/tranh chấp hoặc hoàn tất.');}
   if(entries.length!==(BigInt(p.fee)>0n?3:2)||entries.some(e=>e.unit!=='POINT')||!entries.some(e=>!e.isSystem&&e.ownerId===p.buyerId&&e.bucket==='available'&&BigInt(e.amount)===-BigInt(p.price))||!entries.some(e=>!e.isSystem&&e.ownerId===p.sellerId&&e.bucket==='held'&&BigInt(e.amount)===BigInt(p.seller))||(BigInt(p.fee)>0n&&!entries.some(e=>e.isSystem&&e.bucket==='platform_revenue'&&BigInt(e.amount)===BigInt(p.fee))))findings.push('Các dòng bút toán mua cần đối chiếu lại với người mua, người bán và phần phí đã chốt.');
   if(BigInt(p.fee)+BigInt(p.seller)!==BigInt(p.price)||!p.heldUntil)findings.push('Phân chia thu nhập hoặc dữ liệu khoản giữ chưa đầy đủ.');
  }
 }
 if(check.state==='review')findings.push('Bút toán đã ghi sổ thiếu dòng hoặc không cân bằng theo đơn vị.');
 if(row.referenceType==='refund'&&row.referenceId){const records=(await tx.execute(sql`SELECT p.id,p.status,p.price_points::text price,p.fee_points::text fee,p.seller_points::text seller,e.held_until AS "heldUntil" FROM refunds r JOIN purchase_orders p ON p.id=r.purchase_id LEFT JOIN seller_earnings e ON e.purchase_id=p.id WHERE r.id=${row.referenceId}`)).rows as {id:string;status:string;price:string;fee:string;seller:string;heldUntil:Date|null}[];purchase=records[0]??null;if(!purchase)findings.push('Không tìm thấy yêu cầu hoàn liên quan.');}
 if(row.referenceType==='seller_earning'&&row.referenceId){const records=(await tx.execute(sql`SELECT p.id,p.status,p.price_points::text price,p.fee_points::text fee,p.seller_points::text seller,e.held_until AS "heldUntil" FROM seller_earnings e JOIN purchase_orders p ON p.id=e.purchase_id WHERE e.id=${row.referenceId}`)).rows as {id:string;status:string;price:string;fee:string;seller:string;heldUntil:Date|null}[];purchase=records[0]??null;if(!purchase)findings.push('Không tìm thấy khoản thu liên quan.');}
 const audit=await tx.select({id:auditLogs.id,action:auditLogs.action,createdAt:auditLogs.createdAt}).from(auditLogs).where(inArray(auditLogs.entityId,[id,...(row.referenceId?[row.referenceId]:[]),...(payment?[payment.id]:[]),...(purchase?[purchase.id]:[])])).orderBy(desc(auditLogs.createdAt),desc(auditLogs.id)).limit(20);
 return {...row,entries,check,payment,purchase,findings,audit};
 },{isolationLevel:'repeatable read',accessMode:'read only'});}
