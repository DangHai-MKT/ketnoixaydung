import {receiveSepayWebhook} from '../../../../services/sepay';
import {accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson} from '../../../../lib/seller/http';
export const runtime='nodejs';
export async function POST(request:Request){try{return privateJson(await receiveSepayWebhook(request));}catch(error){return accessErrorResponse(error);}}
