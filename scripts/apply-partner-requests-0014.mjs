import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {purchaseChatTarget} from './apply-purchase-chat-0013.mjs';

const migration = new URL('../db/migrations/0014_partner_requests.sql', import.meta.url);
const tables = ['partner_requests', 'partner_replies', 'partner_introductions'];

export async function applyPartnerRequestsMigration(client, readSql = () => readFile(migration,'utf8')) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s'");
    const {rows:[target]} = await client.query('SELECT current_database() AS name');
    if (target.name !== 'ketnoixaydungvn_db') throw Error('WRONG_DATABASE');
    await client.query('SELECT pg_advisory_xact_lock(671280414)');
    const {rows:[schema]} = await client.query(
      "SELECT count(*)::int AS present FROM unnest($1::text[]) AS t(name) WHERE to_regclass('public.' || name) IS NOT NULL",
      [tables],
    );
    if (schema.present === 0) await client.query(await readSql());
    else if (schema.present !== tables.length) throw Error('PARTIAL_SCHEMA');
    await client.query(`
      SELECT id,owner_id,trade,province,scope,timing,created_at,closed_at FROM public.partner_requests LIMIT 0;
      SELECT request_id,author_id,kind FROM public.partner_replies LIMIT 0;
      SELECT id,request_id,staff_id,name,note,created_at FROM public.partner_introductions LIMIT 0;
    `);
    await client.query('COMMIT');
    return schema.present === 0 ? 'APPLIED' : 'ALREADY_APPLIED';
  } catch (error) {
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }
}

let startup;
export function runPartnerRequestsMigration() {
  startup ??= (async () => {
    const target = purchaseChatTarget(process.env.DATABASE_URL);
    if (!target) { console.error('[partner-requests-0014] WRONG_TARGET'); return; }
    const client = new pg.Client({connectionString:target.href,connectionTimeoutMillis:8000});
    try {
      await client.connect();
      console.info('[partner-requests-0014] ' + await applyPartnerRequestsMigration(client));
    } catch (error) {
      const code = ['WRONG_DATABASE','PARTIAL_SCHEMA'].includes(error?.message) ? error.message
        : /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code : 'UNKNOWN';
      console.error('[partner-requests-0014] FAILED: ' + code);
    } finally { await client.end().catch(()=>{}); }
  })();
  return startup;
}
