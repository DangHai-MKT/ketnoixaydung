import {AccessError} from '../auth/permissions';
export const approvedTopupRate={amountVnd:100000,points:1000} as const;
export const approvedTopupPolicy={minVnd:'100000',maxVnd:'10000000',stepVnd:'100',expiresHours:24,ledgerModel:'point_issuance_v1'} as const;
export const legacyTopupPolicy={...approvedTopupPolicy,stepVnd:'1000'} as const;
export type TopupPolicy=(typeof approvedTopupPolicy|typeof legacyTopupPolicy)&{version:number};
export function positiveInteger(value:unknown){
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)return BigInt(value);
 if(typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n)return BigInt(value);
 throw new AccessError(400,'Giá trị tiền hoặc điểm phải là số nguyên dương hợp lệ.');
}
export function topupPolicyForRate(rate:{amountVnd:unknown;points:unknown}){
 const base=positiveInteger(rate.amountVnd),points=positiveInteger(rate.points);
 if(base===100n*points)return approvedTopupPolicy;
 if(base===1000n*points)return legacyTopupPolicy;
 throw new AccessError(503,'Tỷ giá nạp chưa được duyệt.');
}
export function topupPoints(amount:unknown,rate:{amountVnd:unknown;points:unknown},policy:Record<string,unknown>){
 const vnd=positiveInteger(amount),base=positiveInteger(rate.amountVnd),points=positiveInteger(rate.points);
 const expected=topupPolicyForRate(rate);
 if(Object.entries(expected).some(([key,value])=>policy[key]!==value))throw new AccessError(503,'Cấu hình tỷ giá hoặc chính sách nạp chưa được duyệt.');
 if(vnd<BigInt(expected.minVnd)||vnd>BigInt(expected.maxVnd)||vnd%BigInt(expected.stepVnd)!==0n)
  throw new AccessError(400,`Số tiền từ 100.000 đến 10.000.000 VND, là bội số của ${BigInt(expected.stepVnd).toLocaleString('vi-VN')} VND.`);
 const result=vnd*points;
 if(result%base!==0n||result/base>9223372036854775807n)throw new AccessError(400,'Số tiền không quy đổi chính xác thành POINT nguyên.');
 return {amountVnd:vnd.toString(),points:(result/base).toString(),rate:{amountVnd:base.toString(),points:points.toString()}};
}
