import { and, eq } from 'drizzle-orm';
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

export async function getCanvasState(
  userId: string,
  canvasId: string
): Promise<Buffer | null> {
  const row = await getCanvasRow(userId, canvasId);
  if (!row) return null;

  // Turso é a fonte principal (funciona sem Vercel Blob)
  if (row.yjsState && row.yjsState.length > 0) {
    return row.yjsState;
  }

  if (!isBlobStorageConfigured()) {
    return null;
  }

  return getCanvasBlob(userId, canvasId);
}

export async function saveCanvasState(
  userId: string,
  canvasId: string,
  data: Buffer
): Promise<{ persisted: boolean; storage: 'turso' | 'blob' | 'turso+blob' }> {
  await db
    .insert(canvasDocuments)
    .values({
      id: canvasId,
      userId,
      yjsState: data,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [canvasDocuments.id, canvasDocuments.userId],
      set: {
        yjsState: data,
        updatedAt: new Date(),
      },
    });

  if (isBlobStorageConfigured()) {
    try {
      await putCanvasBlob(userId, canvasId, data);
      return { persisted: true, storage: 'turso+blob' };
    } catch (error) {
      console.error('[canvas] Falha ao espelhar no Blob (Turso OK):', error);
      return { persisted: true, storage: 'turso' };
    }
  }

  return { persisted: true, storage: 'turso' };
}
