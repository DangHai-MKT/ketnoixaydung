import {cmsApi,cmsJson,privateJson} from '../../../../../../lib/cms/http';
import {uuid} from '../../../../../../lib/cms/content';
import {deleteUnusedMedia,mediaResponse,updateMediaAlt} from '../../../../../../services/cms-media';

type Params={params:Promise<{id:string}>};
export function GET(request:Request,{params}:Params) {
  return cmsApi(request,async()=>mediaResponse(uuid((await params).id),true));
}
export function PATCH(request:Request,{params}:Params) {
  return cmsApi(request,async actor=>privateJson(await updateMediaAlt(actor,uuid((await params).id),(await cmsJson(request)).alt)));
}
export function DELETE(request:Request,{params}:Params) {
  return cmsApi(request,async actor=>privateJson(await deleteUnusedMedia(actor,uuid((await params).id))));
}
