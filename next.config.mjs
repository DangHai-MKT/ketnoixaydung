import nextConstants from 'next/constants.js';

// Keep integration-test output separate from an owner's running development server.
const isolatedAuthTest = process.env.CONSTRUCTION_AUTH_TEST === '1';
if (isolatedAuthTest) {
  const database = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (database !== 'construction_marketplace_migration_test') throw new Error('Auth test requires the approved isolated database.');
}

const config = isolatedAuthTest ? {
  distDir: process.env.CONSTRUCTION_WATCH_PREVIEW === '1' ? '.next-watch-preview' : process.env.CONSTRUCTION_EMAIL_PREVIEW === '1' ? '.next-email-preview' : process.env.CONSTRUCTION_CMS_INTEGRATION === '1' ? '.next-cms-integration' : process.env.CONSTRUCTION_SETTINGS_TEST === '1' ? '.next-settings-test' : process.env.CONSTRUCTION_PROJECT_TEST === '1' ? '.next-project-test' : process.env.CONSTRUCTION_SELLER_TEST === '1' ? '.next-seller-test' : '.next-auth-test',
  typescript: { tsconfigPath: process.env.CONSTRUCTION_SETTINGS_TEST === '1' ? 'tsconfig.settings-test.json' : process.env.CONSTRUCTION_PROJECT_TEST === '1' ? 'tsconfig.project-test.json' : process.env.CONSTRUCTION_SELLER_TEST === '1' ? 'tsconfig.seller-test.json' : 'tsconfig.auth-test.json' },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Construction-Auth-Test', value: process.env.CONSTRUCTION_AUTH_TEST_RUN_ID ?? 'unverified' }] }];
  },
} : {};

export default async function nextConfig(phase) {
  if (phase === nextConstants.PHASE_PRODUCTION_SERVER && process.env.STAGING_ADMIN_BOOTSTRAP) {
    const { runStagingAdminBootstrap } = await import('./scripts/bootstrap-staging-admin.mjs');
    await runStagingAdminBootstrap();
  }
  if (phase === nextConstants.PHASE_PRODUCTION_SERVER && process.env.STAGING_BOOTSTRAP) {
    const { runStagingBootstrap } = await import('./scripts/bootstrap-staging.mjs');
    try {
      await runStagingBootstrap();
    } catch (error) {
      console.error('[staging-bootstrap] ' + error.message);
      throw error;
    }
  }
  return config;
}
