import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {db} from '../db/client';
import {notificationEmailTemplate,projectEvents,sellerEvents,type DeliveryResult,type EmailPayload} from '../lib/notifications/email-templates';
import {notificationEmailEnabled} from './notification-email-preferences';
import {projectWatchEnabled} from './project-watch';

const seller=sql.join(sellerEvents.map(value=>sql`${value}`),sql`,`);
const project=sql.join(projectEvents.map(value=>sql`${value}`),sql`,`);
const optedIn=()=>sql`u.status='active' AND u.email_verified AND (
  (n.type IN (${seller}) AND n.created_at >= p.seller_enabled_at)
  OR (n.type IN (${project}) AND n.created_at >= p.project_enabled_at)
  ${projectWatchEnabled()?sql`OR (n.type='project.watch.published' AND EXISTS(
    SELECT 1 FROM project_watch_alerts a JOIN project_watch_periods w ON w.id=a.period_id
    JOIN projects live ON live.id=a.project_id
    WHERE a.notification_id=n.id AND a.user_id=u.id AND w.email_enabled AND w.ends_at>now() AND live.status='published'
  ))`:sql.empty()})`;
const digest=(payload:EmailPayload)=>createHash('sha256').update(JSON.stringify(payload)).digest('hex');
type Candidate={id:string;type:string;email:string;href:string|null};
type Claim=Candidate & {token:string;attempts:number;hash:string;payload:EmailPayload};
type Options={origin:string;from:string;limit:number;recipientId?:string;deliver:(payload:EmailPayload,key:string)=>Promise<DeliveryResult>};

function message(candidate:Candidate,from:string,origin:string) {
  const template=notificationEmailTemplate(candidate.type,origin,candidate.href);
  if(!template)throw new Error('Unsupported notification email type.');
  return {from,to:[candidate.email],...template};
}

async function claimOne(options:Options):Promise<Claim|null> {
  return db.transaction(async tx=>{
    const candidates=await tx.execute<Candidate>(sql`
      SELECT n.id,n.type,u.email,n.data->>'href' AS href FROM notifications n
      LEFT JOIN notification_email_preferences p ON p.user_id=n.user_id
      JOIN users u ON u.id=n.user_id
      LEFT JOIN notification_email_deliveries d ON d.notification_id=n.id
      WHERE n.created_at BETWEEN now()-interval '12 hours' AND now() AND ${optedIn()}
        ${options.recipientId?sql`AND n.user_id=${options.recipientId}`:sql.empty()}
        AND (d.notification_id IS NULL OR (d.state IN ('retry','sending') AND d.attempts<4
          AND d.next_attempt_at<=now() AND d.first_attempt_at>now()-interval '12 hours'))
      ORDER BY n.created_at,n.id LIMIT 1 FOR UPDATE OF n SKIP LOCKED`);
    const row=candidates.rows[0];
    if(!row)return null;
    const payload=message(row,options.from,options.origin),hash=digest(payload),token=randomUUID();
    const result=await tx.execute<{attempts:number;payload_hash:string}>(sql`
      INSERT INTO notification_email_deliveries(notification_id,state,attempts,first_attempt_at,next_attempt_at,lease_token,payload_hash)
      VALUES (${row.id},'sending',1,now(),now()+interval '2 minutes',${token},${hash})
      ON CONFLICT(notification_id) DO UPDATE SET state='sending',attempts=notification_email_deliveries.attempts+1,
        lease_token=excluded.lease_token,next_attempt_at=excluded.next_attempt_at,updated_at=now()
      WHERE notification_email_deliveries.state IN ('retry','sending')
        AND notification_email_deliveries.attempts<4 AND notification_email_deliveries.next_attempt_at<=now()
        AND notification_email_deliveries.first_attempt_at>now()-interval '12 hours'
      RETURNING attempts,payload_hash`);
    const claimed=result.rows[0];
    return claimed?{...row,token,attempts:claimed.attempts,hash:claimed.payload_hash,payload}:null;
  });
}
async function finish(claim:Claim,state:'accepted'|'retry'|'failed'|'skipped',outcome:string,providerId:string|null=null) {
  const delay=[0,60,300,1800,1800][claim.attempts];
  await db.execute(sql`UPDATE notification_email_deliveries SET state=${state},outcome=${outcome},provider_id=${providerId},
    lease_token=NULL,next_attempt_at=now()+${delay}::int*interval '1 second',updated_at=now()
    WHERE notification_id=${claim.id} AND lease_token=${claim.token} AND state='sending'`);
}
async function expire(recipientId?:string) {
  await db.execute(sql`WITH expired AS (
    SELECT d.notification_id FROM notification_email_deliveries d
    JOIN notifications n ON n.id=d.notification_id
    WHERE d.state IN ('sending','retry') AND d.next_attempt_at<=now()
      ${recipientId?sql`AND n.user_id=${recipientId}`:sql.empty()}
      AND (d.attempts>=4 OR d.first_attempt_at<=now()-interval '12 hours' OR n.created_at<now()-interval '12 hours')
    ORDER BY d.next_attempt_at LIMIT 100 FOR UPDATE OF d SKIP LOCKED
  ) UPDATE notification_email_deliveries d SET state='failed',lease_token=NULL,outcome='retry_window_closed',updated_at=now()
    FROM expired WHERE d.notification_id=expired.notification_id`);
}

export async function processNotificationEmails(options:Options) {
  if(!notificationEmailEnabled())throw new Error('Notification email is disabled.');
  if(!Number.isInteger(options.limit)||options.limit<1||options.limit>30)throw new Error('Invalid batch limit.');
  await expire(options.recipientId);
  const stats={accepted:0,retry:0,failed:0,skipped:0};
  for(let index=0;index<options.limit;index++) {
    const claim=await claimOne(options);
    if(!claim)break;
    const current=await db.execute<Candidate>(sql`SELECT n.id,n.type,u.email,n.data->>'href' AS href FROM notifications n
      LEFT JOIN notification_email_preferences p ON p.user_id=n.user_id JOIN users u ON u.id=n.user_id
      JOIN notification_email_deliveries d ON d.notification_id=n.id
      WHERE n.id=${claim.id} AND d.lease_token=${claim.token} AND d.next_attempt_at>now() AND ${optedIn()}`);
    const latest=current.rows[0];
    if(!latest||digest(message(latest,options.from,options.origin))!==claim.hash) {
      await finish(claim,'skipped','eligibility_or_payload_changed');
      stats.skipped++;continue;
    }
    let result:DeliveryResult;
    try {result=await options.deliver(claim.payload,'notification-email/'+claim.id);}
    catch {result={status:'retry',reason:'transport_unavailable'};}
    if(result.status==='accepted') {
      await finish(claim,'accepted','provider_accepted',result.providerId);stats.accepted++;
    } else {
      const state=result.status==='retry'&&claim.attempts<4?'retry':'failed';
      await finish(claim,state,result.reason);stats[state]++;
    }
  }
  return stats;
}
