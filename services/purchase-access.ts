import 'server-only';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { projectFiles, projectPrivateData, projectVersions, projects, purchaseOrders, users, userRoles } from '../db/schema';
import { AccessError, isRole, requireRoles, type Actor } from '../lib/auth/permissions';
import { uuidInput } from '../lib/seller/validation';
import { privateLabels } from '../lib/projects/workflow';
import { getOwnWallet } from './dashboard';
import { getPublicProject } from './public-projects';
import { publicProject } from '../lib/projects/contracts';
import { readProjectParticipants } from '../lib/projects/participants';
import { getCurrentActor } from '../lib/auth/server';
import type { PublicProject } from '../lib/projects/contracts';

export async function markPurchasedProjects(projects: PublicProject[], requestHeaders?: Headers) {
  if (!projects.length) return projects;
  const actor = await getCurrentActor(requestHeaders);
  if (actor?.status !== 'active' || !actor.roles.includes('buyer')) return projects;

  const orders = await db.selectDistinct({ projectId: purchaseOrders.projectId })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.buyerId, actor.id), eq(purchaseOrders.status, 'completed'),
      inArray(purchaseOrders.projectId, projects.map(project => project.id))));
  const purchasedIds = new Set(orders.map(order => order.projectId));
  return projects.map(project => ({ ...project, purchased: purchasedIds.has(project.id) }));
}

async function activeBuyer(actor: Actor) {
  const [user]=await db.select().from(users).where(eq(users.id,actor.id));
  const roles=await db.select({role:userRoles.role}).from(userRoles).where(eq(userRoles.userId,actor.id));
  return requireRoles(user?{...user,roles:roles.map(r=>r.role).filter(isRole)}:null,['buyer']);
}
export async function getPurchaseQuote(actor:Actor,projectId:string,versionId:string){
  await activeBuyer(actor); uuidInput(projectId);uuidInput(versionId);
  const project=await getPublicProject(projectId);
  if(!project||project.versionId!==versionId) throw new AccessError(409,'Dự án hoặc phiên bản đã thay đổi. Hãy tải lại.');
  // Public projection intentionally uses the platform's approved seller label.
  const [owner]=await db.select({sellerId:projects.sellerId}).from(projects).where(eq(projects.id,projectId));
  const [prior]=await db.select({id:purchaseOrders.id,versionId:purchaseOrders.projectVersionId,status:purchaseOrders.status}).from(purchaseOrders)
    .where(and(eq(purchaseOrders.buyerId,actor.id),eq(purchaseOrders.projectId,projectId))).orderBy(desc(purchaseOrders.createdAt)).limit(1);
  return {projectId,versionId,title:project.title,versionNo:project.versionNo,sellerLabel:project.sellerLabel,
    pricePoints:project.pricePoints,availablePoints:(await getOwnWallet(actor))??'0',self:owner?.sellerId===actor.id,prior:prior??null};
}
const receiptProjection={id:purchaseOrders.id,projectId:purchaseOrders.projectId,versionId:purchaseOrders.projectVersionId,
  pricePoints:sql<string>`${purchaseOrders.pricePoints}::text`,feePoints:sql<string>`${purchaseOrders.feePoints}::text`,status:purchaseOrders.status,
  createdAt:purchaseOrders.createdAt,completedAt:purchaseOrders.completedAt,title:projectVersions.title,versionNo:projectVersions.versionNo};
export async function listOwnPurchases(actor:Actor,page=1,q=''){
  await activeBuyer(actor);
  if(!Number.isSafeInteger(page)||page<1||page>10000||q.length>100) throw new AccessError(400,'Trang đơn mua không hợp lệ.');
  const pattern=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
  const where=and(eq(purchaseOrders.buyerId,actor.id),q?sql`(${projectVersions.title} ILIKE ${pattern} OR ${purchaseOrders.id}::text ILIKE ${pattern})`:undefined);
  return db.transaction(async tx=>{
    const rows=await tx.select(receiptProjection).from(purchaseOrders).innerJoin(projectVersions,eq(projectVersions.id,purchaseOrders.projectVersionId))
      .where(where).orderBy(desc(purchaseOrders.createdAt),desc(purchaseOrders.id)).limit(20).offset((page-1)*20);
    const [count]=await tx.select({total:sql<number>`count(*)::int`}).from(purchaseOrders).innerJoin(projectVersions,eq(projectVersions.id,purchaseOrders.projectVersionId)).where(where);
    return {rows,total:count.total,page,pageSize:20};
  },{isolationLevel:'repeatable read',accessMode:'read only'});
}
export async function hasPurchasedVersion(actor:Actor,versionId:string){
  await activeBuyer(actor);uuidInput(versionId);
  const [order]=await db.select({id:purchaseOrders.id}).from(purchaseOrders)
    .where(and(eq(purchaseOrders.buyerId,actor.id),eq(purchaseOrders.projectVersionId,versionId),eq(purchaseOrders.status,'completed'))).limit(1);
  return !!order;
}
export async function getPurchasedVersionData(actor:Actor,versionId:string){
  if(!await hasPurchasedVersion(actor,versionId)) throw new AccessError(403,'Bạn chưa có quyền xem phiên bản này.');
  const [row]=await db.select({data:projectPrivateData.privateData}).from(projectPrivateData).where(eq(projectPrivateData.projectVersionId,versionId));
  return {
    privateData:Object.fromEntries(Object.keys(privateLabels).map(key=>[key,typeof row?.data[key]==='string'?row.data[key]:''])),
    participants:readProjectParticipants(row?.data.participants),
  };
}
export async function getOwnPurchase(actor:Actor,id:string){
  await activeBuyer(actor);uuidInput(id);
  const [receipt]=await db.select(receiptProjection).from(purchaseOrders).innerJoin(projectVersions,eq(projectVersions.id,purchaseOrders.projectVersionId))
    .where(and(eq(purchaseOrders.id,id),eq(purchaseOrders.buyerId,actor.id)));
  if(!receipt) throw new AccessError(404,'Không tìm thấy đơn mua.');
  if(receipt.status!=='completed') return {...receipt,privateData:null,participants:[],files:[]};
  const protectedContent=await getPurchasedVersionData(actor,receipt.versionId);
  const files=await db.select({id:projectFiles.id,label:projectFiles.originalFilename}).from(projectFiles)
    .where(and(eq(projectFiles.projectVersionId,receipt.versionId),inArray(projectFiles.accessLevel,['public_preview','purchased_only']),isNull(projectFiles.supersededAt)));
  return {...receipt,...protectedContent,files:files.map(file=>({...file,url:`/api/projects/${receipt.projectId}/files/${file.id}`}))};
}

export async function getOwnPurchasedProject(actor: Actor, projectId: string, purchaseId: string) {
  projectId = uuidInput(projectId);
  const receipt = await getOwnPurchase(actor, purchaseId);
  if (receipt.projectId !== projectId) throw new AccessError(404, 'Không tìm thấy dự án đã mua.');
  if (!receipt.privateData) return { receipt, project: null };

  const [[snapshot], previews] = await Promise.all([
    db.select({ project: projects, version: projectVersions }).from(projects)
      .innerJoin(projectVersions, eq(projectVersions.projectId, projects.id))
      .where(and(eq(projects.id, projectId), eq(projectVersions.id, receipt.versionId))),
    db.select({ id: projectFiles.id }).from(projectFiles)
      .where(and(eq(projectFiles.projectVersionId, receipt.versionId), eq(projectFiles.accessLevel, 'public_preview'),
        isNull(projectFiles.supersededAt))).orderBy(asc(projectFiles.createdAt), asc(projectFiles.id)),
  ]);
  if (!snapshot) throw new AccessError(404, 'Không tìm thấy phiên bản đã mua.');
  const files = previews.map(({ id }, index) => ({ id, label: `Ảnh dự án ${index + 1}`, url: `/api/projects/${projectId}/files/${id}` }));
  const project = publicProject({ ...snapshot.project, publishedAt: snapshot.version.approvedAt },
    { ...snapshot.version, pricePoints: receipt.pricePoints });
  return { receipt, project: { ...project, files } };
}
