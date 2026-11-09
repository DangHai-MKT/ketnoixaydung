import { AccessError } from '../auth/permissions';

export async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array> {
  const length = Number(request.headers.get('content-length'));
  if (length > limit) throw new AccessError(413, 'Yêu cầu vượt quá giới hạn dung lượng.');
  if (!request.body) throw new AccessError(400, 'Thiếu dữ liệu yêu cầu.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AccessError(413, 'Yêu cầu vượt quá giới hạn dung lượng.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}
export async function readJson(request: Request): Promise<unknown> {
  const body = await readBoundedBody(request, 16 * 1024);
  try { return JSON.parse(new TextDecoder().decode(body)); }
  catch { throw new AccessError(400, 'Dữ liệu JSON không hợp lệ.'); }
}
export function privateJson(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
