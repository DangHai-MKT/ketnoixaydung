import {WithdrawalList} from '../../../components/PayoutPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <WithdrawalList admin={false} searchParams={searchParams}/>;}
