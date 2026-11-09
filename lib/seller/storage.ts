import 'server-only';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AccessError } from '../auth/permissions';

function limit(name: string, fallback: number, maximum: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new AccessError(503, 'Cấu hình giới hạn tài liệu không hợp lệ.');
  return number;
}
export function uploadLimits() {
  return { maxBytes: limit('SELLER_DOCUMENT_MAX_BYTES', 5 * 1024 * 1024, 10 * 1024 * 1024),
    maxDocuments: limit('SELLER_DOCUMENT_MAX_COUNT', 5, 10),
    maxRetainedDocuments: limit('SELLER_DOCUMENT_MAX_RETAINED_COUNT', 30, 100),
    maxStoredBytes: limit('SELLER_DOCUMENT_MAX_STORED_BYTES', 50 * 1024 * 1024, 200 * 1024 * 1024) };
}
export async function normalizeImage(bytes: Buffer, declaredMime: string): Promise<Buffer> {
  if (!bytes.length || bytes.length > uploadLimits().maxBytes) throw new AccessError(413, 'Tài liệu vượt quá giới hạn dung lượng.');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((!png && !jpeg) || declaredMime !== (png ? 'image/png' : 'image/jpeg')) throw new AccessError(415, 'Chỉ chấp nhận ảnh PNG hoặc JPEG có nội dung hợp lệ.');
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 20_000_000, animated: false });
    const metadata = await image.metadata();
    if (!['png', 'jpeg'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height) throw new Error();
    // Decode the full image and re-encode; strip metadata and appended/polyglot payloads.
    const normalized = await image.rotate().png({ compressionLevel: 9 }).toBuffer();
    if (normalized.length > uploadLimits().maxBytes) throw new AccessError(413, 'Ảnh sau chuẩn hóa vượt giới hạn dung lượng.');
    return normalized;
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError(415, 'Ảnh bị hỏng, quá lớn hoặc không được hỗ trợ.');
  }
}
function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}
function within(target: string, base: string): boolean {
  const relative = path.relative(base, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function defaultCaseRoot(namespace:'dispute'|'payout'):string {
  if(process.env.CONSTRUCTION_AUTH_TEST==='1'){
    let url:URL;try{url=new URL(process.env.DATABASE_URL||'');}catch{throw new AccessError(503,'Cấu hình lưu trữ kiểm thử không hợp lệ.');}
    if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||decodeURIComponent(url.pathname.slice(1))!=='construction_marketplace_migration_test'||[...url.searchParams.keys()].some(k=>k!=='sslmode'))throw new AccessError(503,'Bằng chứng kiểm thử phải dùng môi trường cô lập.');
    // Stable across the existing preview and newly launched integration servers.
    return path.join(/* turbopackIgnore: true */ process.cwd(),'tmp',namespace==='payout'?'payout-test-files':'dispute-test-files','construction_marketplace_migration_test');
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(),'.private',namespace==='payout'?'payout-documents':'dispute-evidence');
}
async function storageRoot(namespace: 'seller' | 'project' | 'dispute' | 'payout' = 'seller'): Promise<string> {
  // User uploads are runtime data, never assets to trace into a deployment bundle.
  const root = path.resolve(/* turbopackIgnore: true */ (namespace === 'payout' ? process.env.PAYOUT_PRIVATE_STORAGE_DIR : namespace === 'dispute' ? process.env.DISPUTE_PRIVATE_STORAGE_DIR : namespace === 'project' ? process.env.PROJECT_PRIVATE_STORAGE_DIR : process.env.SELLER_PRIVATE_STORAGE_DIR) || (namespace === 'dispute' || namespace === 'payout' ? defaultCaseRoot(namespace) : path.join(process.cwd(), '.private', namespace === 'project' ? 'project-files' : 'seller-verification')));
  for (const publicRoot of ['public', '.next', '.next-auth-test', '.next-seller-test', '.next-project-test', '.next-settings-test', '.git'].map((directory) => path.join(/* turbopackIgnore: true */ process.cwd(), directory))) {
    if (within(root, publicRoot) || within(publicRoot, root)) throw new AccessError(503, 'Thư mục tài liệu riêng tư chưa được cấu hình an toàn.');
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  const info = await lstat(/* turbopackIgnore: true */ root);
  if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(/* turbopackIgnore: true */ root), root)) throw new AccessError(503, 'Thư mục tài liệu không được dùng liên kết tượng trưng.');
  return root;
}
export function validStorageKey(key: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/.test(key);
}
export async function storeImage(bytes: Buffer, namespace: 'seller' | 'project' | 'dispute' | 'payout' = 'seller'): Promise<string> {
  const root = await storageRoot(namespace);
  const key = `${randomUUID()}.png`;
  const file = await open(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root, key), 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  return key;
}
export async function readImage(key: string, namespace: 'seller' | 'project' | 'dispute' | 'payout' = 'seller'): Promise<Buffer> {
  if (!validStorageKey(key)) throw new AccessError(404, 'Không tìm thấy tài liệu.');
  const target = path.join(/* turbopackIgnore: true */ await storageRoot(namespace), key);
  try {
    const info = await lstat(/* turbopackIgnore: true */ target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error();
    const file = await open(/* turbopackIgnore: true */ target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const current = await file.stat();
      if (!current.isFile() || current.size > 10 * 1024 * 1024) throw new Error();
      return await file.readFile();
    } finally { await file.close(); }
  } catch { throw new AccessError(404, 'Không tìm thấy tài liệu.'); }
}
