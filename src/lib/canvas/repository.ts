import { and, eq } from 'drizzle-orm';
import { db, canvasDocuments } from '../db';
import { getCanvasBlob, isBlobStorageConfigured, putCanvasBlob } from './blob';

export async function userOwnsCanvas(
  userId: string,
  canvasId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: canvasDocuments.id })
    .from(canvasDocuments)
    .where(
      and(eq(canvasDocuments.id, canvasId), eq(canvasDocuments.userId, userId))
    )
    .limit(1);

  return rows.length > 0;
}

export async function touchCanvasDocument(
  userId: string,
  canvasId: string
): Promise<void> {
  await db
    .insert(canvasDocuments)
    .values({
      id: canvasId,
      userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [canvasDocuments.id, canvasDocuments.userId],
      set: { updatedAt: new Date() },
    });
}

export async function getCanvasState(
  userId: string,
  canvasId: string
): Promise<Buffer | null> {
  const owned = await userOwnsCanvas(userId, canvasId);
  if (!owned) return null;

  if (!isBlobStorageConfigured()) {
    console.warn('[canvas] BLOB_READ_WRITE_TOKEN ausente — retornando vazio.');
    return null;
  }

  return getCanvasBlob(userId, canvasId);
}

export async function saveCanvasState(
  userId: string,
  canvasId: string,
  data: Buffer
): Promise<{ persisted: boolean }> {
  if (!isBlobStorageConfigured()) {
    await touchCanvasDocument(userId, canvasId);
    return { persisted: false };
  }

  await putCanvasBlob(userId, canvasId, data);
  await touchCanvasDocument(userId, canvasId);
  return { persisted: true };
}
