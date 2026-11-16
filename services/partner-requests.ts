import 'server-only';
import {randomUUID} from 'node:crypto';
import {and, desc, eq, gte, inArray, isNull, ne} from 'drizzle-orm';
import {db} from '../db/client';
import {notifications, partnerIntroductions, partnerReplies, partnerRequests, userRoles, users} from '../db/schema';
import {AccessError, requireActive, requireRoles, type Actor} from '../lib/auth/permissions';
import {provinceOptions} from '../lib/projects/locations';
import {maskPublicContact} from '../lib/projects/privacy';
import {uuidInput} from '../lib/seller/validation';

export const partnerStaff = ['support_operator','super_admin'] as const;
export function partnerSchemaUnavailable(error:unknown) {
  const failure = error as {code?:string;cause?:{code?:string}} | null;
  return (failure?.cause?.code ?? failure?.code) === '42P01';
}
const path = (id:string) => '/find-partners/' + id;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function field(form:FormData, key:string, max:number, shared = false) {
  const raw = form.get(key);
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || value.length > max) throw new AccessError(400, 'Điền đủ thông tin và kiểm tra độ dài các mục.');
  if (shared && (maskPublicContact(value) !== value || /https?:\/\/|www\./i.test(value))) {
    throw new AccessError(400, 'Vui lòng bỏ số điện thoại, email hoặc đường dẫn khỏi phần chia sẻ.');
  }
  return value;
}

async function findRequest(conn:typeof db|Tx, id:string) {
  const [row] = await conn.select().from(partnerRequests).where(eq(partnerRequests.id,uuidInput(id)));
  if (!row) throw new AccessError(404,'Không tìm thấy nhu cầu.');
  return row;
}

export async function createPartnerRequest(actor:Actor, form:FormData) {
  requireActive(actor);
  const id = uuidInput(field(form,'requestId',36));
  const trade = field(form,'trade',100,true), province = field(form,'province',50);
  const scope = field(form,'scope',600,true), timing = field(form,'timing',100,true);
  if (!provinceOptions.includes(province)) throw new AccessError(400,'Chọn tỉnh hoặc thành phố.');
  return db.transaction(async tx => {
    const [user] = await tx.select({status:users.status}).from(users).where(eq(users.id,actor.id)).for('update');
    requireActive(user ? {...actor,status:user.status} : null);
    const [created] = await tx.insert(partnerRequests).values({id,ownerId:actor.id,trade,province,scope,timing})
      .onConflictDoNothing().returning({id:partnerRequests.id});
    if (!created) {
      const prior = await findRequest(tx,id);
      if (prior.ownerId !== actor.id || prior.trade !== trade || prior.province !== province ||
          prior.scope !== scope || prior.timing !== timing) throw new AccessError(409,'Biểu mẫu đã được gửi. Hãy tải lại trang.');
      return id;
    }
    const recent = await tx.select({id:partnerRequests.id}).from(partnerRequests)
      .where(and(eq(partnerRequests.ownerId,actor.id),gte(partnerRequests.createdAt,new Date(Date.now()-3600_000)))).limit(6);
    if (recent.length > 5) throw new AccessError(409,'Bạn đã tạo 5 nhu cầu trong một giờ. Vui lòng thử lại sau.');
    const recipients = await tx.selectDistinct({id:users.id}).from(users).innerJoin(userRoles,eq(users.id,userRoles.userId))
      .where(and(eq(users.status,'active'),inArray(userRoles.role,partnerStaff),ne(users.id,actor.id)));
    if (recipients.length) await tx.insert(notifications).values(recipients.map(({id:recipient})=>({
      userId:recipient,type:'partner.requested',title:'Có nhu cầu tìm đối tác mới',
      body:'Mở nhu cầu để xem công việc và giới thiệu đơn vị phù hợp.',data:{href:'/admin/partner-requests/'+id},
    })));
    return id;
  });
}

export function listPartnerRequests(actor:Actor, staff = false, page = 1) {
  if (staff) requireRoles(actor,partnerStaff); else requireActive(actor);
  return db.select().from(partnerRequests).where(staff ? isNull(partnerRequests.closedAt) : eq(partnerRequests.ownerId,actor.id))
    .orderBy(desc(partnerRequests.createdAt),desc(partnerRequests.id)).limit(21).offset((page-1)*20);
}

export async function getPartnerRequest(id:string, actor:Actor|null, staff = false) {
  if (staff) requireRoles(actor,partnerStaff);
  const row = await findRequest(db,id);
  const owner = actor?.status === 'active' && actor.id === row.ownerId;
  const mayViewDetails = owner || staff;
  if (row.closedAt && !mayViewDetails) throw new AccessError(404,'Nhu cầu đã đóng.');
  const {ownerId: _ownerId,...summary} = row;
  const replies = mayViewDetails ? await db.select({id:users.id,name:users.displayName,kind:partnerReplies.kind})
    .from(partnerReplies).innerJoin(users,eq(users.id,partnerReplies.authorId))
    .where(eq(partnerReplies.requestId,id)) : [];
  const introductions = mayViewDetails ? await db.select().from(partnerIntroductions)
    .where(eq(partnerIntroductions.requestId,id)).orderBy(desc(partnerIntroductions.createdAt)) : [];
  const [ownReply] = actor?.status === 'active' && !owner ? await db.select({kind:partnerReplies.kind}).from(partnerReplies)
    .where(and(eq(partnerReplies.requestId,id),eq(partnerReplies.authorId,actor.id))) : [];
  return {...summary,owner,replies,introductions,ownReply:ownReply?.kind};
}

export async function respondToPartnerRequest(actor:Actor,id:string,kind:unknown) {
  requireActive(actor);
  if (kind !== 'interested' && kind !== 'referral') throw new AccessError(400,'Chọn một cách phản hồi.');
  await db.transaction(async tx => {
    const [row] = await tx.select().from(partnerRequests).where(eq(partnerRequests.id,uuidInput(id))).for('update');
    if (!row || row.closedAt) throw new AccessError(404,'Nhu cầu đã đóng hoặc không tồn tại.');
    if (row.ownerId === actor.id) throw new AccessError(403,'Bạn đang xem nhu cầu của mình.');
    const [added] = await tx.insert(partnerReplies).values({requestId:id,authorId:actor.id,kind})
      .onConflictDoNothing().returning({kind:partnerReplies.kind});
    if (added) await tx.insert(notifications).values({userId:row.ownerId,type:'partner.replied',
      title:'Có phản hồi về nhu cầu tìm đối tác',body:'Mở nhu cầu để xem người đã phản hồi.',data:{href:path(id)}});
  });
}

export async function closePartnerRequest(actor:Actor,id:string) {
  requireActive(actor);
  const [closed] = await db.update(partnerRequests).set({closedAt:new Date()})
    .where(and(eq(partnerRequests.id,uuidInput(id)),eq(partnerRequests.ownerId,actor.id),isNull(partnerRequests.closedAt)))
    .returning({id:partnerRequests.id});
  if (!closed) throw new AccessError(404,'Nhu cầu đã đóng hoặc không thuộc tài khoản của bạn.');
}

export async function introducePartner(actor:Actor,id:string,form:FormData) {
  requireRoles(actor,partnerStaff);
  const name = field(form,'name',150), note = field(form,'note',1000);
  await db.transaction(async tx => {
    const [row] = await tx.select().from(partnerRequests).where(eq(partnerRequests.id,uuidInput(id))).for('update');
    if (!row || row.closedAt) throw new AccessError(404,'Nhu cầu đã đóng hoặc không tồn tại.');
    const key = form.get('requestId');
    const [added] = await tx.insert(partnerIntroductions).values({id:typeof key === 'string' ? uuidInput(key) : randomUUID(),
      requestId:id,staffId:actor.id,name,note}).onConflictDoNothing().returning({id:partnerIntroductions.id});
    if (added) await tx.insert(notifications).values({userId:row.ownerId,type:'partner.introduced',
      title:'Có đối tác được giới thiệu',body:'Mở nhu cầu để xem đơn vị được giới thiệu và cách liên hệ.',data:{href:path(id)}});
  });
}
