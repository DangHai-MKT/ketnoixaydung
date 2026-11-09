import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson,readJson} from '../../../../../lib/seller/http';
import {createSepayTopup} from '../../../../../services/sepay';
export async function POST(request:Request){try{requireSameOrigin(request);return privateJson(await createSepayTopup(await requireApiActor(request,['buyer']),await readJson(request)));}catch(e){return accessErrorResponse(e);}}
