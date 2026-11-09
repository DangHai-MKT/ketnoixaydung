import {AccessError} from '../auth/permissions';
import {supportChannels,supportHours,supportPhone,supportZaloUrl} from './support';
import {ga4MeasurementId} from './analytics';
export function settingsInput(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new AccessError(400,'Dữ liệu cấu hình không hợp lệ.');
 const v=input as Record<string,unknown>,group=v.group;
 const fields=group==='finance'?['feePercent','holdDays']:group==='email'?['enabled','from','apiKey']
  :group==='support'?['zaloUrl',...supportChannels.flatMap(({key})=>[`${key}Phone`,`${key}Hours`])]
  :group==='analytics'?['enabled','measurementId','enhancedMeasurementDisabled']:[];
 if(!fields.length||Object.keys(v).some(k=>!['group','expectedVersion','reason',...fields].includes(k)))throw new AccessError(400,'Nhóm hoặc trường cấu hình không hợp lệ.');
 if(!Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<0||typeof v.reason!=='string'||v.reason.trim().length<10||v.reason.length>2000)throw new AccessError(400,'Cần phiên bản hiện tại và lý do thay đổi từ 10–2.000 ký tự.');
 if(group==='finance'){
  if(typeof v.feePercent!=='string'||!/^\d{1,3}(\.\d{1,2})?$/.test(v.feePercent)||Number(v.feePercent)>=100||typeof v.holdDays!=='string'||!/^\d{1,3}$/.test(v.holdDays)||Number(v.holdDays)>365)throw new AccessError(400,'Phí từ 0–99,99%, tối đa 2 chữ số thập phân; thời gian giữ từ 0–365 ngày.');
  const [whole,decimal='']=v.feePercent.split('.');
  return {group:'finance' as const,expectedVersion:Number(v.expectedVersion),reason:v.reason.trim(),feeBps:Number(whole)*100+Number(decimal.padEnd(2,'0')),holdDays:Number(v.holdDays)};
 }
 if(group==='support'){
  const values:Record<string,string>={};
  for(const {key,label,defaultHours} of supportChannels){
   const phone=v[`${key}Phone`], hours=v[`${key}Hours`];
   if(typeof phone!=='string'||(phone.trim()&&!supportPhone(phone)))throw new AccessError(400,`Số điện thoại mục “${label}” chưa hợp lệ.`);
   if(typeof hours!=='string'||(hours.trim()&&!supportHours(hours)))throw new AccessError(400,`Giờ phục vụ mục “${label}” phải theo dạng 08:00 – 21:30, giờ kết thúc sau giờ bắt đầu.`);
   values[`${key}Phone`]=supportPhone(phone);
   values[`${key}Hours`]=supportHours(hours)||defaultHours;
  }
  if(typeof v.zaloUrl!=='string'||(v.zaloUrl.trim()&&!supportZaloUrl(v.zaloUrl)))throw new AccessError(400,'Dán liên kết HTTPS chính thức dạng https://zalo.me/…');
  return {group:'support' as const,expectedVersion:Number(v.expectedVersion),reason:v.reason.trim(),values:{...values,zaloUrl:supportZaloUrl(v.zaloUrl)}};
 }
 if(group==='analytics'){
  const measurementId=ga4MeasurementId(v.measurementId);
  if(typeof v.enabled!=='boolean'||typeof v.enhancedMeasurementDisabled!=='boolean'||typeof v.measurementId!=='string'
   ||((v.enabled||v.measurementId.trim())&&!measurementId))throw new AccessError(400,'Nhập mã đo lường GA4 hợp lệ bắt đầu bằng G-.');
  if(v.enabled&&!v.enhancedMeasurementDisabled)throw new AccessError(400,'Hãy tắt Đo lường nâng cao trong luồng dữ liệu GA4 trước khi bật đo lường.');
  return {group:'analytics' as const,expectedVersion:Number(v.expectedVersion),reason:v.reason.trim(),
   values:{enabled:v.enabled,measurementId,enhancedMeasurementDisabled:v.enhancedMeasurementDisabled}};
 }
 if(typeof v.enabled!=='boolean'||typeof v.from!=='string'||v.from.length>254||/[\r\n\x00-\x1f]/.test(v.from)||v.enabled&&!/^(?:[^<>\r\n]+ <)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(v.from))throw new AccessError(400,'Nhập địa chỉ gửi hợp lệ thuộc tên miền đã xác minh trên Resend.');
 if(typeof v.apiKey!=='string'||v.apiKey.length>256||v.apiKey&&!/^re_[A-Za-z0-9_-]{8,}$/.test(v.apiKey))throw new AccessError(400,'API key Resend chưa hợp lệ. Để trống để giữ khóa hiện có.');
 return {group:'email' as const,expectedVersion:Number(v.expectedVersion),reason:v.reason.trim(),enabled:v.enabled,from:v.from.trim(),apiKey:v.apiKey};
}
