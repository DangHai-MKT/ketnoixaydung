import {CmsAdminList} from '../../../components/CmsAdminPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {return <CmsAdminList kind="page" searchParams={searchParams}/>;}
