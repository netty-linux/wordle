import { head, put } from '@vercel/blob';

export class CanvasBlobError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CanvasBlobError';
    this.code = code;
  }
}

export function canvasBlobPath(userId: string, canvasId: string): string {
  return `canvas/${userId}/${canvasId}.yjs`;
}

export function isBlobStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function assertBlobStorageConfigured(): void {
  if (!isBlobStorageConfigured()) {
    throw new CanvasBlobError(
      'BLOB_NOT_CONFIGURED',
      'BLOB_READ_WRITE_TOKEN ausente. Configure o Vercel Blob no projeto.'
    );
  }
}

export async function getCanvasBlob(
  userId: string,
  canvasId: string
): Promise<Buffer | null> {
  assertBlobStorageConfigured();

  const pathname = canvasBlobPath(userId, canvasId);

  try {
    const meta = await head(pathname);
    const response = await fetch(meta.url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function putCanvasBlob(
  userId: string,
  canvasId: string,
  data: Buffer
): Promise<{ url: string; pathname: string; sizeBytes: number }> {
  assertBlobStorageConfigured();

  const pathname = canvasBlobPath(userId, canvasId);

  const result = await put(pathname, data, {
    access: 'public',
    contentType: 'application/octet-stream',
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    sizeBytes: data.length,
  };
}
