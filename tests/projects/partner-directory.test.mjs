import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const read = path => readFile(new URL('../../'+path,import.meta.url),'utf8');
const moduleUrl = code => 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText).toString('base64');
const locations = moduleUrl(await read('lib/projects/locations.ts'));
const {parsePartnerDirectory,directoryColumns} = await import(moduleUrl(
  (await read('lib/site/partner-directory-csv.ts')).replace('../projects/locations',locations),
));
const {listingUrl,extractYellowPages} = await import(moduleUrl(
  (await read('lib/site/yellow-pages.ts')).replace('../projects/locations',locations),
));

test('Trang Vàng input is restricted to company profiles on the approved origin',()=>{
  const url = 'https://trangvangvietnam.com/listings/1116888/chanh-nghia.html';
  assert.equal(listingUrl(url+'?ref=1#section2').href,url);
  for (const value of ['http://trangvangvietnam.com/listings/1/a.html','https://trangvangvietnam.com@other.test/listings/1/a.html',
    'https://trangvangvietnam.com:8080/listings/1/a.html','https://trangvangvietnam.com/quy-che-hoat-dong']) {
    assert.throws(()=>listingUrl(value));
  }
});

test('Extracts company fields and prefers the updated administrative address',()=>{
  const html = '<h1>Công ty A &amp; B</h1><p>Bình Dương</p><p>Địa chỉ hành chính mới: Phường Bình Dương, TP Hồ Chí Minh</p>'+
    '<a href="https://company.example">www.company.example</a><h2>Ngành nghề kinh doanh</h2><a>Tư vấn thiết kế</a>'+
    '<a>Thi công dân dụng</a><h2>Hồ sơ công ty</h2><dt>Mã số thuế</dt><dd>3702194418</dd>';
  const url = 'https://trangvangvietnam.com/listings/1116888/chanh-nghia.html';
  const data = extractYellowPages(html,url);
  assert.equal(data.name,'Công ty A & B');
  assert.equal(data.trade,'Tư vấn thiết kế; Thi công dân dụng');
  assert.equal(data.province,'TP. Hồ Chí Minh');
  assert.equal(data.taxCode,'3702194418');
  assert.equal(data.website,'https://company.example');
  assert.throws(()=>extractYellowPages('Cloudflare Ray ID',url));
});

test('Uses the actual responsible person instead of avatar initials and retains staff range',()=>{
  const url='https://trangvangvietnam.com/listings/1188037389/truong-giang.html';
  const html='<h1>Xây Dựng Trường Giang</h1><h2>Hồ sơ công ty</h2>'+
    '<div>Số lượng nhân viên</div><div>Từ 11 - 50 người</div>'+
    '<div>Liên hệ nhà cung cấp</div><div>Người phụ trách</div><span>TG</span>'+
    '<div>Ông Phan Trường Giang</div><div>0989 510 387</div><h2>Thông tin nhanh</h2>';
  const result=extractYellowPages(html,url);
  assert.equal(result.profile.contactPerson,'Ông Phan Trường Giang');
  assert.equal(result.profile.employees,'Từ 11 - 50 người');
  const initialsOnly=extractYellowPages('<h1>Doanh nghiệp</h1><div>Người phụ trách</div><div>TG</div><h2>Thông tin nhanh</h2>',url);
  assert.equal(initialsOnly.profile.contactPerson,'');
});

test('The downloadable template parses with accents and quoted commas',async()=>{
  const rows = parsePartnerDirectory(await read('public/mau-ho-so-doanh-nghiep.csv'));
  assert.equal(rows.length,2);
  assert.equal(rows[0].company.province,'Đồng Nai');
  assert.equal(rows[0].company.profile.year,'2012');
  assert.equal(rows[0].company.profile.email,'lienhe@example.com');
  assert.equal(rows[1].company.trade,'Cơ điện, cấp thoát nước');
});

test('Validates semicolon files, identity normalization and malformed records',()=>{
  const header = directoryColumns.slice(0,6).join(';');
  const rows = parsePartnerDirectory(header+'\r\nCông ty A;PCCC;Đồng Nai;0123456789;;https://example.com\r\ncông ty  a;PCCC;Đồng Nai;;;https://example.com\r\nCông ty B;PCCC;Nơi khác;;;javascript:alert(1)');
  assert.equal(rows[0].company.taxCode,'0123456789');
  assert.equal(rows[0].company.identityKey,rows[1].company.identityKey);
  assert.ok(rows[2].error);
  assert.throws(()=>parsePartnerDirectory(header+'\n"Chưa đóng'));
  assert.throws(()=>parsePartnerDirectory(header));
});
