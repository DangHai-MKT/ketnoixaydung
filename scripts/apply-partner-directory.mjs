import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {purchaseChatTarget} from './apply-purchase-chat-0013.mjs';

export async function applyDirectory(client,readSql=name=>readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8')) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    const {rows:[target]}=await client.query('SELECT current_database() AS name');
    if(target.name!=='ketnoixaydungvn_db')throw Error('WRONG_DATABASE');
    await client.query('SELECT pg_advisory_xact_lock(671280417)');
    const {rows:[state]}=await client.query(`SELECT to_regclass('public.partner_companies') IS NOT NULL AS directory,
      to_regclass('public.company_contact_access') IS NOT NULL AS access,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_companies' AND column_name='profile') AS profile,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_companies' AND column_name='published_at') AS publication`);
    let changed=false;
    if(!state.directory){await client.query(await readSql('0015_partner_directory.sql'));changed=true;}
    if(state.profile!==state.publication)throw Error('PARTIAL_SCHEMA');
    if(!state.profile){await client.query(await readSql('0016_partner_company_profiles.sql'));changed=true;}
    if(!state.access){await client.query(await readSql('0017_company_contact_access.sql'));changed=true;}
    await client.query(`SELECT id,identity_key,tax_code,name,trade,province,website,source_url,imported_by,created_at,profile,published_at FROM partner_companies LIMIT 0;
      SELECT buyer_id,company_id,ledger_id,price_points,created_at FROM company_contact_access LIMIT 0`);
    await client.query('COMMIT');
    return changed?'APPLIED':'ALREADY_APPLIED';
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}

export async function runDirectoryMigration() {
  const target=purchaseChatTarget(process.env.DATABASE_URL);
  if(!target){console.error('[partner-directory] WRONG_TARGET');return;}
  const client=new pg.Client({connectionString:target.href,connectionTimeoutMillis:8000});
  try{
    await client.connect();
    console.info('[partner-directory] '+await applyDirectory(client));
  }catch(error){
    const code=['WRONG_DATABASE','PARTIAL_SCHEMA'].includes(error?.message)?error.message:
      /^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'UNKNOWN';
    console.error('[partner-directory] FAILED: '+code);
  }finally{await client.end().catch(()=>{});}
}
