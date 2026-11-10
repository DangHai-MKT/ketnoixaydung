export function isSameOrigin(request: Request, publicUrl = process.env.BETTER_AUTH_URL): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  // The request URL can contain an internal host or protocol behind a reverse proxy.
  // Prefer the configured browser-facing origin over request-controlled proxy headers.
  try {
    const expected = new URL(publicUrl?.trim() || request.url);
    return (expected.protocol === 'http:' || expected.protocol === 'https:')
      && origin === expected.origin;
  } catch {
    return false;
  }
}
