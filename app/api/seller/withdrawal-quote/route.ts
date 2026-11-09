import {requireApiActor,accessErrorResponse} from '../../../../lib/auth/server';
import {AccessError} from '../../../../lib/auth/permissions';
import {privateJson} from '../../../../lib/seller/http';
import {getSellerWithdrawalQuote} from '../../../../services/payout-sources';
export async function GET(request:Request){try{if(new URL(request.url).search)throw new AccessError(400,'Không nhận danh tính hoặc số tiền từ bộ lọc báo giá.');return privateJson(await getSellerWithdrawalQuote(await requireApiActor(request,['seller'])));}catch(e){return accessErrorResponse(e);}}
