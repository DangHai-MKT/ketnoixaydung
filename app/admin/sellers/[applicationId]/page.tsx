import { notFound } from 'next/navigation';
import { requirePageActor } from '../../../../lib/auth/server';
import { sellerReviewRoles } from '../../../../lib/seller/workflow';
import SellerReviewForm from '../../../../components/SellerReviewForm';

export default async function ReviewSellerPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const actor = await requirePageActor(`/admin/sellers/${applicationId}`, sellerReviewRoles);
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) notFound();
  return <main className="account-page seller-page"><h1>Chi tiết hồ sơ người bán</h1><p><a href="/admin/sellers">Về danh sách xét duyệt</a></p><SellerReviewForm applicationId={applicationId} reviewerId={actor.id} /></main>;
}
