import 'server-only';
import {randomBytes,createHash} from 'node:crypto';
import {and,asc,desc,eq,gt,inArray,isNull,lte,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs,ledgerEntries,ledgerTransactions,notifications,paymentEvents,paymentOrders,systemSettings,userRoles,users,wallets} from '../db/schema';
import {AccessError,requireRoles,type Actor} from '../lib/auth/permissions';
import {topupInput} from '../lib/finance/topup';
import {approvedTopupPolicy,topupPoints,topupPolicyForRate,type TopupPolicy} from '../lib/finance/money';
import {matchSepayApi,parseSepayWebhook,receiptHash,sepayProvider,verifySepaySignature,type SepayReceipt} from '../lib/finance/sepay';
import {readBoundedBody} from '../lib/seller/http';
import {financeReadActor} from './finance-read-access';
import {requireSepayEnvironment,sepayConfiguration} from './sepay-settings';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
async function configurationUnchanged(tx:Tx,version:number){await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(72301942)`);const now=new Date(),rows=await tx.select().from(systemSettings).where(and(eq(systemSettings.settingKey,'sepay_test'),lte(systemSettings.effectiveFrom,now),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,now))));if(rows.length!==1||rows[0].version!==version||rows[0].value.enabled!==true)throw new AccessError(409,'Cấu hình SePay Test đã thay đổi. Chưa ghi sổ.');}
async function buyer(tx:Tx,id:string){const [u]=await tx.select().from(users).where(eq(users.id,id)).for('update');const [role]=await tx.select().from(userRoles).where(and(eq(userRoles.userId,id),eq(userRoles.role,'buyer')));if(u?.status!=='active'||!role)throw new AccessError(409,'Tài khoản người mua không đủ điều kiện nhận điểm.');}
export async function createSepayTopup(actor:Actor,input:unknown){
 requireSepayEnvironment();requireRoles(actor,['buyer']);const data=topupInput(input),config=await sepayConfiguration();
 return db.transaction(async tx=>{await buyer(tx,actor.id);await configurationUnchanged(tx,config.version);
 const [prior]=await tx.select().from(paymentOrders).where(and(eq(paymentOrders.userId,actor.id),eq(paymentOrders.clientIdempotencyKey,data.idempotencyKey)));
 if(prior){if(prior.provider!==sepayProvider||prior.amountVnd.toString()!==data.amountVnd)throw new AccessError(409,'Mã yêu cầu đã dùng cho đơn khác.');return {id:prior.id,reused:true};}
 const now=new Date(),rows=await tx.select().from(systemSettings).where(and(inArray(systemSettings.settingKey,['topup_rate','manual_topup_policy']),lte(systemSettings.effectiveFrom,now),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,now))));
 const one=(key:string)=>{const found=rows.filter(r=>r.settingKey===key);if(found.length!==1)throw new AccessError(503,'Chính sách nạp chưa sẵn sàng.');return found[0];};
 const rate=one('topup_rate'),policy=one('manual_topup_policy'),exchange={amountVnd:rate.value.amountVnd,points:rate.value.points};
 if(data.expectedRateVersion!==undefined&&data.expectedRateVersion!==rate.version)throw new AccessError(409,'Tỷ giá đã thay đổi. Tải lại trang để xem số điểm mới.');
 const conversion=topupPoints(data.amountVnd,exchange,policy.value),ratePolicy=topupPolicyForRate(exchange),expiresAt=new Date(now.getTime()+ratePolicy.expiresHours*3600000);
 const reference='CM'+BigInt('0x'+randomBytes(14).toString('hex')).toString(36).toUpperCase().padStart(22,'0');
 const snapshot={schemaVersion:1,transferReference:reference,amountVnd:conversion.amountVnd,points:conversion.points,rate:{...conversion.rate,version:rate.version},policy:{...ratePolicy,version:policy.version},bank:{enabled:true,verified:true,bankName:config.bankName,accountNumber:config.accountNumber,accountName:config.accountName,version:config.version},sepayAccountId:config.accountId,mode:'test',expiresAt:expiresAt.toISOString()};
 const [order]=await tx.insert(paymentOrders).values({userId:actor.id,provider:sepayProvider,amountVnd:BigInt(conversion.amountVnd),pointsToCredit:BigInt(conversion.points),exchangeRateVersion:rate.version,clientIdempotencyKey:data.idempotencyKey,createdAt:now,expiresAt}).returning({id:paymentOrders.id});
 await tx.insert(paymentEvents).values([{provider:sepayProvider,providerEventId:'order-created:'+order.id,paymentOrderId:order.id,eventType:'order.created',payload:snapshot,processingStatus:'processed',processedAt:now},{provider:sepayProvider,providerEventId:'transfer:'+reference,paymentOrderId:order.id,eventType:'transfer.reference',payload:{reference},processingStatus:'processed',processedAt:now}]);
 await tx.insert(auditLogs).values({actorId:actor.id,action:'topup.sepay_test.created',entityType:'payment_order',entityId:order.id,metadata:{mode:'test',amountVnd:conversion.amountVnd,points:conversion.points,configurationVersion:config.version}});return {id:order.id,reused:false};
 });
}
async function sandboxReceipt(receipt:SepayReceipt,config:Awaited<ReturnType<typeof sepayConfiguration>>){
 const url=new URL('https://userapi-sandbox.sepay.vn/v2/transactions');url.searchParams.set('bank_account_id',config.accountId);url.searchParams.set('reference_number',receipt.bankReference);url.searchParams.set('per_page','100');
 let response:Response;try{response=await fetch(url,{headers:{Authorization:'Bearer '+config.token,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new AccessError(503,'Chưa kết nối được API SePay Test. Có thể đối soát lại sau.');}
 if(!response.ok)throw new AccessError(503,'API SePay Test chưa sẵn sàng. Kiểm tra quyền và hạn mức API.');
 let result:Record<string,unknown>;try{const bytes=await readBoundedBody(new Request('http://localhost',{method:'POST',body:response.body,duplex:'half'} as RequestInit),256*1024);result=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AccessError(503,'Phản hồi API SePay Test không hợp lệ.');}
 const pagination=(result.meta as {pagination?:{has_more?:boolean;last_page?:number}}|undefined)?.pagination;
 if(result.status!=='success'||!Array.isArray(result.data)||!pagination||pagination.has_more!==false||pagination.last_page!==1)throw new AccessError(409,'Kết quả SePay chưa đủ rõ ràng để tự động ghi sổ.');
 const rows=result.data as Record<string,unknown>[];if(rows.length!==1||!matchSepayApi(receipt,rows[0],config.accountId))throw new AccessError(409,'Bằng chứng webhook không khớp duy nhất một giao dịch SePay Test.');return String(rows[0].id);
}
export async function receiveSepayWebhook(request:Request){
 const config=await sepayConfiguration();if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new AccessError(415,'Webhook cần định dạng application/json.');
 const raw=await readBoundedBody(request,16*1024);verifySepaySignature(raw,request.headers,config.secret);const receipt=parseSepayWebhook(raw),hash=receiptHash(receipt);
 const [inserted]=await db.insert(paymentEvents).values({provider:sepayProvider,providerEventId:'webhook:'+receipt.eventId,eventType:'sepay.webhook',signatureValid:true,payload:{receipt,hash,configurationVersion:config.version},processingStatus:'received'}).onConflictDoNothing().returning({id:paymentEvents.id});
 const [event]=inserted?[inserted]:await db.select({id:paymentEvents.id,payload:paymentEvents.payload}).from(paymentEvents).where(and(eq(paymentEvents.provider,sepayProvider),eq(paymentEvents.providerEventId,'webhook:'+receipt.eventId)));
 if(!event)throw new AccessError(503,'Chưa lưu được webhook.');
 if(!inserted){const [original]=await db.select().from(paymentEvents).where(eq(paymentEvents.id,event.id));if(original.payload.hash!==hash)throw new AccessError(409,'Mã webhook đã tồn tại với dữ liệu khác.');}
 // The inbox survives transient provider failures. No unawaited background work.
 await reconcileSepayEvent(event.id);
 return {success:true};
}
export async function reconcileSepayEvent(id:string,actor?:Actor){
 requireSepayEnvironment();if(actor)await db.transaction(tx=>financeReadActor(tx,actor));
 const [event]=await db.select().from(paymentEvents).where(and(eq(paymentEvents.id,id),eq(paymentEvents.provider,sepayProvider),eq(paymentEvents.eventType,'sepay.webhook')));if(!event)throw new AccessError(404,'Không tìm thấy webhook SePay Test.');
 if(event.processingStatus==='processed')return {ok:true,reused:true};
 const receipt=event.payload.receipt as SepayReceipt;if(!event.signatureValid||!receipt||receiptHash(receipt)!==event.payload.hash)throw new AccessError(409,'Bằng chứng webhook không nhất quán.');
 try{
 const config=await sepayConfiguration();if(event.payload.configurationVersion!==config.version)throw new AccessError(409,'Cấu hình đã thay đổi. Cần rà soát riêng bằng chứng thuộc phiên bản cũ.');
 if(receipt.direction!=='in'||!receipt.reference||receipt.account!==config.accountNumber||receipt.bank!==config.bankName)throw new AccessError(409,'Sai chiều tiền, mã đơn hoặc tài khoản nhận.');
 const apiId=await sandboxReceipt(receipt,config);
 return await db.transaction(async tx=>{
 await tx.execute(sql`SET LOCAL lock_timeout='5s'`);await tx.execute(sql`SET LOCAL statement_timeout='15s'`);
 const matches=await tx.select({id:paymentOrders.id,userId:paymentOrders.userId}).from(paymentOrders).innerJoin(paymentEvents,and(eq(paymentEvents.paymentOrderId,paymentOrders.id),eq(paymentEvents.provider,sepayProvider),eq(paymentEvents.providerEventId,'transfer:'+receipt.reference),eq(paymentEvents.eventType,'transfer.reference'))).where(eq(paymentOrders.provider,sepayProvider));
 if(matches.length!==1)throw new AccessError(409,'Không tìm thấy duy nhất một đơn SePay Test khớp mã chuyển khoản.');const identity=matches[0];
 // Match the existing manual top-up lock order: users, order, event, wallets.
 const people=[identity.userId,...(actor?[actor.id]:[])].sort();for(const person of [...new Set(people)])await tx.select({id:users.id}).from(users).where(eq(users.id,person)).for('update');
 if(actor){await financeReadActor(tx,actor);if(actor.id===identity.userId)throw new AccessError(403,'Không được tự đối soát đơn của chính mình.');}await buyer(tx,identity.userId);await configurationUnchanged(tx,config.version);
 const [order]=await tx.select().from(paymentOrders).where(eq(paymentOrders.id,identity.id)).for('update');const [locked]=await tx.select().from(paymentEvents).where(eq(paymentEvents.id,id)).for('update');if(locked.processingStatus==='processed')return {ok:true,reused:true};
 const [creation]=await tx.select().from(paymentEvents).where(and(eq(paymentEvents.provider,sepayProvider),eq(paymentEvents.providerEventId,'order-created:'+order.id),eq(paymentEvents.eventType,'order.created')));
 const s=creation?.payload as {schemaVersion:number;mode:string;transferReference:string;sepayAccountId:string;amountVnd:string;points:string;rate:{amountVnd:string;points:string;version:number};policy:TopupPolicy;bank:{version:number;accountNumber:string;bankName:string};expiresAt:string}|undefined;
 if(!s||s.schemaVersion!==1||s.mode!=='test'||s.bank.version!==config.version||s.sepayAccountId!==config.accountId||s.transferReference!==receipt.reference||s.bank.accountNumber!==receipt.account||s.bank.bankName!==receipt.bank)throw new AccessError(409,'Thông tin đơn không khớp phiên bản cấu hình đã nhận webhook.');
 const amount=topupPoints(s.amountVnd,s.rate,s.policy);if(amount.amountVnd!==receipt.amountVnd||amount.amountVnd!==order.amountVnd.toString()||amount.points!==order.pointsToCredit.toString()||s.points!==amount.points||s.rate.version!==order.exchangeRateVersion||s.expiresAt!==order.expiresAt?.toISOString()||!order.expiresAt||order.expiresAt.getTime()-order.createdAt.getTime()!==approvedTopupPolicy.expiresHours*3600000)throw new AccessError(409,'Số tiền, POINT hoặc chính sách đã chốt không khớp.');
 const bankKey='receipt:'+createHash('sha256').update(config.accountId+'|'+receipt.bankReference).digest('hex');const [used]=await tx.select().from(paymentEvents).where(and(eq(paymentEvents.provider,sepayProvider),eq(paymentEvents.providerEventId,bankKey)));
 const [canonical]=await tx.select().from(paymentEvents).where(and(eq(paymentEvents.provider,sepayProvider),eq(paymentEvents.providerEventId,'api:'+apiId)));
 if(order.status==='paid'&&used?.paymentOrderId===order.id&&canonical?.paymentOrderId===order.id){const [ledger]=await tx.select().from(ledgerTransactions).where(and(eq(ledgerTransactions.idempotencyKey,'topup:'+order.id),eq(ledgerTransactions.status,'posted')));if(!ledger)throw new AccessError(409,'Đơn đã thanh toán cần kiểm tra sổ cái.');await tx.update(paymentEvents).set({paymentOrderId:order.id,processingStatus:'processed',processedAt:new Date(),processingError:null}).where(eq(paymentEvents.id,id));return {ok:true,reused:true};}
 if(used||canonical)throw new AccessError(409,'Giao dịch ngân hàng đã được dùng cho đơn khác.');const now=new Date(),receivedAt=new Date(receipt.receivedAt);
 if(order.status!=='pending'||order.expiresAt<=now||receivedAt<order.createdAt||receivedAt>order.expiresAt||receivedAt>now)throw new AccessError(409,'Đơn hết hạn hoặc thời gian tiền vào không phù hợp. Cần đối soát riêng.');
 await tx.insert(paymentEvents).values({provider:sepayProvider,providerEventId:bankKey,paymentOrderId:order.id,eventType:'sepay.receipt',signatureValid:true,processingStatus:'processed',processedAt:now,payload:{apiId,bankReference:receipt.bankReference,amountVnd:receipt.amountVnd,receivedAt:receipt.receivedAt}});
 await tx.insert(paymentEvents).values({provider:sepayProvider,providerEventId:'api:'+apiId,paymentOrderId:order.id,eventType:'sepay.api_receipt',signatureValid:true,processingStatus:'processed',processedAt:now,payload:{bankKey,apiId}});
 for(const spec of [{userId:null,isSystem:true,bucket:'issuance' as const,accountCode:'SYS:POINT:issuance'},{userId:order.userId,isSystem:false,bucket:'available' as const,accountCode:`USR:${order.userId}:POINT:available`}])await tx.insert(wallets).values({...spec,unit:'POINT',description:'POINT account'}).onConflictDoNothing();
 const accounts=await tx.select().from(wallets).where(or(eq(wallets.accountCode,'SYS:POINT:issuance'),and(eq(wallets.userId,order.userId),eq(wallets.unit,'POINT'),eq(wallets.bucket,'available'),eq(wallets.isSystem,false)))).orderBy(asc(wallets.id)).for('update');const issuer=accounts.find(w=>w.accountCode==='SYS:POINT:issuance'),owner=accounts.find(w=>w.userId===order.userId&&w.bucket==='available');
 if(!issuer||!issuer.isSystem||issuer.userId!==null||issuer.unit!=='POINT'||issuer.bucket!=='issuance'||!owner||owner.isSystem)throw new AccessError(503,'Cấu hình ví chưa nhất quán.');
 const [ledger]=await tx.insert(ledgerTransactions).values({transactionType:'topup',referenceType:'payment_order',referenceId:order.id,idempotencyKey:'topup:'+order.id,status:'pending',description:'Verified SePay Test POINT top-up',createdBy:actor?.id??null,metadata:{mode:'test',provider:sepayProvider,apiId,amountVnd:receipt.amountVnd,points:amount.points,rate:s.rate,ledgerModel:approvedTopupPolicy.ledgerModel}}).returning({id:ledgerTransactions.id});
 await tx.insert(ledgerEntries).values([{transactionId:ledger.id,walletId:owner.id,amount:order.pointsToCredit},{transactionId:ledger.id,walletId:issuer.id,amount:-order.pointsToCredit}]);await tx.update(ledgerTransactions).set({status:'posted',postedAt:now}).where(eq(ledgerTransactions.id,ledger.id));
 await tx.update(paymentOrders).set({status:'paid',providerReference:receipt.bankReference,paidAt:receivedAt,updatedAt:now}).where(eq(paymentOrders.id,order.id));await tx.update(paymentEvents).set({paymentOrderId:order.id,processingStatus:'processed',processedAt:now,processingError:null}).where(eq(paymentEvents.id,id));
 await tx.insert(auditLogs).values({actorId:actor?.id??null,action:'topup.sepay_test.confirmed',entityType:'payment_order',entityId:order.id,metadata:{ledgerId:ledger.id,apiId,mode:'test',amountVnd:receipt.amountVnd,points:amount.points}});
 await tx.insert(notifications).values({userId:order.userId,type:'topup.confirmed',title:'Nạp POINT thử nghiệm thành công',body:'Giao dịch SePay Test đã được đối soát và ghi sổ một lần.',data:{href:'/account/wallet/top-ups/'+order.id}});return {ok:true,reused:false};
 });
 }catch(error){const message=error instanceof AccessError?error.message:'Đối soát tạm thời chưa hoàn tất. Vui lòng thử lại.';await db.update(paymentEvents).set({processingStatus:'failed',processingError:message}).where(and(eq(paymentEvents.id,id),sql`${paymentEvents.processingStatus}<>'processed'`));if(error instanceof AccessError&&[401,403].includes(error.status))throw error;if(error instanceof AccessError&&error.status!==503)return {ok:false,needsReview:true};throw new AccessError(503,message);}
}
export async function listSepayEvents(actor:Actor,page=1){requireSepayEnvironment();if(!Number.isSafeInteger(page)||page<1||page>10000)throw new AccessError(400,'Trang không hợp lệ.');return db.transaction(async tx=>{await financeReadActor(tx,actor);const where=and(eq(paymentEvents.provider,sepayProvider),eq(paymentEvents.eventType,'sepay.webhook'));const rows=await tx.select({id:paymentEvents.id,orderId:paymentEvents.paymentOrderId,status:paymentEvents.processingStatus,error:paymentEvents.processingError,receivedAt:paymentEvents.receivedAt,payload:paymentEvents.payload}).from(paymentEvents).where(where).orderBy(desc(paymentEvents.receivedAt),desc(paymentEvents.id)).limit(20).offset((page-1)*20);const [count]=await tx.select({total:sql<number>`count(*)::int`}).from(paymentEvents).where(where);return {page,total:count.total,rows:rows.map(({payload,...row})=>{const r=payload.receipt as SepayReceipt;return {...row,amountVnd:r?.amountVnd??'',reference:r?.reference??'',bankReference:r?.bankReference??'',accountLast4:r?.account?.slice(-4)??''};})};},{isolationLevel:'repeatable read',accessMode:'read only'});}
