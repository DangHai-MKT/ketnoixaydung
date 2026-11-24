import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const read = path => readFile(new URL('../../'+path,import.meta.url),'utf8');
const moduleUrl = code => 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText).toString('base64');
const locations = moduleUrl(await read('lib/projects/locations.ts'));
const {parsePartnerDirectory,directoryColumns,directoryMaxBytes,directoryMaxRows} = await import(moduleUrl(
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

test('Accepts the new ward column and keeps the previous 16-column CSV compatible',()=>{
  const record={ten_cong_ty:'Công ty A',chuyen_mon:'PCCC',tinh_thanh:'Hà Nội',nguon_url:'https://example.com',
    dia_chi:'12 A, Phường Ba Đình, Hà Nội',phuong:'Phường Ba Đình'};
  const values=directoryColumns.map(k=>record[k]??'');
  const csv=(columns,cells)=>columns.join(',')+'\n'+cells.map(v=>'"'+v.replaceAll('"','""')+'"').join(',');
  assert.equal(parsePartnerDirectory(csv(directoryColumns,values))[0].company.profile.ward,'Phường Ba Đình');
  assert.equal(parsePartnerDirectory(csv(directoryColumns.slice(0,16),values.slice(0,16)))[0].company.profile.ward,undefined);
});

test('Imports hotline separately from the last Zalo column, regardless of column order',()=>{
  const cols=['ten_cong_ty','chuyen_mon','tinh_thanh','ma_so_thue','website','nguon_url',
    'hotline','dien_thoai','zalo'];
  const cells=['Công ty A','PCCC','Hà Nội','','','https://example.com','0912345678','0987654321','https://zalo.me/0901234567'];
  const result=parsePartnerDirectory(cols.join(',')+'\n'+cells.join(','))[0];
  assert.equal(result.company.profile.hotline,'0912345678');
  assert.equal(result.company.profile.phone,'0987654321');
  assert.equal(result.company.profile.zalo,'https://zalo.me/0901234567');
  assert.equal(directoryColumns.at(-1),'zalo');
  assert.throws(()=>parsePartnerDirectory(cols.join(',')+',zalo\n'+cells.join(',')+','));
});

test('Old Zalo column stays Zalo and invalid hotline is rejected',()=>{
  const header='ten_cong_ty,chuyen_mon,tinh_thanh,ma_so_thue,website,nguon_url,zalo';
  const row='Công ty A,PCCC,Hà Nội,,,https://example.com,https://zalo.me/0901234567';
  assert.equal(parsePartnerDirectory(header+'\n'+row)[0].company.profile.zalo,'https://zalo.me/0901234567');
  assert.ok(parsePartnerDirectory(header.replace('zalo','hotline')+'\n'+row)[0].error);
});

test('Ignores unnamed empty spreadsheet columns but rejects hidden nonempty data',()=>{
  const header='ten_cong_ty,chuyen_mon,tinh_thanh,ma_so_thue,website,nguon_url,,,';
  const row='Công ty A,PCCC,Bình Dương,0123456789,,https://example.com,,,';
  assert.equal(parsePartnerDirectory(header+'\n'+row)[0].company.province,'TP. Hồ Chí Minh');
  assert.throws(()=>parsePartnerDirectory(header+'\n'+row+'hidden'),/chưa đặt tên/);
});

test('Accepts long source descriptions, formatted phones and multiple Zalo links without truncation',()=>{
  const cols=['ten_cong_ty','chuyen_mon','tinh_thanh','ma_so_thue','website','nguon_url','dien_thoai','kinh_nghiem','zalo'];
  const values=['Công ty A','Thi công '.repeat(40),'TP. Đồng Nai','0123456789','','https://example.com',
    '(0251) 6296 345','Kinh nghiệm '.repeat(250),'https://zalo.me/0901234567; https://zalo.me/0901234568'];
  const result=parsePartnerDirectory(cols.join(',')+'\n'+values.join(','))[0];
  assert.equal(result.company.province,'Đồng Nai');
  assert.equal(result.company.profile.experience,values[7].trim());
  assert.equal(result.company.profile.phone,values[6]);
});

test('Reports tax numbers missing their leading zero rather than guessing identifiers',()=>{
  const result=parsePartnerDirectory('ten_cong_ty,chuyen_mon,tinh_thanh,ma_so_thue,website,nguon_url\nCông ty A,PCCC,Hà Nội,123456789,,https://example.com')[0];
  assert.match(result.error,/9 chữ số/);
});

test('Accepts files over the old 256 KB limit and more than 500 rows',()=>{
  const header='ten_cong_ty,chuyen_mon,tinh_thanh,ma_so_thue,website,nguon_url,kinh_nghiem';
  const record='Công ty A,Thi công,Hà Nội,,,https://example.com,'+'a'.repeat(400);
  const text=header+'\n'+Array(1000).fill(record).join('\n');
  assert.ok(Buffer.byteLength(text)>256*1024);
  const rows=parsePartnerDirectory(text);assert.equal(rows.length,1000);assert.ok(rows.every(r=>r.company));
});

test('Rejects files over 10 MB before parsing and caps the number of records',()=>{
  assert.equal(directoryMaxBytes,10*1024*1024);assert.equal(directoryMaxRows,10000);
  assert.throws(()=>parsePartnerDirectory('a'.repeat(directoryMaxBytes+1)),/10 MB/);
  const header='ten_cong_ty,chuyen_mon,tinh_thanh,ma_so_thue,website,nguon_url';
  assert.throws(()=>parsePartnerDirectory(header+'\n'+Array(10001).fill('A,B,Hà Nội,,,https://example.com').join('\n')),/10.000/);
});

test('HTTP upload accepts exactly 10 MB and rejects an oversized streamed request',async()=>{
  const permissions=moduleUrl(await read('lib/auth/permissions.ts'));
  const {readBoundedBody}=await import(moduleUrl((await read('lib/seller/http.ts')).replace('../auth/permissions',permissions)));
  const exact=new Request('http://localhost/import',{method:'POST',body:new Uint8Array(directoryMaxBytes)});
  assert.equal((await readBoundedBody(exact,directoryMaxBytes)).length,directoryMaxBytes);
  const tooLarge=new Request('http://localhost/import',{method:'POST',body:new Uint8Array(directoryMaxBytes+1)});
  await assert.rejects(()=>readBoundedBody(tooLarge,directoryMaxBytes),e=>e.status===413);
});
