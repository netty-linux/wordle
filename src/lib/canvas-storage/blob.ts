import { head, put } from '@vercel/blob';
import type { CanvasStorage } from './types';

function blobPath(id: string) {
  return `canvas/${id}.yjs`;
}

export const blobCanvasStorage: CanvasStorage = {
  mode: 'blob',

  async get(id: string) {
    try {
      const meta = await head(blobPath(id));
      const response = await fetch(meta.url);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  },

  async set(id: string, data: Buffer) {
    await put(blobPath(id), data, {
      access: 'public',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
    });
  },
};
