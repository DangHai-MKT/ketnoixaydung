import 'server-only';
import { AccessError } from '../auth/permissions';
import { normalizeImage, uploadLimits } from './storage';

const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function isWordArchive(bytes: Buffer) {
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) return false;
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > bytes.length || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length) return false;
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  if (!count || count > 2048 || bytes.readUInt32LE(end + 4) !== 0 || count !== bytes.readUInt16LE(end + 8)
    || offset + bytes.readUInt32LE(end + 12) !== end) return false;
  const names = new Set<string>();
  const directoryStart = offset;
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50 || (bytes.readUInt16LE(offset + 8) & 1)) return false;
    const length = bytes.readUInt16LE(offset + 28);
    const next = offset + 46 + length + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    if (!length || next > end || local + 30 > directoryStart || bytes.readUInt32LE(local) !== 0x04034b50) return false;
    const name = bytes.toString('utf8', offset + 46, offset + 46 + length);
    const localNameLength = bytes.readUInt16LE(local + 26);
    const dataEnd = local + 30 + localNameLength + bytes.readUInt16LE(local + 28) + bytes.readUInt32LE(offset + 20);
    expanded += bytes.readUInt32LE(offset + 24);
    if (length !== localNameLength || dataEnd > directoryStart || expanded > 64 * 1024 * 1024
      || !bytes.subarray(local + 30, local + 30 + length).equals(bytes.subarray(offset + 46, offset + 46 + length))
      || /vbaProject\.bin$/i.test(name) || names.has(name)) return false;
    names.add(name);
    offset = next;
  }
  return offset === end && names.has('[Content_Types].xml') && names.has('word/document.xml');
}

function isLegacyWord(bytes: Buffer) {
  if (bytes.length < 512 || bytes.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1') return false;
  const shift = bytes.readUInt16LE(30);
  if (bytes.readUInt16LE(28) !== 0xfffe || (shift !== 9 && shift !== 12)) return false;
  const stream = Buffer.from('WordDocument\0','utf16le');
  for (let offset = 1 << shift; offset + 128 <= bytes.length; offset += 128) {
    if (bytes[offset + 66] === 2 && bytes.readUInt16LE(offset + 64) === stream.length
      && bytes.readUInt32LE(offset + 120) > 0 && bytes.subarray(offset, offset + stream.length).equals(stream)) return true;
  }
  return false;
}

export async function normalizeUploadFile(file: File, allowWebp: boolean) {
  if (!file.size || file.size > uploadLimits().maxBytes) throw new AccessError(413, 'Tệp vượt giới hạn dung lượng hoặc rỗng.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = file.name.toLowerCase().split('.').pop();
  const imageMime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
    : extension === 'png' ? 'image/png' : extension === 'webp' && allowWebp ? 'image/webp' : '';
  if (imageMime) {
    const declaredMime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (declaredMime && declaredMime !== imageMime && declaredMime !== 'application/octet-stream') throw new AccessError(415, 'Đuôi tệp không khớp định dạng ảnh.');
    return { bytes: await normalizeImage(bytes, imageMime, allowWebp), mimeType: 'image/png' };
  }
  if (extension === 'pdf' && /^%PDF-\d\.\d/.test(bytes.toString('ascii',0,8))
    && /%%EOF\s*$/.test(bytes.toString('latin1',Math.max(0,bytes.length-1024)))) return { bytes, mimeType: 'application/pdf' };
  if (extension === 'doc' && isLegacyWord(bytes)) return { bytes, mimeType: 'application/msword' };
  if (extension === 'docx' && isWordArchive(bytes)) return { bytes, mimeType: docxMime };
  throw new AccessError(415, `Tệp không đúng định dạng JPEG, PNG${allowWebp ? ', WebP' : ''}, PDF, DOC hoặc DOCX.`);
}
