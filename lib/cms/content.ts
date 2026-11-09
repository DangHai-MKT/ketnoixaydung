import {AccessError} from '../auth/permissions';

export const cmsRoles = ['content_moderator', 'super_admin'] as const;
export type CmsKind = 'page' | 'news';
export type Block =
  | {type: 'heading' | 'paragraph' | 'quote' | 'list'; text: string}
  | {type: 'link'; text: string; href: string}
  | {type: 'image'; mediaId: string; alt: string; caption: string};

export function record(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError(400, 'Dữ liệu nội dung không hợp lệ.');
  return value as Record<string, unknown>;
}
export function field(value: unknown, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new AccessError(400, 'Kiểm tra nội dung bắt buộc và giới hạn độ dài.');
  }
  return value.trim();
}
export function slugInput(value: unknown) {
  const slug = field(value, 100, true);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new AccessError(400, 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang.');
  return slug;
}
export function suggestedSlug(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('đ','d')
    .replace(/[^a-z0-9]+/g,'-').slice(0,100).replace(/^-|-$/g,'');
}
export function kindInput(value: unknown): CmsKind {
  if (value !== 'page' && value !== 'news') throw new AccessError(400, 'Loại nội dung không hợp lệ.');
  return value;
}
export function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new AccessError(400, 'Mã tham chiếu không hợp lệ.');
  return value.toLowerCase();
}
export function safeHref(value: unknown) {
  const url = field(value, 500, true);
  if (/[\\\s\u0000-\u001f]/.test(url)) throw new AccessError(400, 'Liên kết không hợp lệ.');
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
  } catch {}
  throw new AccessError(400, 'Chỉ dùng liên kết nội bộ hoặc HTTPS.');
}
export function versionInput(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value >= 2147483647) throw new AccessError(400, 'Phiên bản không hợp lệ.');
  return value;
}
export function contentInput(value: unknown, kind: CmsKind) {
  const data = record(value);
  if (!Array.isArray(data.blocks) || data.blocks.length > 40) throw new AccessError(400, 'Tối đa 40 khối nội dung.');
  const blocks = data.blocks.map((value): Block => {
    const block = record(value);
    switch (block.type) {
      case 'heading': case 'paragraph': case 'quote': case 'list':
        return {type: block.type, text: field(block.text, block.type === 'heading' ? 180 : 4000)};
      case 'link': return {type: 'link', text: field(block.text, 180), href: block.href === '' ? '' : safeHref(block.href)};
      case 'image': return {type: 'image', mediaId: block.mediaId === '' ? '' : uuid(block.mediaId), alt: field(block.alt, 250), caption: field(block.caption ?? '', 250)};
      default: throw new AccessError(400, 'Khối nội dung không được hỗ trợ.');
    }
  });
  const slug = slugInput(data.slug);
  const policySlug = /(^|-)(terms|privacy|policy|policies|dieu-khoan|chinh-sach)(-|$)/.test(slug);
  return {
    slug, title: field(data.title, 180, true), summary: field(data.summary ?? '', 500),
    seoTitle: field(data.seoTitle ?? '', 100), seoDescription: field(data.seoDescription ?? '', 200),
    blocks, categoryId: kind === 'news' && data.categoryId ? uuid(data.categoryId) : null,
    featuredMediaId: data.featuredMediaId ? uuid(data.featuredMediaId) : null,
    featuredAlt: field(data.featuredAlt ?? '', 250), isPolicy: kind === 'page' && (data.isPolicy === true || policySlug),
  };
}
export type CmsInput = ReturnType<typeof contentInput>;
export function mediaIds(input: CmsInput) {
  return [...new Set([input.featuredMediaId, ...input.blocks.flatMap(block => block.type === 'image' ? [block.mediaId] : [])].filter((id): id is string => Boolean(id)))];
}
export function validatePublication(input: CmsInput, kind: CmsKind) {
  if (input.isPolicy) throw new AccessError(409, 'Chính sách cần quy trình duyệt riêng trước khi xuất bản.');
  if (!input.title.trim()) throw new AccessError(400,'Nhập tiêu đề trước khi xuất bản.');
  if (!input.summary.trim()) throw new AccessError(400,'Nhập tóm tắt ở phần Thông tin.');
  if (kind==='news'&&!input.categoryId) throw new AccessError(400,'Chọn hoặc tạo danh mục cho bài viết.');
  if (input.featuredMediaId&&!input.featuredAlt.trim()) throw new AccessError(400,'Nhập mô tả ảnh đại diện.');
  if (!input.blocks.some(block=>(block.type==='paragraph'||block.type==='list'||block.type==='quote')&&block.text.trim())) {
    throw new AccessError(400,'Thêm một đoạn văn, danh sách hoặc trích dẫn ở phần Soạn nội dung.');
  }
  input.blocks.forEach((block,index)=>{
    const label='Khối '+(index+1);
    if (block.type==='image'&&(!block.mediaId||!block.alt.trim())) throw new AccessError(400,label+': chọn ảnh và nhập mô tả.');
    if ('text' in block&&!block.text.trim()) throw new AccessError(400,label+': nhập nội dung hoặc bỏ khối trống.');
    if (block.type==='link'&&!block.href.trim()) throw new AccessError(400,label+': nhập địa chỉ liên kết.');
  });
}
export const cmsPublicPath = (kind: CmsKind, slug: string) => (kind === 'news' ? '/news/' : '/pages/') + slug;
export const cmsAdminPath = (kind: CmsKind) => kind === 'news' ? '/admin/news' : '/admin/pages';
