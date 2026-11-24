import 'server-only';
import {and,asc,eq,isNotNull,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs,companyContactAccess,ledgerEntries,ledgerTransactions,partnerCompanies,userRoles,users,wallets} from '../db/schema';
import {AccessError,requireRoles,type Actor} from '../lib/auth/permissions';
import {uuidInput} from '../lib/seller/validation';
import {postedPointBalance} from './settlement-core';
import {payoutPostingTime} from './payout-core';

export async function buyCompanyContact(actor:Actor, companyId:string) {
  requireRoles(actor,['buyer']);
  companyId=uuidInput(companyId);
  return db.transaction(async tx=>{
    await tx.execute(sql`SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'`);
    const [user]=await tx.select().from(users).where(eq(users.id,actor.id)).for('update');
    const [role]=await tx.select().from(userRoles).where(and(eq(userRoles.userId,actor.id),eq(userRoles.role,'buyer')));
    requireRoles(user?{...user,roles:role?['buyer']:[]}:null,['buyer']);
    const [prior]=await tx.select().from(companyContactAccess).where(and(eq(companyContactAccess.buyerId,actor.id),eq(companyContactAccess.companyId,companyId)));
    if(prior)return;
    const [company]=await tx.select().from(partnerCompanies).where(and(eq(partnerCompanies.id,companyId),isNotNull(partnerCompanies.publishedAt))).for('update');
    if(!company || ![company.profile.phone,company.profile.hotline,company.profile.email,company.profile.zalo].some(Boolean))throw new AccessError(409,'Hồ sơ chưa có liên hệ để mở khóa.');
    const code='SYS:POINT:platform_revenue';
    await tx.insert(wallets).values({userId:null,unit:'POINT',bucket:'platform_revenue',isSystem:true,accountCode:code,description:'POINT account'}).onConflictDoNothing();
    const accounts=await tx.select().from(wallets).where(or(eq(wallets.accountCode,code),
      and(eq(wallets.userId,actor.id),eq(wallets.unit,'POINT'),eq(wallets.bucket,'available'),eq(wallets.isSystem,false))))
      .orderBy(asc(wallets.id)).for('update');
    const wallet=accounts.find(row=>row.userId===actor.id&&!row.isSystem&&row.bucket==='available'&&row.unit==='POINT');
    const revenue=accounts.find(row=>row.accountCode===code&&row.isSystem&&row.userId===null&&row.unit==='POINT'&&row.bucket==='platform_revenue');
    if(!revenue)throw new AccessError(503,'Tài khoản doanh thu chưa sẵn sàng.');
    if(!wallet || await postedPointBalance(tx,wallet.id)<50n)throw new AccessError(409,'Ví chưa đủ 50 POINT. Vui lòng nạp thêm điểm.');
    const now=await payoutPostingTime(tx,wallet.id);
    const [ledger]=await tx.insert(ledgerTransactions).values({
      transactionType:'company_contact_purchase',referenceType:'partner_company',referenceId:companyId,
      idempotencyKey:'company-contact:'+actor.id+':'+companyId,status:'pending',createdBy:actor.id,
      description:'Mở liên hệ doanh nghiệp',metadata:{pricePoints:'50'},
    }).returning({id:ledgerTransactions.id});
    await tx.insert(ledgerEntries).values([{transactionId:ledger.id,walletId:wallet.id,amount:-50n},
      {transactionId:ledger.id,walletId:revenue.id,amount:50n}]);
    await tx.update(ledgerTransactions).set({status:'posted',postedAt:now}).where(eq(ledgerTransactions.id,ledger.id));
    await tx.insert(companyContactAccess).values({buyerId:actor.id,companyId,ledgerId:ledger.id,pricePoints:50n});
    await tx.insert(auditLogs).values({actorId:actor.id,entityType:'partner_company',entityId:companyId,
      action:'company.contact.purchased',metadata:{ledgerId:ledger.id,pricePoints:'50'}});
  });
}
