import {getCurrentActor} from '../lib/auth/server';
import {getPurchaseQuote} from '../services/purchase-access';
import {AccessError} from '../lib/auth/permissions';
import type {PublicProject} from '../lib/projects/contracts';
import PurchaseConfirmation from './PurchaseConfirmation';
import {purchasedProjectPath} from '../lib/projects/purchased-path';
export default async function PurchasePanel({project}:{project:PublicProject}){
 const actor=await getCurrentActor();
 if(!actor)return <><a className="button button-primary" href={'/login?next='+encodeURIComponent('/projects/'+project.id)}>Đăng nhập để mua thông tin</a><p className="p2-note">Bạn sẽ quay lại dự án sau khi đăng nhập.</p></>;
 try{
 const quote=await getPurchaseQuote(actor,project.id,project.versionId);
 if(quote.self)return <p className="fw-info">Đây là dự án của bạn. <a href={'/seller/projects/'+project.id}>Quản lý dự án →</a></p>;
 if(quote.prior)return <><p className="fw-info">{quote.prior.status==='completed'?'Bạn đã mua một phiên bản của dự án này. Không cần thanh toán lại.':'Bạn đã có đơn mua liên quan. Hãy kiểm tra trạng thái trước khi tiếp tục.'}</p><a className="button button-primary" href={quote.prior.status==='completed'?purchasedProjectPath(project.id,quote.prior.id)+'#thong-tin-da-mua':'/account/purchases/'+quote.prior.id}>{quote.prior.status==='completed'?'Xem đầy đủ thông tin đã mua →':'Xem trạng thái đơn →'}</a></>;
 return <PurchaseConfirmation key={quote.versionId} quote={quote}/>;
 }catch(error){if(!(error instanceof AccessError))throw error;return <p role="alert" className="fw-info">{error.message}</p>;}
}
