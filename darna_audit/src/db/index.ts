import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const isDbConfigured = (): boolean => {
  return Boolean(process.env.SQL_HOST && process.env.SQL_HOST.trim() !== '');
};

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST || '127.0.0.1',
      user: process.env.SQL_USER || 'postgres',
      password: process.env.SQL_PASSWORD || '',
      database: process.env.SQL_DB_NAME || 'postgres',
      port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
      max: 5,
      connectionTimeoutMillis: 2000,
    });

    global._postgresPool.on('error', (err) => {
      // Suppress unhandled idle pool connection error logs when DB is unreachable
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

