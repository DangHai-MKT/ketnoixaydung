import {CmsAdminPreview} from '../../../../../components/CmsAdminPages';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {return <CmsAdminPreview id={(await params).id} searchParams={searchParams}/>;}
