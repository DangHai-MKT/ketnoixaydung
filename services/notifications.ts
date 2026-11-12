import 'server-only';
import {and,desc,eq,inArray,isNull,ne,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {notifications,userRoles,users} from '../db/schema';
import {AccessError,requireActive,type Actor} from '../lib/auth/permissions';
import {notificationHref,type NotificationPage} from '../lib/notifications/contracts';
import {pointText} from '../lib/finance/labels';

type NotificationTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function notifyTopupConfirmed(tx: NotificationTx, order: {id:string;userId:string;pointsToCredit:bigint;amountVnd:bigint},
  method: 'manual' | 'sepay_live' | 'sepay_test') {
  const staff = await tx.selectDistinct({id:users.id}).from(users).innerJoin(userRoles,eq(users.id,userRoles.userId))
    .where(and(eq(users.status,'active'),inArray(userRoles.role,['super_admin','finance_operator']),ne(users.id,order.userId)));
  const points = pointText(order.pointsToCredit.toString());
  const amount = order.amountVnd.toLocaleString('vi-VN') + ' VND';
  const channel = method === 'manual' ? 'Xác nhận thủ công' : method === 'sepay_live' ? 'Tự động qua SePay Live' : 'SePay Test';
  await tx.insert(notifications).values([{
    userId:order.userId,type:'topup.confirmed',
    title:method==='sepay_test'?'Nạp điểm thử nghiệm thành công':'Nạp điểm thành công',
    body:`Khoản nạp ${amount} đã được xác nhận. Ví của bạn đã nhận ${points}.`,
    data:{href:'/account/wallet',orderId:order.id},
  }, ...staff.map(({id}) => ({
    userId:id,type:'topup.finance.confirmed',title:method==='sepay_test'?'Đã xác nhận đơn nạp thử nghiệm':'Đã xác nhận đơn nạp',
    body:`${channel} · ${amount} · Đã cộng ${points}.`,
    data:{href:`/admin/payments/${order.id}`,orderId:order.id},
  }))]);
}

const unreadFor=(id:string)=>and(eq(notifications.userId,id),isNull(notifications.readAt));
export async function getUnreadCount(actor:Actor) {
  requireActive(actor);
  const [row]=await db.select({count:sql<number>`count(*)::int`}).from(notifications).where(unreadFor(actor.id));
  return row.count;
}
export async function getNotificationPage(actor:Actor,filter:'all'|'unread',page:number,size:number):Promise<NotificationPage> {
  requireActive(actor);
  const [rows,unread]=await Promise.all([
    db.select({id:notifications.id,title:notifications.title,body:notifications.body,href:sql<unknown>`${notifications.data}->>'href'`,readAt:notifications.readAt,createdAt:notifications.createdAt})
      .from(notifications).where(filter==='unread'?unreadFor(actor.id):eq(notifications.userId,actor.id))
      .orderBy(desc(notifications.createdAt),desc(notifications.id)).limit(size+1).offset((page-1)*size),
    getUnreadCount(actor),
  ]);
  return {rows:rows.slice(0,size).map(row=>({...row,href:notificationHref(row.href),readAt:row.readAt?.toISOString()??null,
    createdAt:row.createdAt.toISOString()})),unread,hasNext:rows.length>size};
}
export async function markNotificationRead(actor:Actor,id:string) {
  requireActive(actor);
  const owner=and(eq(notifications.id,id),eq(notifications.userId,actor.id));
  const [updated]=await db.update(notifications).set({readAt:new Date()}).where(and(owner,isNull(notifications.readAt)))
    .returning({readAt:notifications.readAt});
  const row=updated??(await db.select({readAt:notifications.readAt}).from(notifications).where(owner).limit(1))[0];
  if(!row) throw new AccessError(404,'Không tìm thấy thông báo.');
  return {readAt:row.readAt?.toISOString()??null,unread:await getUnreadCount(actor)};
}
export async function markAllNotificationsRead(actor:Actor) {
  requireActive(actor);
  await db.update(notifications).set({readAt:new Date()}).where(unreadFor(actor.id));
  return {unread:await getUnreadCount(actor)};
}
