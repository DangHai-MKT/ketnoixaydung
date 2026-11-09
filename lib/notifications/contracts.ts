import {AccessError} from '../auth/permissions';

const fixedPaths=new Set(['/account','/account/project-watch','/seller','/seller/application','/seller/transactions','/seller/earnings','/admin/feedback']);
const detailPaths=/^\/(?:projects|account\/(?:purchases|wallet\/top-ups|refunds|disputes)|seller\/(?:projects|refunds|disputes|withdrawals)|admin\/(?:disputes|refunds))\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function notificationHref(value: unknown) {
  return typeof value==='string'&&(fixedPaths.has(value)||detailPaths.test(value))?value:null;
}

export function notificationQuery(params: URLSearchParams) {
  const filter=params.get('filter')??'all', page=params.get('page')??'1', size=params.get('size')??'20';
  if ((filter!=='all'&&filter!=='unread')||!/^\d{1,4}$/.test(page)||Number(page)<1||
    !/^\d{1,2}$/.test(size)||Number(size)<1||Number(size)>20||
    [...params.keys()].some(key=>!['filter','page','size'].includes(key)||params.getAll(key).length!==1)) {
    throw new AccessError(400,'Bộ lọc thông báo không hợp lệ.');
  }
  return {filter,page:Number(page),size:Number(size)} as const;
}

export type NotificationItem={id:string;title:string;body:string;href:string|null;readAt:string|null;createdAt:string};
export type NotificationPage={rows:NotificationItem[];unread:number;hasNext:boolean};
export const notificationUpdateEvent='marketplace:notifications-updated';
const date=new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
export const formatNotificationDate=(value:string)=>date.format(new Date(value));
