import {PurchaseDetail} from '../../../../components/PurchasedInformation';
export default function Page({params}:{params:Promise<{id:string}>}){return <PurchaseDetail params={params}/>;}
