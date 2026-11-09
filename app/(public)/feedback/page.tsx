import FeedbackForm from '../../../components/FeedbackForm';
import { IdentityHeader, IdentityPanel } from '../../../components/PhaseOneUI';
import { requirePageActor } from '../../../lib/auth/server';

export const metadata = { title: 'Góp ý trải nghiệm | Kết Nối Xây Dựng', robots: { index: false, follow: false } };

export default async function FeedbackPage() {
  await requirePageActor('/feedback');
  return <main className="identity-page site-feedback-page">
    <IdentityHeader rootHref="/" rootLabel="Trang chủ" title="Góp ý trải nghiệm"
      description="Một đánh giá ngắn giúp chúng tôi biết phần nào cần cải thiện trong phiên bản tiếp theo."/>
    <IdentityPanel title="Chia sẻ ý kiến"><FeedbackForm/></IdentityPanel>
  </main>;
}
