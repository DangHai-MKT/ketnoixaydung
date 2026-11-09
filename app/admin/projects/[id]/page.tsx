import {requirePageActor} from '../../../../lib/auth/server';
import {projectReviewerRoles} from '../../../../lib/projects/workflow';
import {IdentityHeader} from '../../../../components/PhaseOneUI';
import ProjectModerationForm from '../../../../components/ProjectModerationForm';
export default async function ReviewProjectPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{version?:string}>}){const actor=await requirePageActor('/admin/projects',projectReviewerRoles),query=await searchParams;return <main className="identity-page p2-work"><IdentityHeader rootHref="/admin/projects" rootLabel="Kiểm duyệt dự án" title="Kiểm tra tin dự án" description="Đối chiếu nội dung công khai, bảo vệ và quyết định trên đúng phiên bản."/><ProjectModerationForm id={(await params).id} reviewerId={actor.id} versionId={typeof query.version==='string'?query.version:undefined}/></main>;}
