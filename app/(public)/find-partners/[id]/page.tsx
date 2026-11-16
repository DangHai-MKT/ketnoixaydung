import {getCurrentActor} from '../../../../lib/auth/server';
import PartnerRequestDetail from '../../../../components/PartnerRequestDetail';

export const dynamic = 'force-dynamic';
export const metadata = {title:'Lời mời hợp tác',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{id:string}>}) {
  const [{id},actor] = await Promise.all([params,getCurrentActor()]);
  return <PartnerRequestDetail id={id} actor={actor}/>;
}
