import {revalidatePath} from 'next/cache';
import {requireApiActor,requireSameOrigin,accessErrorResponse} from '../../../../lib/auth/server';
import {privateJson,readJson} from '../../../../lib/seller/http';
import {getSystemSettings,saveSystemSettings} from '../../../../services/settings';
export async function GET(request:Request){try{return privateJson(await getSystemSettings(await requireApiActor(request,['super_admin'])));}catch(e){return accessErrorResponse(e);}}
export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  const {group,...result}=await saveSystemSettings(await requireApiActor(request,['super_admin']),await readJson(request));
  if(group==='support'||group==='analytics')revalidatePath('/','layout');
  return privateJson(result);
 }catch(e){return accessErrorResponse(e);}
}
