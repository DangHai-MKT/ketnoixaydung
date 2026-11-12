import 'server-only';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { paymentEvents, paymentOrders } from '../db/schema';
import { AccessError, type Actor } from '../lib/auth/permissions';
import { matchSepayApi, parseSepayWebhook, receiptHash, sepayAutoCreditStart, sepayLivePaymentTime, sepayLiveProvider, sepayLiveWebhookEvent, verifySepaySignature, type SepayReceipt } from '../lib/finance/sepay';
import { readBoundedBody } from '../lib/seller/http';
import { financeReadActor } from './finance-read-access';
import { sepayConfiguration } from './sepay-settings';
import { confirmSepayLiveTopup } from './payments';

const provider = sepayLiveProvider;
const eventType = sepayLiveWebhookEvent;
const manualProvider = 'manual_bank_transfer';
const liveEvents = and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventType, eventType));

async function verifyLiveReceipt(receipt: SepayReceipt, config: Awaited<ReturnType<typeof sepayConfiguration>>) {
  const url = new URL('https://userapi.sepay.vn/v2/transactions');
  url.search = new URLSearchParams({
    bank_account_id: config.accountId, reference_number: receipt.bankReference, per_page: '2',
  }).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + config.token, Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AccessError(503, 'Chưa kết nối được API SePay Live.');
  }
  if (response.status === 401) throw new AccessError(503, 'SePay Live trả HTTP 401 khi gọi API giao dịch. Kiểm tra API Token Live đã lưu.');
  if (response.status === 403) throw new AccessError(503, 'SePay Live trả HTTP 403 khi gọi API giao dịch từ máy chủ. Kiểm tra quyền truy cập với SePay.');
  if (response.status === 429) throw new AccessError(503, 'SePay Live giới hạn lượt gọi. Thử đối soát lại sau.');
  if (!response.ok) throw new AccessError(503, 'API SePay Live chưa trả về dữ liệu giao dịch.');
  let result: { status?: string; data?: { id: string }[]; meta?: { pagination?: { has_more?: boolean; last_page?: number } } };
  try {
    const stream = new Request('http://localhost', { method: 'POST', body: response.body, duplex: 'half' } as RequestInit);
    result = JSON.parse(new TextDecoder().decode(await readBoundedBody(stream, 64 * 1024)));
  } catch {
    throw new AccessError(503, 'Phản hồi API SePay Live không hợp lệ.');
  }
  const pagination = result?.meta?.pagination;
  if (result?.status !== 'success' || !Array.isArray(result.data) || pagination?.has_more !== false) {
    throw new AccessError(503, 'API SePay Live chưa trả về kết quả đối soát đầy đủ.');
  }
  if (!result.data.length) throw new AccessError(503, 'Giao dịch chưa xuất hiện trên API SePay Live.');
  if (pagination.last_page !== 1 || result.data.length !== 1 || !matchSepayApi(receipt, result.data[0], config.accountId)) {
    throw new AccessError(409, 'Giao dịch từ API không khớp duy nhất với webhook.');
  }
  return result.data[0].id;
}

async function findManualOrder(receipt: SepayReceipt, webhookReceivedAt: Date) {
  if (!receipt.reference) throw new AccessError(409, 'Nội dung chưa có mã đơn nạp duy nhất.');
  const [reference] = await db.select({ orderId: paymentEvents.paymentOrderId }).from(paymentEvents)
    .where(and(eq(paymentEvents.provider, manualProvider), eq(paymentEvents.providerEventId, 'transfer:' + receipt.reference)));
  if (!reference?.orderId) throw new AccessError(409, 'Không tìm thấy đơn nạp thủ công theo mã chuyển khoản.');
  const [row] = await db.select({
    id: paymentOrders.id, amount: paymentOrders.amountVnd, createdAt: paymentOrders.createdAt,
    expiresAt: paymentOrders.expiresAt, snapshot: paymentEvents.payload,
  }).from(paymentOrders).innerJoin(paymentEvents, and(
    eq(paymentEvents.paymentOrderId, paymentOrders.id), eq(paymentEvents.provider, manualProvider),
    eq(paymentEvents.providerEventId, 'order-created:' + reference.orderId),
  )).where(and(eq(paymentOrders.provider, manualProvider), eq(paymentOrders.id, reference.orderId)));
  if (!row) throw new AccessError(409, 'Đơn nạp thiếu thông tin chuyển khoản đã chốt.');
  const bank = row.snapshot.bank as { accountNumber?: string } | undefined;
  if (bank?.accountNumber !== receipt.account || row.amount.toString() !== receipt.amountVnd ||
      row.snapshot.transferReference !== receipt.reference) {
    throw new AccessError(409, 'Tài khoản nhận, số tiền hoặc mã chuyển khoản không khớp đơn nạp.');
  }
  if (!sepayLivePaymentTime(receipt, row, webhookReceivedAt)) {
    throw new AccessError(409, 'Giao dịch đến ngoài thời hạn của đơn nạp.');
  }
  return row;
}

async function reconcile(eventId: string) {
  const [event] = await db.select().from(paymentEvents).where(and(liveEvents, eq(paymentEvents.id, eventId)));
  if (!event) throw new AccessError(404, 'Không tìm thấy webhook SePay Live.');
  if (event.processingStatus === 'processed' || event.processingStatus === 'ignored') return;
  try {
    const config = await sepayConfiguration('live');
    const receipt = event.payload.receipt as SepayReceipt;
    if (!event.signatureValid || !receipt || receiptHash(receipt) !== event.payload.hash) {
      throw new AccessError(409, 'Bằng chứng webhook không nhất quán.');
    }
    if (config.accountId !== event.payload.accountId) throw new AccessError(409, 'Tài khoản SePay Live đã đổi. Cần kiểm tra giao dịch theo cấu hình đã nhận.');
    if (receipt.direction !== 'in' || receipt.account !== config.accountNumber || receipt.bank !== config.bankName) {
      await db.update(paymentEvents).set({ processingStatus: 'ignored', processedAt: new Date(),
        processingError: 'Giao dịch không phải tiền vào đúng tài khoản Live.' }).where(and(liveEvents, eq(paymentEvents.id, eventId)));
      return;
    }
    const apiId = await verifyLiveReceipt(receipt, config);
    const order = await findManualOrder(receipt, event.receivedAt);
    const start = sepayAutoCreditStart(process.env.SEPAY_LIVE_AUTO_CREDIT_FROM);
    if (start && order.createdAt >= start && new Date(receipt.receivedAt) >= start) {
      await confirmSepayLiveTopup(order.id, { eventId, apiId, configurationVersion: config.version, receipt });
      return;
    }
    await db.update(paymentEvents).set({
      paymentOrderId: order.id, processingStatus: 'processed', processedAt: new Date(),
      processingError: null, payload: { ...event.payload, apiId },
    }).where(and(liveEvents, eq(paymentEvents.id, eventId)));
  } catch (error) {
    const message = error instanceof AccessError ? error.message : 'Chưa thể đối soát webhook SePay Live.';
    await db.update(paymentEvents).set({ processingStatus: 'failed', processingError: message })
      .where(and(liveEvents, eq(paymentEvents.id, eventId), ne(paymentEvents.processingStatus, 'processed')));
    if (!(error instanceof AccessError) || error.status >= 500) throw new AccessError(503, message);
  }
}

export async function receiveSepayLiveWebhook(request: Request) {
  const config = await sepayConfiguration('live');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new AccessError(415, 'Webhook cần định dạng application/json.');
  }
  const raw = await readBoundedBody(request, 16 * 1024);
  verifySepaySignature(raw, request.headers, config.secret);
  const receipt = parseSepayWebhook(raw);
  const hash = receiptHash(receipt);
  const providerEventId = 'webhook:' + receipt.eventId;
  const [inserted] = await db.insert(paymentEvents).values({
    provider, eventType, providerEventId, signatureValid: true, processingStatus: 'received',
    payload: { receipt, hash, accountId: config.accountId, configurationVersion: config.version },
  }).onConflictDoNothing().returning({ id: paymentEvents.id, payload: paymentEvents.payload });
  const [event] = inserted ? [inserted] : await db.select({ id: paymentEvents.id, payload: paymentEvents.payload })
    .from(paymentEvents).where(and(liveEvents, eq(paymentEvents.providerEventId, providerEventId)));
  if (!event) throw new AccessError(503, 'Chưa lưu được webhook SePay Live.');
  if (event.payload.hash !== hash) throw new AccessError(409, 'Mã webhook đã tồn tại với dữ liệu khác.');
  await reconcile(event.id);
  return { success: true };
}

export async function retrySepayLiveEvent(actor: Actor, id: string) {
  await db.transaction(tx => financeReadActor(tx, actor), { accessMode: 'read only' });
  await reconcile(id);
  const [event] = await db.select({ status: paymentEvents.processingStatus }).from(paymentEvents)
    .where(and(liveEvents, eq(paymentEvents.id, id)));
  return { ok: event?.status === 'processed' };
}

export async function listSepayLiveEvents(actor: Actor, page: number) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new AccessError(400, 'Trang không hợp lệ.');
  return db.transaction(async tx => {
    await financeReadActor(tx, actor);
    const rows = await tx.select().from(paymentEvents).where(liveEvents)
      .orderBy(desc(paymentEvents.receivedAt), desc(paymentEvents.id)).limit(21).offset((page - 1) * 20);
    return { page, hasMore: rows.length > 20, rows: rows.slice(0, 20).map(row => {
      const receipt = row.payload.receipt as SepayReceipt | undefined;
      return { id: row.id, status: row.processingStatus, error: row.processingError, orderId: row.paymentOrderId,
        creditOutcome: row.payload.creditOutcome === 'credited' ? 'credited' : row.payload.creditOutcome === 'already_paid' ? 'already_paid' : null,
        receivedAt: row.receivedAt, amountVnd: receipt?.amountVnd ?? '0', reference: receipt?.reference,
        bankReference: receipt?.bankReference, accountLast4: receipt?.account.slice(-4) };
    }) };
  }, { accessMode: 'read only' });
}
