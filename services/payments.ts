import 'server-only';
import {randomBytes} from 'node:crypto';
import {and,asc,desc,eq,gt,inArray,isNull,lte,or,sql} from 'drizzle-orm';
import {setTimeout as delay} from 'node:timers/promises';
import {db} from '../db/client';
import {auditLogs,ledgerEntries,ledgerTransactions,notifications,paymentEvents,paymentOrders,systemSettings,userRoles,users,wallets} from '../db/schema';
import {AccessError,isRole,requireRoles,type Actor,type Role} from '../lib/auth/permissions';
import {uuidInput} from '../lib/seller/validation';
import {approvedTopupPolicy,topupPoints} from '../lib/finance/money';
import {bankConfigurationInput,bankInstructions,confirmationInput,topupInput,type BankInstructions,paymentQuery} from '../lib/finance/topup';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
const provider='manual_bank_transfer',financeRoles=['finance_operator','super_admin'] as const;
export function isTopupTestEnvironment(){try{const u=new URL(process.env.DATABASE_URL||'');return process.env.CONSTRUCTION_AUTH_TEST==='1'&&['postgres:','postgresql:'].includes(u.protocol)&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&decodeURIComponent(u.pathname.slice(1))==='construction_marketplace_migration_test'&&[...u.searchParams.keys()].every(k=>k==='sslmode');}catch{return false;}}
async function actorNow(tx:Tx,actor:Actor,roles:readonly Role[],ownerId?:string){
 const people=await tx.select().from(users).where(inArray(users.id,ownerId?[actor.id,ownerId]:[actor.id])).orderBy(asc(users.id)).for('update');
 const grants=await tx.select().from(userRoles).where(inArray(userRoles.userId,people.map(p=>p.id)));
 const user=people.find(p=>p.id===actor.id);const current=requireRoles(user?{...user,roles:grants.filter(g=>g.userId===actor.id).map(g=>g.role).filter(isRole)}:null,roles);
 if(ownerId){const owner=people.find(p=>p.id===ownerId);if(owner?.status!=='active'||!grants.some(g=>g.userId===ownerId&&g.role==='buyer'))throw new AccessError(409,'Tài khoản người nạp hiện không đủ điều kiện nhận điểm.');}
 return current;
}
async function readActor(actor:Actor,roles:readonly Role[]){const [user]=await db.select().from(users).where(eq(users.id,actor.id));const grants=await db.select().from(userRoles).where(eq(userRoles.userId,actor.id));return requireRoles(user?{...user,roles:grants.map(g=>g.role).filter(isRole)}:null,roles);}
async function configuration(tx:Tx){
 const now=new Date();const rows=await tx.select().from(systemSettings).where(and(inArray(systemSettings.settingKey,['topup_rate','manual_topup_policy','manual_bank_transfer']),lte(systemSettings.effectiveFrom,now),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,now))));
 const one=(key:string)=>{const list=rows.filter(r=>r.settingKey===key);if(list.length!==1)throw new AccessError(503,'Nạp điểm chưa sẵn sàng: cấu hình cần được xác minh hoặc có khoảng hiệu lực chồng lấn.');return list[0];};
 const rate=one('topup_rate'),policy=one('manual_topup_policy'),bank=one('manual_bank_transfer');
 let instructions:BankInstructions;try{instructions=bankInstructions(bank.value,isTopupTestEnvironment());topupPoints(approvedTopupPolicy.minVnd,rate.value as {amountVnd:unknown;points:unknown},policy.value);}catch(error){if(error instanceof AccessError)throw new AccessError(503,error.message);throw error;}
 return {rate:{amountVnd:String(rate.value.amountVnd),points:String(rate.value.points),version:rate.version},policy:{...approvedTopupPolicy,version:policy.version},bank:{...instructions,version:bank.version},testEnvironment:isTopupTestEnvironment()};
}
export async function getTopupConfiguration(actor:Actor){await readActor(actor,['buyer']);return db.transaction(configuration,{isolationLevel:'repeatable read',accessMode:'read only'});}
export async function getBankConfiguration(actor:Actor){await readActor(actor,['super_admin']);const [row]=await db.select({value:systemSettings.value,version:systemSettings.version}).from(systemSettings).where(eq(systemSettings.settingKey,'manual_bank_transfer')).orderBy(desc(systemSettings.version)).limit(1);return {bank:row?.value??null,version:row?.version??0,policy:approvedTopupPolicy,testEnvironment:isTopupTestEnvironment()};}
export async function saveBankConfiguration(actor:Actor,input:unknown){requireRoles(actor,['super_admin']);const data=bankConfigurationInput(input);
 return db.transaction(async tx=>{await actorNow(tx,actor,['super_admin']);await tx.execute(sql`SELECT pg_advisory_xact_lock(72301942)`);
 const prior=await tx.select().from(systemSettings).where(inArray(systemSettings.settingKey,['manual_bank_transfer','manual_topup_policy'])).orderBy(desc(systemSettings.version));
 if(data.expectedVersion!==undefined&&data.expectedVersion!==(prior.find(r=>r.settingKey==='manual_bank_transfer')?.version??0))throw new AccessError(409,'Cấu hình đã thay đổi. Tải lại trang trước khi lưu.');
 const from=new Date(Math.max(Date.now(),...prior.map(r=>r.effectiveFrom.getTime()+1))),versions:Record<string,number>={};
 for(const key of ['manual_bank_transfer','manual_topup_policy']){const version=(prior.find(r=>r.settingKey===key)?.version??0)+1;versions[key]=version;
 await tx.update(systemSettings).set({effectiveTo:from}).where(and(eq(systemSettings.settingKey,key),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,from))));
 await tx.insert(systemSettings).values({settingKey:key,version,value:key==='manual_bank_transfer'?{...data.bank,verifiedAt:data.bank.enabled?from.toISOString():null}:{...approvedTopupPolicy},effectiveFrom:from,createdBy:actor.id,changeReason:data.reason});}
 await tx.insert(auditLogs).values({actorId:actor.id,action:'finance.topup_configuration.updated',entityType:'system_settings',reason:data.reason,metadata:{enabled:data.bank.enabled,versions}});
 return {ok:true,versions};});
}
export async function createTopup(actor:Actor,input:unknown){requireRoles(actor,['buyer']);const data=topupInput(input);
 return creationRetry(()=>db.transaction(async tx=>{await tx.execute(sql`SET LOCAL lock_timeout='5s'`);await tx.execute(sql`SET LOCAL statement_timeout='15s'`);await actorNow(tx,actor,['buyer']);
 const [prior]=await tx.select().from(paymentOrders).where(and(eq(paymentOrders.userId,actor.id),eq(paymentOrders.clientIdempotencyKey,data.idempotencyKey))).for('update');
 if(prior){if(prior.provider!==provider||prior.amountVnd.toString()!==data.amountVnd)throw new AccessError(409,'Mã yêu cầu đã được dùng cho số tiền hoặc phương thức khác.');return {id:prior.id,reused:true};}
 const config=await configuration(tx),conversion=topupPoints(data.amountVnd,config.rate,config.policy),now=new Date(),expiresAt=new Date(now.getTime()+config.policy.expiresHours*3600000);
 const transferReference='CM'+BigInt('0x'+randomBytes(14).toString('hex')).toString(36).toUpperCase().padStart(22,'0');
 const [order]=await tx.insert(paymentOrders).values({userId:actor.id,provider,clientIdempotencyKey:data.idempotencyKey,amountVnd:BigInt(conversion.amountVnd),pointsToCredit:BigInt(conversion.points),exchangeRateVersion:config.rate.version,status:'pending',createdAt:now,updatedAt:now,expiresAt}).returning({id:paymentOrders.id});
 await tx.insert(paymentEvents).values({paymentOrderId:order.id,provider,providerEventId:`order-created:${order.id}`,eventType:'order.created',signatureValid:false,processingStatus:'processed',processedAt:now,payload:{schemaVersion:1,transferReference,amountVnd:conversion.amountVnd,points:conversion.points,rate:config.rate,policy:config.policy,bank:config.bank,expiresAt:expiresAt.toISOString()}});
 await tx.insert(paymentEvents).values({paymentOrderId:order.id,provider,providerEventId:`transfer:${transferReference}`,eventType:'transfer.reference',signatureValid:false,processingStatus:'processed',processedAt:now,payload:{reference:transferReference}});
 await tx.insert(auditLogs).values({actorId:actor.id,entityType:'payment_order',entityId:order.id,action:'topup.created',metadata:{amountVnd:conversion.amountVnd,points:conversion.points,rateVersion:config.rate.version,policyVersion:config.policy.version,bankVersion:config.bank.version}});
 return {id:order.id,reused:false};}));
}
async function creationRetry<T>(work:()=>Promise<T>):Promise<T>{for(let n=0;;n++)try{return await work();}catch(error){const code=errorCode(error);if(['55P03','57014'].includes(code))throw new AccessError(503,'Đơn đang được xử lý. Hãy kiểm tra lịch sử đơn nạp trước khi thử lại.');if(!['40P01','40001'].includes(code))throw error;if(n>=2)throw new AccessError(503,'Hệ thống đang bận. Vui lòng thử lại với cùng mã yêu cầu.');await delay(30*(n+1));}}
type Snapshot={schemaVersion:number;transferReference?:string;amountVnd:string;points:string;rate:{amountVnd:string;points:string;version:number};policy:typeof approvedTopupPolicy&{version:number};bank:BankInstructions&{version:number};expiresAt:string};
function validateSnapshot(payload:Record<string,unknown>,order:Pick<typeof paymentOrders.$inferSelect,'amountVnd'|'pointsToCredit'|'exchangeRateVersion'|'expiresAt'|'createdAt'>){
 const snapshot=payload as unknown as Snapshot;
 try{if(snapshot.schemaVersion!==1||!snapshot.bank||!snapshot.policy||!snapshot.rate||!Number.isSafeInteger(snapshot.bank.version)||snapshot.bank.version<1||!Number.isSafeInteger(snapshot.policy.version)||snapshot.policy.version<1)throw new Error('snapshot');
 if(snapshot.transferReference!==undefined&&!/^CM[A-Z0-9]{22}$/.test(snapshot.transferReference))throw new Error('reference');
 const {version,...bank}=snapshot.bank;bankInstructions(bank,isTopupTestEnvironment());const c=topupPoints(snapshot.amountVnd,snapshot.rate,snapshot.policy);
 if(c.amountVnd!==order.amountVnd.toString()||c.points!==order.pointsToCredit.toString()||snapshot.points!==c.points||snapshot.rate.version!==order.exchangeRateVersion||snapshot.expiresAt!==order.expiresAt?.toISOString()||order.expiresAt.getTime()-order.createdAt.getTime()!==snapshot.policy.expiresHours*3600000)throw new Error('snapshot');
 return snapshot;}catch{throw new AccessError(409,'Dữ liệu đối chiếu của đơn không đầy đủ hoặc không nhất quán. Cần kiểm tra riêng, chưa cộng điểm.');}
}
async function confirmationTx(actor:Actor,id:string,data:ReturnType<typeof confirmationInput>){return db.transaction(async tx=>{
 await tx.execute(sql`SET LOCAL lock_timeout='5s'`);await tx.execute(sql`SET LOCAL statement_timeout='15s'`);
 const [identity]=await tx.select({userId:paymentOrders.userId}).from(paymentOrders).where(eq(paymentOrders.id,id));if(!identity)throw new AccessError(404,'Không tìm thấy đơn nạp.');
 await actorNow(tx,actor,financeRoles,identity.userId);if(actor.id===identity.userId)throw new AccessError(403,'Không được tự xác nhận đơn nạp của chính mình.');
 const [order]=await tx.select().from(paymentOrders).where(eq(paymentOrders.id,id)).for('update');if(order.provider!==provider)throw new AccessError(409,'Đơn không thuộc phương thức chuyển khoản thủ công được hỗ trợ.');
 const [creation]=await tx.select({payload:paymentEvents.payload}).from(paymentEvents).where(and(eq(paymentEvents.paymentOrderId,id),eq(paymentEvents.provider,provider),eq(paymentEvents.providerEventId,`order-created:${id}`),eq(paymentEvents.eventType,'order.created')));
 const snapshot=validateSnapshot(creation?.payload??{},order);
 if(data.amountVnd!==order.amountVnd.toString()||data.bankAccountLast4!==snapshot.bank.accountNumber.slice(-4))throw new AccessError(409,'Số tiền thực nhận hoặc tài khoản nhận không khớp đơn. Chưa cộng điểm.');
 if(order.status==='paid'){
 const [event]=await tx.select({payload:paymentEvents.payload}).from(paymentEvents).where(and(eq(paymentEvents.paymentOrderId,id),eq(paymentEvents.provider,provider),eq(paymentEvents.providerEventId,`bank:${data.bankReference}`),eq(paymentEvents.eventType,'manual.confirmed')));
 const [ledger]=await tx.select({id:ledgerTransactions.id}).from(ledgerTransactions).where(and(eq(ledgerTransactions.idempotencyKey,`topup:${id}`),eq(ledgerTransactions.status,'posted'),eq(ledgerTransactions.referenceType,'payment_order'),eq(ledgerTransactions.referenceId,id)));
 if(order.providerReference!==data.bankReference||event?.payload.amountVnd!==data.amountVnd||event.payload.receivedAt!==data.receivedAt||!ledger)throw new AccessError(409,'Đơn đã được xác nhận với bằng chứng khác hoặc cần đối soát riêng. Không cộng lại.');return {id,reused:true};}
 const now=new Date();if(order.status!=='pending'||!order.expiresAt||order.expiresAt<=now)throw new AccessError(409,'Đơn đã hết hạn hoặc không ở trạng thái chờ. Tiền đến muộn cần đối soát riêng.');
 const receivedAt=new Date(data.receivedAt);if(receivedAt>now||receivedAt<order.createdAt||receivedAt>order.expiresAt)throw new AccessError(409,'Thời gian tiền vào không phù hợp thời hạn của đơn.');
 const [duplicate]=await tx.select({id:paymentOrders.id}).from(paymentOrders).where(and(eq(paymentOrders.provider,provider),eq(paymentOrders.providerReference,data.bankReference)));if(duplicate)throw new AccessError(409,'Mã giao dịch ngân hàng đã được dùng cho một đơn nạp.');
 const specs=[{userId:null,isSystem:true,bucket:'issuance' as const,accountCode:'SYS:POINT:issuance'},{userId:order.userId,isSystem:false,bucket:'available' as const,accountCode:`USR:${order.userId}:POINT:available`}];
 for(const spec of specs)await tx.insert(wallets).values({...spec,unit:'POINT',description:'POINT account'}).onConflictDoNothing();
 const accounts=await tx.select().from(wallets).where(or(eq(wallets.accountCode,'SYS:POINT:issuance'),and(eq(wallets.userId,order.userId),eq(wallets.unit,'POINT'),eq(wallets.bucket,'available'),eq(wallets.isSystem,false)))).orderBy(asc(wallets.id)).for('update');
 const issuer=accounts.find(a=>a.accountCode==='SYS:POINT:issuance'),owner=accounts.find(a=>a.userId===order.userId&&a.bucket==='available');
 if(!issuer||issuer.unit!=='POINT'||!issuer.isSystem||issuer.userId!==null||issuer.bucket!=='issuance'||!owner||owner.isSystem)throw new AccessError(503,'Cấu hình ví không nhất quán. Chưa cộng điểm.');
 const [ledger]=await tx.insert(ledgerTransactions).values({transactionType:'topup',referenceType:'payment_order',referenceId:id,idempotencyKey:`topup:${id}`,status:'pending',description:'Verified manual POINT top-up',createdBy:actor.id,metadata:{amountVnd:data.amountVnd,points:order.pointsToCredit.toString(),rate:snapshot.rate,policyVersion:snapshot.policy.version,bankVersion:snapshot.bank.version,ledgerModel:approvedTopupPolicy.ledgerModel}}).returning({id:ledgerTransactions.id});
 await tx.insert(ledgerEntries).values([{transactionId:ledger.id,walletId:owner.id,amount:order.pointsToCredit},{transactionId:ledger.id,walletId:issuer.id,amount:-order.pointsToCredit}]);
 await tx.update(ledgerTransactions).set({status:'posted',postedAt:now}).where(eq(ledgerTransactions.id,ledger.id));
 await tx.update(paymentOrders).set({status:'paid',providerReference:data.bankReference,paidAt:receivedAt,updatedAt:now}).where(eq(paymentOrders.id,id));
 await tx.insert(paymentEvents).values({paymentOrderId:id,provider,providerEventId:`bank:${data.bankReference}`,eventType:'manual.confirmed',signatureValid:false,processingStatus:'processed',processedAt:now,payload:{actorId:actor.id,amountVnd:data.amountVnd,bankReference:data.bankReference,receivedAt:data.receivedAt,reason:data.reason,verifiedReceipt:true,ledgerId:ledger.id}});
 await tx.insert(auditLogs).values({actorId:actor.id,entityType:'payment_order',entityId:id,action:'topup.confirmed',reason:data.reason,metadata:{ledgerId:ledger.id,bankReference:data.bankReference,amountVnd:data.amountVnd,points:order.pointsToCredit.toString(),method:'manual_bank_transfer'}});
 await tx.insert(notifications).values({userId:order.userId,type:'topup.confirmed',title:'Nạp điểm thành công',body:'Khoản thanh toán đã được đối chiếu và cộng POINT vào ví.',data:{href:`/account/wallet/top-ups/${id}`}});
 return {id,reused:false};});}
function errorCode(error:unknown){for(let n=0;n<5&&error&&typeof error==='object';n++){const e=error as {code?:string;cause?:unknown};if(e.code)return e.code;error=e.cause;}return '';}
export async function confirmTopup(actor:Actor,id:string,input:unknown){requireRoles(actor,financeRoles);uuidInput(id);const data=confirmationInput(input);
 for(let n=0;;n++)try{return await confirmationTx(actor,id,data);}catch(error){const code=errorCode(error);if(code==='23505')throw new AccessError(409,'Mã giao dịch ngân hàng hoặc đơn đã được ghi nhận. Không cộng lại điểm.');if(['55P03','57014'].includes(code))throw new AccessError(503,'Đơn đang được xử lý. Hãy kiểm tra trạng thái trước khi thử lại.');if(!['40P01','40001'].includes(code))throw error;if(n>=2)throw new AccessError(503,'Giao dịch đang bận. Hãy thử lại với cùng bằng chứng.');await delay(30*(n+1));}
}
const orderProjection={id:paymentOrders.id,userId:paymentOrders.userId,provider:paymentOrders.provider,exchangeRateVersion:paymentOrders.exchangeRateVersion,amountVnd:sql<string>`${paymentOrders.amountVnd}::text`,points:sql<string>`${paymentOrders.pointsToCredit}::text`,status:paymentOrders.status,createdAt:paymentOrders.createdAt,expiresAt:paymentOrders.expiresAt,paidAt:paymentOrders.paidAt};
export async function getTopup(actor:Actor,id:string,admin=false){await readActor(actor,admin?financeRoles:['buyer']);uuidInput(id);
 const [order]=await db.select(orderProjection).from(paymentOrders).where(and(eq(paymentOrders.id,id),admin?undefined:eq(paymentOrders.userId,actor.id)));if(!order)throw new AccessError(404,'Không tìm thấy đơn nạp.');
 const [event]=await db.select({payload:paymentEvents.payload}).from(paymentEvents).where(and(eq(paymentEvents.paymentOrderId,id),eq(paymentEvents.provider,order.provider),eq(paymentEvents.providerEventId,`order-created:${id}`),eq(paymentEvents.eventType,'order.created')));
 let snapshot:Snapshot|null=null;try{snapshot=validateSnapshot(event?.payload??{},{amountVnd:BigInt(order.amountVnd),pointsToCredit:BigInt(order.points),exchangeRateVersion:order.exchangeRateVersion,expiresAt:order.expiresAt,createdAt:order.createdAt});}catch{}
 const evidence=admin?await db.select({createdAt:paymentEvents.processedAt,payload:paymentEvents.payload}).from(paymentEvents).where(and(eq(paymentEvents.paymentOrderId,id),eq(paymentEvents.provider,provider),eq(paymentEvents.eventType,'manual.confirmed'))).limit(1):[];
 return {...order,reference:snapshot?.transferReference??`CM${id.replaceAll('-','').toUpperCase()}`,bank:snapshot?.bank??null,rate:snapshot?.rate??null,policy:snapshot?.policy??null,needsReview:!snapshot,overdue:order.status==='pending'&&!!order.expiresAt&&order.expiresAt<=new Date(),testEnvironment:isTopupTestEnvironment(),evidence:admin?evidence[0]??null:undefined};
}
export async function listTopups(actor:Actor,query:ReturnType<typeof paymentQuery>,admin=false){await readActor(actor,admin?financeRoles:['buyer']);const pattern=`%${query.q.replace(/[\\%_]/g,'\\$&')}%`,now=new Date();
 const status=query.status==='expired'?or(eq(paymentOrders.status,'expired'),and(eq(paymentOrders.status,'pending'),lte(paymentOrders.expiresAt,now))):query.status==='pending'?and(eq(paymentOrders.status,'pending'),or(isNull(paymentOrders.expiresAt),gt(paymentOrders.expiresAt,now))):query.status?eq(paymentOrders.status,query.status as 'paid'|'failed'|'refunded'|'partially_refunded'):undefined;
 const where=and(admin?undefined:eq(paymentOrders.userId,actor.id),status,query.from?sql`${paymentOrders.createdAt}>=${query.from}`:undefined,query.until?sql`${paymentOrders.createdAt}<${query.until}`:undefined,query.q?sql`(${paymentOrders.id}::text ILIKE ${pattern} OR EXISTS (SELECT 1 FROM payment_events pe WHERE pe.payment_order_id=${paymentOrders.id} AND pe.event_type='transfer.reference' AND pe.payload->>'reference' ILIKE ${pattern}) OR replace(${paymentOrders.id}::text,'-','') ILIKE ${'%'+query.q.replace(/^CM/i,'').replace(/[\\%_]/g,'\\$&')+'%'} ${admin?sql`OR ${paymentOrders.providerReference} ILIKE ${pattern}`:sql``})`:undefined);
 return db.transaction(async tx=>{const rows=await tx.select({...orderProjection,ownerName:users.displayName}).from(paymentOrders).innerJoin(users,eq(users.id,paymentOrders.userId)).where(where).orderBy(desc(paymentOrders.createdAt),desc(paymentOrders.id)).limit(20).offset((query.page-1)*20);const [count]=await tx.select({total:sql<number>`count(*)::int`}).from(paymentOrders).where(where);return {rows,total:count.total,page:query.page,pageSize:20};},{isolationLevel:'repeatable read',accessMode:'read only'});
}
