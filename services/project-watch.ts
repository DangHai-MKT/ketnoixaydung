import 'server-only';
import {randomUUID} from 'node:crypto';
import {and,asc,eq,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs,ledgerEntries,ledgerTransactions,userRoles,users,wallets} from '../db/schema';
import {AccessError,requireRoles,type Actor} from '../lib/auth/permissions';
import {watchCategory,watchDays,watchEvent,watchPath,watchPrice,watchPurchaseInput,watchReminder,type WatchPeriod} from '../lib/projects/watch';
import {formatPoints,categoryLabels} from '../lib/projects/workflow';
import {isTopupTestEnvironment} from './payments';
import {postedPointBalance,settlementTransaction,type SettlementTx} from './settlement-core';
import {payoutPostingTime} from './payout-core';

export const projectWatchEnabled=()=>process.env.PROJECT_WATCH_ENABLED==='1'&&isTopupTestEnvironment();
function requireWatch() {
  if(!projectWatchEnabled())throw new AccessError(503,'Theo dõi lĩnh vực chưa được mở trên môi trường này.');
}
type PeriodRow={id:string;category:string;starts_at:string|Date;ends_at:string|Date;email_enabled:boolean};
const mapPeriod=(row:PeriodRow):WatchPeriod=>({id:row.id,category:row.category,startsAt:new Date(row.starts_at).toISOString(),
  endsAt:new Date(row.ends_at).toISOString(),email:row.email_enabled});

export async function getWatchDashboard(actor:Actor) {
  requireWatch();requireRoles(actor,['buyer']);
  const [periods,[wallet],[user]]=await Promise.all([
    db.execute<PeriodRow>(sql`SELECT id,category,starts_at,ends_at,email_enabled FROM (
      SELECT p.*, row_number() OVER (PARTITION BY category ORDER BY starts_at DESC) AS position
      FROM project_watch_periods p WHERE user_id=${actor.id}
    ) ranked WHERE position<=2 ORDER BY starts_at DESC,id`),
    db.select({id:wallets.id}).from(wallets).where(and(eq(wallets.userId,actor.id),eq(wallets.unit,'POINT'),eq(wallets.bucket,'available'),eq(wallets.isSystem,false))).limit(1),
    db.select({verified:users.emailVerified}).from(users).where(eq(users.id,actor.id)).limit(1),
  ]);
  const balance=wallet?await db.transaction(tx=>postedPointBalance(tx,wallet.id),{accessMode:'read only'}):0n;
  return {periods:periods.rows.map(mapPeriod),balance:balance.toString(),emailVerified:user?.verified??false,observedAt:Date.now()};
}

async function lockBuyer(tx:SettlementTx,actor:Actor) {
  const [buyer]=await tx.select().from(users).where(eq(users.id,actor.id)).for('update');
  const [role]=await tx.select({role:userRoles.role}).from(userRoles).where(and(eq(userRoles.userId,actor.id),eq(userRoles.role,'buyer')));
  requireRoles(buyer?{...buyer,roles:role?['buyer']:[]}:null,['buyer']);
  return buyer;
}

export async function buyWatchPeriod(actor:Actor,value:unknown) {
  requireWatch();requireRoles(actor,['buyer']);
  const input=watchPurchaseInput(value);
  return settlementTransaction(async tx=>{
    const buyer=await lockBuyer(tx,actor);
    const prior=await tx.execute<PeriodRow>(sql`SELECT id,category,starts_at,ends_at,email_enabled FROM project_watch_periods
      WHERE user_id=${actor.id} AND request_id=${input.requestId}`);
    if(prior.rows[0]) {
      if(prior.rows[0].category!==input.category)throw new AccessError(409,'Mã yêu cầu đã dùng cho lĩnh vực khác.');
      return {period:mapPeriod(prior.rows[0]),reused:true};
    }
    if(input.email&&!buyer.emailVerified)throw new AccessError(400,'Cần xác minh email trước khi chọn nhận tin qua email.');
    const latestResult=await tx.execute<PeriodRow>(sql`SELECT id,category,starts_at,ends_at,email_enabled FROM project_watch_periods
      WHERE user_id=${actor.id} AND category=${input.category} ORDER BY starts_at DESC LIMIT 1`);
    const latest=latestResult.rows[0];
    if((latest?.id??null)!==input.expectedLatestId)throw new AccessError(409,'Kỳ theo dõi đã thay đổi. Tải lại để xem trước khi xác nhận.');
    const revenueCode='SYS:POINT:platform_revenue';
    await tx.insert(wallets).values({userId:null,unit:'POINT',bucket:'platform_revenue',isSystem:true,accountCode:revenueCode,description:'POINT account'}).onConflictDoNothing();
    const accounts=await tx.select().from(wallets).where(or(
      eq(wallets.accountCode,revenueCode),
      and(eq(wallets.userId,actor.id),eq(wallets.unit,'POINT'),eq(wallets.bucket,'available'),eq(wallets.isSystem,false)),
    )).orderBy(asc(wallets.id)).for('update');
    const wallet=accounts.find(row=>row.userId===actor.id&&row.unit==='POINT'&&row.bucket==='available'&&!row.isSystem);
    const revenue=accounts.find(row=>row.accountCode===revenueCode&&row.isSystem&&row.userId===null&&row.unit==='POINT'&&row.bucket==='platform_revenue');
    if(!revenue)throw new AccessError(503,'Tài khoản doanh thu POINT chưa sẵn sàng.');
    const balance=wallet?await postedPointBalance(tx,wallet.id):0n;
    if(!wallet||balance<watchPrice)throw new AccessError(409,'Số dư khả dụng chưa đủ '+formatPoints(watchPrice)+' POINT. Bạn chưa bị trừ điểm.');
    const now=await payoutPostingTime(tx,wallet.id);
    if(latest&&new Date(latest.starts_at)>now)throw new AccessError(409,'Lĩnh vực này đã có một kỳ gia hạn chờ bắt đầu.');
    const latestEnd=latest?new Date(latest.ends_at):null;
    const starts=latestEnd&&latestEnd>now?latestEnd:now,ends=new Date(starts.getTime()+watchDays*86400000);
    const id=randomUUID();
    const [ledger]=await tx.insert(ledgerTransactions).values({transactionType:'project_watch_subscription',referenceType:'project_watch_period',referenceId:id,
      idempotencyKey:'project-watch:'+actor.id+':'+input.requestId,status:'pending',createdBy:actor.id,
      description:'Phí theo dõi lĩnh vực dự án',metadata:{category:input.category,days:watchDays,pricePoints:watchPrice.toString()},
    }).returning({id:ledgerTransactions.id});
    await tx.insert(ledgerEntries).values([{transactionId:ledger.id,walletId:wallet.id,amount:-watchPrice},{transactionId:ledger.id,walletId:revenue.id,amount:watchPrice}]);
    await tx.update(ledgerTransactions).set({status:'posted',postedAt:now}).where(eq(ledgerTransactions.id,ledger.id));
    const result=await tx.execute<PeriodRow>(sql`INSERT INTO project_watch_periods(id,user_id,category,request_id,price_points,ledger_id,starts_at,ends_at,email_enabled)
      VALUES (${id},${actor.id},${input.category},${input.requestId},${watchPrice.toString()},${ledger.id},${starts.toISOString()},${ends.toISOString()},${input.email})
      RETURNING id,category,starts_at,ends_at,email_enabled`);
    await tx.insert(auditLogs).values({actorId:actor.id,action:'project_watch.purchased',entityType:'project_watch_period',entityId:id,metadata:{ledgerId:ledger.id,category:input.category}});
    return {period:mapPeriod(result.rows[0]),reused:false,balance:(balance-watchPrice).toString()};
  });
}

export async function updateWatchEmail(actor:Actor,categoryValue:unknown,email:unknown) {
  requireWatch();requireRoles(actor,['buyer']);
  const category=watchCategory(categoryValue);
  if(typeof email!=='boolean')throw new AccessError(400,'Tùy chọn email không hợp lệ.');
  return db.transaction(async tx=>{
    const buyer=await lockBuyer(tx,actor);
    if(email&&!buyer.emailVerified)throw new AccessError(400,'Cần xác minh email trước khi bật.');
    await tx.execute(sql`UPDATE project_watch_periods SET email_enabled=${email}
      WHERE user_id=${actor.id} AND category=${category} AND ends_at>now()`);
    return {email};
  });
}

export async function notifyProjectWatch(tx:SettlementTx,project:{id:string;sellerId:string;publishedAt:Date|null},version:{category:string;title:string;provinceCode:string|null}) {
  if(!projectWatchEnabled()||!project.publishedAt||!Object.hasOwn(categoryLabels,version.category))return;
  const occurred=project.publishedAt.toISOString();
  const body=version.title+(version.provinceCode?' · '+version.provinceCode:'')+'. Mở dự án để xem thông tin công khai.';
  await tx.execute(sql`WITH candidates AS MATERIALIZED (
    SELECT p.id AS period_id,p.user_id,gen_random_uuid() AS notice_id
    FROM project_watch_periods p JOIN users u ON u.id=p.user_id
    JOIN user_roles r ON r.user_id=u.id AND r.role='buyer'
    WHERE p.category=${version.category} AND p.starts_at<=${occurred}::timestamptz AND p.ends_at>${occurred}::timestamptz
      AND p.user_id<>${project.sellerId} AND u.status='active'
      AND NOT EXISTS(SELECT 1 FROM project_watch_alerts a WHERE a.user_id=p.user_id AND a.project_id=${project.id})
  ), notices AS (
    INSERT INTO notifications(id,user_id,type,title,body,data)
    SELECT notice_id,user_id,${watchEvent},${'Dự án mới · '+categoryLabels[version.category]},${body},
      jsonb_build_object('href',${'/projects/'+project.id}::text) FROM candidates RETURNING id
  )
  INSERT INTO project_watch_alerts(user_id,project_id,period_id,notification_id)
  SELECT c.user_id,${project.id},c.period_id,c.notice_id FROM candidates c JOIN notices n ON n.id=c.notice_id`);
}

export async function remindProjectWatch() {
  requireWatch();
  return db.transaction(async tx=>{
    const result=await tx.execute<{id:string}>(sql`WITH due AS (
      SELECT p.id FROM project_watch_periods p JOIN users u ON u.id=p.user_id
      JOIN user_roles r ON r.user_id=u.id AND r.role='buyer'
      WHERE p.reminded_at IS NULL AND p.starts_at<=now() AND p.ends_at>now() AND p.ends_at<=now()+interval '72 hours'
        AND u.status='active' AND NOT EXISTS(SELECT 1 FROM project_watch_periods next
          WHERE next.user_id=p.user_id AND next.category=p.category AND next.starts_at=p.ends_at)
      ORDER BY p.ends_at,p.id LIMIT 100 FOR UPDATE OF p SKIP LOCKED
    ), updated AS (
      UPDATE project_watch_periods p SET reminded_at=now() FROM due WHERE due.id=p.id RETURNING p.user_id,p.category
    )
    INSERT INTO notifications(user_id,type,title,body,data)
    SELECT user_id,${watchReminder},'Gói theo dõi sắp hết hạn','Mở Theo dõi dự án để kiểm tra ngày hết hạn và gia hạn nếu cần.',
      jsonb_build_object('href',${watchPath}::text) FROM updated RETURNING id`);
    return result.rows.length;
  });
}
