import 'server-only';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { notifications, userRoles, users } from '../db/schema';
import { AccessError, type Actor } from '../lib/auth/permissions';
import { safeErrorCode } from '../lib/auth/error-diagnostics';
import { settlementId } from '../lib/finance/settlement';
import { listAutomaticReleaseCandidates, releaseEarning } from './settlements';
import { payoutOperationsEnabled } from './settlement-core';
import { payoutFinanceRoles } from './payout-base';

const interval = 15 * 60_000;
const reason = 'Hệ thống tự động giải phóng thu nhập đã đến hạn.';
const alertType = 'earning.auto_release_review';
const advisoryKey = 671280615;
let started = false;

function errorCode(error: unknown) {
  return error instanceof AccessError ? `ACCESS_${error.status}` : safeErrorCode(error);
}

async function alertFinance(earningId: string) {
  await db.transaction(async tx => {
    const staff = await tx.selectDistinct({ id: users.id }).from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .where(and(eq(users.status, 'active'), inArray(userRoles.role, payoutFinanceRoles),
        ne(users.id, sql`(SELECT seller_id FROM seller_earnings WHERE id=${earningId})`),
        sql`NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id=${users.id}
          AND n.type=${alertType} AND n.data->>'earningId'=${earningId})`));
    if (staff.length) await tx.insert(notifications).values(staff.map(({ id }) => ({
      userId: id, type: alertType, title: 'Khoản thu nhập cần đối soát',
      body: 'Một khoản đến hạn chưa thể tự giải phóng. Mở danh sách để kiểm tra mã khoản thu ' + earningId + '.',
      data: { href: '/admin/earnings', earningId },
    })));
  });
}

export function startEarningsRelease(actorId: string) {
  if (started) return;
  let id: string;
  try { id = settlementId(actorId); }
  catch { console.error('[earnings-release] INVALID_ACTOR_ID'); return; }
  started = true;
  const actor: Actor = { id, status: 'active', roles: [], email: '', displayName: 'Tác vụ giải phóng thu nhập' };
  let cursor: string | null = null;

  async function tick() {
    let stage = 'check-configuration';
    try {
      if (!payoutOperationsEnabled()) {
        console.warn('[earnings-release] PAYOUT_OPERATIONS_DISABLED');
        return;
      }
      stage = 'connect';
      const client = await pool.connect();
      let locked = false;
      try {
        stage = 'lock';
        const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [advisoryKey]);
        locked = lock.rows[0].locked === true;
        if (!locked) return;
        stage = 'list-candidates';
        const rows = await listAutomaticReleaseCandidates(actor, cursor);
        let released = 0;
        let failed = 0;
        const deadline = Date.now() + 60_000;
        let processed = 0;
        for (const row of rows) {
          if (Date.now() >= deadline) break;
          try {
            if (!(await releaseEarning(actor, row.id, reason)).reused) released++;
          } catch (error) {
            failed++;
            console.warn('[earnings-release] ITEM_FAILED', { code: errorCode(error) });
            try { await alertFinance(row.id); }
            catch (alertError) {
              console.error('[earnings-release] ALERT_FAILED', { code: errorCode(alertError) });
            }
          }
          cursor = row.id;
          processed++;
        }
        if (processed === rows.length && rows.length < 50) cursor = null;
        console.info('[earnings-release] DONE', { released, failed });
      } finally {
        try {
          if (locked) await client.query('SELECT pg_advisory_unlock($1)', [advisoryKey]);
          client.release();
        } catch {
          client.release(true);
        }
      }
    } catch (error) {
      console.error('[earnings-release] FAILED', { stage, code: errorCode(error) });
    } finally {
      setTimeout(() => void tick(), interval).unref();
    }
  }
  console.info('[earnings-release] ENABLED');
  void tick();
}
