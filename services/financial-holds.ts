import 'server-only';
import {and,asc,eq,inArray,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {purchaseOrders,disputes,refunds,sellerEarnings} from '../db/schema';
import {AccessError} from '../lib/auth/permissions';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
// A lock is a case/refund state, not a new financial balance or ledger bucket.
export async function purchaseFinancialHold(tx:Tx,purchaseId:string){
 const cases=await tx.select({id:disputes.id}).from(disputes).where(and(eq(disputes.purchaseId,purchaseId),inArray(disputes.status,['open','under_review'])));
 const requests=await tx.select({id:refunds.id}).from(refunds).where(and(eq(refunds.purchaseId,purchaseId),inArray(refunds.status,['requested','approved'])));
 const [earning]=await tx.select({status:sellerEarnings.status}).from(sellerEarnings).where(eq(sellerEarnings.purchaseId,purchaseId));
 return {blocked:cases.length>0||requests.length>0||earning?.status==='disputed',activeDisputes:cases.length,pendingRefunds:requests.length};
}
// Call inside the SAME read-committed transaction as release/reserve/payout,
// after user locks and before wallet locks. Opening a case takes these same rows.
// Future payout allocation must pass ALL purchase IDs backing the payout.
export async function assertPurchasesFinancialUnlocked(tx:Tx,purchaseIds:string[]){
 const ids=[...new Set(purchaseIds)].sort();if(!ids.length||ids.length>200)throw new AccessError(400,'Danh sách thu nhập cần kiểm tra không hợp lệ.');
 if(ids.some(id=>! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)))throw new AccessError(400,'Mã giao dịch kiểm tra không hợp lệ.');
 const [isolation]=(await tx.execute(sql`SELECT current_setting('transaction_isolation') AS level`)).rows as {level:string}[];
 if(isolation.level!=='read committed')throw new AccessError(503,'Kiểm tra khóa nghiệp vụ cần giao dịch đọc trạng thái hiện tại. Chưa được xử lý tài chính.');
 const orders=await tx.select({id:purchaseOrders.id,status:purchaseOrders.status}).from(purchaseOrders).where(inArray(purchaseOrders.id,ids)).orderBy(asc(purchaseOrders.id)).for('update');
 if(orders.length!==ids.length)throw new AccessError(409,'Không tìm thấy đầy đủ giao dịch liên quan.');
 for(const order of orders)if(order.status!=='completed'||(await purchaseFinancialHold(tx,order.id)).blocked)throw new AccessError(409,'Thu nhập đang có hồ sơ tranh chấp hoặc hoàn tiền. Chưa được giải phóng hay rút.');
 return orders;
}
