import 'server-only';
import {AccessError,type Actor} from '../lib/auth/permissions';

// Keep stale clients from charging POINT after company contacts became free.
export async function buyCompanyContact(_actor:Actor,_companyId:string) {
  throw new AccessError(409,'Thông tin liên hệ doanh nghiệp hiện miễn phí. Vui lòng tải lại trang để xem.');
}
