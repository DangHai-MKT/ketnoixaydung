import { siteIdentity } from '../site/navigation';
import 'server-only';
import {getEmailDelivery} from '../settings/email';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
function testMailbox() {
    if (process.env.NODE_ENV !== 'development' || process.env.CONSTRUCTION_AUTH_TEST !== '1' || !process.env.CONSTRUCTION_AUTH_TEST_RUN_ID)
        return null;
    try {
        const url = new URL(process.env.DATABASE_URL || '');
        if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || decodeURIComponent(url.pathname.slice(1)) !== 'construction_marketplace_migration_test')
            return null;
    }
    catch {
        return null;
    }
    return resolve('tmp', 'identity-test-mail', process.env.CONSTRUCTION_AUTH_TEST_RUN_ID);
}
export async function emailConfigured() {
    if (testMailbox()) return true;
    try { return Boolean(await getEmailDelivery()); }
    catch { return false; }
}
export async function sendIdentityEmail(to: string, url: string, kind: 'reset' | 'verify') {
    const mailbox = testMailbox();
    if (mailbox) {
        await mkdir(mailbox, { recursive: true });
        await writeFile(resolve(mailbox, `${createHash('sha256').update(to).digest('hex')}-${kind}.json`), JSON.stringify({ url }), { mode: 0o600 });
        return;
    }
    const delivery = await getEmailDelivery();
    if (!delivery) throw new Error('Dịch vụ email chưa được cấu hình.');
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${delivery.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: delivery.from, to: [to], subject: kind === 'reset' ? `Đặt lại mật khẩu ${siteIdentity.name}` : `Xác minh email ${siteIdentity.name}`, text: `${kind === 'reset' ? 'Bạn đã yêu cầu đặt lại mật khẩu. Liên kết có hiệu lực 15 phút.' : 'Xác minh địa chỉ email của bạn.'}\n\n${url}\n\nNếu không phải bạn yêu cầu, hãy bỏ qua email này.` }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
        console.warn('Resend từ chối gửi email tài khoản.', { status: response.status, kind });
        throw new Error('Không thể gửi email lúc này.');
    }
}
