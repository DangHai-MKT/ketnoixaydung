import {AccessError} from '../auth/permissions';
import {categoryLabels} from './workflow';
export const watchPrice=1000n,watchDays=30;
export const watchPath='/account/project-watch';
export const watchEvent='project.watch.published';
export const watchReminder='project.watch.expiring';
export function watchCategory(value:unknown) {
  if(typeof value!=='string'||!Object.hasOwn(categoryLabels,value))throw new AccessError(400,'Chọn lĩnh vực hợp lệ.');
  return value;
}
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function watchPurchaseInput(value:unknown) {
  const body=value as {category?:unknown;requestId?:unknown;expectedLatestId?:unknown;email?:unknown}|null;
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['category','requestId','expectedLatestId','email'].includes(key))||
    typeof body.requestId!=='string'||!uuid.test(body.requestId)||typeof body.email!=='boolean'||
    (body.expectedLatestId!==null&&(typeof body.expectedLatestId!=='string'||!uuid.test(body.expectedLatestId))))throw new AccessError(400,'Yêu cầu đăng ký theo dõi không hợp lệ.');
  return {category:watchCategory(body.category),requestId:body.requestId.toLowerCase(),expectedLatestId:body.expectedLatestId?.toLowerCase()??null,email:body.email};
}
export type WatchPeriod={id:string;category:string;startsAt:string;endsAt:string;email:boolean};
