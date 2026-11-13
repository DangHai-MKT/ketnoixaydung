import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { AccessError } from '../lib/auth/permissions';
import { requirePageActor } from '../lib/auth/server';
import { requireVerifiedSeller } from '../lib/seller/server';
import { formatNotificationDate } from '../lib/notifications/contracts';
import { purchasedProjectPath } from '../lib/projects/purchased-path';
import { chatPath, type ChatSide } from '../lib/projects/purchase-chat';
import { sendChatAction } from '../lib/projects/purchase-chat-actions';
import { readPurchaseChat } from '../services/purchase-chat';
import { DashboardPanel } from './DashboardPanels';
import { IdentityHeader } from './PhaseOneUI';
import PurchaseChatForm from './PurchaseChatForm';

export default async function PurchaseChat({ id, side, page }: { id: string; side: ChatSide; page?: string | string[] }) {
  const buyer = side === 'buyer';
  const path = chatPath(side, id);
  const actor = buyer ? await requirePageActor(path, ['buyer']) : (await requireVerifiedSeller()).actor;
  const pageNo = typeof page === 'string' && /^[1-9]\d{0,3}$/.test(page) ? Number(page) : 1;
  const thread = await readPurchaseChat(actor, side, id, pageNo).catch(error => {
    if (error instanceof AccessError && [400, 404].includes(error.status)) notFound();
    if ((error as { cause?: { code?: string } })?.cause?.code === '42P01') return null;
    throw error;
  });
  if (!thread) return <main className="fw-page">
    <h1>Trao đổi về dự án</h1>
    <p role="status">Kênh trao đổi chưa sẵn sàng. Vui lòng quay lại sau.</p>
    <a href={buyer ? '/account/purchases' : '/seller/transactions'}>Về lịch sử giao dịch</a>
  </main>;
  const { order, messages, hasOlder } = thread;
  return <main className="fw-page purchase-chat">
    <IdentityHeader rootHref={buyer ? '/account/purchases' : '/seller/transactions'}
      rootLabel={buyer ? 'Dự án đã mua' : 'Lịch sử bán'} title={buyer ? 'Trao đổi với người bán' : 'Trao đổi với người mua'}
      description={`${order.title} · Phiên bản ${order.version}`} />
    <DashboardPanel title="Cuộc trò chuyện" icon="file">
      <div className="fw-actions">
        <a href={path + '#tin-nhan-moi'}>Tải tin mới</a>
        {buyer && order.status === 'completed' && <a href={purchasedProjectPath(order.projectId, id) + '#thong-tin-da-mua'}>Xem thông tin đã mua</a>}
        {pageNo > 1 && <a href={path + '?page=' + (pageNo - 1)}>Tin gần đây hơn</a>}
        {hasOlder && pageNo < 9999 && <a href={path + '?page=' + (pageNo + 1)}>Tin cũ hơn</a>}
      </div>
      {messages.length ? <ol className="purchase-chat-thread" aria-label="Lịch sử tin nhắn">
        {messages.map(message => <li key={message.id} className={message.senderId === actor.id ? 'is-mine' : undefined}>
          <header><strong>{message.senderId === actor.id ? 'Bạn' : buyer ? 'Người bán' : 'Người mua'}</strong>
            <time dateTime={message.createdAt.toISOString()}>{formatNotificationDate(message.createdAt.toISOString())}</time></header>
          <p>{message.body}</p>
        </li>)}
      </ol> : <p>{pageNo === 1 ? 'Chưa có tin nhắn. Bạn có thể hỏi về đầu mối liên hệ, tiến độ hoặc cách gửi hồ sơ năng lực.' : 'Trang này chưa có tin nhắn.'}</p>}
      <div id="tin-nhan-moi">
        {order.status === 'completed' ? <PurchaseChatForm action={sendChatAction.bind(null, side, id, randomUUID())} buyer={buyer} />
          : <p className="fw-info">Đơn mua hiện chỉ cho phép xem lịch sử trao đổi.</p>}
      </div>
    </DashboardPanel>
  </main>;
}
