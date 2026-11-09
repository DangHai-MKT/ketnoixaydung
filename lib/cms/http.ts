import 'server-only';
import {accessErrorResponse,requireApiActor,requireSameOrigin} from '../auth/server';
import {AccessError,type Actor} from '../auth/permissions';
import {privateJson,readBoundedBody} from '../seller/http';
import {cmsRoles,record} from './content';

export {privateJson};
export async function cmsApi(request:Request,work:(actor:Actor)=>Promise<Response>) {
  try {
    if (request.method!=='GET') requireSameOrigin(request);
    return await work(await requireApiActor(request,cmsRoles));
  } catch (error) {return accessErrorResponse(error);}
}
export async function cmsJson(request:Request) {
  const bytes=await readBoundedBody(request,256*1024);
  try {return record(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}
  catch {throw new AccessError(400,'Dữ liệu nội dung không hợp lệ.');}
}
