import {getPublicProject,getPublicProjectByLegacySlug} from '../../../../services/public-projects';
import {projectPath,isPublicSlug} from '../../../../lib/site/public-paths';
import {legacyPublicResponse} from '../../../../lib/site/legacy-public-url';
import {accessErrorResponse} from '../../../../lib/auth/server';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if(!uuid&&!isPublicSlug(id))return legacyPublicResponse(null,'','project');
    const project=await (uuid?getPublicProject(id):getPublicProjectByLegacySlug(id));
    return legacyPublicResponse(project?.publicSlug?projectPath(project):null,new URL(request.url).search,'project');
  }catch(error){return accessErrorResponse(error);}
}
