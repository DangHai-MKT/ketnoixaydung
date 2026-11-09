import {CmsAdminMedia} from '../../../components/CmsAdminPages';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {return <CmsAdminMedia searchParams={searchParams}/>;}
