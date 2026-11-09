import {RefundDetail} from '../../../../components/SettlementPages';
export default function Page({params}:{params:Promise<{id:string}>}){return <RefundDetail mode="buyer" params={params}/>;}
