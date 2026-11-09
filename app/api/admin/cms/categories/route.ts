import {cmsApi,cmsJson,privateJson} from '../../../../../lib/cms/http';
import {field,uuid} from '../../../../../lib/cms/content';
import {renameCategory,saveCategory} from '../../../../../services/cms';
export function POST(request:Request) {
  return cmsApi(request,async actor=>privateJson(await saveCategory(actor,await cmsJson(request)),201));
}
export function PATCH(request:Request) {
  return cmsApi(request,async actor=>{
    const body=await cmsJson(request);
    return privateJson(await renameCategory(actor,uuid(body.id),field(body.name,120,true)));
  });
}
