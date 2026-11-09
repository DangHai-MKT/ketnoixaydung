import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../../lib/auth/server';
import {privateJson,readJson} from '../../../../../lib/seller/http';
import {getBankConfiguration,saveBankConfiguration} from '../../../../../services/payments';
export async function GET(request:Request){try{return privateJson(await getBankConfiguration(await requireApiActor(request,['super_admin'])));}catch(error){return accessErrorResponse(error);}}
export async function POST(request:Request){try{requireSameOrigin(request);return privateJson(await saveBankConfiguration(await requireApiActor(request,['super_admin']),await readJson(request)));}catch(error){return accessErrorResponse(error);}}
