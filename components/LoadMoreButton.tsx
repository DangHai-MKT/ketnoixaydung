export default function LoadMoreButton({remaining,label,busy,error,onClick}:{
  remaining:number;label:string;busy:boolean;error:string;onClick:()=>void;
}) {
  return <div className="load-more" aria-busy={busy}>
    <button type="button" disabled={busy} onClick={onClick}>
      {busy?'Đang tải…':error?'Thử tải lại':`Xem thêm ${remaining.toLocaleString('vi-VN')} ${label}`}
      {!busy&&<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg>}
    </button>
    {error&&<p role="alert">{error}</p>}
  </div>;
}
