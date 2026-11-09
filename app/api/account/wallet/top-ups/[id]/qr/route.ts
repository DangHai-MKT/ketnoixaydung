import {requireApiActor,accessErrorResponse} from '../../../../../../../lib/auth/server';
import {getTopup} from '../../../../../../../services/payments';
import {topupQrImage} from '../../../../../../../lib/finance/qr-image';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await requireApiActor(request,['buyer']),{id}=await params;const image=await topupQrImage(await getTopup(actor,id));return new Response(new Uint8Array(image),{headers:{'Content-Type':'image/png','Content-Disposition':'attachment; filename="ma-nap-diem.png"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return accessErrorResponse(e);}}
