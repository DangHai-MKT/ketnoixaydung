import {WithdrawalDetail} from '../../../../components/PayoutPages';
export default function Page({params}:{params:Promise<{id:string}>}){return <WithdrawalDetail admin={false} params={params}/>;}
