import {notificationApi,privateJson} from '../../../../lib/notifications/http';
import {readJson} from '../../../../lib/seller/http';
import {getEmailPreferences,saveEmailPreferences} from '../../../../services/notification-email-preferences';

export function GET(request:Request) {
  return notificationApi(request,async actor=>privateJson(await getEmailPreferences(actor)));
}
export function PUT(request:Request) {
  return notificationApi(request,async actor=>privateJson(await saveEmailPreferences(actor,await readJson(request))));
}
