import 'server-only';
import {and,desc,eq,isNotNull,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {purchaseOrders as p,sellerEarnings as e,projectVersions as v} from '../db/schema';
import {type Actor,requireRoles} from '../lib/auth/permissions';
import {earningState,type earningsQuery} from '../lib/finance/reporting';
import {financeReadActor} from './finance-read-access';
const blocked=sql<boolean>`(EXISTS (SELECT 1 FROM disputes d WHERE d.purchase_id=${p.id} AND d.status IN ('open','under_review')) OR EXISTS (SELECT 1 FROM refunds r WHERE r.purchase_id=${p.id} AND r.status IN ('requested','approved')) OR (${p.status}<>'completed' AND ${e.status} IN ('held','available','reserved')) OR ${e.status}='disputed')`;
export async function getSellerEarnings(actor:Actor,q:ReturnType<typeof earningsQuery>,sales=false){requireRoles(actor,['seller']);return db.transaction(async tx=>{
 await financeReadActor(tx,actor,true);await tx.execute(sql`SET LOCAL statement_timeout='15s'`);const now=new Date();
 const state=q.state==='blocked'?blocked:q.state==='due'?and(eq(e.status,'held'),sql`${e.heldUntil}<=${now}`,sql`NOT COALESCE(${blocked},false)`):q.state?eq(e.status,q.state as 'held'):undefined;
 const pattern='%'+q.q.replace(/[\\%_]/g,'\\$&')+'%';
 const where=and(eq(p.sellerId,actor.id),sales?undefined:isNotNull(e.id),state,q.orderStatus?eq(p.status,q.orderStatus as 'completed'):undefined,q.from?sql`${p.createdAt}>=${q.from}`:undefined,q.until?sql`${p.createdAt}<${q.until}`:undefined,q.q?sql`(${p.id}::text ILIKE ${pattern} OR ${v.title} ILIKE ${pattern})`:undefined);
 const rows=await tx.select({id:p.id,projectId:p.projectId,title:v.title,createdAt:p.createdAt,completedAt:p.completedAt,orderStatus:p.status,gross:sql<string>`${p.pricePoints}::text`,fee:sql<string>`${p.feePoints}::text`,net:sql<string>`${p.sellerPoints}::text`,earningId:e.id,status:e.status,heldUntil:e.heldUntil,releasedAt:e.releasedAt,blocked:sql<boolean>`COALESCE(${blocked},false)`}).from(p).innerJoin(v,eq(v.id,p.projectVersionId)).leftJoin(e,eq(e.purchaseId,p.id)).where(where).orderBy(desc(p.createdAt),desc(p.id)).limit(20).offset((q.page-1)*20);
 const [count]=await tx.select({total:sql<number>`count(*)::int`}).from(p).innerJoin(v,eq(v.id,p.projectVersionId)).leftJoin(e,eq(e.purchaseId,p.id)).where(where);
 const totals=await tx.execute(sql`SELECT se.status, count(*)::int AS count, COALESCE(sum(se.net_points),0)::text AS points FROM seller_earnings se WHERE se.seller_id=${actor.id} GROUP BY se.status`);
 const [pending]= (await tx.execute(sql`SELECT count(*)::int AS count, COALESCE(sum(points_reserved),0)::text AS points FROM withdrawal_requests WHERE seller_id=${actor.id} AND status IN ('requested','under_review','approved','processing')`)).rows as {count:number;points:string}[];
 const [due]=(await tx.execute(sql`SELECT count(*)::int AS count, COALESCE(sum(${e.netPoints}),0)::text AS points FROM ${e} INNER JOIN ${p} ON ${p.id}=${e.purchaseId} WHERE ${e.sellerId}=${actor.id} AND ${e.status}='held' AND ${e.heldUntil}<=${now} AND ${p.status}='completed' AND NOT COALESCE(${blocked},false)`)).rows as {count:number;points:string}[];
 const summary=totals.rows as {status:string;count:number;points:string}[];
 return {rows:rows.map(r=>({...r,state:earningState(r,now)})),total:count.total,page:q.page,pageSize:20,summary,due,pending,totalRecorded:summary.filter(r=>r.status!=='reversed').reduce((n,r)=>n+BigInt(r.points),0n).toString(),asOf:now};
 },{isolationLevel:'repeatable read',accessMode:'read only'});}
