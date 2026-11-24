import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>url(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const locations=compile(await read('lib/projects/locations.ts'));
const phones=compile(await read('lib/site/company-phones.ts'));
const csv=compile((await read('lib/site/partner-directory-csv.ts')).replace('../projects/locations',locations).replace('./company-phones',phones));
const wards=url('export default '+await read('lib/projects/vietnam-wards.json'));
const conversion=url('export default '+await read('lib/projects/vietnam-ward-conversion.json'));
const address=compile((await read('lib/site/company-address.ts')).replace('../projects/vietnam-ward-conversion.json',conversion).replace('../projects/locations',locations));
const {profileFields}=await import(csv);
const {companyEditVersion,parseCompanyEdit,mergeEditedProfile}=await import(compile((await read('lib/site/company-edit.ts'))
  .replace('./partner-directory-csv',csv).replace('../projects/vietnam-wards.json',wards).replace('./company-address',address)));
const initial={name:'Doanh nghiệp A',trade:'Thi công',province:'Hà Nội',taxCode:null,website:null,sourceUrl:'https://example.com',
  profile:{address:'12 A, Phường Ba Đình, Hà Nội',ward:'Phường Ba Đình',phone:'0901234567',experience:'Dòng một\nDòng hai',addressOriginal:'Địa chỉ nguồn',addressStatus:'manual'}};
function form(){const f=new FormData();for(const k of ['name','trade','province','taxCode','website','sourceUrl'])f.set(k,initial[k]??'');for(const [k] of profileFields)f.set(k,initial.profile[k]??'');return f;}
test('Edit validates fields and preserves full multiline descriptions',()=>{
  const edited=parseCompanyEdit(form());assert.equal(edited.profile.experience,initial.profile.experience);assert.equal(edited.profile.phone,'0901234567');
  const invalid=form();invalid.set('email','not-an-email');assert.throws(()=>parseCompanyEdit(invalid));
  invalid.set('email','ok@example.com');invalid.set('ward','Phường An Hội Tây');assert.throws(()=>parseCompanyEdit(invalid),/phường\/xã/);
});
test('Updating contact fields preserves address evidence and unknown profile metadata',()=>{
  const f=form();f.set('hotline','0909999999');const result=mergeEditedProfile({...initial,profile:{...initial.profile,customMetadata:'kept'}},parseCompanyEdit(f));
  assert.equal(result.addressOriginal,initial.profile.addressOriginal);assert.equal(result.addressStatus,'manual');assert.equal(result.customMetadata,'kept');assert.equal(result.hotline,'0909999999');
});
test('Admin can correct an unresolved ward without losing the source address',()=>{
  const previous={...initial,profile:{...initial.profile,ward:'',addressStatus:'review'}};
  const result=mergeEditedProfile(previous,parseCompanyEdit(form()));assert.equal(result.ward,'Phường Ba Đình');assert.equal(result.addressStatus,'manual');assert.equal(result.addressOriginal,'Địa chỉ nguồn');
});
test('Cleared optional fields stay empty and an explicitly cleared ward requires review',()=>{
  const f=form();f.set('phone','');f.set('ward','');const result=mergeEditedProfile(initial,parseCompanyEdit(f));assert.equal(result.phone,'');assert.equal(result.ward,'');assert.equal(result.addressStatus,'review');
});
test('Version detects concurrent content edits but is independent of JSON key order',()=>{
  assert.equal(companyEditVersion(initial),companyEditVersion({...initial,profile:Object.fromEntries(Object.entries(initial.profile).reverse())}));
  assert.notEqual(companyEditVersion(initial),companyEditVersion({...initial,name:'Doanh nghiệp B'}));
});
