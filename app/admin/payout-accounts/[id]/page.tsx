import {PayoutAccountDetail} from '../../../../components/PayoutPages';
export default function Page({params}:{params:Promise<{id:string}>}){return <PayoutAccountDetail admin={true} params={params}/>;}
