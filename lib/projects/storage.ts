import 'server-only';
import {createHash} from 'node:crypto';
import {AccessError} from '../auth/permissions';
import { normalizeImage, readImage, storeImage, uploadLimits } from '../seller/storage';
export { normalizeImage, uploadLimits };
export const storeProjectImage = (bytes: Buffer) => storeImage(bytes, 'project');
export const readProjectImage = (key: string) => readImage(key, 'project');
export async function verifiedProjectImage(file:{storageKey:string;sizeBytes:bigint;mimeType:string;checksumSha256:string|null}){
 const bytes=await readProjectImage(file.storageKey);
 if(file.mimeType!=='image/png'||!file.checksumSha256||BigInt(bytes.length)!==file.sizeBytes||createHash('sha256').update(bytes).digest('hex')!==file.checksumSha256)throw new AccessError(503,'Tệp dự án không khớp bằng chứng lưu giữ. Cần đối soát trước khi tải hoặc công bố.');
 return bytes;
}
