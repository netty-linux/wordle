import { and, eq } from 'drizzle-orm';
import * as Y from 'yjs';
import { db, canvasDocuments } from '../db';
import { getCanvasBlob, isBlobStorageConfigured, putCanvasBlob } from './blob';

async function getCanvasRow(userId: string, canvasId: string) {
  const rows = await db
    .select()
    .from(canvasDocuments)
    .where(
      and(eq(canvasDocuments.id, canvasId), eq(canvasDocuments.userId, userId))
    )
    .limit(1);

  return rows[0] ?? null;
}

async function persistMergedState(
  userId: string,
  canvasId: string,
  merged: Buffer
): Promise<{ persisted: boolean; storage: 'turso' | 'blob' | 'turso+blob' }> {
  await db
    .insert(canvasDocuments)
    .values({
      id: canvasId,
      userId,
      yjsState: merged,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [canvasDocuments.id, canvasDocuments.userId],
      set: {
        yjsState: merged,
        updatedAt: new Date(),
      },
    });

  if (isBlobStorageConfigured()) {
    try {
      await putCanvasBlob(userId, canvasId, merged);
      return { persisted: true, storage: 'turso+blob' };
    } catch (error) {
      console.error('[canvas] Falha ao espelhar no Blob (Turso OK):', error);
      return { persisted: true, storage: 'turso' };
    }
  }

  return { persisted: true, storage: 'turso' };
}

export async function getCanvasState(
  userId: string,
  canvasId: string
): Promise<Buffer | null> {
  const row = await getCanvasRow(userId, canvasId);
  if (!row) return null;

  if (row.yjsState && row.yjsState.length > 0) {
    return row.yjsState;
  }

  if (!isBlobStorageConfigured()) {
    return null;
  }

  return getCanvasBlob(userId, canvasId);
}

/** Aplica update incremental Yjs sobre o estado salvo e persiste o merge no Turso. */
export async function applyCanvasUpdate(
  userId: string,
  canvasId: string,
  incoming: Buffer
): Promise<{
  persisted: boolean;
  storage: 'turso' | 'blob' | 'turso+blob';
  incomingBytes: number;
  mergedBytes: number;
}> {
  const row = await getCanvasRow(userId, canvasId);
  const doc = new Y.Doc();

  if (row?.yjsState && row.yjsState.length > 0) {
    Y.applyUpdate(doc, new Uint8Array(row.yjsState));
  }

  Y.applyUpdate(doc, new Uint8Array(incoming));
  const merged = Buffer.from(Y.encodeStateAsUpdate(doc));
  const storage = await persistMergedState(userId, canvasId, merged);

  return {
    ...storage,
    incomingBytes: incoming.length,
    mergedBytes: merged.length,
  };
}

/** Substitui o estado inteiro (legado). */
export async function saveCanvasState(
  userId: string,
  canvasId: string,
  data: Buffer
): Promise<{ persisted: boolean; storage: 'turso' | 'blob' | 'turso+blob' }> {
  return persistMergedState(userId, canvasId, data);
}
