import 'server-only';
import {and,asc,desc,eq,gt,inArray,isNull,lte,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs,systemSettings,userRoles,users} from '../db/schema';
import {type Actor,AccessError,isRole,requireRoles} from '../lib/auth/permissions';
import {settingsInput} from '../lib/settings/validation';
import {readSupportSettings} from '../lib/settings/support';
import {analyticsKey,analyticsOrigin,readAnalyticsSettings} from '../lib/settings/analytics';
import {publicOrigin} from '../lib/site/seo';
import {decryptSetting,encryptSetting,secretStorageReady} from '../lib/settings/secrets';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
async function current(tx:Tx,actor:Actor,lock=false){const q=tx.select().from(users).where(eq(users.id,actor.id)).orderBy(asc(users.id));const [u]=await(lock?q.for('update'):q);const grants=await tx.select().from(userRoles).where(eq(userRoles.userId,actor.id));return requireRoles(u?{...u,roles:grants.map(g=>g.role).filter(isRole)}:null,['super_admin']);}
const supportKey='site_support';
const keys=['platform_fee','seller_hold_period','resend_email',supportKey,analyticsKey];
export async function getPublicSiteSettings(){
 const now=new Date();
 const canMeasure=process.env.NODE_ENV==='production'&&publicOrigin()===analyticsOrigin;
 try{
  const rows=await db.select({key:systemSettings.settingKey,value:systemSettings.value}).from(systemSettings).where(and(
   inArray(systemSettings.settingKey,canMeasure?[supportKey,analyticsKey]:[supportKey]),lte(systemSettings.effectiveFrom,now),
   or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,now)),
  ));
  const one=(key:string)=>{const found=rows.filter(row=>row.key===key);return found.length===1?found[0].value:undefined;};
  const analytics=readAnalyticsSettings(one(analyticsKey));
  return {...readSupportSettings(one(supportKey)),
   analyticsId:analytics.enabled&&analytics.enhancedMeasurementDisabled?analytics.measurementId:''};
 }catch{
  return {...readSupportSettings(),analyticsId:''};
 }
}
export async function getSystemSettings(actor:Actor){return db.transaction(async tx=>{
 await current(tx,actor);const now=new Date();const rows=await tx.select().from(systemSettings).where(and(inArray(systemSettings.settingKey,keys),lte(systemSettings.effectiveFrom,now),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,now))));
 const one=(key:string)=>{const found=rows.filter(r=>r.settingKey===key);if(found.length>1)throw new AccessError(503,'Cấu hình có khoảng hiệu lực chồng lấn. Cần người vận hành kiểm tra.');return found[0];};
 const fee=one('platform_fee'),hold=one('seller_hold_period'),email=one('resend_email');
 const revisions=await tx.select({key:systemSettings.settingKey,version:sql<number>`max(${systemSettings.version})::int`}).from(systemSettings).where(inArray(systemSettings.settingKey,keys)).groupBy(systemSettings.settingKey);
 const revision=(group:string[])=>Math.max(0,...revisions.filter(r=>group.includes(r.key)).map(r=>r.version));
 const history=await tx.select({key:systemSettings.settingKey,version:systemSettings.version,changedAt:systemSettings.effectiveFrom,reason:systemSettings.changeReason}).from(systemSettings).where(inArray(systemSettings.settingKey,[...keys,'manual_bank_transfer','manual_topup_policy','topup_rate','sepay_test','sepay_live'])).orderBy(desc(systemSettings.effectiveFrom),desc(systemSettings.version)).limit(20);
 return {finance:{feePercent:fee?String(Number(fee.value.feeBps)/100):'',holdDays:hold?String(hold.value.days):'',version:revision(['platform_fee','seller_hold_period']),feeVersion:fee?.version??0,holdVersion:hold?.version??0},email:{enabled:email?email.value.enabled===true:Boolean(process.env.RESEND_API_KEY&&process.env.AUTH_EMAIL_FROM),from:email?String(email.value.from||''):process.env.AUTH_EMAIL_FROM||'',hasKey:Boolean(email?.value.encryptedKey||process.env.RESEND_API_KEY),source:email?'database':'environment',version:revision(['resend_email']),secretStorageReady:secretStorageReady()},support:{...readSupportSettings(one(supportKey)?.value),version:revision([supportKey])},analytics:{...readAnalyticsSettings(one(analyticsKey)?.value),version:revision([analyticsKey])},history};
 },{isolationLevel:'repeatable read',accessMode:'read only'});}
export async function saveSystemSettings(actor:Actor,input:unknown){requireRoles(actor,['super_admin']);const data=settingsInput(input);return db.transaction(async tx=>{
 await tx.execute(sql`SET LOCAL lock_timeout='5s'`);await current(tx,actor,true);await tx.execute(sql`SELECT pg_advisory_xact_lock(72301942)`);
 const groupKeys=data.group==='finance'?['platform_fee','seller_hold_period']:data.group==='support'?[supportKey]:data.group==='analytics'?[analyticsKey]:['resend_email'];
 const prior=await tx.select().from(systemSettings).where(inArray(systemSettings.settingKey,groupKeys)).orderBy(desc(systemSettings.version));
 const version=Math.max(0,...prior.map(r=>r.version));if(version!==data.expectedVersion)throw new AccessError(409,'Cấu hình đã được người khác thay đổi. Tải lại trang để xem phiên bản mới trước khi lưu.');
 const from=new Date(Math.max(Date.now(),...prior.map(r=>r.effectiveFrom.getTime()+1)));let values:Record<string,Record<string,unknown>>;
 if(data.group==='finance')values={platform_fee:{feeBps:data.feeBps},seller_hold_period:{days:data.holdDays}};
 else if(data.group==='support')values={[supportKey]:data.values};
 else if(data.group==='analytics')values={[analyticsKey]:data.values};
 else {const observedAt=new Date(),old=prior.find(r=>r.effectiveFrom<=observedAt&&(!r.effectiveTo||r.effectiveTo>observedAt))?.value;const encryptedKey=data.apiKey?encryptSetting(data.apiKey):old?.encryptedKey;if(data.enabled&&!encryptedKey&&!process.env.RESEND_API_KEY)throw new AccessError(400,'Cần API key trước khi bật gửi email.');if(data.enabled&&encryptedKey)decryptSetting(encryptedKey);values={resend_email:{enabled:data.enabled,from:data.from,...(encryptedKey?{encryptedKey}:{})}};}
 for(const key of groupKeys){await tx.update(systemSettings).set({effectiveTo:from}).where(and(eq(systemSettings.settingKey,key),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,from))));await tx.insert(systemSettings).values({settingKey:key,version:version+1,value:values[key],effectiveFrom:from,createdBy:actor.id,changeReason:data.reason});}
 const metadata=data.group==='finance'?{feeBps:data.feeBps,holdDays:data.holdDays}
  :data.group==='email'?{enabled:data.enabled,keyReplaced:Boolean(data.apiKey)}
  :data.group==='analytics'?{enabled:data.values.enabled}:{zaloEnabled:Boolean(data.values.zaloUrl)};
 await tx.insert(auditLogs).values({actorId:actor.id,action:'settings.'+data.group+'.updated',entityType:'system_settings',reason:data.reason,metadata:{version:version+1,keys:groupKeys,...metadata}});
 return {ok:true,version:version+1,group:data.group};
 });}
