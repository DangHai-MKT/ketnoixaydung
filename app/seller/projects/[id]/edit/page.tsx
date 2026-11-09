import {requireVerifiedSeller} from '../../../../../lib/seller/server';
import {IdentityHeader} from '../../../../../components/PhaseOneUI';
import ProjectEditor from '../../../../../components/ProjectEditor';
export default async function EditProjectPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{step?:string}>}){await requireVerifiedSeller();const step=Number((await searchParams).step||1);return <main className="identity-page p2-work"><IdentityHeader rootHref="/seller/projects" rootLabel="Dự án của tôi" title="Soạn nội dung dự án" description="Bản nháp được lưu riêng; nội dung đã công bố chỉ thay đổi sau khi bản mới được duyệt."/><ProjectEditor id={(await params).id} initialStep={Number.isInteger(step)&&step>=1&&step<=5?step:1}/></main>;}
