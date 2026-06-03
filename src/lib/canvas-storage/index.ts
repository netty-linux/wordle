import type { CanvasStorage } from './types';
import { blobCanvasStorage } from './blob';
import { memoryCanvasStorage } from './memory';

let storage: CanvasStorage | null = null;

function resolveStorage(): CanvasStorage {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return blobCanvasStorage;
  }

  // better-sqlite3 não é compatível com Vercel serverless (FS efêmero + binário nativo)
  if (!process.env.VERCEL) {
    const { sqliteCanvasStorage } = require('./sqlite') as typeof import('./sqlite');
    return sqliteCanvasStorage;
  }

  return memoryCanvasStorage;
}

export function getCanvasStorage(): CanvasStorage {
  if (!storage) {
    storage = resolveStorage();
    console.log(`[canvas-storage] Using ${storage.mode} backend`);
  }
  return storage;
}
