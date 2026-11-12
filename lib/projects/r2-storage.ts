import 'server-only';
import {GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException} from '@aws-sdk/client-s3';
import {AccessError} from '../auth/permissions';

export const maxProjectFileBytes = 10 * 1024 * 1024;
export const isProjectStorageKey = (key: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:png|blob)$/.test(key);

export function projectR2Storage(env: NodeJS.ProcessEnv = process.env) {
  const accountId = env.PROJECT_R2_ACCOUNT_ID ?? '';
  const bucket = env.PROJECT_R2_BUCKET ?? '';
  const accessKeyId = env.PROJECT_R2_ACCESS_KEY_ID;
  const secretAccessKey = env.PROJECT_R2_SECRET_ACCESS_KEY;
  if (!/^[0-9a-f]{32}$/i.test(accountId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)
    || !accessKeyId || !secretAccessKey) {
    throw new AccessError(503, 'Cấu hình kho tệp dự án R2 chưa đầy đủ.');
  }

  const client = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    forcePathStyle: true,
    credentials: {accessKeyId, secretAccessKey},
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  function objectKey(key: string, thumbnailWidth?: number) {
    if (!isProjectStorageKey(key)) throw new AccessError(404, 'Không tìm thấy tài liệu.');
    if (thumbnailWidth) {
      if (![160, 400, 800].includes(thumbnailWidth)) throw new AccessError(400, 'Kích thước ảnh thu nhỏ không hợp lệ.');
      return `project-thumbnails/v1/${key}/${thumbnailWidth}.webp`;
    }
    return `project-files/${key}`;
  }
  const options = () => ({abortSignal: AbortSignal.timeout(15000)});
  return {
    async read(key: string, thumbnailWidth?: number): Promise<Buffer> {
      const Key = objectKey(key, thumbnailWidth);
      try {
        const response = await client.send(new GetObjectCommand({Bucket: bucket, Key}), options());
        if (!response.Body || !response.ContentLength || response.ContentLength > maxProjectFileBytes) {
          if (response.Body && 'destroy' in response.Body) response.Body.destroy();
          throw new AccessError(503, 'Tệp trong kho R2 có dung lượng không hợp lệ.');
        }
        return Buffer.from(await response.Body.transformToByteArray());
      } catch (error) {
        if (error instanceof AccessError) throw error;
        if (error instanceof S3ServiceException && error.name === 'NoSuchKey') throw new AccessError(404, 'Không tìm thấy tài liệu.');
        throw new AccessError(503, 'Chưa thể đọc tệp từ kho R2.');
      }
    },
    async writeIfAbsent(key: string, bytes: Buffer, mimeType: string, thumbnailWidth?: number): Promise<boolean> {
      const Key = objectKey(key, thumbnailWidth);
      if (!bytes.length || bytes.length > maxProjectFileBytes) throw new AccessError(413, 'Tệp vượt giới hạn dung lượng.');
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket, Key, Body: bytes, ContentType: mimeType, IfNoneMatch: '*',
        }), options());
        return true;
      } catch (error) {
        if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412) return false;
        throw new AccessError(503, 'Chưa thể lưu tệp vào kho R2.');
      }
    },
  };
}
