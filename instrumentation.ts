export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production' ||
      process.env.CONSTRUCTION_AUTH_TEST === '1' || !process.env.SELLER_EARNINGS_AUTO_RELEASE_ACTOR_ID) return;
  const { startEarningsRelease } = await import('./services/automatic-earnings-release');
  startEarningsRelease(process.env.SELLER_EARNINGS_AUTO_RELEASE_ACTOR_ID);
}
