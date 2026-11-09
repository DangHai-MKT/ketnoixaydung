import {CmsAdminEdit} from '../../../../../components/CmsAdminPages';
export default async function Page({params}:{params:Promise<{id:string}>}) {return <CmsAdminEdit kind="page" id={(await params).id}/>;}
