import 'server-only';
import {eq} from 'drizzle-orm';
import {db} from '../db/client';
import {users,userRoles,sellerProfiles} from '../db/schema';
import {AccessError,isRole,requireRoles,type Actor} from '../lib/auth/permissions';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function financeReadActor(tx:Tx,actor:Actor,seller=false){
 const [user]=await tx.select().from(users).where(eq(users.id,actor.id));const grants=await tx.select().from(userRoles).where(eq(userRoles.userId,actor.id));
 requireRoles(user?{...user,roles:grants.map(g=>g.role).filter(isRole)}:null,seller?['seller']:['finance_operator','super_admin']);
 if(seller){const [p]=await tx.select({status:sellerProfiles.verificationStatus}).from(sellerProfiles).where(eq(sellerProfiles.userId,actor.id));if(p?.status!=='verified')throw new AccessError(403,'Cần hồ sơ người bán đã được xác minh để xem thu nhập.');}
}
