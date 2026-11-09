import {notificationApi,privateJson} from '../../../lib/notifications/http';
import {notificationQuery} from '../../../lib/notifications/contracts';
import {getNotificationPage} from '../../../services/notifications';
export function GET(request:Request) {
  return notificationApi(request,async actor=>{
    const {filter,page,size}=notificationQuery(new URL(request.url).searchParams);
    return privateJson(await getNotificationPage(actor,filter,page,size));
  });
}
