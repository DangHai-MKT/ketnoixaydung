import {RefundList} from '../../../components/SettlementPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <RefundList mode="admin" searchParams={searchParams}/>;}
