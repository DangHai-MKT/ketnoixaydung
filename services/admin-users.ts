import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { users, userRoles, authSessions, auditLogs, sellerProfiles, notifications } from '../db/schema';
import { assertAdminContinuity } from '../lib/account/admin-policy';
import { AccessError, isRole, requireRoles, type Actor } from '../lib/auth/permissions';
import { uuidInput } from '../lib/seller/validation';
import { manualAccountApprovalInput } from '../lib/account/validation';

export async function manuallyApproveAccount(actor:Actor,targetId:string,input:unknown){
  requireRoles(actor,['super_admin']);targetId=uuidInput(targetId);
  if(actor.id===targetId)throw new AccessError(403,'Không được tự xác thực hoặc cấp quyền cho chính mình.');
  const data=manualAccountApprovalInput(input);
  return db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(72301941)`);
    const records=await tx.select().from(users).where(inArray(users.id,[actor.id,targetId])).orderBy(asc(users.id)).for('update');
    const actual=records.find(u=>u.id===actor.id),target=records.find(u=>u.id===targetId);
    const grants=await tx.select({role:userRoles.role}).from(userRoles).where(eq(userRoles.userId,actor.id));
    requireRoles(actual?{...actual,roles:grants.map(g=>g.role).filter(isRole)}:null,['super_admin']);
    if(!target)throw new AccessError(404,'Không tìm thấy tài khoản.');
    if(target.status!=='active')throw new AccessError(409,'Cần mở lại tài khoản bị khóa trước khi xác thực quyền hoạt động.');
    const [profile]=await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId,targetId)).for('update');
    const targetRoles=await tx.select({role:userRoles.role}).from(userRoles).where(eq(userRoles.userId,targetId));
    const [prior]=await tx.select().from(auditLogs).where(and(eq(auditLogs.entityType,'user'),eq(auditLogs.entityId,targetId),eq(auditLogs.action,'user.access.manually_verified'))).orderBy(desc(auditLogs.createdAt),desc(auditLogs.id)).limit(1);
    if(prior?.actorId===actor.id&&prior.reason===data.reason&&prior.metadata.role===data.role&&prior.metadata.sourceUpdatedAt===data.updatedAt&&prior.metadata.sourceProfileRevision===data.profileRevision
      &&targetRoles.some(g=>g.role==='buyer')&&(data.role==='buyer'||targetRoles.some(g=>g.role==='seller')&&profile?.verificationStatus==='verified'&&profile.revision===data.profileRevision+1))return {ok:true,changed:false};
    if(target.updatedAt.toISOString()!==data.updatedAt)throw new AccessError(409,'Tài khoản đã thay đổi. Hãy tải lại.');
    const now=new Date();
    let reviewed=profile;
    if(data.role==='seller'){
      if((profile?.revision??0)!==data.profileRevision)throw new AccessError(409,'Hồ sơ nhà cung cấp đã thay đổi. Hãy tải lại.');
      if(!profile){
        if(!data.legalName||!data.sellerType)throw new AccessError(400,'Cần nhập tên pháp lý và loại nhà cung cấp để tạo hồ sơ xác thực thủ công.');
        [reviewed]=await tx.insert(sellerProfiles).values({userId:targetId,legalName:data.legalName,sellerType:data.sellerType,contactEmail:target.email,contactPhone:target.phone,verificationStatus:'verified',verifiedAt:now,reviewedAt:now,reviewedBy:actor.id,reviewReason:data.reason,revision:1}).returning();
      }else{
        if(data.legalName!==undefined||data.sellerType!==undefined)throw new AccessError(400,'Không sửa danh tính hồ sơ hiện có trong thao tác xác thực.');
        [reviewed]=await tx.update(sellerProfiles).set({verificationStatus:'verified',verifiedAt:now,reviewedAt:now,reviewedBy:actor.id,reviewReason:data.reason,correctionRequestedAt:null,revision:profile.revision+1,updatedAt:now}).where(eq(sellerProfiles.id,profile.id)).returning();
      }
      await tx.insert(auditLogs).values({actorId:actor.id,entityType:'seller_profile',entityId:reviewed.id,action:'seller.review.manual_approve',reason:data.reason,metadata:{method:'admin_manual',revision:reviewed.revision,status:'verified'}});
    }
    await tx.insert(userRoles).values((data.role==='seller'?['buyer','seller']:['buyer']).map(role=>({userId:targetId,role}))).onConflictDoNothing();
    await tx.update(users).set({updatedAt:now}).where(eq(users.id,targetId));
    await tx.insert(auditLogs).values({actorId:actor.id,entityType:'user',entityId:targetId,action:'user.access.manually_verified',reason:data.reason,metadata:{role:data.role,method:'admin_manual',sourceUpdatedAt:data.updatedAt,sourceProfileRevision:data.profileRevision}});
    await tx.insert(notifications).values({userId:targetId,type:'user.access.manually_verified',title:'Tài khoản được xác thực thủ công',body:data.role==='seller'?'Quản trị viên đã xác thực người bán. Bạn có thể sử dụng khu vực nhà cung cấp.':'Quản trị viên đã xác thực tài khoản người mua.',data:{href:data.role==='seller'?'/seller':'/account'}});
    return {ok:true,changed:true};
  });
}

export async function getAdminUser(actor: Actor, id: string) {
  requireRoles(actor, ['super_admin']);
  uuidInput(id);
  const [user] = await db.select({
    id: users.id, displayName: users.displayName, email: users.email, phone: users.phone,
    emailVerified: users.emailVerified, status: users.status, createdAt: users.createdAt, updatedAt: users.updatedAt,
  }).from(users).where(eq(users.id, id));
  if (!user) throw new AccessError(404, 'Không tìm thấy tài khoản.');
  const [roles, sellers] = await Promise.all([
    db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, id)),
    db.select({ id: sellerProfiles.id, name: sellerProfiles.legalName, status: sellerProfiles.verificationStatus, revision: sellerProfiles.revision })
      .from(sellerProfiles).where(eq(sellerProfiles.userId, id)),
  ]);
  const approvals=await db.select({role:sql<string>`${auditLogs.metadata}->>'role'`,at:auditLogs.createdAt}).from(auditLogs).where(and(eq(auditLogs.entityType,'user'),eq(auditLogs.entityId,id),eq(auditLogs.action,'user.access.manually_verified'))).orderBy(desc(auditLogs.createdAt)).limit(20);
  return { ...user, roles: roles.map(row => row.role), seller: sellers[0] || null, approvals };
}

export async function manageUser(actor: Actor, targetId: string, input: unknown) {
  requireRoles(actor, ['super_admin']);
  uuidInput(targetId);
  if (actor.id === targetId) throw new AccessError(403, 'Không được tự thay đổi quyền hoặc trạng thái.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AccessError(400, 'Dữ liệu không hợp lệ.');
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some(key => !['action', 'role', 'status', 'reason', 'updatedAt'].includes(key))
      || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000
      || typeof body.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt))) {
    throw new AccessError(400, 'Vui lòng cung cấp lý do và phiên bản tài khoản.');
  }
  if (body.action !== 'status' && body.action !== 'revoke') throw new AccessError(400, 'Thao tác không hợp lệ.');
  if (body.action === 'status' && !['active', 'suspended'].includes(String(body.status))) throw new AccessError(400, 'Trạng thái không hợp lệ.');
  if (body.action === 'revoke' && (!isRole(body.role) || body.role === 'buyer')) throw new AccessError(400, 'Không được thu hồi vai trò buyer.');
  const reason = body.reason.trim();

  return db.transaction(async tx => {
    // Serialize destructive access changes so two admins cannot remove the last active admin concurrently.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(72301941)`);
    const records = await tx.select().from(users).where(inArray(users.id, [actor.id, targetId])).orderBy(asc(users.id)).for('update');
    const actual = records.find(user => user.id === actor.id);
    const target = records.find(user => user.id === targetId);
    const grants = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, actor.id));
    requireRoles(actual ? { ...actual, roles: grants.map(row => row.role).filter(isRole) } : null, ['super_admin']);
    if (!target) throw new AccessError(404, 'Không tìm thấy tài khoản.');
    if (target.status === 'closed') throw new AccessError(409, 'Tài khoản đã đóng không thể thay đổi tại đây.');
    if (target.updatedAt.toISOString() !== body.updatedAt) throw new AccessError(409, 'Tài khoản đã thay đổi. Hãy tải lại.');
    const targetRoles = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, targetId));
    const removesAdmin = targetRoles.some(row => row.role === 'super_admin') &&
      ((body.action === 'revoke' && body.role === 'super_admin') || (body.action === 'status' && body.status === 'suspended'));
    if (removesAdmin) {
      const admins = await tx.select({ id: users.id }).from(users).innerJoin(userRoles, eq(userRoles.userId, users.id))
        .where(and(eq(users.status, 'active'), eq(userRoles.role, 'super_admin')));
      assertAdminContinuity(targetRoles.map(row => row.role), body.action, body.role, body.status, admins.filter(user => user.id !== targetId).length);
    }
    if (body.action === 'revoke') {
      if (!targetRoles.some(row => row.role === body.role)) throw new AccessError(409, 'Tài khoản không còn vai trò này. Hãy tải lại.');
      await tx.delete(userRoles).where(and(eq(userRoles.userId, targetId), eq(userRoles.role, String(body.role))));
    }
    await tx.update(users).set({
      ...(body.action === 'status' ? { status: body.status as 'active' | 'suspended' } : {}), updatedAt: new Date(),
    }).where(eq(users.id, targetId));
    if (body.action === 'revoke' || body.status === 'suspended') await tx.delete(authSessions).where(eq(authSessions.userId, targetId));
    await tx.insert(auditLogs).values({
      actorId: actor.id, entityType: 'user', entityId: targetId,
      action: body.action === 'status' ? 'user.status.changed' : 'user.role.revoked', reason,
      metadata: body.action === 'status' ? { from: target.status, to: body.status } : { role: body.role },
    });
    return { ok: true };
  });
}
