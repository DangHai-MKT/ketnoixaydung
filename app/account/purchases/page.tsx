import {PurchaseList} from '../../../components/PurchasedInformation';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <PurchaseList searchParams={searchParams}/>;}
