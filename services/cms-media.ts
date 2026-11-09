import 'server-only';
import sharp from 'sharp';
import {and, desc, eq, exists, ilike, or, sql} from 'drizzle-orm';
import {db} from '../db/client';
import {auditLogs} from '../db/schema';
import {cmsContents,cmsMedia,cmsRevisionMedia} from '../db/schema/cms';
import {AccessError,requireRoles,type Actor} from '../lib/auth/permissions';
import {cmsRoles,field} from '../lib/cms/content';
import {searchPattern} from '../lib/projects/query';
import {cmsEnabled,requireCms} from './cms';

export const mediaLimit=5*1024*1024;
export const mediaPath=(id:string,preview=false)=>(preview?'/api/admin/cms/media/':'/api/cms/media/')+id;
const display={id:cmsMedia.id,filename:cmsMedia.filename,alt:cmsMedia.alt,width:cmsMedia.width,height:cmsMedia.height,
  size:sql<number>`octet_length(${cmsMedia.bytes})`,createdAt:cmsMedia.createdAt};

export async function listMedia(q: string,page: number) {
  requireCms();
  const rows=await db.select(display).from(cmsMedia).where(q?or(ilike(cmsMedia.filename,searchPattern(q)),ilike(cmsMedia.alt,searchPattern(q))):undefined)
    .orderBy(desc(cmsMedia.createdAt),desc(cmsMedia.id)).limit(25).offset((page-1)*24);
  return {rows:rows.slice(0,24),hasNext:rows.length>24};
}
export async function storeMedia(actor: Actor, file: File, altInput: unknown) {
  requireCms();
  requireRoles(actor,cmsRoles);
  if (!file.size || file.size>mediaLimit) throw new AccessError(413,'Ảnh phải nhỏ hơn hoặc bằng 5 MB.');
  const alt=field(altInput,250,true), filename=field(file.name.split(/[\\/]/).at(-1)?.slice(0,180),180,true);
  const formats:Record<string,string>={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'};
  const format=Object.hasOwn(formats,file.type)?formats[file.type]:file.type==='image/jpg'?'jpeg':null;
  const unspecified=!file.type||file.type==='application/octet-stream';
  let image: {data:Buffer;info:{width:number;height:number}};
  try {
    if (!format&&!unspecified) throw new Error();
    const source=sharp(Buffer.from(await file.arrayBuffer()),{failOn:'warning',limitInputPixels:20000000});
    const meta=await source.metadata();
    if (!meta.format||!['png','jpeg','webp'].includes(meta.format)||(format&&meta.format!==format)||(meta.pages??1)!==1) throw new Error();
    image=await source.rotate().resize(1920,1920,{fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer({resolveWithObject:true});
  } catch {throw new AccessError(415,'Chỉ tải ảnh JPEG, PNG hoặc WebP tĩnh có nội dung hợp lệ.');}
  if (image.data.length>2097152) throw new AccessError(413,'Ảnh chuẩn hóa vượt giới hạn 2 MB.');
  return db.transaction(async tx=>{
    const [row]=await tx.insert(cmsMedia).values({filename,alt,width:image.info.width,height:image.info.height,bytes:image.data,createdBy:actor.id})
      .returning({id:cmsMedia.id,filename:cmsMedia.filename,alt:cmsMedia.alt,width:cmsMedia.width,height:cmsMedia.height});
    await tx.insert(auditLogs).values({actorId:actor.id,action:'cms.media.upload',entityType:'cms_media',entityId:row.id});
    return row;
  });
}
export async function updateMediaAlt(actor: Actor,id:string,altInput:unknown) {
  requireCms();
  requireRoles(actor,cmsRoles);
  const alt=field(altInput,250,true);
  return db.transaction(async tx=>{
    const [row]=await tx.update(cmsMedia).set({alt}).where(eq(cmsMedia.id,id)).returning({id:cmsMedia.id});
    if (!row) throw new AccessError(404,'Không tìm thấy ảnh.');
    await tx.insert(auditLogs).values({actorId:actor.id,action:'cms.media.alt',entityType:'cms_media',entityId:id});
    return row;
  });
}
export async function deleteUnusedMedia(actor: Actor,id:string) {
  requireCms();
  requireRoles(actor,['super_admin']);
  return db.transaction(async tx=>{
    const [image]=await tx.select({id:cmsMedia.id}).from(cmsMedia).where(eq(cmsMedia.id,id)).for('update');
    if (!image) throw new AccessError(404,'Ảnh không còn trong thư viện.');
    const [historical]=await tx.select({id:cmsRevisionMedia.mediaId}).from(cmsRevisionMedia).where(eq(cmsRevisionMedia.mediaId,id)).limit(1);
    if (historical) throw new AccessError(409,'Ảnh được giữ lại vì có trong lịch sử xuất bản.');
    const [draft]=await tx.select({id:cmsContents.id}).from(cmsContents).where(or(
      eq(cmsContents.featuredMediaId,id),
      sql`${cmsContents.blocks} @> ${JSON.stringify([{type:'image',mediaId:id}])}::jsonb`,
    )).limit(1);
    if (draft) throw new AccessError(409,'Ảnh đang được dùng trong bản nháp. Gỡ ảnh khỏi nội dung và lưu trước khi xóa.');
    await tx.delete(cmsMedia).where(eq(cmsMedia.id,id));
    await tx.insert(auditLogs).values({actorId:actor.id,action:'cms.media.delete',entityType:'cms_media',entityId:id});
    return {id};
  });
}
export async function mediaResponse(id:string,preview=false) {
  if (!cmsEnabled()) return new Response(null,{status:404});
  const visible=db.select({id:cmsRevisionMedia.mediaId}).from(cmsRevisionMedia)
    .innerJoin(cmsContents,and(eq(cmsRevisionMedia.contentId,cmsContents.id),eq(cmsRevisionMedia.revision,cmsContents.publishedRevision),eq(cmsContents.isPolicy,false)))
    .where(eq(cmsRevisionMedia.mediaId,cmsMedia.id));
  const [row]=await db.select({bytes:cmsMedia.bytes}).from(cmsMedia).where(and(eq(cmsMedia.id,id),preview?undefined:exists(visible)));
  if (!row) return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(new Uint8Array(row.bytes),{headers:{'Content-Type':'image/webp','Content-Length':String(row.bytes.length),
    'Cache-Control':preview?'private, no-store':'public, no-cache','X-Content-Type-Options':'nosniff'}});
}
