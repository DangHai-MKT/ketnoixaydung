import { siteIdentity } from '../site/navigation';
const sellerEvents=['seller.review.approve','seller.review.reject','seller.review.request_changes'] as const;
const projectEvents=['project.review.approve'] as const;
export {sellerEvents,projectEvents};
export type EmailGroup='seller'|'project';

export function notificationEmailTemplate(type:string,origin:string,href?:string|null) {
  if(type==='project.watch.published')return {subject:`${siteIdentity.name} · Có dự án mới trong lĩnh vực theo dõi`,
    text:'Một dự án mới đã được công bố trong lĩnh vực bạn theo dõi.\n\n'+origin+
      (href&&/^\/projects\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(href)?href:'/account/notifications')+
      '\n\nBạn có thể tắt email tại Theo dõi dự án.'};
  const groups: Record<EmailGroup,{events:readonly string[];label:string;path:string}>={
    seller:{events:sellerEvents,label:'hồ sơ nhà cung cấp',path:'/seller/application'},
    project:{events:projectEvents,label:'tin dự án',path:'/seller/projects'},
  };
  for(const {events,label,path} of Object.values(groups)) {
    if(!events.includes(type)) continue;
    const subject=`${siteIdentity.name} · Cập nhật ${label}`;
    const text='Kết quả xử lý '+label+' đã có trong tài khoản của bạn. Đăng nhập để xem chi tiết.\n\n'+origin+path+
      '\n\nBạn có thể thay đổi tùy chọn email trong Trung tâm thông báo.';
    return {subject,text};
  }
  return null;
}

export type EmailPayload={from:string;to:string[];subject:string;text:string};
export type DeliveryResult={status:'accepted';providerId:string}|{status:'retry'|'failed';reason:string};

export async function sendResendNotification(apiKey:string,payload:EmailPayload,key:string,transport=fetch):Promise<DeliveryResult> {
  try {
    const response=await transport('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':key},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(10000),
    });
    if(response.ok) {
      const result=await response.json().catch(()=>null);
      if(typeof result?.id==='string'&&/^[a-z0-9_-]{1,100}$/i.test(result.id))return {status:'accepted',providerId:result.id};
      return {status:'retry',reason:'invalid_response'};
    }
    if(response.status===409) {
      const result=await response.json().catch(()=>null);
      if(result?.name==='concurrent_idempotent_requests')return {status:'retry',reason:'concurrent_request'};
    }
    return response.status===429||response.status>=500?{status:'retry',reason:'provider_temporary'}:{status:'failed',reason:'provider_rejected'};
  } catch {return {status:'retry',reason:'transport_unavailable'};}
}
