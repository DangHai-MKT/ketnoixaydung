import {
  pgTable, pgEnum, uuid, text, varchar, bigint, integer, boolean,
  timestamp, jsonb, numeric, uniqueIndex, index, check, foreignKey, unique, primaryKey, type AnyPgColumn, type PgTableExtraConfigValue,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export {cmsCategories,cmsContents,cmsMedia,cmsRevisions,cmsRevisionMedia} from './cms';

const now = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedNow = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const userStatus = pgEnum('user_status', ['active', 'suspended', 'closed']);
export const verificationStatus = pgEnum('verification_status', ['unverified', 'pending', 'verified', 'rejected', 'suspended']);
export const sellerType = pgEnum('seller_type', ['individual', 'business']);
export const projectStatus = pgEnum('project_status', ['draft', 'pending_auto_check', 'needs_correction', 'pending_review', 'published', 'rejected', 'paused', 'archived']);
export const moderationDecision = pgEnum('moderation_decision', ['approved', 'rejected', 'changes_requested', 'paused', 'restored']);
export const walletUnit = pgEnum('wallet_unit', ['POINT', 'VND']);
export const walletBucket = pgEnum('wallet_bucket', ['available', 'held', 'platform_clearing', 'platform_revenue', 'issuance', 'seller_payable']);
export const ledgerStatus = pgEnum('ledger_status', ['pending', 'posted', 'reversed', 'failed']);
export const paymentStatus = pgEnum('payment_status', ['pending', 'paid', 'failed', 'expired', 'partially_refunded', 'refunded']);
export const purchaseStatus = pgEnum('purchase_status', ['created', 'completed', 'failed', 'refund_pending', 'refunded', 'disputed']);
export const earningStatus = pgEnum('earning_status', ['held', 'available', 'reserved', 'paid', 'reversed', 'disputed']);
export const withdrawalStatus = pgEnum('withdrawal_status', ['requested', 'under_review', 'approved', 'processing', 'paid', 'rejected', 'failed', 'cancelled']);
export const payoutStatus = pgEnum('payout_status', ['pending', 'processing', 'paid', 'failed', 'cancelled']);
export const disputeStatus = pgEnum('dispute_status', ['open', 'under_review', 'resolved_buyer', 'resolved_seller', 'rejected', 'closed']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull(),
  passwordHash: text('password_hash'),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  phone: varchar('phone', { length: 40 }),
  status: userStatus('status').notNull().default('active'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: now(), updatedAt: updatedNow(),
}, (t) => [
  uniqueIndex('users_email_uq').on(t.email),
  uniqueIndex('users_phone_uq')
  .on(t.phone)
  .where(sql`${t.phone} IS NOT NULL`),
  check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
]);

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  createdAt: now(),
}, (t) => [
  foreignKey({
    name: 'user_roles_user_id_fkey',
    columns: [t.userId],
    foreignColumns: [users.id],
  }).onDelete('cascade'),
  unique('user_roles_user_id_role_key').on(t.userId, t.role),
  check('user_roles_role_check', sql`${t.role} IN ('buyer', 'seller', 'content_moderator',
'finance_operator', 'support_operator', 'super_admin')`),
]);

export const sellerProfiles = pgTable('seller_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  sellerType: sellerType('seller_type').notNull(),
  legalName: varchar('legal_name', { length: 300 }).notNull(),
  businessRegistrationNo: varchar('business_registration_no', { length: 100 }),
  taxCode: varchar('tax_code', { length: 100 }),
  contactPhone: varchar('contact_phone', { length: 40 }),
  contactEmail: varchar('contact_email', { length: 320 }),
  contactAddress: varchar('contact_address', { length: 500 }),
  authorizedRepresentative: varchar('authorized_representative', { length: 200 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  correctionRequestedAt: timestamp('correction_requested_at', { withTimezone: true }),
  revision: integer('revision').notNull().default(1),
  verificationStatus: verificationStatus('verification_status').notNull().default('unverified'),
  verificationSubmittedAt: timestamp('verification_submitted_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by'),
  reviewReason: text('review_reason'),
  payoutProfileStatus: verificationStatus('payout_profile_status').notNull().default('unverified'),
  createdAt: now(),
  updatedAt: updatedNow(),
}, (t) => [
  check(
    'seller_profiles_check',
    sql`${t.sellerType} <> 'business' OR ${t.legalName} <> ''`,
  ),
  unique('seller_profiles_user_id_key').on(t.userId),
  check('seller_profiles_revision_positive', sql`${t.revision} > 0`),
  index('seller_profiles_review_queue_idx').on(t.verificationStatus, t.verificationSubmittedAt, t.id),
  foreignKey({
    name: 'seller_profiles_user_id_fkey',
    columns: [t.userId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'seller_profiles_reviewed_by_fkey',
    columns: [t.reviewedBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),
]);


export const sellerVerificationDocuments = pgTable('seller_verification_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerProfileId: uuid('seller_profile_id').notNull(),
  documentType: varchar('document_type', { length: 80 }).notNull(),
  storageKey: text('storage_key').notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: now(),
}, (t) => [
  check('seller_verification_documents_size_bytes_check', sql`${t.sizeBytes} > 0`),
  index('seller_verification_documents_active_idx').on(t.sellerProfileId).where(sql`${t.supersededAt} IS NULL`),
  check('seller_verification_documents_status_check', sql`${t.status} IN ('pending', 'accepted', 'rejected')`),
  foreignKey({
    name: 'seller_verification_documents_seller_profile_id_fkey',
    columns: [t.sellerProfileId],
    foreignColumns: [sellerProfiles.id],
  }).onDelete('cascade'),

  foreignKey({
    name: 'seller_verification_documents_reviewed_by_fkey',
    columns: [t.reviewedBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),
]);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull(),
  slug: varchar('slug', { length: 320 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  provinceCode: varchar('province_code', { length: 20 }),
  districtName: varchar('district_name', { length: 120 }),
  projectStage: varchar('project_stage', { length: 80 }),
  sizeMinSqm: numeric('size_min_sqm', { precision: 14, scale: 2 }),
  sizeMaxSqm: numeric('size_max_sqm', { precision: 14, scale: 2 }),
  publicSummary: text('public_summary').notNull(),
  publicData: jsonb('public_data').$type<Record<string, unknown>>().notNull().default({}),
  pricePoints: bigint('price_points', { mode: 'bigint' }).notNull(),
  status: projectStatus('status').notNull().default('draft'),
  currentVersion: integer('current_version').notNull().default(1),
  workingVersion: integer('working_version'),
  revision: integer('revision').notNull().default(1),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: now(), updatedAt: updatedNow(),
}, (t) => [
  uniqueIndex('projects_slug_uq').on(t.slug),
  index('projects_status_published_idx')
  .on(t.status, t.publishedAt.desc().nullsFirst()),

  index('projects_seller_idx')
  .on(t.sellerId, t.createdAt.desc().nullsFirst()),
  index('projects_category_province_idx').on(t.category, t.provinceCode),
  check('projects_price_points_check', sql`${t.pricePoints} > 0`),
  check('projects_current_version_check', sql`${t.currentVersion} > 0`),
  check('projects_working_version_positive', sql`${t.workingVersion} IS NULL OR ${t.workingVersion} > 0`),
  check('projects_revision_positive', sql`${t.revision} > 0`),
  check(
    'projects_size_min_sqm_check',
    sql`${t.sizeMinSqm} IS NULL OR ${t.sizeMinSqm} >= 0`,
  ),
  check(
    'projects_size_max_sqm_check',
    sql`${t.sizeMaxSqm} IS NULL OR ${t.sizeMaxSqm} >= 0`,
  ),
  check(
    'projects_check',
    sql`${t.sizeMinSqm} IS NULL OR ${t.sizeMaxSqm} IS NULL OR ${t.sizeMaxSqm} >= ${t.sizeMinSqm}`,
  ),
  index('projects_public_data_gin_idx').using('gin', t.publicData),
  foreignKey({
    name: 'projects_seller_id_fkey',
    columns: [t.sellerId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
]);

export const projectVersions = pgTable('project_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  versionNo: integer('version_no').notNull(),
  submissionStatus: projectStatus('submission_status'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  title: varchar('title', { length: 300 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  provinceCode: varchar('province_code', { length: 20 }),
  districtName: varchar('district_name', { length: 120 }),
  projectStage: varchar('project_stage', { length: 80 }),
  sizeMinSqm: numeric('size_min_sqm', { precision: 14, scale: 2 }),
  sizeMaxSqm: numeric('size_max_sqm', { precision: 14, scale: 2 }),
  publicSummary: text('public_summary').notNull(),
  publicData: jsonb('public_data').$type<Record<string, unknown>>().notNull().default({}),
  pricePoints: bigint('price_points', { mode: 'bigint' }).notNull(),
  submittedBy: uuid('submitted_by').notNull(),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  changeSummary: text('change_summary'),
  createdAt: now(),
}, (t) => [
  unique('project_versions_project_id_version_no_key')
  .on(t.projectId, t.versionNo),
  index('project_versions_project_idx')
    .on(t.projectId, t.versionNo.desc().nullsFirst()),
  check('project_versions_version_no_check', sql`${t.versionNo} > 0`),
  index('project_versions_review_queue_idx').on(t.submissionStatus, t.submittedAt, t.id),
  check('project_versions_price_points_check', sql`${t.pricePoints} > 0`),
  check('project_versions_size_min_nonnegative', sql`${t.sizeMinSqm} IS NULL OR ${t.sizeMinSqm} >= 0`),
  check('project_versions_size_max_nonnegative', sql`${t.sizeMaxSqm} IS NULL OR ${t.sizeMaxSqm} >= 0`),
  check('project_versions_size_range_valid', sql`${t.sizeMinSqm} IS NULL OR ${t.sizeMaxSqm} IS NULL OR ${t.sizeMaxSqm} >= ${t.sizeMinSqm}`),
  foreignKey({
    name: 'project_versions_project_id_fkey',
    columns: [t.projectId],
    foreignColumns: [projects.id],
  }).onDelete('restrict'),

  foreignKey({
    name: 'project_versions_submitted_by_fkey',
    columns: [t.submittedBy],
    foreignColumns: [users.id],
  }).onDelete('restrict'),

  foreignKey({
    name: 'project_versions_reviewed_by_fkey',
    columns: [t.reviewedBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),
]);

export const projectPrivateData = pgTable('project_private_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectVersionId: uuid('project_version_id').notNull(),
  privateData: jsonb('private_data').$type<Record<string, unknown>>().notNull().default({}),
  dataRightsConfirmedAt: timestamp('data_rights_confirmed_at', { withTimezone: true }),
  dataRightsDeclaration: text('data_rights_declaration'),
  createdAt: now(), updatedAt: updatedNow(),
  }, (t) => [
    unique('project_private_data_project_version_id_key').on(t.projectVersionId),
    foreignKey({
      name: 'project_private_data_project_version_id_fkey',
      columns: [t.projectVersionId],
      foreignColumns: [projectVersions.id],
    }).onDelete('restrict'),
]);

export const projectFiles = pgTable('project_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectVersionId: uuid('project_version_id').notNull(),
  storageKey: text('storage_key').notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
  accessLevel: varchar('access_level', { length: 20 }).notNull(),
  checksumSha256: varchar('checksum_sha256', { length: 64 }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  createdAt: now(),
}, (t) => [
  unique('project_files_storage_key_key').on(t.storageKey),
  index('project_files_version_idx').on(t.projectVersionId),
  index('project_files_active_idx').on(t.projectVersionId).where(sql`${t.supersededAt} IS NULL`),
  foreignKey({
    name: 'project_files_project_version_id_fkey',
    columns: [t.projectVersionId],
    foreignColumns: [projectVersions.id],
  }).onDelete('restrict'),
  check('project_files_size_bytes_check', sql`${t.sizeBytes} > 0`),
  check('project_files_access_level_check', sql`${t.accessLevel} IN ('public_preview', 'purchased_only', 'moderator_only')`),
]);

export const moderationReviews = pgTable('moderation_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  projectVersionId: uuid('project_version_id'),
  reviewerId: uuid('reviewer_id'),
  decision: moderationDecision('decision').notNull(),
  automatedChecks: jsonb('automated_checks').$type<Record<string, unknown>>().notNull().default({}),
  reason: text('reason'),
  createdAt: now(),
}, (t) => [
  index('moderation_reviews_project_idx').on(t.projectId, t.createdAt.desc().nullsFirst()),
  foreignKey({
    name: 'moderation_reviews_project_id_fkey',
    columns: [t.projectId],
    foreignColumns: [projects.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'moderation_reviews_project_version_id_fkey',
    columns: [t.projectVersionId],
    foreignColumns: [projectVersions.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'moderation_reviews_reviewer_id_fkey',
    columns: [t.reviewerId],
    foreignColumns: [users.id],
  }).onDelete('set null'),
]);

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  accountCode: varchar('account_code', { length: 100 }).notNull(),
  unit: walletUnit('unit').notNull(),
  bucket: walletBucket('bucket').notNull(),
  description: text('description').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: now(),
}, (t) => [
  unique('wallets_account_code_key').on(t.accountCode),
  uniqueIndex('wallets_user_unit_bucket_uq').on(t.userId, t.unit, t.bucket).where(sql`${t.userId} IS NOT NULL`),
  index('wallets_unit_bucket_idx').on(t.unit, t.bucket),
  foreignKey({
    name: 'wallets_user_id_fkey',
    columns: [t.userId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
  check('wallets_check', sql`(${t.isSystem} = true AND ${t.userId} IS NULL) OR (${t.isSystem} = false AND ${t.userId} IS NOT NULL)`),
]);

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionType: varchar('transaction_type', { length: 60 }).notNull(),
  referenceType: varchar('reference_type', { length: 60 }),
  referenceId: uuid('reference_id'),
  idempotencyKey: varchar('idempotency_key', { length: 200 }),
  reversalOfTransactionId: uuid('reversal_of_transaction_id'),
  reversalReason: text('reversal_reason'),
  status: ledgerStatus('status').notNull().default('pending'),
  description: text('description').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdBy: uuid('created_by'),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  createdAt: now(),
}, (t) => [
  unique('ledger_transactions_idempotency_key_key').on(t.idempotencyKey),
  uniqueIndex('ledger_transactions_one_active_reversal_per_original_uidx')
    .on(t.reversalOfTransactionId).where(sql`${t.reversalOfTransactionId} IS NOT NULL AND ${t.status} <> 'failed'`),
  foreignKey({ name: 'ledger_transactions_reversal_of_fkey', columns: [t.reversalOfTransactionId], foreignColumns: [t.id] }).onDelete('restrict'),
  check('ledger_transactions_reversal_fields_check', sql`(
    (${t.transactionType} = 'reversal' AND ${t.reversalOfTransactionId} IS NOT NULL AND ${t.reversalReason} IS NOT NULL AND btrim(${t.reversalReason}) <> '')
    OR (${t.transactionType} <> 'reversal' AND ${t.reversalOfTransactionId} IS NULL AND ${t.reversalReason} IS NULL)
  )`),
  index('ledger_reference_idx').on(t.referenceType, t.referenceId),
  index('ledger_created_idx').on(t.createdAt.desc().nullsFirst()),
  foreignKey({
    name: 'ledger_transactions_created_by_fkey',
    columns: [t.createdBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),
]);

export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull(),
  walletId: uuid('wallet_id').notNull(),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  reversalOfEntryId: uuid('reversal_of_entry_id'),
  createdAt: now(),
}, (t) => [
  index('ledger_entries_transaction_idx').on(t.transactionId),
  uniqueIndex('ledger_entries_one_reversal_per_original_entry_uidx')
    .on(t.reversalOfEntryId).where(sql`${t.reversalOfEntryId} IS NOT NULL`),
  foreignKey({ name: 'ledger_entries_reversal_of_entry_fkey', columns: [t.reversalOfEntryId], foreignColumns: [t.id] }).onDelete('restrict'),
  index('ledger_entries_wallet_idx')
    .on(t.walletId, t.createdAt.desc().nullsFirst()),
  foreignKey({
    name: 'ledger_entries_transaction_id_fkey',
    columns: [t.transactionId],
    foreignColumns: [ledgerTransactions.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'ledger_entries_wallet_id_fkey',
    columns: [t.walletId],
    foreignColumns: [wallets.id],
  }).onDelete('restrict'),
  check('ledger_entries_amount_check', sql`${t.amount} <> 0`),
]);

export const paymentOrders = pgTable('payment_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerReference: varchar('provider_reference', { length: 200 }),
  clientIdempotencyKey: varchar('client_idempotency_key', { length: 200 }),
  amountVnd: bigint('amount_vnd', { mode: 'bigint' }).notNull(),
  pointsToCredit: bigint('points_to_credit', { mode: 'bigint' }).notNull(),
  exchangeRateVersion: integer('exchange_rate_version').notNull(),
  status: paymentStatus('status').notNull().default('pending'),
  checkoutUrl: text('checkout_url'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  refundedAmountVnd: bigint('refunded_amount_vnd', { mode: 'bigint' }).notNull().default(sql`0`),
  createdAt: now(), updatedAt: updatedNow(),
}, (t) => [
  unique('payment_orders_provider_provider_reference_key').on(t.provider, t.providerReference),
  uniqueIndex('payment_user_idempotency_uq').on(t.userId, t.clientIdempotencyKey).where(sql`${t.clientIdempotencyKey} IS NOT NULL`),
  index('payment_orders_user_idx')
  .on(t.userId, t.createdAt.desc().nullsFirst()),
  index('payment_orders_status_idx').on(t.status, t.createdAt),
  check('payment_orders_amount_vnd_check', sql`${t.amountVnd} > 0`),
  check('payment_orders_points_to_credit_check', sql`${t.pointsToCredit} > 0`),
  check('payment_orders_refunded_amount_vnd_check', sql`${t.refundedAmountVnd} >= 0`),
  check('payment_orders_check', sql`${t.refundedAmountVnd} <= ${t.amountVnd}`),
  foreignKey({
    name: 'payment_orders_user_id_fkey',
    columns: [t.userId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
]);

export const paymentEvents = pgTable('payment_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentOrderId: uuid('payment_order_id'),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerEventId: varchar('provider_event_id', { length: 200 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  signatureValid: boolean('signature_valid').notNull().default(false),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  processingStatus: varchar('processing_status', { length: 20 }).notNull().default('received'),
  processingError: text('processing_error'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (t) => [
  unique('payment_events_provider_provider_event_id_key').on(t.provider, t.providerEventId),
  check('payment_events_processing_status_check', sql`${t.processingStatus} IN ('received', 'processed', 'ignored', 'failed')`),
  foreignKey({
    name: 'payment_events_payment_order_id_fkey',
    columns: [t.paymentOrderId],
    foreignColumns: [paymentOrders.id],
  }).onDelete('restrict'),
]);

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerId: uuid('buyer_id').notNull(),
  sellerId: uuid('seller_id').notNull(),
  projectId: uuid('project_id').notNull(),
  projectVersionId: uuid('project_version_id').notNull(),
  pricePoints: bigint('price_points', { mode: 'bigint' }).notNull(),
  feeBps: integer('fee_bps').notNull(),
  feePoints: bigint('fee_points', { mode: 'bigint' }).notNull(),
  sellerPoints: bigint('seller_points', { mode: 'bigint' }).notNull(),
  status: purchaseStatus('status').notNull().default('created'),
  idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: now(),
}, (t) => [
  unique('purchase_orders_buyer_id_project_version_id_key')
    .on(t.buyerId, t.projectVersionId),
  unique('purchase_orders_idempotency_key_key')
    .on(t.idempotencyKey),
  index('purchase_orders_seller_idx')
    .on(t.sellerId, t.createdAt.desc().nullsFirst()),
  index('purchase_orders_project_idx')
    .on(t.projectId, t.createdAt.desc().nullsFirst()),
  foreignKey({
    name: 'purchase_orders_buyer_id_fkey',
    columns: [t.buyerId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'purchase_orders_seller_id_fkey',
    columns: [t.sellerId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'purchase_orders_project_id_fkey',
    columns: [t.projectId],
    foreignColumns: [projects.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'purchase_orders_project_version_id_fkey',
    columns: [t.projectVersionId],
    foreignColumns: [projectVersions.id],
  }).onDelete('restrict'),
  check(
    'purchase_orders_price_points_check',
    sql`${t.pricePoints} > 0`,
  ),
  check(
    'purchase_orders_fee_bps_check',
    sql`${t.feeBps} >= 0 AND ${t.feeBps} <= 10000`,
  ),
  check(
    'purchase_orders_fee_points_check',
    sql`${t.feePoints} >= 0`,
  ),
  check(
    'purchase_orders_seller_points_check',
    sql`${t.sellerPoints} >= 0`,
  ),
  check(
    'purchase_orders_check',
    sql`${t.feePoints} + ${t.sellerPoints} = ${t.pricePoints}`,
  ),
  check(
    'purchase_orders_check1',
    sql`${t.buyerId} <> ${t.sellerId}`,
  ),
]);

export const sellerEarnings = pgTable('seller_earnings', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull(),
  purchaseId: uuid('purchase_id').notNull(),
  grossPoints: bigint('gross_points', { mode: 'bigint' }).notNull(),
  feePoints: bigint('fee_points', { mode: 'bigint' }).notNull(),
  netPoints: bigint('net_points', { mode: 'bigint' }).notNull(),
  status: earningStatus('status').notNull().default('held'),
  heldUntil: timestamp('held_until', { withTimezone: true }).notNull(),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  createdAt: now(),
}, (t) => [
  unique('seller_earnings_purchase_id_key').on(t.purchaseId),
  index('seller_earnings_available_idx').on(t.sellerId, t.status, t.heldUntil),
  foreignKey({
    name: 'seller_earnings_seller_id_fkey',
    columns: [t.sellerId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'seller_earnings_purchase_id_fkey',
    columns: [t.purchaseId],
    foreignColumns: [purchaseOrders.id],
  }).onDelete('restrict'),
  check('seller_earnings_gross_points_check', sql`${t.grossPoints} >= 0`),
  check('seller_earnings_fee_points_check', sql`${t.feePoints} >= 0`),
  check('seller_earnings_net_points_check', sql`${t.netPoints} >= 0`),
  check(
    'seller_earnings_check',
    sql`${t.grossPoints} = ${t.feePoints} + ${t.netPoints}`,
  ),
]);

export const payoutAccounts = pgTable('payout_accounts', {
  workflowVersion: integer('workflow_version'),
  revision: integer('revision').notNull().default(1),
  verifiedBy: uuid('verified_by').references(()=>users.id,{onDelete:'restrict'}),
  reviewReason: text('review_reason'),
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  accountHolder: varchar('account_holder', { length: 200 }).notNull(),
  bankName: varchar('bank_name', { length: 200 }).notNull(),
  accountNumberEncrypted: text('account_number_encrypted').notNull(),
  accountNumberMasked: varchar('account_number_masked', { length: 80 }).notNull(),
  bankCode: varchar('bank_code', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  isDefault: boolean('is_default').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: now(),
  updatedAt: updatedNow(),
}, (t) => [
  check('payout_accounts_workflow_version_check',sql`${t.workflowVersion} IS NULL OR ${t.workflowVersion}=1`),
  check('payout_accounts_revision_check',sql`${t.revision}>0`),
  index('payout_accounts_user_idx')
  .on(t.userId, t.createdAt.desc().nullsFirst()),
  uniqueIndex('payout_accounts_one_default_per_user_uq').on(t.userId).where(sql`${t.isDefault} = true`),
  foreignKey({
    name: 'payout_accounts_user_id_fkey',
    columns: [t.userId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
  check('payout_accounts_status_check', sql`${t.status} IN ('pending', 'verified', 'rejected', 'disabled')`),
]);

export const withdrawalRequests = pgTable('withdrawal_requests', {
  workflowVersion: integer('workflow_version'),
  revision: integer('revision').notNull().default(1),
  reservationLedgerId: uuid('reservation_ledger_id').unique().references(()=>ledgerTransactions.id,{onDelete:'restrict'}),
  settlementLedgerId: uuid('settlement_ledger_id').unique().references(()=>ledgerTransactions.id,{onDelete:'restrict'}),
  releaseLedgerId: uuid('release_ledger_id').unique().references(()=>ledgerTransactions.id,{onDelete:'restrict'}),
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull(),
  amountVnd: bigint('amount_vnd', { mode: 'bigint' }).notNull(),
  pointsReserved: bigint('points_reserved', { mode: 'bigint' }).notNull(),
  conversionRateVersion: integer('conversion_rate_version').notNull(),
  payoutAccountId: uuid('payout_account_id'),
  idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
  status: withdrawalStatus('status').notNull().default('requested'),
  payoutAccountSnapshot: jsonb('payout_account_snapshot').$type<Record<string, unknown>>().notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewReason: text('review_reason'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  updatedAt: updatedNow(),
}, (t) => [
  check('withdrawal_requests_workflow_version_check',sql`${t.workflowVersion} IS NULL OR ${t.workflowVersion}=1`),
  check('withdrawal_requests_revision_check',sql`${t.revision}>0`),
  uniqueIndex('withdrawal_new_one_active_seller_uq').on(t.sellerId).where(sql`${t.workflowVersion}=1 AND ${t.status} IN ('requested','under_review','approved','processing')`),
  check('withdrawal_new_workflow_check',sql`${t.workflowVersion} IS NULL OR (${t.reservationLedgerId} IS NOT NULL AND ${t.payoutAccountId} IS NOT NULL AND (${t.status}<>'paid' OR (${t.settlementLedgerId} IS NOT NULL AND ${t.paidAt} IS NOT NULL)) AND (${t.status} NOT IN ('rejected','failed','cancelled') OR ${t.releaseLedgerId} IS NOT NULL))`),
  index('withdrawal_requests_seller_idx')
  .on(t.sellerId, t.requestedAt.desc().nullsFirst()),
  index('withdrawal_requests_status_idx').on(t.status, t.requestedAt),
  uniqueIndex('withdrawal_seller_idempotency_uq').on(t.sellerId, t.idempotencyKey),
  foreignKey({
    name: 'withdrawal_requests_seller_id_fkey',
    columns: [t.sellerId],
    foreignColumns: [users.id],
  }).onDelete('restrict'),

  foreignKey({
    name: 'withdrawal_requests_reviewed_by_fkey',
    columns: [t.reviewedBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),

  foreignKey({
    name: 'withdrawal_requests_payout_account_id_fkey',
    columns: [t.payoutAccountId],
    foreignColumns: [payoutAccounts.id],
  }).onDelete('restrict'),
  check('withdrawal_requests_amount_vnd_check', sql`${t.amountVnd} > 0`),
  check('withdrawal_requests_points_reserved_check', sql`${t.pointsReserved} > 0`),
]);

export const payoutAttempts = pgTable('payout_attempts', {
  workflowVersion: integer('workflow_version'),
  evidenceId: uuid('evidence_id'),
  id: uuid('id').primaryKey().defaultRandom(),
  withdrawalRequestId: uuid('withdrawal_request_id').notNull(),
  attemptNo: integer('attempt_no').notNull(),
  provider: varchar('provider', { length: 50 }),
  providerReference: varchar('provider_reference', { length: 200 }),
  status: payoutStatus('status').notNull().default('pending'),
  amountVnd: bigint('amount_vnd', { mode: 'bigint' }).notNull(),
  failureReason: text('failure_reason'),
  initiatedBy: uuid('initiated_by'),
  createdAt: now(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t):PgTableExtraConfigValue[] => [
  check('payout_attempts_workflow_version_check',sql`${t.workflowVersion} IS NULL OR ${t.workflowVersion}=1`),
  foreignKey({name:'payout_attempts_evidence_fkey',columns:[t.evidenceId],foreignColumns:[payoutDocuments.id]}).onDelete('restrict'),
  unique('payout_attempts_request_id_uq').on(t.withdrawalRequestId,t.id),
  uniqueIndex('payout_attempt_one_active_new_uq').on(t.withdrawalRequestId).where(sql`${t.workflowVersion}=1 AND ${t.status} IN ('pending','processing')`),
  unique('payout_attempts_withdrawal_request_id_attempt_no_key')
  .on(t.withdrawalRequestId, t.attemptNo),

  unique('payout_attempts_provider_provider_reference_key')
  .on(t.provider, t.providerReference),
  foreignKey({
    name: 'payout_attempts_withdrawal_request_id_fkey',
    columns: [t.withdrawalRequestId],
    foreignColumns: [withdrawalRequests.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'payout_attempts_initiated_by_fkey',
    columns: [t.initiatedBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),
  check('payout_attempts_attempt_no_check', sql`${t.attemptNo} > 0`),
  check('payout_attempts_amount_vnd_check', sql`${t.amountVnd} > 0`),
]);

export const withdrawalAllocations = pgTable('withdrawal_allocations', {
  id:uuid('id').primaryKey().defaultRandom(),
  withdrawalRequestId:uuid('withdrawal_request_id').notNull().references(()=>withdrawalRequests.id,{onDelete:'restrict'}),
  earningId:uuid('earning_id').notNull().references(()=>sellerEarnings.id,{onDelete:'restrict'}),
  amountPoints:bigint('amount_points',{mode:'bigint'}).notNull(),
  state:varchar('state',{length:20}).notNull(),createdAt:now(),finishedAt:timestamp('finished_at',{withTimezone:true}),
},(t):PgTableExtraConfigValue[]=>[unique('withdrawal_allocations_source_uq').on(t.withdrawalRequestId,t.earningId),index('withdrawal_allocations_earning_idx').on(t.earningId,t.state),check('withdrawal_allocations_amount_points_check',sql`${t.amountPoints}>0`),check('withdrawal_allocations_state_check',sql`${t.state} IN ('reserved','released','paid')`),check('withdrawal_allocations_finished_check',sql`(${t.state}='reserved' AND ${t.finishedAt} IS NULL) OR (${t.state}<>'reserved' AND ${t.finishedAt} IS NOT NULL)`)]);
export const payoutEvents = pgTable('payout_events', {
 id:uuid('id').primaryKey().defaultRandom(),payoutAccountId:uuid('payout_account_id').references(()=>payoutAccounts.id,{onDelete:'restrict'}),withdrawalRequestId:uuid('withdrawal_request_id').references(()=>withdrawalRequests.id,{onDelete:'restrict'}),payoutAttemptId:uuid('payout_attempt_id'),actorId:uuid('actor_id').notNull().references(()=>users.id,{onDelete:'restrict'}),kind:varchar('kind',{length:60}).notNull(),message:text('message').notNull(),requestKey:varchar('request_key',{length:150}).notNull(),createdAt:now(),
},(t):PgTableExtraConfigValue[]=>[foreignKey({name:'payout_events_attempt_fkey',columns:[t.withdrawalRequestId,t.payoutAttemptId],foreignColumns:[payoutAttempts.withdrawalRequestId,payoutAttempts.id]}).onDelete('restrict'),uniqueIndex('payout_events_account_request_uq').on(t.payoutAccountId,t.actorId,t.requestKey).where(sql`${t.payoutAccountId} IS NOT NULL`),uniqueIndex('payout_events_withdrawal_request_uq').on(t.withdrawalRequestId,t.actorId,t.requestKey).where(sql`${t.withdrawalRequestId} IS NOT NULL`),index('payout_events_withdrawal_timeline_idx').on(t.withdrawalRequestId,t.createdAt,t.id),index('payout_events_account_timeline_idx').on(t.payoutAccountId,t.createdAt,t.id),check('payout_events_target_check',sql`(${t.payoutAccountId} IS NOT NULL AND ${t.withdrawalRequestId} IS NULL AND ${t.payoutAttemptId} IS NULL) OR (${t.payoutAccountId} IS NULL AND ${t.withdrawalRequestId} IS NOT NULL)`),check('payout_events_message_check',sql`length(${t.message}) BETWEEN 1 AND 10000`),check('payout_events_kind_check',sql`${t.kind} IN ('account_created','account_verified','account_rejected','account_default','account_disabled','account_revealed','document_added','withdrawal_requested','review_started','approved','processing','uncertain','cancelled','rejected','failed','paid')`)]);
export const payoutDocuments = pgTable('payout_documents', {
 id:uuid('id').primaryKey().defaultRandom(),eventId:uuid('event_id').notNull().unique().references(():AnyPgColumn=>payoutEvents.id,{onDelete:'restrict'}),payoutAccountId:uuid('payout_account_id').references(()=>payoutAccounts.id,{onDelete:'restrict'}),withdrawalRequestId:uuid('withdrawal_request_id').references(()=>withdrawalRequests.id,{onDelete:'restrict'}),payoutAttemptId:uuid('payout_attempt_id'),uploadedBy:uuid('uploaded_by').notNull().references(()=>users.id,{onDelete:'restrict'}),kind:varchar('kind',{length:40}).notNull(),storageKey:varchar('storage_key',{length:200}).notNull().unique(),originalFilename:varchar('original_filename',{length:255}).notNull(),mimeType:varchar('mime_type',{length:100}).notNull(),sizeBytes:bigint('size_bytes',{mode:'bigint'}).notNull(),sha256:varchar('sha256',{length:64}).notNull(),createdAt:now(),
},(t):PgTableExtraConfigValue[]=>[foreignKey({name:'payout_documents_attempt_fkey',columns:[t.withdrawalRequestId,t.payoutAttemptId],foreignColumns:[payoutAttempts.withdrawalRequestId,payoutAttempts.id]}).onDelete('restrict'),index('payout_documents_account_idx').on(t.payoutAccountId,t.createdAt),index('payout_documents_withdrawal_idx').on(t.withdrawalRequestId,t.createdAt),check('payout_documents_mime_type_check',sql`${t.mimeType}='image/png'`),check('payout_documents_size_bytes_check',sql`${t.sizeBytes}>0 AND ${t.sizeBytes}<=5242880`),check('payout_documents_sha256_check',sql`${t.sha256} ~ '^[a-f0-9]{64}$'`),check('payout_documents_kind_check',sql`${t.kind} IN ('account_ownership','transfer_receipt','failure_confirmation')`),check('payout_documents_target_check',sql`(${t.kind}='account_ownership' AND ${t.payoutAccountId} IS NOT NULL AND ${t.withdrawalRequestId} IS NULL AND ${t.payoutAttemptId} IS NULL) OR (${t.kind} IN ('transfer_receipt','failure_confirmation') AND ${t.payoutAccountId} IS NULL AND ${t.withdrawalRequestId} IS NOT NULL AND ${t.payoutAttemptId} IS NOT NULL)`)]);

export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').notNull(),
  requestedBy: uuid('requested_by').notNull(),
  amountPoints: bigint('amount_points', { mode: 'bigint' }).notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('requested'),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  ledgerTransactionId: uuid('ledger_transaction_id'),
  createdAt: now(),
}, (t) => [
  foreignKey({
    name: 'refunds_purchase_id_fkey',
    columns: [t.purchaseId],
    foreignColumns: [purchaseOrders.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'refunds_requested_by_fkey',
    columns: [t.requestedBy],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'refunds_reviewed_by_fkey',
    columns: [t.reviewedBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),
  foreignKey({
    name: 'refunds_ledger_transaction_id_fkey',
    columns: [t.ledgerTransactionId],
    foreignColumns: [ledgerTransactions.id],
  }).onDelete('restrict'),
  check('refunds_amount_points_check', sql`${t.amountPoints} > 0`),
  check('refunds_status_check', sql`${t.status} IN ('requested', 'approved', 'rejected', 'completed')`),
]);

export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').notNull(),
  raisedBy: uuid('raised_by').notNull(),
  reasonCode: varchar('reason_code', { length: 80 }).notNull(),
  description: text('description').notNull(),
  status: disputeStatus('status').notNull().default('open'),
  assignedTo: uuid('assigned_to'),
  resolution: text('resolution'),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: now(),
  revision: integer('revision').notNull().default(1),
  clientIdempotencyKey: varchar('client_idempotency_key', { length: 150 }),
}, (t) => [
  check('disputes_revision_check', sql`${t.revision} > 0`),
  uniqueIndex('disputes_opening_request_uq').on(t.raisedBy,t.clientIdempotencyKey).where(sql`${t.clientIdempotencyKey} IS NOT NULL`),
  index('disputes_status_idx').on(t.status, t.createdAt),
  index('disputes_open_purchase_idx').on(t.purchaseId, t.status),
  uniqueIndex('disputes_one_open_per_purchase_uq').on(t.purchaseId).where(sql`${t.status} IN ('open', 'under_review')`),
  foreignKey({
    name: 'disputes_purchase_id_fkey',
    columns: [t.purchaseId],
    foreignColumns: [purchaseOrders.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'disputes_raised_by_fkey',
    columns: [t.raisedBy],
    foreignColumns: [users.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'disputes_assigned_to_fkey',
    columns: [t.assignedTo],
    foreignColumns: [users.id],
  }).onDelete('set null'),
  foreignKey({
    name: 'disputes_resolved_by_fkey',
    columns: [t.resolvedBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),
]);

export const disputeCaseEvents = pgTable('dispute_case_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  disputeId: uuid('dispute_id').notNull().references(()=>disputes.id,{onDelete:'restrict'}),
  actorId: uuid('actor_id').notNull().references(()=>users.id,{onDelete:'restrict'}),
  kind: varchar('kind',{length:40}).notNull(),
  message: text('message').notNull(),
  requestKey: varchar('request_key',{length:150}).notNull(),
  createdAt: now(),
},t=>[
  unique('dispute_case_events_request_uq').on(t.disputeId,t.actorId,t.requestKey),
  unique('dispute_case_events_case_id_uq').on(t.disputeId,t.id),
  index('dispute_case_events_timeline_idx').on(t.disputeId,t.createdAt,t.id),
  check('dispute_case_events_kind_check',sql`${t.kind} IN ('opened','message','review_started','information_requested','evidence_added','resolution')`),
  check('dispute_case_events_message_check',sql`length(${t.message}) BETWEEN 1 AND 10000`),
]);
export const disputeEvidence = pgTable('dispute_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  disputeId: uuid('dispute_id').notNull().references(()=>disputes.id,{onDelete:'restrict'}),
  eventId: uuid('event_id').notNull().unique(),
  uploadedBy: uuid('uploaded_by').notNull().references(()=>users.id,{onDelete:'restrict'}),
  storageKey: varchar('storage_key',{length:200}).notNull().unique(),
  originalFilename: varchar('original_filename',{length:255}).notNull(),
  mimeType: varchar('mime_type',{length:100}).notNull(),
  sizeBytes: bigint('size_bytes',{mode:'bigint'}).notNull(),
  sha256: varchar('sha256',{length:64}).notNull(),
  createdAt: now(),
},t=>[
  foreignKey({name:'dispute_evidence_event_case_fkey',columns:[t.disputeId,t.eventId],foreignColumns:[disputeCaseEvents.disputeId,disputeCaseEvents.id]}).onDelete('restrict'),
  index('dispute_evidence_case_idx').on(t.disputeId,t.createdAt,t.id),
  check('dispute_evidence_mime_type_check',sql`${t.mimeType}='image/png'`),
  check('dispute_evidence_size_bytes_check',sql`${t.sizeBytes}>0 AND ${t.sizeBytes}<=5242880`),
  check('dispute_evidence_sha256_check',sql`${t.sha256} ~ '^[a-f0-9]{64}$'`),
]);

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  settingKey: varchar('setting_key', { length: 100 }).notNull(),
  version: integer('version').notNull(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  createdBy: uuid('created_by'),
  changeReason: text('change_reason').notNull(),
  createdAt: now(),
}, (t) => [
  unique('system_settings_setting_key_version_key').on(t.settingKey, t.version),
  index('system_settings_effective_idx').on(t.settingKey, t.effectiveFrom, t.effectiveTo),
  foreignKey({
    name: 'system_settings_created_by_fkey',
    columns: [t.createdBy],
    foreignColumns: [users.id],
  }).onDelete('set null'),
  check('system_settings_version_check', sql`${t.version} > 0`),
  check('system_settings_check', sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  reason: text('reason'),
  requestId: varchar('request_id', { length: 100 }),
  ipHash: varchar('ip_hash', { length: 128 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: now(),
}, (t) => [
  index('audit_logs_actor_idx')
    .on(t.actorId, t.createdAt.desc().nullsFirst()),
  index('audit_logs_entity_idx')
    .on(t.entityType, t.entityId, t.createdAt.desc().nullsFirst()),
  foreignKey({
    name: 'audit_logs_actor_id_fkey',
    columns: [t.actorId],
    foreignColumns: [users.id],
  }).onDelete('set null'),
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 80 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: now(),
}, (t) => [
  index('notifications_user_idx')
    .on(t.userId, t.readAt, t.createdAt.desc().nullsFirst()),
  index('notifications_email_candidates_idx').on(t.type,t.createdAt,t.id),
  foreignKey({
    name: 'notifications_user_id_fkey',
    columns: [t.userId],
    foreignColumns: [users.id],
  }).onDelete('cascade'),
]);

export const notificationEmailPreferences = pgTable('notification_email_preferences', {
  userId:uuid('user_id').primaryKey().references(()=>users.id,{onDelete:'cascade'}),
  sellerEnabledAt:timestamp('seller_enabled_at',{withTimezone:true}),
  projectEnabledAt:timestamp('project_enabled_at',{withTimezone:true}),
  revision:integer('revision').notNull().default(1),
  updatedAt:updatedNow(),
}, t=>[check('notification_email_preferences_revision_check',sql`${t.revision}>0`)]);

export const projectWatchPeriods = pgTable('project_watch_periods', {
  id:uuid('id').primaryKey(),
  userId:uuid('user_id').notNull().references(()=>users.id),
  category:varchar('category',{length:100}).notNull(),
  requestId:uuid('request_id').notNull(),
  pricePoints:bigint('price_points',{mode:'bigint'}).notNull(),
  ledgerId:uuid('ledger_id').notNull().unique('project_watch_periods_ledger_id_key').references(()=>ledgerTransactions.id),
  startsAt:timestamp('starts_at',{withTimezone:true}).notNull(),
  endsAt:timestamp('ends_at',{withTimezone:true}).notNull(),
  emailEnabled:boolean('email_enabled').notNull().default(false),
  remindedAt:timestamp('reminded_at',{withTimezone:true}),createdAt:now(),
},t=>[
  unique('project_watch_periods_user_id_request_id_key').on(t.userId,t.requestId),
  unique('project_watch_periods_user_id_category_starts_at_key').on(t.userId,t.category,t.startsAt),
  check('project_watch_periods_category_check',sql`${t.category} IN ('civil','industrial','infrastructure','energy','commercial','agriculture','healthcare','education','other')`),
  check('project_watch_periods_price_points_check',sql`${t.pricePoints}=1000`),
  check('project_watch_periods_check',sql`${t.endsAt}=${t.startsAt}+interval '720 hours'`),
  index('project_watch_periods_category_idx').on(t.category,t.startsAt,t.endsAt),
]);

export const projectWatchAlerts = pgTable('project_watch_alerts', {
  userId:uuid('user_id').notNull().references(()=>users.id),
  projectId:uuid('project_id').notNull().references(()=>projects.id),
  periodId:uuid('period_id').notNull().references(()=>projectWatchPeriods.id),
  notificationId:uuid('notification_id').notNull().unique('project_watch_alerts_notification_id_key').references(()=>notifications.id),
},t=>[primaryKey({name:'project_watch_alerts_pkey',columns:[t.userId,t.projectId]})]);

export const notificationEmailDeliveries = pgTable('notification_email_deliveries', {
  notificationId:uuid('notification_id').primaryKey().references(()=>notifications.id,{onDelete:'cascade'}),
  state:varchar('state',{length:12}).notNull(),
  attempts:integer('attempts').notNull(),
  firstAttemptAt:timestamp('first_attempt_at',{withTimezone:true}).notNull(),
  nextAttemptAt:timestamp('next_attempt_at',{withTimezone:true}).notNull(),
  leaseToken:uuid('lease_token'),payloadHash:varchar('payload_hash',{length:64}).notNull(),
  providerId:varchar('provider_id',{length:100}),outcome:varchar('outcome',{length:40}),
  updatedAt:updatedNow(),
}, t=>[
  check('notification_email_deliveries_state_check',sql`${t.state} IN ('sending','retry','accepted','failed','skipped')`),
  check('notification_email_deliveries_attempts_check',sql`${t.attempts} BETWEEN 1 AND 4`),
  check('notification_email_deliveries_payload_hash_check',sql`${t.payloadHash} ~ '^[a-f0-9]{64}$'`),
  check('notification_email_deliveries_check',sql`(${t.state}='sending')=(${t.leaseToken} IS NOT NULL)`),
  check('notification_email_deliveries_check1',sql`(${t.state}='accepted')=(${t.providerId} IS NOT NULL)`),
  index('notification_email_deliveries_due_idx').on(t.nextAttemptAt).where(sql`${t.state} IN ('sending','retry')`),
]);

export const authSessions = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('session_user_id_idx').on(t.userId),
  ],
);

export const authAccounts = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('account_user_id_idx').on(t.userId),
  ],
);

export const authVerifications = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('verification_identifier_idx').on(t.identifier),
  ],
);
