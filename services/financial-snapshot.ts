import 'server-only';
import {sql} from 'drizzle-orm';
import {db} from '../db/client';
import {AccessError,type Actor} from '../lib/auth/permissions';
import {financeReadActor} from './finance-read-access';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function financialSnapshot<T>(actor:Actor,work:(tx:Tx)=>Promise<T>):Promise<T>{
 try{return await db.transaction(async tx=>{await tx.execute(sql`SET LOCAL statement_timeout='15s'`);await financeReadActor(tx,actor);return work(tx);},{isolationLevel:'repeatable read',accessMode:'read only'});}
 catch(error){let cause:unknown=error;for(let i=0;i<5&&cause&&typeof cause==='object';i++){const item=cause as {code?:string;cause?:unknown};if(['57014','55P03','40001'].includes(item.code||''))throw new AccessError(503,'Chưa hoàn tất đối soát trong giới hạn xử lý. Lọc mã hồ sơ riêng hoặc thử lại; chưa xác nhận dữ liệu đã khớp.');cause=item.cause;}throw error;}
}
