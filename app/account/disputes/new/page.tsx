import {NewDispute} from '../../../../components/DisputePages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <NewDispute searchParams={searchParams}/>;}
