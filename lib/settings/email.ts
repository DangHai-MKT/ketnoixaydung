import 'server-only';
import {and,eq,gt,isNull,lte,or} from 'drizzle-orm';
import {db} from '../../db/client';
import {systemSettings} from '../../db/schema';
import {decryptSetting} from './secrets';
export async function getEmailDelivery(){
 const now=new Date(),rows=await db.select({value:systemSettings.value}).from(systemSettings).where(and(eq(systemSettings.settingKey,'resend_email'),lte(systemSettings.effectiveFrom,now),or(isNull(systemSettings.effectiveTo),gt(systemSettings.effectiveTo,now))));
 if(rows.length>1)throw new Error('Email configuration is ambiguous.');
 if(!rows.length)return process.env.RESEND_API_KEY&&process.env.AUTH_EMAIL_FROM?{apiKey:process.env.RESEND_API_KEY,from:process.env.AUTH_EMAIL_FROM}:null;
 const v=rows[0].value;if(v.enabled!==true)return null;
 const apiKey=v.encryptedKey?decryptSetting(v.encryptedKey):process.env.RESEND_API_KEY;
 if(typeof v.from!=='string'||!apiKey)throw new Error('Email configuration is unavailable.');
 return {apiKey,from:v.from};
}
