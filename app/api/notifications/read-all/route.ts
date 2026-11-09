import {notificationApi,privateJson} from '../../../../lib/notifications/http';
import {markAllNotificationsRead} from '../../../../services/notifications';
export function POST(request:Request) {
  return notificationApi(request,async actor=>privateJson(await markAllNotificationsRead(actor)));
}
