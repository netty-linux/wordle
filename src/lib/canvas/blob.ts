import { head, put } from '@vercel/blob';

export function canvasBlobPath(userId: string, canvasId: string) {
  return `canvas/${userId}/${canvasId}.yjs`;
}

export async function getCanvasBlob(
  userId: string,
  canvasId: string
): Promise<Buffer | null> {
  try {
    const meta = await head(canvasBlobPath(userId, canvasId));
    const response = await fetch(meta.url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function putCanvasBlob(
  userId: string,
  canvasId: string,
  data: Buffer
): Promise<void> {
  await put(canvasBlobPath(userId, canvasId), data, {
    access: 'public',
    contentType: 'application/octet-stream',
    addRandomSuffix: false,
  });
}

export function isBlobStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
