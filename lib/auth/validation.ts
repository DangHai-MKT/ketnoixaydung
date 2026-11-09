export function safeReturnTo(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  // Decode to reject encoded slashes/backslashes and control characters as well.
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
    const url = new URL(value, 'https://marketplace.invalid');
    if (url.origin !== 'https://marketplace.invalid' || url.pathname.startsWith('//') || /^\/(login|register)(\/|$)/.test(decodeURIComponent(url.pathname))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export type RegistrationIntent = 'buyer' | 'seller';
export function initialRegistrationIntent(next: string | null | undefined): RegistrationIntent {
  const destination = safeReturnTo(next, '/workspace').split(/[?#]/)[0];
  return destination === '/become-seller' || destination === '/seller' || destination.startsWith('/seller/') ? 'seller' : 'buyer';
}
export function registrationDestination(intent: RegistrationIntent, next: string | null | undefined): string {
  if (intent === 'seller') return '/become-seller';
  // An explicit buyer choice overrides a previously requested onboarding journey.
  return initialRegistrationIntent(next) === 'seller' ? '/workspace' : safeReturnTo(next, '/workspace');
}

export function validateCredentials(email: string, password: string, name?: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return 'Vui lòng nhập email hợp lệ.';
  if (password.length < 8 || password.length > 128) return 'Mật khẩu phải có từ 8 đến 128 ký tự.';
  if (name !== undefined && (!name.trim() || name.trim().length > 200)) return 'Tên hiển thị phải có từ 1 đến 200 ký tự.';
  return null;
}
