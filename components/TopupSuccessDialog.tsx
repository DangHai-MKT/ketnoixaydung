'use client';

import { useEffect, useId, useRef } from 'react';
import { pointText } from '../lib/finance/labels';
import styles from './TopupSuccessDialog.module.css';

export default function TopupSuccessDialog({ orderId, points }: { orderId: string; points: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const shownOrder = useRef<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open || shownOrder.current === orderId) return;
    const storageKey = `topup-success-shown:${orderId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch { /* The dialog also works with browser storage disabled. */ }
    element.showModal();
    shownOrder.current = orderId;
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch { /* The component still tracks the current order. */ }
  }, [orderId]);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}>
    <div className={styles.header}>
      <span className={styles.check} aria-hidden="true" />
      <h2 id={titleId}>Chúc mừng, bạn đã nạp điểm thành công!</h2>
    </div>
    <div className={styles.body}>
      <p id={descriptionId} className={styles.amount}>
        <span>Đã cộng vào ví</span>
        <strong>+{pointText(points)}</strong>
      </p>
      <div className={styles.actions}>
        <a className={styles.primary} href="/account/wallet" autoFocus>Xem tổng điểm <span aria-hidden="true">→</span></a>
        <button className={styles.close} type="button" onClick={() => dialog.current?.close()}>Đóng</button>
      </div>
    </div>
  </dialog>;
}
