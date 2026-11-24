import {provinceOptions,projectProvinceFilterAliases} from '../projects/locations';

export const listingMaxBytes = 2 * 1024 * 1024;

export function listingUrl(value: string) {
  let url:URL;
  try { url = new URL(value.trim()); }
  catch { throw Error('Dán URL HTTPS của trang chi tiết doanh nghiệp trên Trang Vàng.'); }
  if (url.protocol !== 'https:' || !['trangvangvietnam.com','www.trangvangvietnam.com'].includes(url.hostname)
      || url.port || url.username || url.password || !/^\/listings\/\d{1,15}\/[a-z0-9_-]+\.html$/i.test(url.pathname)) {
    throw Error('Dán URL HTTPS của trang chi tiết doanh nghiệp trên Trang Vàng.');
  }
  return new URL(url.origin + url.pathname);
}

const entities: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
function clean(value:string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(original,key:string)=>{
    if (!key.startsWith('#')) return entities[key.toLowerCase()] ?? original;
    const number = key[1].toLowerCase()==='x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
    return number>0 && number<=0x10ffff ? String.fromCodePoint(number) : original;
  }).replace(/\s+/g,' ').trim();
}

const plain = (html:string) => clean(html.replace(/<[^>]*>/g,' '));
const fold = (text:string) => text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('đ','d').replace(/[^a-z0-9]+/g,' ').trim();
const headings = /^(Ngành nghề kinh doanh|Thị trường chính|Khách hàng chính|Loại hình kinh doanh|Giới thiệu công ty|Sản phẩm dịch vụ|Hồ sơ công ty|Mã số thuế|Năm thành lập|Liên hệ nhà cung cấp|Thông tin nhanh|Địa điểm)$/i;

export function extractYellowPages(html:string, source:string) {
  const url = listingUrl(source);
  if (/Cloudflare Ray ID|cf-chl-|Sorry, you have been blocked/i.test(html)) throw Error('Trang Vàng đang chặn truy cập tự động.');
  const content = html.replace(/<!--[^]*?-->|<(script|style|noscript)\b[^>]*>[^]*?<\/\1>/gi,'');
  const name = plain(content.match(/<h1\b[^>]*>([^]*?)<\/h1>/i)?.[1] ?? '').slice(0,200);
  if (!name || /^(Trang Vàng Việt Nam|.*(?:Access Denied|Just a moment).*|404)$/i.test(name)) throw Error('Không tìm thấy tên doanh nghiệp trong trang.');
  const lines = content.replace(/<\/?(?:div|p|li|dd|dt|h[1-6]|br|tr|td|section|aside|a)\b[^>]*>/gi,'\n')
    .split(/\r?\n/).map(plain).filter(Boolean);
  const section = lines.findIndex(line=>/^Ngành nghề kinh doanh\s*:?$/i.test(line));
  const trades:string[] = [];
  for (const line of (section < 0 ? [] : lines.slice(section+1,section+9))) {
    if (headings.test(line) || /^(Giới thiệu chung|Thư viện ảnh)$/i.test(line)) break;
    if (line.length<=150 && !trades.includes(line)) trades.push(line);
  }
  const trade = trades.reduce((text,item)=>{
    const next = text ? text+'; '+item : item;
    return next.length<=200 ? next : text;
  },'');
  const taxCode = lines.join(' ').match(/Mã số thuế\s*:?\s*(\d{10}(?:-\d{3})?)(?!\d)/i)?.[1] ?? '';
  const newAddress = lines.findIndex(line=>/Địa chỉ hành chính mới/i.test(line));
  const location = lines.findIndex(line=>/^Địa điểm\s*:?$/i.test(line));
  const address = newAddress>=0 ? lines.slice(newAddress,newAddress+2).join(' ') : location>=0 ? lines[location+1] ?? '' : '';
  const normalized = ' '+fold(address)+' ';
  const hasProvince = (alias:string) => {
    const key=fold(alias);
    return key.length>=4 && normalized.includes(' '+key+' ');
  };
  const province = provinceOptions.find(hasProvince)
    ?? provinceOptions.find(item => projectProvinceFilterAliases(item).some(hasProvince)) ?? '';
  const profile = content.slice(content.search(/<h1\b/i)).split(/Ngành nghề kinh doanh|Giới thiệu công ty/i,1)[0];
  const website = profile.match(/href\s*=\s*["'](https?:\/\/[^"'<>\s]+)["'][^>]*>\s*(?:<[^>]+>\s*)*(?:www\.|https?:\/\/)/i)?.[1] ?? '';
  const valueAfter = (label:string) => {
    const index = lines.findIndex(line=>line===label || line.startsWith(label+':'));
    return index<0 ? '' : (lines[index].slice(label.length).replace(/^\s*:\s*/,'') || lines[index+1] || '').trim();
  };
  const phone = profile.match(/href\s*=\s*["']tel:([+0-9 .()-]{6,40})["']/i)?.[1]
    ?? plain(profile).match(/Hotline\s*:?\s*(\+?\d(?:[ .()-]*\d){8,11})/i)?.[1] ?? '';
  const email = profile.match(/href\s*=\s*["']mailto:([^"'?<>\s]+)["']/i)?.[1] ?? '';
  const zalo = profile.match(/href\s*=\s*["'](https:\/\/(?:zalo\.me|oa\.zalo\.me)\/[a-z0-9_./-]+)["']/i)?.[1] ?? '';
  const contactIndex=lines.findIndex(line=>/^Người phụ trách\s*:?$/i.test(line));
  const contactLines=contactIndex<0 ? [] : lines.slice(contactIndex+1,contactIndex+5);
  const contactPerson=contactLines.find(line=>/^(Ông|Bà|Anh|Chị|Mr\.?|Ms\.?|Mrs\.?)\s+\S+/i.test(line))
    ?? contactLines.find(line=>line.split(/\s+/).length>=2 && !headings.test(line)
      && !/[0-9@:/]/.test(line) && !/^Zalo$/i.test(line)) ?? '';
  const fields = {address:address.slice(0,400),year:valueAfter('Năm thành lập').match(/^\d{4}$/)?.[0] ?? '',
    phone,email,zalo,market:valueAfter('Thị trường chính').slice(0,200),work:valueAfter('Khách hàng chính').slice(0,300),experience:'',
    contactPerson:(contactPerson || (contactIndex<0 ? valueAfter('Người phụ trách') : '')).slice(0,150),
    employees:valueAfter('Số lượng nhân viên').slice(0,100),ward:'',
    hotline:plain(profile).match(/Hotline\s*:?\s*(\+?\d(?:[ .()-]*\d){8,11})/i)?.[1] ?? ''};
  return {name,trade,province,taxCode,website:clean(website),sourceUrl:url.href,listingId:url.pathname.split('/')[2],address,profile:fields};
}
