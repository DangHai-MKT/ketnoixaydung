import {PayoutAccountList} from '../../../components/PayoutPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <PayoutAccountList admin={false} searchParams={searchParams}/>;}
