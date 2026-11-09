import {AccessError} from '../auth/permissions';
export const approvedTopupPolicy={minVnd:'100000',maxVnd:'10000000',stepVnd:'100',expiresHours:24,ledgerModel:'point_issuance_v1'} as const;
export function positiveInteger(value:unknown){
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)return BigInt(value);
 if(typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n)return BigInt(value);
 throw new AccessError(400,'Giá trị tiền hoặc điểm phải là số nguyên dương hợp lệ.');
}
export function topupPoints(amount:unknown,rate:{amountVnd:unknown;points:unknown},policy:Record<string,unknown>){
 const vnd=positiveInteger(amount),base=positiveInteger(rate.amountVnd),points=positiveInteger(rate.points);
 if(base!==100n*points||Object.entries(approvedTopupPolicy).some(([key,value])=>policy[key]!==value))throw new AccessError(503,'Cấu hình tỷ giá hoặc chính sách nạp chưa được duyệt.');
 if(vnd<BigInt(approvedTopupPolicy.minVnd)||vnd>BigInt(approvedTopupPolicy.maxVnd)||vnd%BigInt(approvedTopupPolicy.stepVnd)!==0n)
  throw new AccessError(400,'Số tiền từ 100.000 đến 10.000.000 VND, là bội số của 100 VND.');
 const result=vnd*points;
 if(result%base!==0n||result/base>9223372036854775807n)throw new AccessError(400,'Số tiền không quy đổi chính xác thành POINT nguyên.');
 return {amountVnd:vnd.toString(),points:(result/base).toString(),rate:{amountVnd:base.toString(),points:points.toString()}};
}
