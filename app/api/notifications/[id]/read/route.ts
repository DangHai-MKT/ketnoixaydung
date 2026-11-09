import {notificationApi,privateJson} from '../../../../../lib/notifications/http';
import {AccessError} from '../../../../../lib/auth/permissions';
import {markNotificationRead} from '../../../../../services/notifications';
export function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  return notificationApi(request,async actor=>{
    const {id}=await params;
    if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new AccessError(404,'Không tìm thấy thông báo.');
    return privateJson(await markNotificationRead(actor,id));
  });
}
