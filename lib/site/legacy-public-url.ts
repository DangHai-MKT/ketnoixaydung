export function legacyPublicResponse(path:string|null,search:string,kind:'project'|'company') {
  if(path)return new Response(null,{status:308,headers:{Location:path+search,'Cache-Control':'private, no-store'}});
  const back=kind==='project'?'/projects':'/find-partners';
  return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Không tìm thấy nội dung</title><main><h1>Không tìm thấy nội dung</h1><p>Nội dung chưa công bố hoặc không còn khả dụng.</p><a href="'+back+'">Quay lại danh sách</a></main></html>',{status:404,headers:{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex','Cache-Control':'private, no-store'}});
}
