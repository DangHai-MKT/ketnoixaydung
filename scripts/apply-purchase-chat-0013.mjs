import { readFile } from 'node:fs/promises';
import pg from 'pg';

const database = 'ketnoixaydungvn_db';
const internalHost = 'vays-db-34190cd5-postgresql-5432';
const migration = new URL('../db/migrations/0013_purchase_messages.sql', import.meta.url);

export function purchaseChatTarget(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  return ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname === internalHost
    && (!url.port || url.port === '5432') && url.pathname === '/' + database ? url : null;
}

async function schemaMatches(client) {
  const { rows: [result] } = await client.query(`
    SELECT
      (SELECT array_agg(column_name::text || ':' || udt_name || ':' || is_nullable || ':' ||
          coalesce(column_default, '') ORDER BY ordinal_position)
       FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_messages')
        = ARRAY['id:uuid:NO:', 'purchase_id:uuid:NO:', 'sender_id:uuid:NO:', 'body:text:NO:', 'created_at:timestamptz:NO:now()']
      AND (SELECT array_agg(pg_get_constraintdef(oid) ORDER BY conname)
           FROM pg_constraint WHERE conrelid='public.purchase_messages'::regclass AND convalidated)
        = ARRAY['CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 2000)))',
          'PRIMARY KEY (id)', 'FOREIGN KEY (purchase_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT',
          'FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT']
      AND EXISTS (SELECT 1 FROM pg_index
        WHERE indrelid='public.purchase_messages'::regclass AND indisvalid
          AND indexrelid=to_regclass('public.purchase_messages_thread_idx')
          AND pg_get_indexdef(indexrelid) LIKE '% USING btree (purchase_id, created_at DESC, id DESC)')
      AS matches
  `);
  return result.matches === true;
}

export async function applyPurchaseChatMigration(client, readSql = () => readFile(migration, 'utf8')) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s'");
    const { rows: [target] } = await client.query('SELECT current_database() AS name');
    if (target.name !== database) throw new Error('WRONG_DATABASE');
    await client.query('SELECT pg_advisory_xact_lock(671280413)');
    const { rows: [schema] } = await client.query("SELECT to_regclass('public.purchase_messages') IS NOT NULL AS present");
    if (!schema.present) await client.query(await readSql());
    if (!await schemaMatches(client)) throw new Error('SCHEMA_MISMATCH');
    await client.query('COMMIT');
    return schema.present ? 'ALREADY_APPLIED' : 'APPLIED';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

let startup;
export function runPurchaseChatMigration() {
  startup ??= (async () => {
    const target = purchaseChatTarget(process.env.DATABASE_URL);
    if (!target) {
      console.error('[purchase-chat-0013] WRONG_TARGET: cần DATABASE_URL nội bộ của ketnoixaydungvn_db.');
      return;
    }
    const client = new pg.Client({ connectionString: target.href, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      console.info('[purchase-chat-0013] ' + await applyPurchaseChatMigration(client));
    } catch (error) {
      const code = ['WRONG_DATABASE', 'SCHEMA_MISMATCH'].includes(error?.message) ? error.message
        : /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code : 'UNKNOWN';
      console.error('[purchase-chat-0013] FAILED: ' + code);
    } finally {
      await client.end().catch(() => {});
    }
  })();
  return startup;
}
