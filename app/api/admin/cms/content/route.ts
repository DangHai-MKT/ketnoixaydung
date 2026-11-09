import {cmsApi,cmsJson,privateJson} from '../../../../../lib/cms/http';
import {contentInput,kindInput,uuid,versionInput} from '../../../../../lib/cms/content';
import {saveContent,setPublication} from '../../../../../services/cms';
import {AccessError} from '../../../../../lib/auth/permissions';

export function POST(request:Request) {
  return cmsApi(request,async actor=>{
    const body=await cmsJson(request),kind=kindInput(body.kind);
    if (body.action==='create') return privateJson(await saveContent(actor,kind,contentInput(body,kind)),201);
    if (body.action==='save-publish') {
      const edit=body.id===undefined?undefined:{id:uuid(body.id),revision:versionInput(body.revision)};
      return privateJson(await saveContent(actor,kind,contentInput(body,kind),edit,true),edit?200:201);
    }
    const id=uuid(body.id),revision=versionInput(body.revision);
    if (body.action==='save') return privateJson(await saveContent(actor,kind,contentInput(body,kind),{id,revision}));
    if (body.action==='publish'||body.action==='unpublish') return privateJson(await setPublication(actor,kind,id,revision,body.action==='publish'));
    throw new AccessError(400,'Thao tác nội dung không hợp lệ.');
  });
}
