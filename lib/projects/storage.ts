import 'server-only';
import {createHash, randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {AccessError} from '../auth/permissions';
import { readImage, storeImage, uploadLimits } from '../seller/storage';
import { validProjectFileType } from './file-types';
import {isProjectStorageKey, projectR2Storage} from './r2-storage';
import { normalizeUploadFile } from '../seller/upload-file';
export { uploadLimits };
let r2: ReturnType<typeof projectR2Storage> | undefined;
function remoteStorage() {
  const driver = process.env.PROJECT_STORAGE_DRIVER || 'local';
  if (driver === 'local') return undefined;
  if (driver !== 'r2') throw new AccessError(503, 'Cấu hình kho tệp dự án không hợp lệ.');
  return r2 ??= projectR2Storage();
}
export async function storeProjectFile(bytes: Buffer, mimeType: string) {
  const storage = remoteStorage();
  const document = mimeType !== 'image/png';
  if (!storage) return storeImage(bytes, 'project', document);
  const key = `${randomUUID()}.${document ? 'blob' : 'png'}`;
  if (!await storage.writeIfAbsent(key, bytes, mimeType)) throw new AccessError(503, 'Mã lưu trữ tệp đã được dùng. Vui lòng thử lại.');
  return key;
}
export async function verifiedProjectFile(file:{storageKey:string;sizeBytes:bigint;mimeType:string;accessLevel:string;checksumSha256:string|null}){
 if(!isProjectStorageKey(file.storageKey)||!validProjectFileType(file.mimeType,file.accessLevel)||!file.checksumSha256)throw new AccessError(503,'Thông tin lưu trữ tệp dự án không hợp lệ.');
 const storage=remoteStorage();
 const bytes=storage?await storage.read(file.storageKey):await readImage(file.storageKey,'project');
 if(BigInt(bytes.length)!==file.sizeBytes||createHash('sha256').update(bytes).digest('hex')!==file.checksumSha256)throw new AccessError(503,'Tệp dự án không khớp bằng chứng lưu giữ. Cần đối soát trước khi tải hoặc công bố.');
 return bytes;
}

export async function readProjectThumbnail(file: Parameters<typeof verifiedProjectFile>[0], width: number) {
  const storage = remoteStorage();
  if (storage) {
    try {
      return await storage.read(file.storageKey, width);
    } catch (error) {
      if (!(error instanceof AccessError) || error.status !== 404) throw error;
    }
  }
  const original = await verifiedProjectFile(file);
  const thumbnail = await sharp(original)
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76 }).toBuffer();
  if (storage) {
    try {
      await storage.writeIfAbsent(file.storageKey, thumbnail, 'image/webp', width);
    } catch {
      // A cache write failure must not prevent delivery of a verified image.
    }
  }
  return thumbnail;
}

export function normalizeProjectFile(file: File) {
  return normalizeUploadFile(file, true);
}
