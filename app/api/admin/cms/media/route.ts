import {cmsApi,privateJson} from '../../../../../lib/cms/http';
import {readBoundedBody} from '../../../../../lib/seller/http';
import {AccessError} from '../../../../../lib/auth/permissions';
import {listMedia,mediaLimit,storeMedia} from '../../../../../services/cms-media';
import {requireCms} from '../../../../../services/cms';

export function GET(request:Request) {
  return cmsApi(request,async()=>{
    const params=new URL(request.url).searchParams,n=Number(params.get('page'));
    const page=Number.isSafeInteger(n)&&n>0&&n<=10000?n:1;
    return privateJson(await listMedia(params.get('q')?.trim().slice(0,100)??'',page));
  });
}

export function POST(request:Request) {
  return cmsApi(request,async actor=>{
    requireCms();
    const contentType=request.headers.get('content-type');
    if (!contentType?.startsWith('multipart/form-data;')) throw new AccessError(415,'Yêu cầu tải ảnh không hợp lệ.');
    const body=await readBoundedBody(request,mediaLimit+65536);
    let form:FormData;
    try {form=await new Response(new Uint8Array(body),{headers:{'Content-Type':contentType}}).formData();}
    catch {throw new AccessError(400,'Không đọc được ảnh tải lên.');}
    const file=form.get('file');
    if (!(file instanceof File)) throw new AccessError(400,'Chọn một ảnh để tải lên.');
    return privateJson(await storeMedia(actor,file,form.get('alt')),201);
  });
}
