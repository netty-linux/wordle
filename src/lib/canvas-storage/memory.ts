import type { CanvasStorage } from './types';

/**
 * Fallback para Vercel sem Blob configurado: o canvas funciona no cliente,
 * mas o estado não persiste entre sessões no servidor.
 */
export const memoryCanvasStorage: CanvasStorage = {
  mode: 'memory',

  async get() {
    return null;
  },

  async set() {
    // no-op
  },
};
