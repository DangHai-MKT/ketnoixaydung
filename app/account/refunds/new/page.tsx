import {NewRefund} from '../../../../components/SettlementPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <NewRefund searchParams={searchParams}/>;}
