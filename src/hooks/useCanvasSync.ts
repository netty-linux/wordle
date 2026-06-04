import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

interface UseCanvasSyncProps {
  id: string;
  debounceMs?: number;
  /** When false, POST sync is paused (e.g. while tldraw hydrates from Yjs). */
  isSyncReady?: boolean;
}

const MAX_POST_BYTES = 4_000_000;

/**
 * Hook customizado para gerenciar um Y.Doc local e sincronizá-lo com o backend.
 * Envia apenas o diff Yjs desde o último save (evita POST > 4.5MB / HTTP 413 na Vercel).
 */
export function useCanvasSync({
  id,
  debounceMs = 2000,
  isSyncReady = true,
}: UseCanvasSyncProps) {
  const ydoc = useMemo(() => {
    const doc = new Y.Doc();
    doc.gc = true;
    return doc;
  }, []);

  const lastSyncedVectorRef = useRef<Uint8Array>(new Uint8Array());
  const [isDocLoaded, setIsDocLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCanvas() {
      try {
        setIsDocLoaded(false);
        setError(null);
        lastSyncedVectorRef.current = new Uint8Array();

        const response = await fetch(`/api/canvas/${id}`, {
          credentials: 'include',
        });

        if (response.status === 404) {
          console.log(
            `[useCanvasSync] Canvas '${id}' não encontrado no banco. Iniciando canvas vazio.`
          );
          if (active) {
            lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
            setIsDocLoaded(true);
          }
          return;
        }

        if (response.status === 401) {
          throw new Error('Sessão expirada. Faça login novamente em /login');
        }

        if (!response.ok) {
          throw new Error(`Falha ao buscar estado inicial: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        if (arrayBuffer.byteLength > 0 && active) {
          const update = new Uint8Array(arrayBuffer);
          Y.applyUpdate(ydoc, update, 'initial-load');
          console.log(
            `[useCanvasSync] Estado inicial de '${id}' carregado (${arrayBuffer.byteLength} bytes).`
          );
        }

        if (active) {
          lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
        }
      } catch (err: unknown) {
        console.error(`[useCanvasSync] Erro no carregamento inicial de '${id}':`, err);
        if (active) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (active) setIsDocLoaded(true);
      }
    }

    loadCanvas();

    return () => {
      active = false;
    };
  }, [ydoc, id]);

  useEffect(() => {
    if (!isDocLoaded || !isSyncReady) return;

    let timeoutId: NodeJS.Timeout;
    let dirty = false;

    const flushToServer = async () => {
      if (!dirty) return;
      dirty = false;

      const fullState = Y.encodeStateAsUpdate(ydoc);
      const diffUpdate = Y.diffUpdate(fullState, lastSyncedVectorRef.current);

      if (diffUpdate.byteLength === 0) return;

      try {
        setIsSaving(true);

        if (diffUpdate.byteLength > MAX_POST_BYTES) {
          throw new Error(
            `Alteração muito grande para enviar (${diffUpdate.byteLength} bytes). Tente novamente após recarregar.`
          );
        }

        const response = await fetch(`/api/canvas/${id}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Canvas-Update': 'incremental',
          },
          body: diffUpdate as BodyInit,
        });

        if (response.status === 413) {
          throw new Error(
            'O canvas excedeu o limite de envio (413). Recarregue a página e tente de novo.'
          );
        }

        if (!response.ok) {
          throw new Error(
            `Falha ao sincronizar o estado com o servidor: ${response.status} ${response.statusText}`
          );
        }

        const result = await response.json().catch(() => ({}));
        if (result.persisted === false) {
          throw new Error(
            'Servidor não persistiu o canvas. Verifique Turso/Blob na Vercel.'
          );
        }

        lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
        setError(null);
        console.log(
          `[useCanvasSync] Canvas '${id}' salvo (+${diffUpdate.byteLength} bytes → merge ${result.mergedBytes ?? '?'} no servidor).`
        );
      } catch (err: unknown) {
        console.error('[useCanvasSync] Erro no Lazy Sync:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsSaving(false);
      }
    };

    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === 'initial-load') return;
      dirty = true;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void flushToServer();
      }, debounceMs);
    };

    ydoc.on('update', handleUpdate);

    return () => {
      ydoc.off('update', handleUpdate);
      clearTimeout(timeoutId);
    };
  }, [ydoc, id, isDocLoaded, isSyncReady, debounceMs]);

  return {
    ydoc,
    isDocLoaded,
    isSaving,
    error,
  };
}
