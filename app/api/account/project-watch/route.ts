import {notificationApi,privateJson} from '../../../../lib/notifications/http';
import {readJson} from '../../../../lib/seller/http';
import {buyWatchPeriod,updateWatchEmail} from '../../../../services/project-watch';

export function POST(request:Request) {
  return notificationApi(request,async actor=>{
    const result=await buyWatchPeriod(actor,await readJson(request));
    return privateJson(result,result.reused?200:201);
  });
}
export function PATCH(request:Request) {
  return notificationApi(request,async actor=>{
    const value=await readJson(request) as {category?:unknown;email?:unknown}|null;
    return privateJson(await updateWatchEmail(actor,value?.category,value?.email));
  });
}
