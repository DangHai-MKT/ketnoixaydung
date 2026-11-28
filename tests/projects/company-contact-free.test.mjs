import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
// No database dependency is supplied: the retired purchase must reject before any posting.
const source=await readFile(new URL('../../services/company-contacts.ts',import.meta.url),'utf8');
const code=ts.transpile(source.replace("import 'server-only';",'').replace(/import \{AccessError,type Actor\} from '[^']+';/,"class AccessError extends Error {constructor(status,message){super(message);this.status=status;}}"),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
const {buyCompanyContact}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('Stale company-contact purchases cannot charge POINT after contacts become free',async()=>{
  await assert.rejects(buyCompanyContact({id:'stale-client'},'company'),error=>error.status===409&&error.message.includes('miễn phí'));
});
