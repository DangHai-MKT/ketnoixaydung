import 'server-only';
import {sql} from 'drizzle-orm';
import {db} from '../db/client';
import {requireRoles,type Actor} from '../lib/auth/permissions';
import {type financeWindow} from '../lib/finance/reporting';
import {financeReadActor} from './finance-read-access';
export async function getFinanceDashboard(actor:Actor,range:ReturnType<typeof financeWindow>){requireRoles(actor,['finance_operator','super_admin']);return db.transaction(async tx=>{
 await financeReadActor(tx,actor);await tx.execute(sql`SET LOCAL statement_timeout='15s'`);
 const [payments]=(await tx.execute(sql`SELECT count(*)::int AS count, COALESCE(sum(amount_vnd),0)::text AS vnd FROM payment_orders WHERE status='paid' AND paid_at>=${range.from} AND paid_at<${range.until}`)).rows as {count:number;vnd:string}[];
 const [purchases]=(await tx.execute(sql`SELECT count(*)::int AS count, COALESCE(sum(price_points),0)::text AS points, COALESCE(sum(fee_points),0)::text AS fees, COALESCE(sum(seller_points),0)::text AS seller FROM purchase_orders WHERE status='completed' AND completed_at>=${range.from} AND completed_at<${range.until}`)).rows as {count:number;points:string;fees:string;seller:string}[];
 const [posted]=(await tx.execute(sql`SELECT COALESCE(sum(-le.amount) FILTER (WHERE w.bucket='issuance' AND lt.transaction_type='topup'),0)::text AS issued, COALESCE(sum(le.amount) FILTER (WHERE w.bucket='platform_revenue'),0)::text AS revenue FROM ledger_transactions lt JOIN ledger_entries le ON le.transaction_id=lt.id JOIN wallets w ON w.id=le.wallet_id WHERE lt.status='posted' AND w.is_system AND w.unit='POINT' AND lt.posted_at>=${range.from} AND lt.posted_at<${range.until}`)).rows as {issued:string;revenue:string}[];
 const earnings=(await tx.execute(sql`SELECT status,count(*)::int AS count,COALESCE(sum(net_points),0)::text AS points FROM seller_earnings GROUP BY status`)).rows as {status:string;count:number;points:string}[];
 const withdrawals=(await tx.execute(sql`SELECT status,count(*)::int AS count,COALESCE(sum(amount_vnd),0)::text AS vnd,COALESCE(sum(points_reserved),0)::text AS points FROM withdrawal_requests GROUP BY status`)).rows as {status:string;count:number;vnd:string;points:string}[];
 const [cases]=(await tx.execute(sql`SELECT (SELECT count(*)::int FROM refunds WHERE status IN ('requested','approved')) AS refunds,(SELECT count(*)::int FROM disputes WHERE status IN ('open','under_review')) AS disputes`)).rows as {refunds:number;disputes:number}[];
 const [exceptions]=(await tx.execute(sql`SELECT
 (SELECT count(*)::int FROM payment_orders p WHERE p.status='paid' AND (SELECT count(*) FROM ledger_transactions l WHERE l.reference_type='payment_order' AND l.reference_id=p.id AND l.status='posted' AND l.transaction_type<>'reversal')<>1) AS payments,
 (SELECT count(*)::int FROM purchase_orders p WHERE p.status='completed' AND ((SELECT count(*) FROM ledger_transactions l WHERE l.reference_type='purchase_order' AND l.reference_id=p.id AND l.status='posted' AND l.transaction_type<>'reversal')<>1 OR (SELECT count(*) FROM seller_earnings e WHERE e.purchase_id=p.id AND e.seller_id=p.seller_id AND e.gross_points=p.price_points AND e.fee_points=p.fee_points AND e.net_points=p.seller_points)<>1)) AS purchases,
 (SELECT count(*)::int FROM ledger_transactions l WHERE l.status='posted' AND l.transaction_type='topup' AND NOT EXISTS (SELECT 1 FROM payment_orders p WHERE l.reference_type='payment_order' AND p.id=l.reference_id)) AS "unlinkedTopups"`)).rows as {payments:number;purchases:number;unlinkedTopups:number}[];
 const daily=(await tx.execute(sql`SELECT to_char(completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS day,count(*)::int AS count,sum(price_points)::text AS points,sum(fee_points)::text AS fees FROM purchase_orders WHERE status='completed' AND completed_at>=${range.from} AND completed_at<${range.until} GROUP BY 1 ORDER BY 1 DESC LIMIT 31`)).rows as {day:string;count:number;points:string;fees:string}[];
 return {payments,purchases,posted,earnings,withdrawals,cases,exceptions,daily,range:{start:range.start,end:range.end},asOf:new Date()};
 },{isolationLevel:'repeatable read',accessMode:'read only'});}
