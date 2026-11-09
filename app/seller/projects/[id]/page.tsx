import {requireVerifiedSeller} from '../../../../lib/seller/server';
import {IdentityHeader} from '../../../../components/PhaseOneUI';
import ProjectEditor from '../../../../components/ProjectEditor';
export default async function OwnProjectPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{version?:string}>}){await requireVerifiedSeller();const query=await searchParams;return <main className="identity-page p2-work"><IdentityHeader rootHref="/seller/projects" rootLabel="Dự án của tôi" title="Quản lý phiên bản" description="Theo dõi nội dung, trạng thái công bố và phản hồi kiểm duyệt."/><ProjectEditor id={(await params).id} mode="status" versionId={typeof query.version==='string'?query.version:undefined}/></main>;}
