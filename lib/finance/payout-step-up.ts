import 'server-only';
import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {auth} from '../../auth';
import {db} from '../../db/client';
import {auditLogs} from '../../db/schema';
import {AccessError,type Actor} from '../auth/permissions';
import {requirePayoutOperations} from '../../services/settlement-core';
export async function payoutStepUp(request:Request,actor:Actor,password:unknown){
 requirePayoutOperations();if(typeof password!=='string'||password.length<8||password.length>128)throw new AccessError(403,'Nhập lại mật khẩu hiện tại để xác nhận thao tác nhạy cảm.');const key=randomUUID();
 await db.transaction(async tx=>{await tx.execute(sql`SET LOCAL lock_timeout='5s'`);await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'payout-step-up:'+actor.id},0))`);const [count]=(await tx.execute(sql`SELECT (SELECT count(*) FROM audit_logs WHERE actor_id=${actor.id} AND action='payout.step_up.failed' AND created_at>now()-interval '15 minutes')::int failures,(SELECT count(*) FROM audit_logs a WHERE a.actor_id=${actor.id} AND a.action='payout.step_up.started' AND a.created_at>now()-interval '1 minute' AND NOT EXISTS(SELECT 1 FROM audit_logs f WHERE f.actor_id=a.actor_id AND f.request_id=a.request_id AND f.action IN ('payout.step_up.failed','payout.step_up.succeeded')))::int pending`)).rows as {failures:number;pending:number}[];if(count.failures>=5||count.pending>=3)throw new AccessError(403,'Đã vượt số lần xác nhận. Chờ rồi thử lại hoặc đăng nhập lại.');await tx.insert(auditLogs).values({actorId:actor.id,action:'payout.step_up.started',entityType:'user',entityId:actor.id,requestId:key});});
 let valid=false;try{const session=await auth.api.getSession({headers:request.headers});if(session?.user.id===actor.id){const result=await auth.api.verifyPassword({headers:request.headers,body:{password}});valid=result.status===true;}}catch{valid=false;}
 await db.insert(auditLogs).values({actorId:actor.id,action:valid?'payout.step_up.succeeded':'payout.step_up.failed',entityType:'user',entityId:actor.id,requestId:key});if(!valid)throw new AccessError(403,'Không xác nhận được mật khẩu. Kiểm tra mật khẩu hoặc đăng nhập lại nếu phiên đã cũ.');
}
