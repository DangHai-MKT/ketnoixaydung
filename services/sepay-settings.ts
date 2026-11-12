import 'server-only';
import {and,desc,eq,gt,isNull,lte,or,sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs,systemSettings,users} from '../db/schema';
import {AccessError,type Actor} from '../lib/auth/permissions';
import {decryptSetting,encryptSetting,secretStorageReady} from '../lib/settings/secrets';
import {isTopupTestEnvironment} from './payments';
import {financeReadActor} from './finance-read-access';
export type SepayConfig={enabled:boolean;accountId:string;accountNumber:string;accountName:string;bankName:string;encryptedToken?:unknown;encryptedSecret?:unknown};
export function requireSepayEnvironment(){if(!isTopupTestEnvironment())throw new AccessError(503,'SePay Test chỉ được dùng trong cơ sở dữ liệu kiểm thử cô lập.');}
export type SepayMode = 'test' | 'live';
const settingsKey = (mode: SepayMode) => mode === 'live' ? 'sepay_live' : 'sepay_test';
function requireSepayMode(mode: SepayMode) {
 if (mode === 'test') requireSepayEnvironment();
 if (mode === 'live' && process.env.CONSTRUCTION_AUTH_TEST === '1') {
   throw new AccessError(503, 'SePay Live không nhận giao dịch trong môi trường kiểm thử cô lập.');
 }
}
export async function sepayConfiguration(mode: SepayMode = 'test'){
 requireSepayMode(mode);const now=new Date();const rows=await db.select().from(systemSettings).where(and(eq(systemSettings.settingKey,settingsKey(mode)),lte(systemSettings.effectiveFrom,now),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,now))));
 const label = mode === 'live' ? 'Live' : 'Test';
 if(rows.length!==1||rows[0].value.enabled!==true)throw new AccessError(503,`SePay ${label} chưa được cấu hình hoặc đang tắt.`);
 const value=rows[0].value as SepayConfig;
 if(!value.encryptedToken||!value.encryptedSecret)throw new AccessError(503,`Thiếu thông tin bảo mật SePay ${label}.`);
 return {...value,version:rows[0].version,token:decryptSetting(value.encryptedToken,mode==='live'?'sepay-live-api':'sepay-test-api'),secret:decryptSetting(value.encryptedSecret,mode==='live'?'sepay-live-webhook':'sepay-test-webhook')};
}
export async function getSepaySettings(actor:Actor,mode:SepayMode='test'){return db.transaction(async tx=>{await financeReadActor(tx,actor);const [row]=await tx.select().from(systemSettings).where(eq(systemSettings.settingKey,settingsKey(mode))).orderBy(desc(systemSettings.version)).limit(1);const v=row?.value as SepayConfig|undefined;return {version:row?.version??0,enabled:v?.enabled===true,accountId:v?.accountId??'',accountNumber:v?.accountNumber??'',accountName:v?.accountName??'',bankName:v?.bankName??'',hasToken:Boolean(v?.encryptedToken),hasSecret:Boolean(v?.encryptedSecret),storageReady:secretStorageReady(),testEnvironment:isTopupTestEnvironment()};},{isolationLevel:'repeatable read',accessMode:'read only'});}
export async function saveSepaySettings(actor:Actor,input:unknown,mode:SepayMode='test'){
 const label = mode === 'live' ? 'Live' : 'Test';
 requireSepayMode(mode);if(!input||typeof input!=='object'||Array.isArray(input))throw new AccessError(400,'Cấu hình không hợp lệ.');const v=input as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['enabled','accountId','accountNumber','accountName','bankName','token','secret','reason','expectedVersion'].includes(k))||typeof v.enabled!=='boolean'||!Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<0)throw new AccessError(400,'Cấu hình không hợp lệ.');
 const text=(key:string,min:number,max:number)=>{const value=v[key];if(typeof value!=='string'||value.trim().length<min||value.length>max||/[\u0000-\u001f]/.test(value))throw new AccessError(400,'Thông tin cấu hình '+key+' chưa hợp lệ.');return value.trim();};
 const accountId=text('accountId',36,36),accountNumber=text('accountNumber',6,34),accountName=text('accountName',2,200),bankName=text('bankName',2,100),reason=text('reason',10,2000),token=text('token',0,2000),secret=text('secret',0,2000);
 if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(accountId)) {
   throw new AccessError(400, `UUID tài khoản ${label} không đúng định dạng. Hãy sao chép trường id từ SePay.`);
 }
 if (!/^\d{6,34}$/.test(accountNumber)) throw new AccessError(400, `Số tài khoản ${label} phải gồm từ 6 đến 34 chữ số.`);
 if (/\s|[•●…*]|\.{3}/u.test(token)) {
   throw new AccessError(400, `Hãy nhập API Token ${label} đầy đủ, không có khoảng trắng hoặc ký tự che.`);
 }
 if (secret && secret.length < 32) throw new AccessError(400, `Khóa HMAC ${label} phải có ít nhất 32 ký tự.`);
 return db.transaction(async tx=>{
 await tx.select({id:users.id}).from(users).where(eq(users.id,actor.id)).for('update');await financeReadActor(tx,actor);if(!actor.roles.includes('super_admin'))throw new AccessError(403,`Chỉ quản trị viên cấp cao được cấu hình SePay ${label}.`);
 // Check the current super-admin grant inside the transaction, not only the session.
 const {userRoles}=await import('../db/schema');const grants=await tx.select().from(userRoles).where(and(eq(userRoles.userId,actor.id),eq(userRoles.role,'super_admin')));if(!grants.length)throw new AccessError(403,'Không có quyền cấu hình.');
 await tx.execute(sql`SELECT pg_advisory_xact_lock(72301942)`);const prior=await tx.select().from(systemSettings).where(eq(systemSettings.settingKey,settingsKey(mode))).orderBy(desc(systemSettings.version));const old=prior[0];if((old?.version??0)!==v.expectedVersion)throw new AccessError(409,'Cấu hình đã thay đổi. Hãy tải lại trang.');
 const encryptedToken=token?encryptSetting(token,mode==='live'?'sepay-live-api':'sepay-test-api'):old?.value.encryptedToken,encryptedSecret=secret?encryptSetting(secret,mode==='live'?'sepay-live-webhook':'sepay-test-webhook'):old?.value.encryptedSecret;
 if(v.enabled&&(!encryptedToken||!encryptedSecret))throw new AccessError(400,`Cần API Token và khóa HMAC riêng cho SePay ${label}.`);
 if(v.enabled){decryptSetting(encryptedToken,mode==='live'?'sepay-live-api':'sepay-test-api');decryptSetting(encryptedSecret,mode==='live'?'sepay-live-webhook':'sepay-test-webhook');}
 const from=new Date(Math.max(Date.now(),...prior.map(r=>r.effectiveFrom.getTime()+1))),version=(old?.version??0)+1;
 await tx.update(systemSettings).set({effectiveTo:from}).where(and(eq(systemSettings.settingKey,settingsKey(mode)),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,from))));
 await tx.insert(systemSettings).values({settingKey:settingsKey(mode),version,value:{enabled:v.enabled,accountId,accountNumber,accountName,bankName,encryptedToken,encryptedSecret},effectiveFrom:from,createdBy:actor.id,changeReason:reason});
 await tx.insert(auditLogs).values({actorId:actor.id,action:'settings.'+settingsKey(mode)+'.updated',entityType:'system_settings',reason,metadata:{version,enabled:v.enabled,tokenReplaced:Boolean(token),secretReplaced:Boolean(secret)}});return {ok:true,version};
 });
}
