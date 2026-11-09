import 'server-only';
import {accessErrorResponse,requireApiActor,requireSameOrigin} from '../auth/server';
import type {Actor} from '../auth/permissions';
export {privateJson} from '../seller/http';
export async function notificationApi(request:Request,work:(actor:Actor)=>Promise<Response>) {
  try {
    if(request.method!=='GET') requireSameOrigin(request);
    return await work(await requireApiActor(request));
  } catch(error) {return accessErrorResponse(error);}
}
