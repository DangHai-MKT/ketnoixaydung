import 'server-only';
import {sql} from 'drizzle-orm';
import {projectVersions as v,projectPrivateData as p} from '../db/schema';
import {contactPattern,sensitiveProjectKeys} from '../lib/projects/privacy';
import {protectedParticipantKeys} from '../lib/projects/participants';
export function safeProjectPublicContent(){
 const text=sql`concat_ws(' ',${v.title},${v.category},${v.provinceCode},${v.districtName},${v.projectStage},${v.publicSummary},${v.publicData}->>'constructionType',${v.publicData}->>'technicalSummary',${v.publicData}->>'scopeSummary')`;
 const participantArray=sql`CASE WHEN jsonb_typeof(${p.privateData}->'participants')='array' THEN ${p.privateData}->'participants' ELSE '[]'::jsonb END`;
 return sql`NOT (${text} ~* ${contactPattern}) AND NOT EXISTS(
  SELECT 1 FROM ${p} CROSS JOIN LATERAL (
   SELECT field.value FROM jsonb_each_text(CASE WHEN jsonb_typeof(${p.privateData})='object' THEN ${p.privateData} ELSE '{}'::jsonb END) field
   WHERE field.key IN (${sql.join(sensitiveProjectKeys.map(k=>sql`${k}`),sql`,`)})
   UNION ALL
   SELECT field.value FROM jsonb_array_elements(${participantArray}) participant(item)
   CROSS JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(participant.item)='object' THEN participant.item ELSE '{}'::jsonb END) field
   WHERE field.key IN (${sql.join(protectedParticipantKeys.map(k=>sql`${k}`),sql`,`)})
  ) protected WHERE ${p.projectVersionId}=${v.id}
  AND length(btrim(protected.value))>=8 AND position(lower(btrim(protected.value)) IN lower(${text}))>0)`;
}
