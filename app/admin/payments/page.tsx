import {TopupList} from '../../../components/TopUpPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <TopupList admin searchParams={searchParams}/>;}
