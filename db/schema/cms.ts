import {customType, index, integer, jsonb, pgTable, primaryKey, timestamp, unique, uuid, varchar, boolean, check, foreignKey, type PgTableExtraConfigValue, type AnyPgColumn} from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
import type {Block, CmsInput, CmsKind} from '../../lib/cms/content';
import {users} from './index';

const bytea = customType<{data: Buffer; driverData: Buffer}>({dataType: () => 'bytea'});
const createdAt = () => timestamp('created_at', {withTimezone: true}).notNull().defaultNow();

export const cmsCategories = pgTable('cms_categories', {
  id: uuid('id').primaryKey().defaultRandom(), slug: varchar('slug', {length:100}).notNull().unique('cms_categories_slug_key'),
  name: varchar('name', {length:120}).notNull(), createdAt: createdAt(),
}, t => [check('cms_categories_slug_check',sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)]);

export const cmsMedia = pgTable('cms_media', {
  id: uuid('id').primaryKey().defaultRandom(), filename: varchar('filename', {length:180}).notNull(),
  alt: varchar('alt', {length:250}).notNull(), width: integer('width').notNull(), height: integer('height').notNull(),
  bytes: bytea('bytes').notNull(), createdBy: uuid('created_by').notNull(), createdAt: createdAt(),
}, t => [
  foreignKey({name:'cms_media_created_by_fkey',columns:[t.createdBy],foreignColumns:[users.id]}),
  check('cms_media_width_check',sql`${t.width} BETWEEN 1 AND 1920`),
  check('cms_media_height_check',sql`${t.height} BETWEEN 1 AND 1920`),
  check('cms_media_bytes_check',sql`octet_length(${t.bytes}) BETWEEN 1 AND 2097152`),
]);

export const cmsContents = pgTable('cms_contents', {
  id: uuid('id').primaryKey().defaultRandom(), kind: varchar('kind', {length:10}).$type<CmsKind>().notNull(),
  slug: varchar('slug', {length:100}).notNull(), title: varchar('title', {length:180}).notNull(),
  summary: varchar('summary', {length:500}).notNull().default(''), seoTitle: varchar('seo_title', {length:100}).notNull().default(''),
  seoDescription: varchar('seo_description', {length:200}).notNull().default(''),
  blocks: jsonb('blocks').$type<Block[]>().notNull().default([]), categoryId: uuid('category_id'),
  featuredMediaId: uuid('featured_media_id'), featuredAlt: varchar('featured_alt', {length:250}).notNull().default(''),
  isPolicy: boolean('is_policy').notNull().default(false), revision: integer('revision').notNull().default(1),
  publishedRevision: integer('published_revision'), createdBy: uuid('created_by').notNull(), updatedBy: uuid('updated_by').notNull(),
  createdAt: createdAt(), updatedAt: timestamp('updated_at', {withTimezone:true}).notNull().defaultNow(),
}, (t): PgTableExtraConfigValue[] => [
  unique('cms_contents_kind_slug_key').on(t.kind,t.slug),
  index('cms_contents_kind_updated_idx').on(t.kind,t.updatedAt.desc(),t.id.desc()),
  foreignKey({name:'cms_contents_category_id_fkey',columns:[t.categoryId],foreignColumns:[cmsCategories.id]}),
  foreignKey({name:'cms_contents_featured_media_id_fkey',columns:[t.featuredMediaId],foreignColumns:[cmsMedia.id]}),
  foreignKey({name:'cms_contents_created_by_fkey',columns:[t.createdBy],foreignColumns:[users.id]}),
  foreignKey({name:'cms_contents_updated_by_fkey',columns:[t.updatedBy],foreignColumns:[users.id]}),
  foreignKey({name:'cms_contents_published_revision_fk',columns:[t.id,t.publishedRevision],
    foreignColumns:[cmsRevisions.contentId,cmsRevisions.revision]}),
  check('cms_contents_kind_check',sql`${t.kind} IN ('page','news')`),
  check('cms_contents_slug_check',sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check('cms_contents_revision_check',sql`${t.revision}>0`),
  check('cms_contents_blocks_check',sql`jsonb_typeof(${t.blocks})='array'`),
  check('cms_contents_check',sql`${t.kind}='news' OR ${t.categoryId} IS NULL`),
  check('cms_contents_check1',sql`${t.kind}='page' OR NOT ${t.isPolicy}`),
]);

export const cmsRevisions = pgTable('cms_revisions', {
  contentId: uuid('content_id').notNull().references(():AnyPgColumn=>cmsContents.id), revision: integer('revision').notNull(),
  snapshot: jsonb('snapshot').$type<CmsInput>().notNull(), categoryId: uuid('category_id'), publishedBy: uuid('published_by').notNull(),
  publishedAt: timestamp('published_at', {withTimezone:true}).notNull().defaultNow(),
}, t => [
  primaryKey({name:'cms_revisions_pkey',columns:[t.contentId,t.revision]}),
  index('cms_revisions_published_idx').on(t.publishedAt.desc(),t.contentId),
  foreignKey({name:'cms_revisions_category_id_fkey',columns:[t.categoryId],foreignColumns:[cmsCategories.id]}),
  foreignKey({name:'cms_revisions_published_by_fkey',columns:[t.publishedBy],foreignColumns:[users.id]}),
  check('cms_revisions_revision_check',sql`${t.revision}>0`),
  check('cms_revisions_snapshot_check',sql`jsonb_typeof(${t.snapshot})='object'`),
]);

export const cmsRevisionMedia = pgTable('cms_revision_media', {
  contentId: uuid('content_id').notNull(), revision: integer('revision').notNull(), mediaId: uuid('media_id').notNull(),
}, t => [
  primaryKey({name:'cms_revision_media_pkey',columns:[t.contentId,t.revision,t.mediaId]}),
  index('cms_revision_media_image_idx').on(t.mediaId),
  foreignKey({name:'cms_revision_media_media_id_fkey',columns:[t.mediaId],foreignColumns:[cmsMedia.id]}),
  foreignKey({name:'cms_revision_media_content_id_revision_fkey',columns:[t.contentId,t.revision],
    foreignColumns:[cmsRevisions.contentId,cmsRevisions.revision]}),
]);
