import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// Padrão Singleton para evitar conexões duplicadas no hot-reload do Next.js
const globalForDb = global as unknown as {
    __db: Database.Database | undefined;
};

const sqlite = globalForDb.__db ?? new Database('local.db');

if (process.env.NODE_ENV !== 'production') {
    globalForDb.__db = sqlite;
}

export const db = drizzle(sqlite, { schema });