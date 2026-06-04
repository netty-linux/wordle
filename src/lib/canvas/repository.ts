import * as Y from 'yjs';
import { db, canvasDocuments } from '../db';
import { ensureCanvasDocumentsSchema } from '../db/ensure-schema';
import {
  CanvasBlobError,
  assertBlobStorageConfigured,
  canvasBlobPath,
  getCanvasBlob,
  putCanvasBlob,
} from './blob';
import { canvasDebug } from './debug';

export type CanvasStorageBackend = 'blob';

export interface CanvasPersistResult {
  persisted: boolean;
  storage: CanvasStorageBackend;
  blobUrl: string;
  blobPath: string;
  incomingBytes: number;
  mergedBytes: number;
}

async function upsertCanvasMetadata(
  userId: string,
  canvasId: string,
  blobUrl: string,
  sizeBytes: number
) {
  await ensureCanvasDocumentsSchema();

  const now = new Date();

  await db
    .insert(canvasDocuments)
    .values({
      id: canvasId,
      userId,
      blobUrl,
      sizeBytes,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [canvasDocuments.id, canvasDocuments.userId],
      set: {
        blobUrl,
        sizeBytes,
        updatedAt: now,
      },
    });
}

async function loadDocFromBlob(
  userId: string,
  canvasId: string
): Promise<Y.Doc> {
  const doc = new Y.Doc();
  const existing = await getCanvasBlob(userId, canvasId);

  if (existing && existing.length > 0) {
    Y.applyUpdate(doc, new Uint8Array(existing));
  }

  return doc;
}

/**
 * Lê o estado Yjs do Vercel Blob para o par (userId, canvasId).
 * Retorna null se o blob não existir (primeiro acesso).
 */
export async function getCanvasState(
  userId: string,
  canvasId: string
): Promise<Buffer | null> {
  assertBlobStorageConfigured();
  return getCanvasBlob(userId, canvasId);
}

/**
 * Mescla update incremental Yjs, persiste no Blob e faz upsert de metadados no Turso.
 */
export async function applyCanvasUpdate(
  userId: string,
  canvasId: string,
  incoming: Buffer
): Promise<CanvasPersistResult> {
  const startedAt = Date.now();
  assertBlobStorageConfigured();

  const blobPath = canvasBlobPath(userId, canvasId);

  canvasDebug('applyCanvasUpdate start', {
    userId,
    canvasId,
    blobPath,
    incomingBytes: incoming.length,
  });

  const doc = await loadDocFromBlob(userId, canvasId);
  Y.applyUpdate(doc, new Uint8Array(incoming));

  const merged = Buffer.from(Y.encodeStateAsUpdate(doc));
  const blob = await putCanvasBlob(userId, canvasId, merged);

  await upsertCanvasMetadata(userId, canvasId, blob.url, blob.sizeBytes);

  canvasDebug('applyCanvasUpdate done', {
    userId,
    canvasId,
    blobPath,
    mergedBytes: merged.length,
    blobUrl: blob.url,
    durationMs: Date.now() - startedAt,
  });

  return {
    persisted: true,
    storage: 'blob',
    blobUrl: blob.url,
    blobPath,
    incomingBytes: incoming.length,
    mergedBytes: merged.length,
  };
}

export function isCanvasStorageError(
  error: unknown
): error is CanvasBlobError {
  return error instanceof CanvasBlobError;
}
