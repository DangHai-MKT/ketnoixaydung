
import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL;

if (process.env.NODE_ENV === 'development' && connectionString) {
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

const databasePool = new Pool({
  connectionString,
  password: process.env.PGPASSWORD || undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Next.js imports server modules while building, before runtime secrets are supplied.
// Validate before the first actual query or connection, including direct pool callers.
const pool = new Proxy(databasePool, {
  get(target, property) {
    const value = Reflect.get(target, property, target);
    if (typeof value !== 'function') return value;
    if (property === 'query' || property === 'connect') {
      return (...args: unknown[]) => {
        if (!connectionString) throw new Error('DATABASE_URL is required');
        return Reflect.apply(value, target, args);
      };
    }
    return value.bind(target);
  },
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export const db = drizzle(pool, { schema });
export { pool };

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
