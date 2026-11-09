import {ReleasePage} from '../../../components/SettlementPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <ReleasePage searchParams={searchParams}/>;}
