
import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

if (process.env.NODE_ENV === 'development') {
  const databaseUrl = new URL(connectionString);

  console.info(
    '[Database Connection]',
    JSON.stringify({
      database: databaseUrl.pathname.replace(/^\//, ''),
      host: databaseUrl.hostname,
      port: databaseUrl.port || '5432',
    })
  );
}

const pool = new Pool({
  connectionString,
  password: process.env.PGPASSWORD || undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export const db = drizzle(pool, { schema });
export { pool };

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
