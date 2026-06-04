import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

function createDb() {
  // Vercel Turso integration usa BLOB_TURSO_*; docs usam TURSO_*
  const url =
    process.env.TURSO_CONNECTION_URL ??
    process.env.BLOB_TURSO_DATABASE_URL;
  const authToken =
    process.env.TURSO_AUTH_TOKEN ?? process.env.BLOB_TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      'Turso não configurado. Defina TURSO_CONNECTION_URL ou BLOB_TURSO_DATABASE_URL.'
    );
  }

  const client = createClient({
    url,
    authToken: authToken || undefined,
  });

  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as {
  __tursoDb?: ReturnType<typeof createDb>;
};

export const db = globalForDb.__tursoDb ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__tursoDb = db;
}

export * from './schema';
