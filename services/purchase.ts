import 'server-only';
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { setTimeout as delay } from 'node:timers/promises';
import { db } from '../db/client';
import { ledgerEntries, ledgerTransactions, projectPrivateData, projectVersions, projects, purchaseOrders, sellerEarnings, sellerProfiles, systemSettings, users, userRoles, wallets, auditLogs, notifications } from '../db/schema';
import { AccessError, isRole, requireRoles } from '../lib/auth/permissions';
import { purchaseInput, purchasePolicy } from '../lib/finance/purchase';
import { uuidInput } from '../lib/seller/validation';

type PurchaseInput = { buyerId: string; projectVersionId: string; idempotencyKey: string };
function result(order: typeof purchaseOrders.$inferSelect, reused: boolean, heldUntil?: Date) {
  return { purchaseId: order.id, status: 'completed' as const, pricePoints: order.pricePoints,
    feePoints: order.feePoints, sellerPoints: order.sellerPoints, heldUntil, reused };
}
function retryCode(error: unknown): string | undefined {
  for (let n=0; n<5 && error && typeof error==='object'; n++) {
    const value=error as {code?:string;cause?:unknown};
    if (value.code) return value.code; error=value.cause;
  }
}
export async function purchaseProject(input: PurchaseInput) {
  const buyerId=uuidInput(input.buyerId);
  const data=purchaseInput({projectVersionId:input.projectVersionId,idempotencyKey:input.idempotencyKey});
  for (let attempt=0; ; attempt++) {
    try { return await executePurchase(buyerId,data); }
    catch(error) {
      if (['55P03','57014'].includes(retryCode(error)??'')) throw new AccessError(503,'Giao dịch đang bận. Hãy kiểm tra đơn đã mua rồi thử lại với cùng yêu cầu.');
      if (!['40P01','40001'].includes(retryCode(error)??'')) throw error;
      if(attempt>=2) throw new AccessError(503,'Giao dịch đang bận. Vui lòng thử lại với cùng yêu cầu mua.');
      await delay(30*(attempt+1));
    }
  }
}
async function executePurchase(buyerId:string, data:ReturnType<typeof purchaseInput>) {
  const purchaseKey=`${buyerId}:${data.idempotencyKey}`;
  return db.transaction(async tx=>{
    await tx.execute(sql`SET LOCAL lock_timeout='5s'`);
    await tx.execute(sql`SET LOCAL statement_timeout='15s'`);
    const [identity]=await tx.select({projectId:projects.id,sellerId:projects.sellerId}).from(projectVersions)
      .innerJoin(projects,eq(projects.id,projectVersions.projectId)).where(eq(projectVersions.id,data.projectVersionId));
    if(!identity) throw new AccessError(404,'Không tìm thấy phiên bản dự án.');
    // Same order as project moderation, seller review and role/status changes:
    // users ascending -> seller profile -> project -> wallets ascending.
    const people=await tx.select().from(users).where(inArray(users.id,[buyerId,identity.sellerId])).orderBy(asc(users.id)).for('update');
    const buyer=people.find(row=>row.id===buyerId);
    const grants=await tx.select().from(userRoles).where(inArray(userRoles.userId,[buyerId,identity.sellerId]));
    requireRoles(buyer?{...buyer,roles:grants.filter(g=>g.userId===buyerId).map(g=>g.role).filter(isRole)}:null,['buyer']);
    const [prior]=await tx.select().from(purchaseOrders).where(eq(purchaseOrders.idempotencyKey,purchaseKey));
    if(prior){
      if(prior.buyerId!==buyerId||prior.projectVersionId!==data.projectVersionId) throw new AccessError(409,'Mã yêu cầu đã được dùng cho nội dung mua khác.');
      if(prior.status!=='completed') throw new AccessError(409,'Đơn mua trước đang ở trạng thái không thể mua lại.');
      const [earning]=await tx.select({heldUntil:sellerEarnings.heldUntil}).from(sellerEarnings).where(eq(sellerEarnings.purchaseId,prior.id));
      return result(prior,true,earning?.heldUntil);
    }
    const [existing]=await tx.select().from(purchaseOrders).where(and(eq(purchaseOrders.buyerId,buyerId),eq(purchaseOrders.projectVersionId,data.projectVersionId)));
    if(existing){
      if(existing.status==='completed') {
        const [earning]=await tx.select({heldUntil:sellerEarnings.heldUntil}).from(sellerEarnings).where(eq(sellerEarnings.purchaseId,existing.id));
        return result(existing,true,earning?.heldUntil);
      }
      throw new AccessError(409,'Phiên bản này đã có đơn mua chưa đủ điều kiện cấp quyền.');
    }
    const [previousVersion]=await tx.select({id:purchaseOrders.id}).from(purchaseOrders)
      .where(and(eq(purchaseOrders.buyerId,buyerId),eq(purchaseOrders.projectId,identity.projectId),eq(purchaseOrders.status,'completed'))).limit(1);
    if(previousVersion) throw new AccessError(409,'Bạn đã mua một phiên bản của dự án này. Hãy mở Dự án đã mua để xem; chưa hỗ trợ thu phí phiên bản khác.');
    if(identity.sellerId===buyerId) throw new AccessError(403,'Bạn không thể mua thông tin dự án của chính mình.');
    const seller=people.find(row=>row.id===identity.sellerId);
    const [profile]=await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId,identity.sellerId)).for('update');
    if(seller?.status!=='active'||profile?.verificationStatus!=='verified'||!grants.some(g=>g.userId===identity.sellerId&&g.role==='seller'))
      throw new AccessError(409,'Nhà cung cấp hiện không đủ điều kiện bán thông tin.');
    const [project]=await tx.select().from(projects).where(eq(projects.id,identity.projectId)).for('update');
    if(!project||project.sellerId!==identity.sellerId||project.status!=='published') throw new AccessError(409,'Dự án hiện không được mở bán.');
    const [version]=await tx.select().from(projectVersions).where(and(eq(projectVersions.id,data.projectVersionId),eq(projectVersions.projectId,project.id)));
    if(!version?.approvedAt||version.versionNo!==project.currentVersion||version.submissionStatus!=='published') throw new AccessError(409,'Phiên bản đã thay đổi. Hãy tải lại dự án và xem giá trước khi mua.');
    const [privateRow]=await tx.select({id:projectPrivateData.id,confirmed:projectPrivateData.dataRightsConfirmedAt}).from(projectPrivateData).where(eq(projectPrivateData.projectVersionId,version.id));
    if(!privateRow?.confirmed) throw new AccessError(409,'Thông tin bảo vệ chưa đủ điều kiện cung cấp.');
    const now=new Date();
    const settings=await tx.select().from(systemSettings).where(and(inArray(systemSettings.settingKey,['platform_fee','seller_hold_period']),lte(systemSettings.effectiveFrom,now),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,now))));
    const policy=purchasePolicy(settings.map(row=>({key:row.settingKey,value:row.value,version:row.version})));
    const price=version.pricePoints, fee=price*BigInt(policy.feeBps)/10000n, sellerNet=price-fee;
    if(price<=0n||sellerNet<=0n) throw new AccessError(409,'Giá thông tin dự án không hợp lệ.');
    const specs=[
      {userId:buyerId,bucket:'available' as const,isSystem:false,accountCode:`USR:${buyerId}:POINT:available`},
      {userId:identity.sellerId,bucket:'held' as const,isSystem:false,accountCode:`USR:${identity.sellerId}:POINT:held`},
      ...(fee>0n?[{userId:null,bucket:'platform_revenue' as const,isSystem:true,accountCode:'SYS:POINT:platform_revenue'}]:[]),
    ].sort((a,b)=>a.accountCode.localeCompare(b.accountCode));
    for(const spec of specs) await tx.insert(wallets).values({...spec,unit:'POINT',description:'POINT account'}).onConflictDoNothing();
    const accounts=await tx.select().from(wallets).where(or(...specs.map(s=>s.isSystem?eq(wallets.accountCode,s.accountCode):and(eq(wallets.userId,s.userId!),eq(wallets.unit,'POINT'),eq(wallets.bucket,s.bucket),eq(wallets.isSystem,false))))).orderBy(asc(wallets.id)).for('update');
    for(const spec of specs){
      const row=accounts.find(a=>spec.isSystem?a.accountCode===spec.accountCode:a.userId===spec.userId&&a.bucket===spec.bucket);
      if(!row||row.unit!=='POINT'||row.bucket!==spec.bucket||row.userId!==spec.userId||row.isSystem!==spec.isSystem)
        throw new AccessError(503,'Cấu hình ví không nhất quán. Vui lòng liên hệ hỗ trợ.');
    }
    const buyerWallet=accounts.find(a=>a.userId===buyerId&&a.bucket==='available')!;
    const sellerWallet=accounts.find(a=>a.userId===identity.sellerId&&a.bucket==='held')!;
    const platformWallet=accounts.find(a=>a.isSystem);
    const [balance]=await tx.select({value:sql<string>`COALESCE(sum(${ledgerEntries.amount}),0)::text`}).from(ledgerEntries)
      .innerJoin(ledgerTransactions,eq(ledgerTransactions.id,ledgerEntries.transactionId)).where(and(eq(ledgerEntries.walletId,buyerWallet.id),eq(ledgerTransactions.status,'posted')));
    if(BigInt(balance.value)<price) throw new AccessError(409,'Số dư POINT khả dụng chưa đủ. Bạn chưa bị trừ điểm.');
    const [order]=await tx.insert(purchaseOrders).values({buyerId,sellerId:identity.sellerId,projectId:project.id,projectVersionId:version.id,pricePoints:price,feeBps:policy.feeBps,feePoints:fee,sellerPoints:sellerNet,status:'created',idempotencyKey:purchaseKey}).returning();
    const [ledger]=await tx.insert(ledgerTransactions).values({transactionType:'project_purchase',referenceType:'purchase_order',referenceId:order.id,idempotencyKey:`purchase:${order.id}`,status:'pending',description:'Purchase approved project information',createdBy:buyerId,
      metadata:{buyerId,sellerId:identity.sellerId,projectId:project.id,projectVersionId:version.id,feeBps:policy.feeBps,feeSettingVersion:policy.feeVersion,holdDays:policy.holdDays,holdSettingVersion:policy.holdVersion}}).returning({id:ledgerTransactions.id});
    await tx.insert(ledgerEntries).values([{transactionId:ledger.id,walletId:buyerWallet.id,amount:-price},{transactionId:ledger.id,walletId:sellerWallet.id,amount:sellerNet},...(fee>0n&&platformWallet?[{transactionId:ledger.id,walletId:platformWallet.id,amount:fee}]:[])]);
    await tx.update(ledgerTransactions).set({status:'posted',postedAt:now}).where(eq(ledgerTransactions.id,ledger.id));
    const heldUntil=new Date(now.getTime()+policy.holdDays*86400000);
    await tx.insert(sellerEarnings).values({sellerId:identity.sellerId,purchaseId:order.id,grossPoints:price,feePoints:fee,netPoints:sellerNet,status:'held',heldUntil});
    await tx.update(purchaseOrders).set({status:'completed',completedAt:now}).where(eq(purchaseOrders.id,order.id));
    await tx.insert(auditLogs).values({actorId:buyerId,entityType:'purchase_order',entityId:order.id,action:'purchase.completed',metadata:{projectId:project.id,versionId:version.id,ledgerId:ledger.id}});
    await tx.insert(notifications).values([
      {userId:buyerId,type:'purchase.completed',title:'Mua thông tin thành công',body:'Thông tin đã mua sẵn sàng trong Dự án đã mua.',data:{href:`/account/purchases/${order.id}`}},
      {userId:identity.sellerId,type:'sale.completed',title:'Dự án có giao dịch mua mới',body:'Khoản thu sau phí đang được giữ theo chính sách nền tảng.',data:{href:'/seller/transactions'}},
    ]);
    return result(order,false,heldUntil);
  });
}
// Compatibility entry point: the supplied buyer ID never substitutes for a session.
export async function getPurchasedPrivateData(buyerId:string,projectVersionId:string){
  const {getCurrentActor}=await import('../lib/auth/server');
  const {getPurchasedVersionData}=await import('./purchase-access');
  const actor=await getCurrentActor();
  if(!actor||actor.id!==buyerId) throw new AccessError(403,'Bạn không có quyền xem thông tin này.');
  return getPurchasedVersionData(actor,projectVersionId);
}
