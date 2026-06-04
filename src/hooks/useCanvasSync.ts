import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

interface UseCanvasSyncProps {
  id: string;
  debounceMs?: number;
}

/**
 * Hook customizado para gerenciar um Y.Doc local e sincronizá-lo com o backend.
 * Envia apenas updates incrementais Yjs (evita POST > 4.5MB / HTTP 413 na Vercel).
 */
export function useCanvasSync({ id, debounceMs = 2000 }: UseCanvasSyncProps) {
  const ydoc = useMemo(() => {
    const doc = new Y.Doc();
    doc.gc = true;
    return doc;
  }, []);

  const [isDocLoaded, setIsDocLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCanvas() {
      try {
        setIsDocLoaded(false);
        setError(null);

        const response = await fetch(`/api/canvas/${id}`, {
          credentials: 'include',
        });

        if (response.status === 404) {
          console.log(
            `[useCanvasSync] Canvas '${id}' não encontrado no banco. Iniciando canvas vazio.`
          );
          if (active) setIsDocLoaded(true);
          return;
        }

        if (response.status === 401) {
          throw new Error('Sessão expirada. Faça login novamente em /login');
        }

        if (!response.ok) {
          throw new Error(`Falha ao buscar estado inicial: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // #region agent log
        fetch('http://127.0.0.1:7401/ingest/bc08e07d-0b22-492d-a8b7-6f08426e0ffc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': 'd65edf',
          },
          body: JSON.stringify({
            sessionId: 'd65edf',
            hypothesisId: 'A',
            location: 'useCanvasSync.ts:load',
            message: 'GET canvas loaded',
            data: { canvasId: id, getBytes: arrayBuffer.byteLength },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion

        if (arrayBuffer.byteLength > 0 && active) {
          const update = new Uint8Array(arrayBuffer);
          Y.applyUpdate(ydoc, update, 'initial-load');
          console.log(
            `[useCanvasSync] Estado inicial de '${id}' carregado (${arrayBuffer.byteLength} bytes).`
          );
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
    if (!isDocLoaded) return;

    let timeoutId: NodeJS.Timeout;
    const pendingUpdates: Uint8Array[] = [];

    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'initial-load') return;

      pendingUpdates.push(update);
      clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        const batch = pendingUpdates.splice(0, pendingUpdates.length);
        if (batch.length === 0) return;

        const incrementalUpdate = Y.mergeUpdates(batch);

        try {
          setIsSaving(true);

          // #region agent log
          fetch('http://127.0.0.1:7401/ingest/bc08e07d-0b22-492d-a8b7-6f08426e0ffc', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Debug-Session-Id': 'd65edf',
            },
            body: JSON.stringify({
              sessionId: 'd65edf',
              hypothesisId: 'A',
              location: 'useCanvasSync.ts:prePOST',
              message: 'POST incremental payload',
              data: {
                canvasId: id,
                postBytes: incrementalUpdate.byteLength,
                batchCount: batch.length,
                fullDocBytes: Y.encodeStateAsUpdate(ydoc).byteLength,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion

          const response = await fetch(`/api/canvas/${id}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Canvas-Update': 'incremental',
            },
            body: incrementalUpdate as BodyInit,
          });

          // #region agent log
          fetch('http://127.0.0.1:7401/ingest/bc08e07d-0b22-492d-a8b7-6f08426e0ffc', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Debug-Session-Id': 'd65edf',
            },
            body: JSON.stringify({
              sessionId: 'd65edf',
              hypothesisId: 'A',
              location: 'useCanvasSync.ts:postPOST',
              message: 'POST response',
              data: {
                canvasId: id,
                status: response.status,
                ok: response.ok,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion

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

          setError(null);
          console.log(
            `[useCanvasSync] Canvas '${id}' salvo (+${incrementalUpdate.byteLength} bytes → merge ${result.mergedBytes ?? '?'} no servidor).`
          );
        } catch (err: unknown) {
          console.error('[useCanvasSync] Erro no Lazy Sync:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
          setIsSaving(false);
        }
      }, debounceMs);
    };

    ydoc.on('update', handleUpdate);

    return () => {
      ydoc.off('update', handleUpdate);
      clearTimeout(timeoutId);
    };
  }, [ydoc, id, isDocLoaded, debounceMs]);

  return {
    ydoc,
    isDocLoaded,
    isSaving,
    error,
  };
}
