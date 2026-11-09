import 'server-only';
import {sql} from 'drizzle-orm';
import {db} from '../db/client';
import {AccessError,requireActive,type Actor} from '../lib/auth/permissions';

export type EmailPreferences={seller:boolean;project:boolean;revision:number};
export const notificationEmailEnabled=()=>process.env.NOTIFICATION_EMAIL_ENABLED==='1';
function enabled() {
  if(!notificationEmailEnabled())throw new AccessError(503,'Tùy chọn email nghiệp vụ chưa được mở trên môi trường này.');
}
export async function getEmailPreferences(actor:Actor):Promise<EmailPreferences> {
  requireActive(actor);enabled();
  const result=await db.execute<EmailPreferences>(sql`SELECT seller_enabled_at IS NOT NULL AS seller,
    project_enabled_at IS NOT NULL AS project, revision FROM notification_email_preferences WHERE user_id=${actor.id}`);
  return result.rows[0]??{seller:false,project:false,revision:0};
}
export async function saveEmailPreferences(actor:Actor,body:unknown):Promise<EmailPreferences> {
  requireActive(actor);enabled();
  const input=body as Partial<EmailPreferences>|null;
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['seller','project','revision'].includes(key))||
    typeof input.seller!=='boolean'||typeof input.project!=='boolean'||typeof input.revision!=='number'||
    !Number.isInteger(input.revision)||input.revision<0||input.revision>=2147483647)throw new AccessError(400,'Tùy chọn email không hợp lệ.');
  const result=await db.execute<EmailPreferences>(input.revision===0?sql`
    INSERT INTO notification_email_preferences(user_id,seller_enabled_at,project_enabled_at)
    VALUES (${actor.id},CASE WHEN ${input.seller} THEN now() END,CASE WHEN ${input.project} THEN now() END)
    ON CONFLICT(user_id) DO NOTHING
    RETURNING seller_enabled_at IS NOT NULL AS seller,project_enabled_at IS NOT NULL AS project,revision`:sql`
    UPDATE notification_email_preferences SET
      seller_enabled_at=CASE WHEN ${input.seller} THEN coalesce(seller_enabled_at,now()) END,
      project_enabled_at=CASE WHEN ${input.project} THEN coalesce(project_enabled_at,now()) END,
      revision=revision+1,updated_at=now()
    WHERE user_id=${actor.id} AND revision=${input.revision}
    RETURNING seller_enabled_at IS NOT NULL AS seller,project_enabled_at IS NOT NULL AS project,revision`);
  if(!result.rows[0])throw new AccessError(409,'Tùy chọn đã thay đổi. Hãy tải lại trước khi lưu.');
  return result.rows[0];
}
