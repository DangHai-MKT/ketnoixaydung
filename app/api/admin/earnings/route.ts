import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson,readJson} from '../../../../lib/seller/http';
import {settlementQuery} from '../../../../lib/finance/settlement';
import {listReleases,releaseEarnings} from '../../../../services/settlements';
export async function GET(request:Request){try{return privateJson(await listReleases(await requireApiActor(request,['finance_operator','super_admin']),settlementQuery(new URL(request.url).searchParams,'release')));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);return privateJson(await releaseEarnings(await requireApiActor(request,['finance_operator','super_admin']),await readJson(request)));}catch(e){return accessErrorResponse(e);}}
