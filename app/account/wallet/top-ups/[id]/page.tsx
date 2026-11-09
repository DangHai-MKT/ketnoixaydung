import {TopupDetail} from '../../../../../components/TopUpPages';
export default function Page({params}:{params:Promise<{id:string}>}){return <TopupDetail params={params}/>;}
