import type { ApplicationView } from '../lib/seller/types';
import { documentLabels, stateLabels, type DocumentType } from '../lib/seller/workflow';

const events: Record<string, string> = {
  'seller.review.manual_approve': 'Admin xác thực thủ công và mở quyền bán',
  'seller.application.created': 'Tạo hồ sơ', 'seller.application.draft_saved': 'Lưu thông tin',
  'seller.application.submitted': 'Gửi xét duyệt', 'seller.application.resubmitted': 'Gửi lại hồ sơ',
  'seller.document.uploaded': 'Bổ sung tài liệu', 'seller.document.replaced': 'Thay thế tài liệu',
  'seller.review.approve': 'Phê duyệt hồ sơ', 'seller.review.reject': 'Từ chối hồ sơ',
  'seller.review.request_changes': 'Yêu cầu bổ sung', 'seller.review.suspend': 'Tạm đình chỉ người bán',
};
function date(value: string | null) { return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có'; }

export default function SellerApplicationStatus({ application, reviewer = false }: { application: ApplicationView; reviewer?: boolean }) {
  const { profile } = application;
  const manuallyApproved=application.state==='verified'&&application.history[0]?.action==='seller.review.manual_approve';
  return <section className="seller-status" aria-label="Thông tin hồ sơ">
    <div className="seller-status-heading"><h2>{profile.legalName}</h2><span className="seller-badge">{stateLabels[application.state]}</span></div>
    <>{manuallyApproved&&<p className="identity-success">Admin đã xác thực thủ công hồ sơ và quyền bán. Bạn có thể sử dụng khu vực người bán, không phụ thuộc xác minh email.</p>}</><dl className="seller-details">
      <dt>Loại người bán</dt><dd>{profile.sellerType === 'business' ? 'Doanh nghiệp' : 'Cá nhân'}</dd>
      <dt>Ngày gửi gần nhất</dt><dd>{date(profile.verificationSubmittedAt)}</dd>
      <dt>Ngày xét duyệt gần nhất</dt><dd>{date(profile.reviewedAt)}</dd>
      <dt>Email liên hệ</dt><dd>{profile.contactEmail || 'Chưa bổ sung'}</dd>
      <dt>Điện thoại</dt><dd>{profile.contactPhone || 'Chưa bổ sung'}</dd>
      <dt>Địa chỉ</dt><dd>{profile.contactAddress || 'Chưa bổ sung'}</dd>
      {profile.sellerType === 'business' && <>
        <dt>Mã đăng ký doanh nghiệp</dt><dd>{profile.businessRegistrationNo || 'Chưa bổ sung'}</dd>
        <dt>Mã số thuế</dt><dd>{profile.taxCode || 'Chưa bổ sung'}</dd>
        <dt>Người đại diện</dt><dd>{profile.authorizedRepresentative || 'Chưa bổ sung'}</dd>
      </>}
    </dl>
    {profile.reviewReason && <div className="seller-feedback"><h3>Phản hồi xét duyệt</h3><p>{profile.reviewReason}</p></div>}
    {application.state === 'suspended' && <p role="status">Quyền thao tác người bán đang bị tạm đình chỉ. Vui lòng chờ quản trị viên hướng dẫn; bạn không thể tự kích hoạt lại.</p>}
    {application.missing.length > 0 && <div><h3>{manuallyApproved?'Thông tin bổ sung (không khóa quyền đã duyệt)':'Thông tin cần hoàn thiện'}</h3><ul>{application.missing.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <h3>Tài liệu đang sử dụng</h3>
    {application.documents.length ? <ul className="seller-documents">{application.documents.map((doc) => <li key={doc.id}>
      <a href={`/api/seller/documents/${doc.id}`}>{documentLabels[doc.documentType as DocumentType] || 'Tài liệu'} — {doc.originalFilename}</a>
      <span> ({Math.ceil(Number(doc.sizeBytes) / 1024)} KB; {doc.status === 'accepted' ? 'đã chấp nhận' : doc.status === 'rejected' ? 'bị từ chối' : 'chờ kiểm tra'})</span>
    </li>)}</ul> : <p>Chưa có tài liệu.</p>}
    {application.archivedDocuments.length > 0 && <details><summary>Tài liệu đã được thay thế</summary><ul>{application.archivedDocuments.map((doc) => <li key={doc.id}><a href={`/api/seller/documents/${doc.id}`}>{doc.originalFilename}</a></li>)}</ul></details>}
    <details><summary>Lịch sử xử lý</summary><ol>{application.history.map((event) => <li key={event.id}>{date(event.createdAt)} — {events[event.action] || 'Cập nhật hồ sơ'}</li>)}</ol></details>
    {!reviewer && application.notifications.length > 0 && <details><summary>Thông báo của bạn</summary><ul>{application.notifications.map((notice) => <li key={notice.id}>{date(notice.createdAt)} — {notice.body}</li>)}</ul></details>}
  </section>;
}
