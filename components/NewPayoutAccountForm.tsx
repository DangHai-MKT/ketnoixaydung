'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { vietnamBanks } from '../lib/finance/banks';

const banks = [...vietnamBanks].sort((a, b) => a.label.localeCompare(b.label, 'vi'));

export default function NewPayoutAccountForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accountId, setAccountId] = useState('');
  const keys = useRef<{ account: string; document: string } | null>(null);
  const saved = useRef('');

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const bank = banks.find(item => item.bin === values.get('bank'));
    const file = values.get('file');
    const password = values.get('password');
    if (!bank || !(file instanceof File) || !file.size || file.size > 5242880 || !['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Chọn ngân hàng và ảnh PNG hoặc JPEG tối đa 5 MB.');
      return;
    }
    keys.current ??= { account: crypto.randomUUID(), document: crypto.randomUUID() };
    const request = keys.current;
    setBusy(true);
    setError('');
    try {
      if (!saved.current) {
        const response = await fetch('/api/payout-accounts?workspace=seller', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bankName: bank.label, bankCode: bank.bin, accountHolder: values.get('holder'),
            accountNumber: values.get('bankAccountNumber'), password, idempotencyKey: request.account }),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Chưa lưu được tài khoản.');
        saved.current = result.id;
        setAccountId(result.id);
      }
      const data = new FormData();
      data.set('file', file);
      data.set('password', String(password));
      data.set('kind', 'account_ownership');
      data.set('caption', 'Ảnh xác nhận chủ tài khoản nhận tiền.');
      data.set('expectedRevision', '1');
      data.set('idempotencyKey', request.document);
      const response = await fetch(`/api/payout-accounts/${saved.current}/documents?workspace=seller`, { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Chưa tải được ảnh xác minh.');
      router.replace('/seller/payout-accounts/' + saved.current);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kết nối bị gián đoạn. Vui lòng thử lại.');
    } finally {
      const input = form.elements.namedItem('password');
      if (input instanceof HTMLInputElement) input.value = '';
      setBusy(false);
    }
  }

  return <form className="fw-form payout-form payout-simple-form" onSubmit={send} onChange={event => {
    const target: EventTarget = event.target;
    const name = target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.name : '';
    if (!busy && !saved.current && ['bank', 'holder', 'bankAccountNumber'].includes(name)) keys.current = null;
    if (!busy && name === 'file' && keys.current) keys.current.document = crypto.randomUUID();
  }}>
    <fieldset disabled={busy || !!accountId}>
      <label>Ngân hàng<select name="bank" defaultValue="" required><option value="" disabled>Chọn ngân hàng</option>
        {banks.map(bank => <option key={bank.bin} value={bank.bin}>{bank.label} — {bank.name}</option>)}
      </select></label>
      <label>Chủ tài khoản<input name="holder" autoComplete="off" required minLength={2} maxLength={200} placeholder="Tên hiển thị trong ứng dụng ngân hàng" /></label>
      <label>Số tài khoản<input name="bankAccountNumber" type="text" inputMode="numeric" pattern="[0-9]{6,34}"
        autoComplete="off" required maxLength={34} placeholder="Chỉ nhập chữ số" /></label>
    </fieldset>
    <label>Ảnh xác nhận tài khoản<input name="file" type="file" accept="image/png,image/jpeg" disabled={busy} required />
      <small>Chụp màn hình phần thông tin tài khoản trong ứng dụng ngân hàng, có tên chủ tài khoản và số tài khoản. PNG hoặc JPEG, tối đa 5 MB.</small>
    </label>
    <label>Mật khẩu đăng nhập website<input name="password" type="password" autoComplete="current-password" disabled={busy} required minLength={8} maxLength={128} /></label>
    <button className="dash-primary" disabled={busy}>{busy ? 'Đang gửi hồ sơ…' : accountId ? 'Gửi lại ảnh xác minh' : 'Gửi xác minh tài khoản'}</button>
    {error && <p role="alert">{error}</p>}
    {accountId && error && <a href={'/seller/payout-accounts/' + accountId}>Mở tài khoản đã lưu để bổ sung ảnh</a>}
  </form>;
}
