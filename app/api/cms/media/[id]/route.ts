import {mediaResponse} from '../../../../../services/cms-media';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return new Response(null,{status:404});
  return mediaResponse(id.toLowerCase());
}
