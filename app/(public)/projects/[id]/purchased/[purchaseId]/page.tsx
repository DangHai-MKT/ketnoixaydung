import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import ProjectParticipantCards from '../../../../../../components/ProjectParticipantCards';
import PublicProjectDetail from '../../../../../../components/PublicProjectDetail';
import Icon from '../../../../../../components/MarketplaceIcon';
import { AccessError } from '../../../../../../lib/auth/permissions';
import { requirePageActor } from '../../../../../../lib/auth/server';
import { purchasedProjectPath } from '../../../../../../lib/projects/purchased-path';
import { privateLabels } from '../../../../../../lib/projects/workflow';
import { getOwnPurchasedProject } from '../../../../../../services/purchase-access';
import { chatPath } from '../../../../../../lib/projects/purchase-chat';
import ProjectContactActions from '../../../../../../components/ProjectContactActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Thông tin dự án đã mua',
  robots: { index: false, follow: false },
};

export default async function PurchasedProjectPage({ params }: { params: Promise<{ id: string; purchaseId: string }> }) {
  const { id, purchaseId } = await params;
  const actor = await requirePageActor(purchasedProjectPath(id, purchaseId), ['buyer']);
  const result = await getOwnPurchasedProject(actor, id, purchaseId).catch(error => {
    if (error instanceof AccessError && [400, 403, 404].includes(error.status)) notFound();
    throw error;
  });
  const { receipt, project } = result;
  if (!project || !receipt.privateData) redirect('/account/purchases/' + receipt.id);
  const fields = Object.entries(privateLabels).flatMap(([key, label]) => {
    const value = receipt.privateData?.[key];
    return value?.trim() ? [{ key, label, value }] : [];
  });

  return <main className="p2-market p2-public-detail">
    <nav className="p2-breadcrumb" aria-label="Đường dẫn">
      <a href="/">Trang chủ</a><span>/</span><a href="/projects">Dự án</a><span>/</span>
      <span aria-current="page">Thông tin đã mua</span>
    </nav>
    <PublicProjectDetail project={project} purchasePanel={<>
      <a className="button button-primary" href="#thong-tin-da-mua">Xem nội dung đã mở khóa</a>
      <p className="p2-note">Bạn đang xem đúng phiên bản đã mua.</p>
    </>} unlockedContent={
      <section className="pd-surface pd-unlocked" id="thong-tin-da-mua" aria-labelledby="pd-unlocked-title">
        <div className="pd-section-head pd-unlocked-head">
          <div className="pd-unlocked-title">
            <span className="pd-unlocked-symbol"><Icon name="unlock" size={23}/></span>
            <div><h2 id="pd-unlocked-title">Thông tin đã mở khóa</h2><p>Dành riêng cho người mua</p></div>
          </div>
          <span className="pd-unlocked-version">Phiên bản {receipt.versionNo}</span>
        </div>
        {fields.length ? <dl className="pd-facts">{fields.map(({ key, label, value }) =>
          <div key={key}><dt>{label}</dt><dd className="pd-description">{value}</dd></div>
        )}</dl> : <p>Phiên bản này chưa có thông tin bổ sung.</p>}
        <section className="purchase-access-next">
          <h3>Bắt đầu tiếp cận dự án</h3>
          <p>Xem vai trò của từng đơn vị trong hồ sơ. Nếu chưa rõ nên liên hệ ai trước hoặc cần hỏi cách gửi báo giá, hãy trao đổi với người bán.</p>
          <div className="fw-actions"><a className="dash-primary" href={chatPath('buyer', receipt.id)}>Trao đổi với người bán</a></div>
          <ProjectContactActions phone={receipt.privateData.contactPhone} email={receipt.privateData.contactEmail} />
          <ProjectParticipantCards participants={receipt.participants} showContactActions />
        </section>
        <h3>Tài liệu được cấp quyền</h3>
        {receipt.files.length ? <ul>{receipt.files.map(file => <li key={file.id}><a href={file.url}>{file.label}</a></li>)}</ul>
          : <p>Phiên bản này không có tệp đính kèm.</p>}
        <div className="pd-unlocked-actions">
          <a href={'/account/purchases/' + receipt.id}><Icon name="file" size={18}/>Xem chi tiết đơn mua</a>
          <a className="pd-report-action" href={'/account/disputes/new?purchaseId=' + receipt.id}><Icon name="flag" size={18}/>Báo cáo tin sai hoặc trùng</a>
        </div>
      </section>
    } />
  </main>;
}
