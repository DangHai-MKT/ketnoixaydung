import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { sellerProfiles, sellerVerificationDocuments } from '../db/schema';
import { AccessError, requireActive, requireRoles, type Actor } from '../lib/auth/permissions';
import { assertEditable, assertRevision, sellerReviewRoles } from '../lib/seller/workflow';
import { applicationState } from '../lib/seller/workflow';
import { documentTypeInput, revisionInput, uuidInput } from '../lib/seller/validation';
import { normalizeImage, readImage, storeImage, uploadLimits } from '../lib/seller/storage';
import { activeDocuments, lockActors, ownProfile, recordSellerEvent } from './seller-context';

export async function uploadDocument(actor: Actor, file: File, type: unknown, revision: unknown, replacement: string | null) {
  requireActive(actor);
  const documentType = documentTypeInput(type);
  const expected = revisionInput(revision);
  const replaceId = replacement ? uuidInput(replacement) : null;
  // Authorize before decoding/storing any content. Recheck under lock after decoding.
  await db.transaction(async (tx) => {
    await lockActors(tx, actor.id);
    const profile = await ownProfile(tx, actor.id);
    assertEditable(applicationState(profile)); assertRevision(profile.revision, expected);
  });
  const normalized = await normalizeImage(Buffer.from(await file.arrayBuffer()), file.type);
  return db.transaction(async (tx) => {
    await lockActors(tx, actor.id);
    const profile = await ownProfile(tx, actor.id);
    assertEditable(applicationState(profile)); assertRevision(profile.revision, expected);
    const docs = await activeDocuments(tx, profile.id);
    if (replaceId && !docs.some((doc) => doc.id === replaceId)) throw new AccessError(404, 'Tài liệu thay thế không thuộc hồ sơ đang chỉnh sửa.');
    if (!replaceId && docs.length >= uploadLimits().maxDocuments) throw new AccessError(400, 'Hồ sơ đã đạt giới hạn số tài liệu. Hãy chọn thay thế tài liệu hiện có.');
    const retained = await tx.select({ sizeBytes: sellerVerificationDocuments.sizeBytes }).from(sellerVerificationDocuments)
      .where(eq(sellerVerificationDocuments.sellerProfileId, profile.id));
    if (retained.length >= uploadLimits().maxRetainedDocuments) throw new AccessError(400, 'Hồ sơ đã đạt giới hạn tài liệu lưu giữ. Vui lòng liên hệ đơn vị vận hành.');
    if (retained.reduce((sum, doc) => sum + doc.sizeBytes, 0n) + BigInt(normalized.length) > BigInt(uploadLimits().maxStoredBytes)) {
      throw new AccessError(413, 'Hồ sơ đã đạt hạn mức lưu trữ, bao gồm tài liệu cũ. Vui lòng liên hệ đơn vị vận hành.');
    }
    // A failed DB commit can leave an unlinked private file; never delete or expose it automatically.
    const storageKey = await storeImage(normalized);
    if (replaceId) await tx.update(sellerVerificationDocuments).set({ supersededAt: new Date() }).where(eq(sellerVerificationDocuments.id, replaceId));
    const originalFilename = file.name.replace(/\\/g, '/').split('/').pop()!.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'tai-lieu.png';
    const [document] = await tx.insert(sellerVerificationDocuments).values({ sellerProfileId: profile.id, documentType, storageKey,
      originalFilename, mimeType: 'image/png', sizeBytes: BigInt(normalized.length) }).returning({ id: sellerVerificationDocuments.id });
    const [updated] = await tx.update(sellerProfiles).set({ revision: profile.revision + 1, updatedAt: new Date() }).where(eq(sellerProfiles.id, profile.id)).returning();
    await recordSellerEvent(tx, actor.id, updated, replaceId ? 'seller.document.replaced' : 'seller.document.uploaded', false);
    return { id: document.id, revision: updated.revision };
  });
}

export async function downloadDocument(actor: Actor, id: string): Promise<Response> {
  requireActive(actor);
  const [row] = await db.select({ document: sellerVerificationDocuments, ownerId: sellerProfiles.userId })
    .from(sellerVerificationDocuments).innerJoin(sellerProfiles, eq(sellerProfiles.id, sellerVerificationDocuments.sellerProfileId))
    .where(eq(sellerVerificationDocuments.id, uuidInput(id)));
  if (!row) throw new AccessError(404, 'Không tìm thấy tài liệu.');
  if (row.ownerId !== actor.id) requireRoles(actor, sellerReviewRoles);
  const bytes = await readImage(row.document.storageKey);
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="tai-lieu-${row.document.id}.png"`,
    'Content-Length': String(bytes.length), 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}
