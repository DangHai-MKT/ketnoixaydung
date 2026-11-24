import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../../lib/site/directory-review.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {directorySelection,directoryIssues}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const ids=Array.from({length:101},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
test('Batch selection rejects empty, malformed, non-text and oversized requests',()=>{
  assert.throws(()=>directorySelection([]));
  assert.throws(()=>directorySelection(['bad-id']));
  assert.throws(()=>directorySelection([new Blob(['invalid'])]));
  assert.throws(()=>directorySelection(ids));
  assert.equal(directorySelection(ids.slice(0,100)).length,100);
});
test('Repeated IDs count once and must not produce duplicate audit entries',()=>{
  assert.deepEqual(directorySelection([ids[0],ids[0],ids[1]]),ids.slice(0,2));
});
test('Review queue flags missing contacts and unresolved addresses independently',()=>{
  assert.deepEqual(directoryIssues({ward:'Phường Ba Đình',addressStatus:'current',hasContact:true}),[]);
  assert.deepEqual(directoryIssues({ward:'Phường Ba Đình',addressStatus:'review',hasContact:true}),['Kiểm tra địa chỉ']);
  assert.deepEqual(directoryIssues({ward:'Phường Ba Đình',addressStatus:'current',hasContact:false}),['Thiếu liên hệ']);
  assert.equal(directoryIssues({ward:'',addressStatus:'review',hasContact:false}).length,2);
});
