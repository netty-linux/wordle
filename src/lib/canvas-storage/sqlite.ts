import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { canvasDocuments } from '../db/schema';
import type { CanvasStorage } from './types';

const globalForDb = global as unknown as {
  __sqlite?: Database.Database;
  __drizzle?: ReturnType<typeof drizzle>;
};

function ensureMigrated(sqlite: Database.Database) {
  const table = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='canvas_documents'"
    )
    .get();

  if (table) return;

  const migrationPath = join(process.cwd(), 'drizzle', '0000_yellow_pyro.sql');
  if (!existsSync(migrationPath)) {
    throw new Error(`Migration não encontrada: ${migrationPath}`);
  }

  sqlite.exec(readFileSync(migrationPath, 'utf8'));
}

function getDb() {
  if (!globalForDb.__drizzle) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const sqlite = globalForDb.__sqlite ?? new Database('local.db');
    ensureMigrated(sqlite);
    globalForDb.__sqlite = sqlite;
    globalForDb.__drizzle = drizzle(sqlite, { schema });
  }
  return globalForDb.__drizzle;
}

export const sqliteCanvasStorage: CanvasStorage = {
  mode: 'sqlite',

  async get(id: string) {
    const db = getDb();
    const docs = await db
      .select()
      .from(canvasDocuments)
      .where(eq(canvasDocuments.id, id))
      .limit(1);

    if (docs.length === 0) return null;
    return docs[0].yjsState;
  },

  async set(id: string, data: Buffer) {
    const db = getDb();
    await db
      .insert(canvasDocuments)
      .values({
        id,
        yjsState: data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: canvasDocuments.id,
        set: {
          yjsState: data,
          updatedAt: new Date(),
        },
      });
  },
};
