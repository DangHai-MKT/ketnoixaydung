import {readFile} from 'node:fs/promises';
import pg from 'pg';
export async function applyPublicSlugs(client,expectedDatabase='ketnoixaydungvn_db') {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s'; SET LOCAL search_path=public,pg_catalog");
    const {rows:[target]}=await client.query('SELECT current_database() AS name');
    if(target.name!==expectedDatabase)throw Error('WRONG_DATABASE');
    await client.query('SELECT pg_advisory_xact_lock(671280418)');
    const {rows:[state]}=await client.query(`SELECT
      (SELECT count(*)=2 FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('projects','partner_companies') AND column_name='public_slug')
      AND to_regclass('public.projects_public_slug_uq') IS NOT NULL AND to_regclass('public.partner_companies_public_slug_uq') IS NOT NULL
      AND (SELECT count(*)=2 FROM pg_trigger WHERE tgrelid IN (to_regclass('public.projects'),to_regclass('public.partner_companies')) AND tgname IN ('assign_project_public_slug','assign_company_public_slug') AND tgenabled<>'D')
      AND (SELECT count(*)=2 FROM pg_constraint WHERE conrelid IN (to_regclass('public.projects'),to_regclass('public.partner_companies')) AND conname IN ('projects_public_slug_format','partner_companies_public_slug_format') AND convalidated) AS ready`);
    if(!state.ready)await client.query(await readFile(new URL('../db/migrations/0018_public_slugs.sql',import.meta.url),'utf8'));
    await client.query('COMMIT');return state.ready?'ALREADY_APPLIED':'APPLIED';
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}
export async function runPublicSlugMigration() {
  if(!process.env.DATABASE_URL)throw Error('PUBLIC_URLS_DATABASE_REQUIRED');
  for(let attempt=0;attempt<3;attempt++) {
    const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:8000});
    try {await client.connect();console.info('[public-urls-0018] '+await applyPublicSlugs(client));return;}
    catch(error){
      const code=error?.message==='WRONG_DATABASE'?'WRONG_DATABASE':/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'UNKNOWN';
      if(attempt===2||code==='WRONG_DATABASE'){console.error('[public-urls-0018] FAILED '+code);throw Error('PUBLIC_URLS_SETUP_FAILED');}
      console.info('[public-urls-0018] RETRY '+code);await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
    }finally{await client.end().catch(()=>{});}
  }
}
