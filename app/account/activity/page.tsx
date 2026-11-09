import {WorkspaceActivity} from '../../../components/WorkspaceAccountPages';
export default function Page({searchParams}:{searchParams:Promise<{page?:string}>}){return <WorkspaceActivity mode="buyer" searchParams={searchParams}/>;}
