import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson,readJson} from '../../../../../lib/seller/http';
import {getSepaySettings,saveSepaySettings} from '../../../../../services/sepay-settings';
export async function GET(request:Request){try{return privateJson(await getSepaySettings(await requireApiActor(request,['super_admin'])));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);return privateJson(await saveSepaySettings(await requireApiActor(request,['super_admin']),await readJson(request)));}catch(e){return accessErrorResponse(e);}}
