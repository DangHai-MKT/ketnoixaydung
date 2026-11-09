import {requireVerifiedSeller} from '../../../../lib/seller/server';
import {accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson} from '../../../../lib/seller/http';
import {earningsQuery} from '../../../../lib/finance/reporting';
import {getSellerEarnings} from '../../../../services/earnings';
export async function GET(request:Request){try{return privateJson(await getSellerEarnings((await requireVerifiedSeller(request)).actor,earningsQuery(new URL(request.url).searchParams),true));}catch(e){return accessErrorResponse(e);}}
