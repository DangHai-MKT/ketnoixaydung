import {DisputeList} from '../../../components/DisputePages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <DisputeList mode="admin" searchParams={searchParams}/>;}
