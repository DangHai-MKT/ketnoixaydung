import {sellerApi} from '../../../../lib/seller/api';
import {privateJson} from '../../../../lib/projects/http';
import {projectReviewerRoles} from '../../../../lib/projects/workflow';
import {projectQuery} from '../../../../lib/projects/query';
import {listModerationProjects} from '../../../../services/project-moderation';
export async function GET(request:Request){return sellerApi(request,async actor=>{const params=new URL(request.url).searchParams;projectQuery(params,['pending_review','needs_correction','rejected','published','paused','archived']);if(!params.get('status'))params.set('status','pending_review');if(!params.has('sort'))params.set('sort','oldest');const query=projectQuery(params,['pending_review','needs_correction','rejected','published','paused','archived']);return privateJson(await listModerationProjects(actor,query.status,query.page,query.q,query.sort,query));},projectReviewerRoles);}

