import {DisputeDetail} from '../../../../components/DisputePages';
export default function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <DisputeDetail mode="admin" params={params} searchParams={searchParams}/>;}
