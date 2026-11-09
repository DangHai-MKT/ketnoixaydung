// VietQR bank-transfer EMV payload. No external image generation or network call.
export function crc16(value:string){let crc=0xffff;for(const byte of new TextEncoder().encode(value)){crc^=byte<<8;for(let i=0;i<8;i++)crc=crc&0x8000?(crc<<1)^0x1021:crc<<1;crc&=0xffff;}return crc.toString(16).toUpperCase().padStart(4,'0');}
function tlv(id:string,value:string){if(value.length>99||!/^[\x20-\x7e]*$/.test(value))throw new Error('Invalid VietQR field.');return id+String(value.length).padStart(2,'0')+value;}
export function vietqrPayload({bankBin,accountNumber,amountVnd,reference}:{bankBin:string;accountNumber:string;amountVnd:string;reference:string}){
 if(!/^\d{6}$/.test(bankBin)||!/^\d{6,19}$/.test(accountNumber)||!/^[1-9]\d{0,12}$/.test(amountVnd)||!/^[A-Za-z0-9 ]{1,25}$/.test(reference))throw new Error('Invalid payment instructions for QR.');
 const merchant=tlv('00','A000000727')+tlv('01',tlv('00',bankBin)+tlv('01',accountNumber))+tlv('02','QRIBFTTA');
 const data=tlv('00','01')+tlv('01','12')+tlv('38',merchant)+tlv('53','704')+tlv('54',amountVnd)+tlv('58','VN')+tlv('62',tlv('08',reference))+'6304';
 return data+crc16(data);
}
