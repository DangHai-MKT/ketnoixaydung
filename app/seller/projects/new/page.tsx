import {requireVerifiedSeller} from '../../../../lib/seller/server';
import {IdentityHeader} from '../../../../components/PhaseOneUI';
import ProjectEditor from '../../../../components/ProjectEditor';
export default async function NewProjectPage(){await requireVerifiedSeller();return <main className="identity-page p2-work"><IdentityHeader rootHref="/seller/projects" rootLabel="Dự án của tôi" title="Tạo dự án mới" description="Bắt đầu từ mẫu, bổ sung thông tin và tham khảo giá bán trước khi gửi duyệt."/><ProjectEditor/></main>;}
