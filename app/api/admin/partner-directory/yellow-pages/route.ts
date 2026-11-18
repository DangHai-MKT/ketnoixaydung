import {accessErrorResponse,requireApiActor,requireSameOrigin} from '../../../../../lib/auth/server';
import {AccessError} from '../../../../../lib/auth/permissions';
import {readJson,readBoundedBody,privateJson} from '../../../../../lib/seller/http';
import {partnerStaff} from '../../../../../services/partner-requests';
import {extractYellowPages,listingMaxBytes,listingUrl} from '../../../../../lib/site/yellow-pages';

export const runtime = 'nodejs';

export async function POST(request:Request) {
  try {
    requireSameOrigin(request);
    await requireApiActor(request,partnerStaff);
    const input = await readJson(request) as {url?:unknown}|null;
    let url;
    try { url = listingUrl(typeof input?.url==='string' ? input.url : ''); }
    catch { throw new AccessError(400,'Dán URL HTTPS của trang chi tiết doanh nghiệp trên Trang Vàng.'); }
    const response = await fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10000)}).catch(()=>{
      throw new AccessError(503,'Chưa kết nối được Trang Vàng. Bạn có thể chọn tệp HTML đã lưu.');
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !response.body) {
      await response.body?.cancel();
      throw new AccessError(503,'Trang Vàng chưa trả về hồ sơ. Hãy kiểm tra URL hoặc chọn tệp HTML đã lưu.');
    }
    const bytes = await readBoundedBody(new Request(url,{method:'POST',body:response.body,duplex:'half'} as RequestInit),listingMaxBytes);
    try { return privateJson(extractYellowPages(new TextDecoder().decode(bytes),url.href)); }
    catch(error) { throw new AccessError(400,(error as Error).message); }
  } catch(error) { return accessErrorResponse(error); }
}
