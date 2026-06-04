import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

interface UseCanvasSyncProps {
  id: string;
  debounceMs?: number;
  /** When false, POST sync is paused (e.g. while tldraw hydrates from Yjs). */
  isSyncReady?: boolean;
}

export type ManualSaveStatus =
  | 'saved'
  | 'already_synced'
  | 'not_ready'
  | 'session_expired'
  | 'error';

export interface ManualSaveResult {
  ok: boolean;
  status: ManualSaveStatus;
  message?: string;
}

const MAX_POST_BYTES = 4_000_000;

const SESSION_EXPIRED_MESSAGE =
  'Sessão expirada. Faça login novamente para continuar salvando.';

function isAuthFailure(response: Response): boolean {
  if (response.type === 'opaqueredirect') return true;
  if (response.status === 401 || response.status === 405) return true;
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') ?? '';
    return location.includes('/login');
  }
  return response.url.includes('/login');
}

async function canvasFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
    redirect: 'manual',
  });
}

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
  const [sessionExpired, setSessionExpired] = useState(false);

  const saveNowHandlerRef = useRef<() => Promise<ManualSaveResult>>(async () => ({
    ok: false,
    status: 'not_ready',
    message: 'Canvas ainda não está pronto.',
  }));

  useEffect(() => {
    let active = true;

    async function loadCanvas() {
      try {
        setIsDocLoaded(false);
        setError(null);
        setSessionExpired(false);
        lastSyncedVectorRef.current = new Uint8Array();

        const response = await canvasFetch(`/api/canvas/${id}`);

        if (isAuthFailure(response)) {
          throw new Error(SESSION_EXPIRED_MESSAGE);
        }

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

    const persistDiff = async (): Promise<ManualSaveResult> => {
      if (sessionExpired) {
        return {
          ok: false,
          status: 'session_expired',
          message: SESSION_EXPIRED_MESSAGE,
        };
      }

      const fullState = Y.encodeStateAsUpdate(ydoc);
      const diffUpdate = Y.diffUpdate(fullState, lastSyncedVectorRef.current);

      if (diffUpdate.byteLength === 0) {
        return {
          ok: true,
          status: 'already_synced',
          message: 'Tudo já está salvo na nuvem.',
        };
      }

      if (diffUpdate.byteLength > MAX_POST_BYTES) {
        return {
          ok: false,
          status: 'error',
          message: `Alteração muito grande para enviar (${diffUpdate.byteLength} bytes). Recarregue e tente de novo.`,
        };
      }

      try {
        setIsSaving(true);

        const response = await canvasFetch(`/api/canvas/${id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Canvas-Update': 'incremental',
          },
          body: diffUpdate as BodyInit,
        });

        if (isAuthFailure(response)) {
          setSessionExpired(true);
          return {
            ok: false,
            status: 'session_expired',
            message: SESSION_EXPIRED_MESSAGE,
          };
        }

        if (response.status === 413) {
          return {
            ok: false,
            status: 'error',
            message:
              'O canvas excedeu o limite de envio (413). Recarregue a página e tente de novo.',
          };
        }

        if (!response.ok) {
          return {
            ok: false,
            status: 'error',
            message: `Falha ao sincronizar: ${response.status} ${response.statusText}`,
          };
        }

        const result = await response.json().catch(() => ({}));
        if (result.persisted === false) {
          return {
            ok: false,
            status: 'error',
            message: 'Servidor não persistiu o canvas. Verifique Turso/Blob na Vercel.',
          };
        }

        lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
        setError(null);
        console.log(
          `[useCanvasSync] Canvas '${id}' salvo (+${diffUpdate.byteLength} bytes → merge ${result.mergedBytes ?? '?'} no servidor).`
        );

        return {
          ok: true,
          status: 'saved',
          message: 'Canvas salvo na nuvem.',
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Erro desconhecido ao salvar.';
        console.error('[useCanvasSync] Erro ao salvar:', err);
        setError(err instanceof Error ? err : new Error(message));
        return { ok: false, status: 'error', message };
      } finally {
        setIsSaving(false);
      }
    };

    const flushToServer = async () => {
      if (!dirty) return;
      dirty = false;
      await persistDiff();
    };

    saveNowHandlerRef.current = async () => {
      clearTimeout(timeoutId);
      dirty = true;
      const result = await persistDiff();
      dirty = false;
      return result;
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
      saveNowHandlerRef.current = async () => ({
        ok: false,
        status: 'not_ready',
        message: 'Canvas ainda não está pronto.',
      });
    };
  }, [ydoc, id, isDocLoaded, isSyncReady, debounceMs, sessionExpired]);

  const saveNow = useCallback(
    () => saveNowHandlerRef.current(),
    []
  );

  return {
    ydoc,
    isDocLoaded,
    isSaving,
    error,
    sessionExpired,
    saveNow,
  };
}
