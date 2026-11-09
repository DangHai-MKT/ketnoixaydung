import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {AccessError} from '../auth/permissions';

export const sepayProvider='sepay_test';
export function verifySepaySignature(body:Uint8Array,headers:Headers,secret:string,now=Date.now()){
 const timestamp=headers.get('x-sepay-timestamp')||'',signature=headers.get('x-sepay-signature')||'';
 if(!secret||!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!/^sha256=[a-f0-9]{64}$/i.test(signature))throw new AccessError(401,'Chữ ký webhook không hợp lệ hoặc đã hết hạn.');
 const expected=createHmac('sha256',secret).update(timestamp+'.').update(body).digest();
 if(!timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex')))throw new AccessError(401,'Chữ ký webhook không hợp lệ hoặc đã hết hạn.');
}
function text(v:unknown,max=200){if(typeof v!=='string'||!v.length||v.length>max||/[\u0000-\u001f]/.test(v))throw new AccessError(400,'Dữ liệu SePay không hợp lệ.');return v;}
export function sepayAmount(v:unknown,zero=false){const s=typeof v==='number'&&Number.isSafeInteger(v)?String(v):typeof v==='string'?v:'';if(!/^(0|[1-9]\d{0,17})$/.test(s)||!zero&&BigInt(s)===0n)throw new AccessError(400,'Số tiền SePay không hợp lệ.');return s;}
export function sepayDate(v:unknown){const s=text(v,19);if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s))throw new AccessError(400,'Thời gian SePay không hợp lệ.');const date=new Date(s.replace(' ','T')+'+07:00');if(!Number.isFinite(date.getTime())||new Date(date.getTime()+7*3600000).toISOString().slice(0,19)!==s.replace(' ','T'))throw new AccessError(400,'Thời gian SePay không hợp lệ.');return date.toISOString();}
export function sepayReference(content:string,code:unknown){const refs=[...content.matchAll(/(?<![A-Za-z0-9])CM[A-Z0-9]{22}(?![A-Za-z0-9])/g)].map(m=>m[0]);if(typeof code==='string'&&/^CM[A-Z0-9]{22}$/.test(code))refs.push(code);const unique=[...new Set(refs)];return unique.length===1?unique[0]:null;}
export function parseSepayWebhook(body:Uint8Array){
 let v:Record<string,unknown>;try{v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{throw new AccessError(400,'Webhook cần dữ liệu JSON hợp lệ.');}
 if(!v||typeof v!=='object'||Array.isArray(v)||typeof v.id!=='number'||!Number.isSafeInteger(v.id)||v.id<=0||!['in','out'].includes(String(v.transferType)))throw new AccessError(400,'Giao dịch SePay không hợp lệ.');
 const content=text(v.content,2000),account=text(v.accountNumber,34),reference=text(v.referenceCode,100),bank=text(v.gateway,100);
 if(!/^\d{6,34}$/.test(account))throw new AccessError(400,'Tài khoản SePay không hợp lệ.');
 return {eventId:String(v.id),account,bank,bankReference:reference,amountVnd:sepayAmount(v.transferAmount),direction:String(v.transferType),receivedAt:sepayDate(v.transactionDate),reference:sepayReference(content,v.code),contentHash:createHash('sha256').update(content).digest('hex')};
}
export type SepayReceipt=ReturnType<typeof parseSepayWebhook>;
export function receiptHash(receipt:SepayReceipt){return createHash('sha256').update(JSON.stringify(Object.keys(receipt).sort().map(key=>[key,receipt[key as keyof SepayReceipt]]))).digest('hex');}
export function matchSepayApi(receipt:SepayReceipt,value:unknown,accountId:string){
 const v=value as Record<string,unknown>;
 if(!v||typeof v!=='object'||typeof v.id!=='string'||! /^[a-f0-9-]{36}$/i.test(v.id))return false;
 try{return v.bank_account_id===accountId&&v.account_number===receipt.account&&v.bank_brand_name===receipt.bank&&v.reference_number===receipt.bankReference&&sepayAmount(v.amount_in)===receipt.amountVnd&&sepayAmount(v.amount_out,true)==='0'&&v.transfer_type==='in'&&sepayDate(v.transaction_date)===receipt.receivedAt&&createHash('sha256').update(text(v.transaction_content,2000)).digest('hex')===receipt.contentHash&&sepayReference(String(v.transaction_content),v.code)===receipt.reference;}catch{return false;}
}
