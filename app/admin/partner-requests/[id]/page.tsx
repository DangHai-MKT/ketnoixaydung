import {requirePageActor} from '../../../../lib/auth/server';
import {partnerStaff} from '../../../../services/partner-requests';
import PartnerRequestDetail from '../../../../components/PartnerRequestDetail';

export default async function Page({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const actor = await requirePageActor('/admin/partner-requests/'+id,partnerStaff);
  return <PartnerRequestDetail id={id} actor={actor} staff/>;
}
