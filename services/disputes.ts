import 'server-only';
import {createHash} from 'node:crypto';
import {and,asc,desc,eq,inArray,notInArray,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs,disputeCaseEvents,disputeEvidence,disputes,notifications,purchaseOrders,projectVersions,refunds,sellerEarnings,userRoles,users} from '../db/schema';
import {AccessError,isRole,requireRoles,type Actor} from '../lib/auth/permissions';
import {assertCaseOpen,caseActionInput,caseKey,caseQuery,caseReadRoles,caseRevision,caseRoles,openDisputeInput,type CaseMode} from '../lib/finance/disputes';
import {projectReviewerRoles} from '../lib/projects/workflow';
import {uuidInput} from '../lib/seller/validation';
import {normalizeImage,readImage,storeImage} from '../lib/seller/storage';
import {purchaseFinancialHold} from './financial-holds';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
async function writeLimits(tx:Tx){await tx.execute(sql`SET LOCAL lock_timeout='5s'`);await tx.execute(sql`SET LOCAL statement_timeout='15s'`);}
async function lockCasePeople(tx:Tx,actorId:string,order:{buyerId:string;sellerId:string}){await tx.select({id:users.id}).from(users).where(inArray(users.id,[...new Set([actorId,order.buyerId,order.sellerId])])).orderBy(asc(users.id)).for('update');}
async function writeCase<T>(work:(tx:Tx)=>Promise<T>):Promise<T>{try{return await db.transaction(work);}catch(error){let cause:unknown=error;for(let n=0;n<5&&cause&&typeof cause==='object';n++){const e=cause as {code?:string;cause?:unknown};if(e.code==='23505')throw new AccessError(409,'Yêu cầu hoặc hồ sơ đang xử lý đã tồn tại. Tải lại để kiểm tra.');if(['55P03','57014','40P01','40001'].includes(e.code||''))throw new AccessError(503,'Hồ sơ đang được cập nhật. Hãy tải lại và thử với cùng yêu cầu.');cause=e.cause;}throw error;}}
async function current(tx:Tx,actor:Actor,mode:CaseMode,lock=false){const q=tx.select().from(users).where(eq(users.id,actor.id));const [user]=await(lock?q.for('update'):q);const grants=await tx.select().from(userRoles).where(eq(userRoles.userId,actor.id));return requireRoles(user?{...user,roles:grants.map(g=>g.role).filter(isRole)}:null,mode==='admin'?caseReadRoles:[mode]);}
async function caseAccess(tx:Tx,actor:Actor,id:string,mode:CaseMode,write=false){
 uuidInput(id);let person=await current(tx,actor,mode);const [identity]=await tx.select({purchaseId:disputes.purchaseId}).from(disputes).where(eq(disputes.id,id));if(!identity)throw new AccessError(404,'Không tìm thấy hồ sơ.');
 let [order]=await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id,identity.purchaseId));if(!order||mode==='buyer'&&order.buyerId!==actor.id||mode==='seller'&&order.sellerId!==actor.id)throw new AccessError(404,'Không tìm thấy hồ sơ.');
 if(write){await lockCasePeople(tx,actor.id,order);person=await current(tx,actor,mode);const [locked]=await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id,order.id)).for('update');if(!locked||locked.buyerId!==order.buyerId||locked.sellerId!==order.sellerId)throw new AccessError(409,'Giao dịch liên quan đã thay đổi.');order=locked;}
 if(write&&mode==='admin'){requireRoles(person,caseRoles);if([order.buyerId,order.sellerId].includes(actor.id))throw new AccessError(403,'Không được xử lý hồ sơ có giao dịch của chính mình.');}
 const cq=tx.select().from(disputes).where(eq(disputes.id,id));const [record]=await(write?cq.for('update'):cq);return {record,order,person};
}
async function note(tx:Tx,actor:Actor,caseId:string,action:string,metadata:Record<string,unknown>={}){await tx.insert(auditLogs).values({actorId:actor.id,action,entityType:'dispute',entityId:caseId,metadata});}
async function notify(tx:Tx,record:typeof disputes.$inferSelect,order:typeof purchaseOrders.$inferSelect,actorId:string){const people=[{id:order.buyerId,base:'/account'},{id:order.sellerId,base:'/seller'}].filter(p=>p.id!==actorId);if(people.length)await tx.insert(notifications).values(people.map(p=>({userId:p.id,type:'dispute.updated',title:'Hồ sơ tranh chấp có cập nhật',body:'Mở hồ sơ để xem nội dung và tài liệu được bổ sung.',data:{href:p.base+'/disputes/'+record.id}})));}
async function notifyStaff(tx:Tx, order:typeof purchaseOrders.$inferSelect, roles:typeof caseReadRoles[number][], notice:{type:string;title:string;body:string;href:string}){
 const people=await tx.selectDistinct({id:users.id}).from(users).innerJoin(userRoles,eq(userRoles.userId,users.id))
  .where(and(eq(users.status,'active'),inArray(userRoles.role,roles),notInArray(users.id,[order.buyerId,order.sellerId])));
 if(people.length)await tx.insert(notifications).values(people.map(({id})=>({
  userId:id,type:notice.type,title:notice.title,body:notice.body,data:{href:notice.href},
 })));
}
export async function disputeOpeningContext(actor:Actor,purchaseId:string){uuidInput(purchaseId);return db.transaction(async tx=>{await current(tx,actor,'buyer');const [order]=await tx.select().from(purchaseOrders).where(and(eq(purchaseOrders.id,purchaseId),eq(purchaseOrders.buyerId,actor.id)));if(!order)throw new AccessError(404,'Không tìm thấy giao dịch mua của bạn.');const [active]=await tx.select({id:disputes.id}).from(disputes).where(and(eq(disputes.purchaseId,purchaseId),inArray(disputes.status,['open','under_review'])));const [refunded]=await tx.select({id:refunds.id}).from(refunds).where(and(eq(refunds.purchaseId,purchaseId),eq(refunds.status,'completed')));return {activeId:active?.id??null,eligible:order.status==='completed'&&!refunded};},{isolationLevel:'repeatable read',accessMode:'read only'});}
export async function openDispute(actor:Actor,input:unknown){const data=openDisputeInput(input);return writeCase(async tx=>{
 await writeLimits(tx);await current(tx,actor,'buyer');const [identity]=await tx.select().from(purchaseOrders).where(and(eq(purchaseOrders.id,data.purchaseId),eq(purchaseOrders.buyerId,actor.id)));if(!identity)throw new AccessError(404,'Không tìm thấy giao dịch mua của bạn.');await lockCasePeople(tx,actor.id,identity);await current(tx,actor,'buyer');const [order]=await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id,data.purchaseId)).for('update');if(!order||order.buyerId!==identity.buyerId||order.sellerId!==identity.sellerId)throw new AccessError(409,'Giao dịch liên quan đã thay đổi.');
 const [prior]=await tx.select().from(disputes).where(and(eq(disputes.raisedBy,actor.id),eq(disputes.clientIdempotencyKey,data.key)));if(prior){if(prior.purchaseId!==order.id||prior.reasonCode!==data.reasonCode||prior.description!==data.description)throw new AccessError(409,'Mã yêu cầu đã dùng cho hồ sơ khác.');return {id:prior.id,reused:true};}
 if(order.status!=='completed')throw new AccessError(409,'Chỉ mở tranh chấp cho giao dịch mua đã hoàn tất, chưa hoàn tiền.');
 const [refunded]=await tx.select({id:refunds.id}).from(refunds).where(and(eq(refunds.purchaseId,order.id),eq(refunds.status,'completed')));if(refunded)throw new AccessError(409,'Giao dịch đã hoàn tiền, cần liên hệ bộ phận hỗ trợ.');
 const [active]=await tx.select({id:disputes.id}).from(disputes).where(and(eq(disputes.purchaseId,order.id),inArray(disputes.status,['open','under_review'])));if(active)throw new AccessError(409,'Giao dịch đã có hồ sơ đang được xử lý. Hãy bổ sung vào hồ sơ hiện có.');
 const [dismissed]=await tx.select({id:disputes.id}).from(disputes).where(and(
  eq(disputes.purchaseId,order.id),eq(disputes.reasonCode,data.reasonCode),eq(disputes.status,'rejected'),
 )).limit(1);
 if(dismissed)throw new AccessError(409,'Lý do này đã được xem xét. Nếu có bằng chứng mới, hãy liên hệ bộ phận hỗ trợ và cung cấp mã hồ sơ cũ.');
 const [record]=await tx.insert(disputes).values({purchaseId:order.id,raisedBy:actor.id,reasonCode:data.reasonCode,description:data.description,clientIdempotencyKey:data.key}).returning();
 await tx.insert(disputeCaseEvents).values({disputeId:record.id,actorId:actor.id,kind:'opened',message:data.description,requestKey:data.key});await note(tx,actor,record.id,'dispute.opened',{purchaseId:order.id,businessHold:true});await notify(tx,record,order,actor.id);
 await notifyStaff(tx,order,[...caseRoles],{type:'dispute.opened',title:'Có báo cáo vi phạm cần xem xét',body:'Mở hồ sơ để kiểm tra thông tin của giao dịch và bằng chứng.',href:'/admin/disputes/'+record.id});
 return {id:record.id,reused:false};
 });}
export async function listDisputes(actor:Actor,mode:CaseMode,query:ReturnType<typeof caseQuery>){return db.transaction(async tx=>{
 await current(tx,actor,mode);const where=and(mode==='buyer'?eq(purchaseOrders.buyerId,actor.id):mode==='seller'?eq(purchaseOrders.sellerId,actor.id):undefined,query.status?eq(disputes.status,query.status as typeof disputes.$inferSelect.status):undefined);
 const rows=await tx.select({id:disputes.id,status:disputes.status,reason:disputes.reasonCode,createdAt:disputes.createdAt,title:projectVersions.title,purchaseId:disputes.purchaseId}).from(disputes).innerJoin(purchaseOrders,eq(purchaseOrders.id,disputes.purchaseId)).innerJoin(projectVersions,eq(projectVersions.id,purchaseOrders.projectVersionId)).where(where).orderBy(desc(disputes.createdAt),desc(disputes.id)).limit(20).offset((query.page-1)*20);
 const [count]=await tx.select({total:sql<number>`count(*)::int`}).from(disputes).innerJoin(purchaseOrders,eq(purchaseOrders.id,disputes.purchaseId)).where(where);return {rows,total:count.total,page:query.page};
 },{isolationLevel:'repeatable read',accessMode:'read only'});}
export async function getDispute(actor:Actor,id:string,mode:CaseMode,eventPage=1){if(!Number.isSafeInteger(eventPage)||eventPage<1||eventPage>10000)throw new AccessError(400,'Trang lịch sử không hợp lệ.');return db.transaction(async tx=>{
 const {record,order,person}=await caseAccess(tx,actor,id,mode);const [version]=await tx.select({title:projectVersions.title,version:projectVersions.versionNo}).from(projectVersions).where(eq(projectVersions.id,order.projectVersionId));
 const events=await tx.select({id:disputeCaseEvents.id,kind:disputeCaseEvents.kind,message:disputeCaseEvents.message,createdAt:disputeCaseEvents.createdAt,actorId:disputeCaseEvents.actorId,evidenceId:disputeEvidence.id,filename:disputeEvidence.originalFilename,size:sql<string>`${disputeEvidence.sizeBytes}::text`,hash:disputeEvidence.sha256}).from(disputeCaseEvents).leftJoin(disputeEvidence,eq(disputeEvidence.eventId,disputeCaseEvents.id)).where(eq(disputeCaseEvents.disputeId,id)).orderBy(desc(disputeCaseEvents.createdAt),desc(disputeCaseEvents.id)).limit(30).offset((eventPage-1)*30);
 const [count]=await tx.select({total:sql<number>`count(*)::int`}).from(disputeCaseEvents).where(eq(disputeCaseEvents.disputeId,id));const [earning]=await tx.select({status:sellerEarnings.status}).from(sellerEarnings).where(eq(sellerEarnings.purchaseId,order.id));
 const [refund]=await tx.select({id:refunds.id,status:refunds.status}).from(refunds)
  .where(and(eq(refunds.purchaseId,order.id),inArray(refunds.status,['requested','approved','completed']))).orderBy(desc(refunds.createdAt)).limit(1);
 return {id:record.id,status:record.status,reason:record.reasonCode,description:record.description,revision:record.revision,createdAt:record.createdAt,resolution:record.resolution,resolvedAt:record.resolvedAt,purchase:{id:order.id,title:version?.title??'Dự án đã mua',version:version?.version??0,price:order.pricePoints.toString(),status:order.status},hold:await purchaseFinancialHold(tx,order.id),earning:earning??null,refund:refund??null,projectReviewHref:mode==='admin'&&projectReviewerRoles.some(role=>person.roles.includes(role))?'/admin/projects/'+order.projectId+'?version='+order.projectVersionId:null,canViewRefund:mode!=='admin'||person.roles.some(role=>role==='finance_operator'||role==='super_admin'),canWrite:['open','under_review'].includes(record.status)&&(mode!=='admin'||caseRoles.some(r=>person.roles.includes(r))&&![order.buyerId,order.sellerId].includes(actor.id)),canReview:mode==='admin'&&caseRoles.some(r=>person.roles.includes(r))&&![order.buyerId,order.sellerId].includes(actor.id),eventPage,eventTotal:count.total,events:events.map(({actorId,...event})=>({...event,author:actorId===order.buyerId?'Người mua':actorId===order.sellerId?'Người bán':'Bộ phận xử lý',own:actorId===actor.id}))};
 },{isolationLevel:'repeatable read',accessMode:'read only'});}
export async function updateDispute(actor:Actor,id:string,mode:CaseMode,input:unknown){const data=caseActionInput(input);return writeCase(async tx=>{
 await writeLimits(tx);const {record,order}=await caseAccess(tx,actor,id,mode,true);if(data.action!=='message'&&mode!=='admin')throw new AccessError(403,'Chỉ bộ phận xử lý được tiếp nhận hoặc yêu cầu bổ sung.');
 const kind=data.action==='refer_refund'?'message':data.action==='dismiss_report'?'resolution':data.action;
 const message=data.action==='refer_refund'?'Xác nhận vi phạm và chuyển tài chính xét hoàn POINT. '+data.message:data.message;
 const [prior]=await tx.select().from(disputeCaseEvents).where(and(eq(disputeCaseEvents.disputeId,id),eq(disputeCaseEvents.actorId,actor.id),eq(disputeCaseEvents.requestKey,data.key)));if(prior){if(prior.kind!==kind||prior.message!==message)throw new AccessError(409,'Mã yêu cầu đã dùng cho nội dung khác.');return {ok:true,reused:true,revision:record.revision};}
 assertCaseOpen(record.status);if(record.revision!==data.revision)throw new AccessError(409,'Hồ sơ vừa có cập nhật. Tải lại trước khi gửi.');if(data.action==='review_started'&&record.status!=='open')throw new AccessError(409,'Hồ sơ đã được tiếp nhận.');
 if(data.action==='refer_refund'||data.action==='dismiss_report'){
  if(record.status!=='under_review'||order.status!=='completed')throw new AccessError(409,'Cần tiếp nhận hồ sơ và kiểm tra giao dịch trước khi quyết định.');
  const [activeRefund]=await tx.select({id:refunds.id}).from(refunds).where(and(eq(refunds.purchaseId,order.id),
   inArray(refunds.status,['requested','approved','completed']))).limit(1);
  if(activeRefund)throw new AccessError(409,'Giao dịch đã có yêu cầu hoàn POINT. Cần xử lý yêu cầu đó trước.');
  if(data.action==='refer_refund'){
   const [refund]=await tx.insert(refunds).values({purchaseId:order.id,requestedBy:order.buyerId,amountPoints:order.pricePoints,reason:message}).returning({id:refunds.id});
   await tx.insert(auditLogs).values({actorId:actor.id,entityType:'refund',entityId:refund.id,action:'refund.requested',
    reason:message,metadata:{purchaseId:order.id,disputeId:id,amountPoints:order.pricePoints.toString()}});
   await notifyStaff(tx,order,['finance_operator','super_admin'],{type:'dispute.refund_referred',
    title:'Báo cáo đã chuyển xét hoàn POINT',body:'Mở yêu cầu để kiểm tra giao dịch và quyết định hoàn POINT.',href:'/admin/refunds/'+refund.id});
  }
 }
 await tx.insert(disputeCaseEvents).values({disputeId:id,actorId:actor.id,kind,message,requestKey:data.key});
 const changes:Partial<typeof disputes.$inferInsert>={revision:record.revision+1};
 if(data.action==='review_started')Object.assign(changes,{status:'under_review',assignedTo:actor.id});
 if(data.action==='dismiss_report')Object.assign(changes,{status:'rejected',resolvedBy:actor.id,resolvedAt:new Date(),resolution:data.message});
 await tx.update(disputes).set(changes).where(eq(disputes.id,id));
 await note(tx,actor,id,'dispute.'+data.action,{revision:record.revision+1});
 await notify(tx,record,order,actor.id);
 return {ok:true,reused:false,revision:record.revision+1};
 });}
export async function uploadDisputeEvidence(actor:Actor,id:string,mode:CaseMode,input:{file:File;expectedRevision:unknown;idempotencyKey:unknown;caption:unknown}){
 const revision=caseRevision(input.expectedRevision),key=caseKey(input.idempotencyKey);const caption=typeof input.caption==='string'?input.caption.trim():'';if(caption.length<10||caption.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(caption))throw new AccessError(400,'Mô tả bằng chứng từ 10 đến 2.000 ký tự.');if(!input.file.size||input.file.size>5*1024*1024)throw new AccessError(413,'Ảnh bằng chứng tối đa 5 MB.');
 await writeCase(async tx=>{await writeLimits(tx);const {record}=await caseAccess(tx,actor,id,mode,true);assertCaseOpen(record.status);});
 const bytes=await normalizeImage(Buffer.from(await input.file.arrayBuffer()),input.file.type);if(bytes.length>5*1024*1024)throw new AccessError(413,'Ảnh sau chuẩn hóa vượt quá 5 MB.');const hash=createHash('sha256').update(bytes).digest('hex');
 const filename=input.file.name.replaceAll('\\','/').split('/').pop()!.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,255)||'bang-chung.png';
 return writeCase(async tx=>{await writeLimits(tx);const {record,order}=await caseAccess(tx,actor,id,mode,true);const [prior]=await tx.select({event:disputeCaseEvents,evidence:disputeEvidence}).from(disputeCaseEvents).leftJoin(disputeEvidence,eq(disputeEvidence.eventId,disputeCaseEvents.id)).where(and(eq(disputeCaseEvents.disputeId,id),eq(disputeCaseEvents.actorId,actor.id),eq(disputeCaseEvents.requestKey,key)));if(prior){if(prior.event.kind!=='evidence_added'||prior.event.message!==caption||prior.evidence?.sha256!==hash||prior.evidence.originalFilename!==filename)throw new AccessError(409,'Mã yêu cầu đã dùng cho bằng chứng khác.');return {id:prior.evidence.id,reused:true,revision:record.revision};}
 assertCaseOpen(record.status);if(record.revision!==revision)throw new AccessError(409,'Hồ sơ đã cập nhật. Tải lại trước khi gửi bằng chứng.');const [limits]=await tx.select({count:sql<number>`count(*)::int`,size:sql<string>`COALESCE(sum(${disputeEvidence.sizeBytes}),0)::text`}).from(disputeEvidence).where(eq(disputeEvidence.disputeId,id));if(limits.count>=20||BigInt(limits.size)+BigInt(bytes.length)>50n*1024n*1024n)throw new AccessError(413,'Hồ sơ đã đạt hạn mức 20 ảnh hoặc 50 MB. Liên hệ bộ phận xử lý.');
 const storageKey=await storeImage(bytes,'dispute');const [event]=await tx.insert(disputeCaseEvents).values({disputeId:id,actorId:actor.id,kind:'evidence_added',message:caption,requestKey:key}).returning({id:disputeCaseEvents.id});const [evidence]=await tx.insert(disputeEvidence).values({disputeId:id,eventId:event.id,uploadedBy:actor.id,storageKey,originalFilename:filename,mimeType:'image/png',sizeBytes:BigInt(bytes.length),sha256:hash}).returning({id:disputeEvidence.id});await tx.update(disputes).set({revision:record.revision+1}).where(eq(disputes.id,id));await note(tx,actor,id,'dispute.evidence_added',{evidenceId:evidence.id,hash});await notify(tx,record,order,actor.id);return {id:evidence.id,reused:false,revision:record.revision+1};});
}
export async function downloadDisputeEvidence(actor:Actor,id:string,evidenceId:string,mode:CaseMode){uuidInput(evidenceId);return db.transaction(async tx=>{
 await caseAccess(tx,actor,id,mode);const [row]=await tx.select().from(disputeEvidence).where(and(eq(disputeEvidence.id,evidenceId),eq(disputeEvidence.disputeId,id)));if(!row)throw new AccessError(404,'Không tìm thấy bằng chứng.');const bytes=await readImage(row.storageKey,'dispute');if(createHash('sha256').update(bytes).digest('hex')!==row.sha256||BigInt(bytes.length)!==row.sizeBytes)throw new AccessError(503,'Bằng chứng cần được kiểm tra tính toàn vẹn.');return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/png','Content-Disposition':`attachment; filename="bang-chung-${row.id}.png"`,'Content-Length':String(bytes.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 },{isolationLevel:'repeatable read',accessMode:'read only'});}
