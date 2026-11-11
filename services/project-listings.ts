import 'server-only';
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLogs, moderationReviews, notifications, projectFiles, projectPrivateData, projectVersions, projects, sellerProfiles, userRoles, users } from '../db/schema';
import { AccessError, requireActive, requireRoles, type Actor } from '../lib/auth/permissions';
import { publicProject } from '../lib/projects/contracts';
import { assertDraft, assertProjectRevision, projectLabels, projectReviewerRoles } from '../lib/projects/workflow';
import { autoCheck, projectInput, revisionInput, uuidInput, type ProjectInput } from '../lib/projects/validation';
import { verifiedProjectFile, storeProjectFile, uploadLimits } from '../lib/projects/storage';
import { lockActors } from './seller-context';
import { activeProjectFiles, checkFileBudget, lockProject, projectEvent, workingVersion, versionContent } from './project-context';
import { findProjectOverlap } from './project-overlap';
import { readProjectParticipants } from '../lib/projects/participants';

function publicFields(input: ProjectInput) {
  const { privateData: _private, rightsConfirmed: _confirmed, rightsDeclaration: _declaration, ...fields } = input;
  return fields;
}
async function savePrivate(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], versionId: string, input: ProjectInput) {
  await tx.insert(projectPrivateData).values({ projectVersionId: versionId, privateData: input.privateData,
    dataRightsConfirmedAt: input.rightsConfirmed ? new Date() : null, dataRightsDeclaration: input.rightsDeclaration })
    .onConflictDoUpdate({ target: projectPrivateData.projectVersionId, set: { privateData: input.privateData,
      dataRightsConfirmedAt: input.rightsConfirmed ? new Date() : null, dataRightsDeclaration: input.rightsDeclaration, updatedAt: new Date() } });
}
export async function createProject(actor: Actor, value: unknown) {
  const input = projectInput(value);
  const id = uuidInput(String((value as Record<string, unknown>).requestId));
  const hash = createHash('sha256').update(JSON.stringify({ ...input, pricePoints: input.pricePoints.toString() })).digest('hex');
  return db.transaction(async (tx) => {
    const current = await lockActors(tx, actor.id);
    requireRoles(current, ['seller']);
    const [seller] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, actor.id)).for('update');
    if (seller?.verificationStatus !== 'verified') throw new AccessError(403, 'Bạn cần hoàn tất xác minh người bán.');
    const [prior] = await tx.select().from(projects).where(eq(projects.id, id));
    if (prior) {
      if (prior.sellerId !== actor.id) throw new AccessError(409, 'Mã yêu cầu đã được sử dụng.');
      const [event] = await tx.select().from(auditLogs).where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, 'project.created'))).limit(1);
      if (event?.metadata.commandHash !== hash) throw new AccessError(409, 'Khóa tạo tin đã dùng cho nội dung khác.');
      return { id: prior.id, revision: prior.revision };
    }
    const slug = `${input.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75) || 'du-an'}-${id}`;
    const [project] = await tx.insert(projects).values({ id, sellerId: actor.id, slug, ...publicFields(input), workingVersion: 1 }).returning();
    const [version] = await tx.insert(projectVersions).values({ projectId: id, versionNo: 1, submissionStatus: 'draft', submittedBy: actor.id, ...publicFields(input) }).returning();
    await savePrivate(tx, version.id, input);
    await projectEvent(tx, actor.id, project, 'project.created', version.id, { commandHash: hash });
    return { id: project.id, revision: project.revision };
  });
}
export async function listOwnProjects(actor: Actor, status?: string) {
  requireActive(actor); requireRoles(actor, ['seller']);
  if (status && !Object.hasOwn(projectLabels, status)) throw new AccessError(400, 'Trạng thái dự án không hợp lệ.');
  const state = status as typeof projects.$inferSelect.status | undefined;
  const filter = !state ? undefined : state === 'published' ? eq(projects.status, state)
    : state === 'archived' ? eq(projects.status, state)
    : and(sql`${projects.status} <> 'archived'`, or(eq(projectVersions.submissionStatus, state), eq(projects.status, state)));
  return db.select({ id: projects.id, title: sql<string>`COALESCE(${projectVersions.title}, ${projects.title})`, status: projects.status, pricePoints: sql<string>`COALESCE(${projectVersions.pricePoints}, ${projects.pricePoints})::text`,
    submissionStatus: projectVersions.submissionStatus,
    feedback: sql<string | null>`(SELECT reason FROM moderation_reviews WHERE project_id = ${projects.id} ORDER BY created_at DESC, id DESC LIMIT 1)`,
    currentVersion: projects.currentVersion, workingVersion: projects.workingVersion, revision: projects.revision,
    createdAt: projects.createdAt, updatedAt: projects.updatedAt, publishedAt: projects.publishedAt }).from(projects)
    .leftJoin(projectVersions, and(eq(projectVersions.projectId, projects.id), sql`${projectVersions.versionNo} = COALESCE(${projects.workingVersion}, ${projects.currentVersion})`))
    .where(and(eq(projects.sellerId, actor.id), filter)).orderBy(desc(projects.updatedAt), desc(projects.id)).limit(100);
}
export async function projectDetail(actor: Actor, id: string, reviewer = false, requestedVersion?: string) {
  requireActive(actor);
  if (reviewer) requireRoles(actor, projectReviewerRoles);
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id), ...(!reviewer ? [eq(projects.sellerId, actor.id)] : [])));
  if (!project) throw new AccessError(404, 'Không tìm thấy dự án.');
  const versions = await db.select().from(projectVersions).where(eq(projectVersions.projectId, id)).orderBy(desc(projectVersions.versionNo));
  const candidate = versions.find((version) => version.versionNo === project.workingVersion);
  const current = versions.find((version) => version.versionNo === project.currentVersion);
  const target = requestedVersion ? versions.find(version => version.id === requestedVersion && (!reviewer || version.submittedAt || version.approvedAt)) : reviewer ? ([candidate, current, ...versions].find((version) => version && (version.submittedAt || version.approvedAt))) : candidate ?? current ?? versions[0];
  if (!target) throw new AccessError(requestedVersion ? 404 : 409, 'Không tìm thấy phiên bản được phép xem.');
  const [privateRow] = await db.select().from(projectPrivateData).where(eq(projectPrivateData.projectVersionId, target.id));
  const files = await db.select().from(projectFiles).where(and(eq(projectFiles.projectVersionId, target.id), isNull(projectFiles.supersededAt))).orderBy(asc(projectFiles.createdAt),asc(projectFiles.id));
  const currentFiles = current?.approvedAt && current.id !== target.id
    ? await db.select().from(projectFiles).where(and(eq(projectFiles.projectVersionId,current.id),isNull(projectFiles.supersededAt))).orderBy(asc(projectFiles.createdAt),asc(projectFiles.id))
    : files;
  const previewFor = (version: typeof target, source: typeof files) => {
    const publicFiles = source.filter(file=>file.accessLevel==='public_preview').map((file,index)=>({id:file.id,label:`Ảnh công khai ${index+1}`,url:`/api/projects/${id}/files/${file.id}`}));
    return {...publicProject(project,version),files:publicFiles,imageUrl:publicFiles[0]?.url??null};
  };
  const reviews = await db.select({ id: moderationReviews.id, projectVersionId: moderationReviews.projectVersionId, decision: moderationReviews.decision,
    automatedChecks: moderationReviews.automatedChecks, reason: moderationReviews.reason, createdAt: moderationReviews.createdAt }).from(moderationReviews).where(eq(moderationReviews.projectId, id)).orderBy(desc(moderationReviews.createdAt)).limit(50);
  const [sellerInfo] = reviewer ? await db.select({ id: users.id, displayName: users.displayName, email: users.email, verificationStatus: sellerProfiles.verificationStatus })
    .from(users).leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id)).where(eq(users.id, project.sellerId)) : [];
  const overlap = reviewer ? await findProjectOverlap(db, target, project.sellerId, privateRow?.privateData ?? {}) : null;
  const [overlapEvent] = !reviewer && target.submittedAt ? await db.select({ id: auditLogs.id }).from(auditLogs).where(and(
    eq(auditLogs.entityId, project.id), eq(auditLogs.action, 'project.submitted'),
    sql`${auditLogs.metadata}->>'versionId' = ${target.id}`, sql`${auditLogs.metadata}->>'overlapWarning' = 'true'`,
  )).limit(1) : [];
  const [revisionEvent] = target.versionNo > 1 ? await db.select({ metadata: auditLogs.metadata }).from(auditLogs).where(and(
    eq(auditLogs.entityId, id), eq(auditLogs.action, 'project.revision_created'),
    sql`${auditLogs.metadata}->>'versionId' = ${target.id}`,
  )).limit(1) : [];
  const missingFileCount = revisionEvent?.metadata.missingFileCount;
  return { project: { id: project.id, sellerId: project.sellerId, slug: project.slug, status: project.status, currentVersion: project.currentVersion, workingVersion: project.workingVersion, revision: project.revision, publishedAt: project.publishedAt },
    sellerInfo: sellerInfo ?? null,
    version: { ...target, pricePoints: target.pricePoints.toString() },
    privateData: Object.fromEntries(Object.entries(privateRow?.privateData ?? {}).filter(([,value])=>typeof value==='string')),
    participants: readProjectParticipants(privateRow?.privateData.participants),
    rightsConfirmed: !!privateRow?.dataRightsConfirmedAt, rightsDeclaration: privateRow?.dataRightsDeclaration ?? '',
    versions: versions.filter(version=>!reviewer||version.submittedAt||version.approvedAt).map((version) => ({ id: version.id, versionNo: version.versionNo, status: version.submissionStatus ?? (version.approvedAt ? 'published' : 'draft'), approvedAt: version.approvedAt })),
    files: files.map(({ storageKey: _key, ...file }) => ({ ...file, sizeBytes: file.sizeBytes.toString(), url: `/api/projects/${id}/files/${file.id}` })),
    reviews, preview: previewFor(target,files), currentPreview: current?.approvedAt ? previewFor(current,currentFiles) : null,
    currentVersionId: current?.id ?? null, overlap, overlapWarning: Boolean(overlapEvent),
    missingFileCount: typeof missingFileCount === 'number' ? missingFileCount : 0 };
}
export async function updateDraft(actor: Actor, id: string, value: unknown) {
  const input = projectInput(value), body = value as Record<string, unknown>;
  const expected = revisionInput(body.revision), versionId = uuidInput(String(body.versionId));
  return db.transaction(async (tx) => {
    const { project } = await lockProject(tx, actor, id);
    if (project.status === 'archived') throw new AccessError(409, 'Dự án đã lưu trữ.');
    assertProjectRevision(project.revision, expected);
    const version = await workingVersion(tx, project);
    if (version.id !== versionId) throw new AccessError(409, 'Phiên bản đề xuất đã thay đổi.');
    assertDraft(version);
    await tx.update(projectVersions).set(publicFields(input)).where(eq(projectVersions.id, version.id));
    if (!Object.hasOwn(input.privateData, 'participants')) {
      const [prior] = await tx.select({ data: projectPrivateData.privateData }).from(projectPrivateData)
        .where(eq(projectPrivateData.projectVersionId, version.id));
      const participants = readProjectParticipants(prior?.data.participants);
      if (participants.length) input.privateData.participants = participants;
    }
    await savePrivate(tx, version.id, input);
    const [updated] = await tx.update(projects).set({ revision: project.revision + 1, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    await projectEvent(tx, actor.id, updated, 'project.draft_saved', version.id);
    return { id, revision: updated.revision };
  });
}
export async function submitProject(actor: Actor, id: string, expected: number, versionId: string) {
  return db.transaction(async (tx) => {
    const { project } = await lockProject(tx, actor, id);
    if (project.status === 'archived') throw new AccessError(409, 'Dự án đã lưu trữ.');
    const version = await workingVersion(tx, project);
    if (version.id !== versionId) throw new AccessError(409, 'Phiên bản đã thay đổi.');
    if (project.revision === expected + 1 && version.submittedAt && ['pending_review', 'needs_correction'].includes(version.submissionStatus ?? '')) return { id, revision: project.revision, state: version.submissionStatus };
    assertProjectRevision(project.revision, expected); assertDraft(version);
    await tx.update(projectVersions).set({ submissionStatus: 'pending_auto_check' }).where(eq(projectVersions.id, version.id));
    const [privateRow] = await tx.select().from(projectPrivateData).where(eq(projectPrivateData.projectVersionId, version.id));
    const files = await activeProjectFiles(tx, version.id);
    const parsed = projectInput({ ...versionContent(version), pricePoints: version.pricePoints.toString(),
      privateData: privateRow?.privateData ?? {}, rightsConfirmed: !!privateRow?.dataRightsConfirmedAt, rightsDeclaration: privateRow?.dataRightsDeclaration ?? '' });
    const errors = autoCheck(parsed, files);
    for(const file of files)await verifiedProjectFile(file);
    const state = errors.length ? 'needs_correction' : 'pending_review';
    const overlap = errors.length ? null : await findProjectOverlap(tx, version, project.sellerId, privateRow?.privateData ?? {});
    const overlapWarning = overlap?.matches.some(match => match.finding !== 'related_package') ?? false;
    await tx.update(projectVersions).set({ submissionStatus: state, submittedAt: new Date() }).where(eq(projectVersions.id, version.id));
    if (errors.length) await tx.insert(moderationReviews).values({ projectId: id, projectVersionId: version.id, decision: 'changes_requested', automatedChecks: { passed: false, errors }, reason: 'Kiểm tra ban đầu chưa đạt.' });
    const [updated] = await tx.update(projects).set({ revision: project.revision + 1, updatedAt: new Date(),
      status: ['published', 'paused'].includes(project.status) ? project.status : state }).where(eq(projects.id, id)).returning();
    await projectEvent(tx, actor.id, updated, 'project.submitted', version.id, { autoCheckPassed: errors.length === 0, overlapWarning }, true);
    if (state === 'pending_review') {
      const recipients = await tx.selectDistinct({ id: users.id }).from(users)
        .innerJoin(userRoles, eq(users.id, userRoles.userId))
        .where(and(eq(users.status, 'active'), inArray(userRoles.role, projectReviewerRoles), ne(users.id, project.sellerId)));
      if (recipients.length) await tx.insert(notifications).values(recipients.map(({ id: recipientId }) => ({
        userId: recipientId,
        type: 'project.review_requested',
        title: 'Có tin dự án chờ kiểm duyệt',
        body: 'Mở phiên bản được gửi để kiểm tra và xét duyệt.',
        data: { projectId: id, versionId: version.id, href: `/admin/projects/${id}?version=${version.id}` },
      })));
    }
    return { id, revision: updated.revision, state, errors };
  });
}
export async function proposeRevision(actor: Actor, id: string, expected: number, sourceId: string) {
  return db.transaction(async (tx) => {
    const { project } = await lockProject(tx, actor, id);
    if (project.status === 'archived') throw new AccessError(409, 'Dự án đã lưu trữ.');
    assertProjectRevision(project.revision, expected);
    if (project.workingVersion) {
      const current = await workingVersion(tx, project);
      if (['draft', 'pending_auto_check', 'pending_review'].includes(current.submissionStatus ?? '')) throw new AccessError(409, 'Đã có bản nháp hoặc phiên bản đang xét duyệt.');
    }
    const [source] = await tx.select().from(projectVersions).where(and(eq(projectVersions.id, sourceId), eq(projectVersions.projectId, id)));
    if (!source) throw new AccessError(404, 'Không tìm thấy phiên bản nguồn của dự án.');
    const [maximum] = await tx.select({ n: sql<number>`max(${projectVersions.versionNo})` }).from(projectVersions).where(eq(projectVersions.projectId, id));
    const number = maximum.n + 1;
    const { id: _id, projectId: _projectId, versionNo: _no, reviewedBy: _reviewer, reviewedAt: _reviewedAt, approvedAt: _approvedAt, submittedAt: _submittedAt, submissionStatus: _status, submittedBy: _by, createdAt: _created, ...content } = source;
    const [version] = await tx.insert(projectVersions).values({ ...content, projectId: id, versionNo: number, submittedBy: actor.id, submissionStatus: 'draft' }).returning();
    const [privateRow] = await tx.select().from(projectPrivateData).where(eq(projectPrivateData.projectVersionId, source.id));
    if (privateRow) await tx.insert(projectPrivateData).values({ projectVersionId: version.id, privateData: privateRow.privateData,
      dataRightsDeclaration: privateRow.dataRightsDeclaration, dataRightsConfirmedAt: null });
    const files = await activeProjectFiles(tx, source.id);
    if (files.length > uploadLimits().maxDocuments) throw new AccessError(409, 'Phiên bản nguồn có quá nhiều tệp để sao chép.');
    const copies: { file: typeof files[number]; bytes: Buffer }[] = [];
    for (const file of files) {
      try {
        copies.push({ file, bytes: await verifiedProjectFile(file) });
      } catch (error) {
        if (!(error instanceof AccessError) || error.status !== 404) throw error;
      }
    }
    const missingFileCount = files.length - copies.length;
    await checkFileBudget(tx, id, copies.length, copies.reduce((sum, {file}) => sum + file.sizeBytes, 0n));
    for (const {file, bytes} of copies) {
      const key = await storeProjectFile(bytes, file.mimeType);
      await tx.insert(projectFiles).values({ projectVersionId: version.id, storageKey: key, originalFilename: file.originalFilename, mimeType: file.mimeType,
        sizeBytes: file.sizeBytes, accessLevel: file.accessLevel, checksumSha256: file.checksumSha256 });
    }
    const [updated] = await tx.update(projects).set({ workingVersion: number, revision: project.revision + 1, updatedAt: new Date(),
      status: ['published', 'paused'].includes(project.status) ? project.status : 'draft' }).where(eq(projects.id, id)).returning();
    await projectEvent(tx, actor.id, updated, 'project.revision_created', version.id, { sourceVersionId: source.id, missingFileCount });
    return { id, revision: updated.revision };
  });
}
export async function changeListingVisibility(actor: Actor, id: string, expected: number, versionId: string, action: 'archive' | 'withdraw') {
  return db.transaction(async (tx) => {
    const { project } = await lockProject(tx, actor, id);
    assertProjectRevision(project.revision, expected);
    const [version] = await tx.select().from(projectVersions).where(and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, id)));
    if (!version) throw new AccessError(404, 'Không tìm thấy phiên bản.');
    if (project.status === 'archived') throw new AccessError(409, 'Dự án đã lưu trữ.');
    if (action === 'withdraw' && project.status !== 'published') throw new AccessError(409, 'Chỉ ngừng công bố tin đang công khai.');
    if (action === 'archive' && project.workingVersion) {
      const working = await workingVersion(tx, project);
      await tx.update(projectVersions).set({ submissionStatus: 'archived' }).where(eq(projectVersions.id, working.id));
    }
    const [updated] = await tx.update(projects).set({ status: action === 'archive' ? 'archived' : 'paused', revision: project.revision + 1,
      archivedAt: action === 'archive' ? new Date() : null, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    await projectEvent(tx, actor.id, updated, action === 'archive' ? 'project.archived' : 'project.withdrawn', version.id, {}, true);
    return { id, revision: updated.revision };
  });
}



