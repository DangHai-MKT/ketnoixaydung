import 'server-only';
import {and,desc,eq,isNull,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {notifications} from '../db/schema';
import {AccessError,requireActive,type Actor} from '../lib/auth/permissions';
import {notificationHref,type NotificationPage} from '../lib/notifications/contracts';

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
