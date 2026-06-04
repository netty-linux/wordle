import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

interface UseCanvasSyncProps {
  /** ID do workspace/canvas (ex.: default-canvas-room). */
  workspaceId: string;
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

function canvasApiPath(workspaceId: string): string {
  return `/api/canvas/${encodeURIComponent(workspaceId)}`;
}

/** Copia bytes Yjs para um Blob compatível com fetch BodyInit (sem SharedArrayBuffer). */
function yjsUpdateToPostBody(update: Uint8Array): Blob {
  return new Blob([Uint8Array.from(update)]);
}

async function canvasFetch(
  workspaceId: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(canvasApiPath(workspaceId), {
    ...init,
    credentials: 'include',
    redirect: 'manual',
  });
}

/**
 * Sincroniza Y.Doc local com /api/canvas/[workspaceId] (Turso metadata + Vercel Blob).
 * POST apenas quando há diff real desde o último vector sincronizado.
 */
export function useCanvasSync({
  workspaceId,
  debounceMs = 2000,
  isSyncReady = true,
}: UseCanvasSyncProps) {
  const ydoc = useMemo(() => {
    const doc = new Y.Doc();
    doc.gc = true;
    return doc;
  }, []);

  const lastSyncedVectorRef = useRef<Uint8Array>(new Uint8Array());
  const sessionExpiredRef = useRef(false);
  const flushInFlightRef = useRef(false);
  const pendingFlushRef = useRef(false);

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
        sessionExpiredRef.current = false;
        lastSyncedVectorRef.current = new Uint8Array();

        const response = await canvasFetch(workspaceId);

        if (isAuthFailure(response)) {
          throw new Error(SESSION_EXPIRED_MESSAGE);
        }

        if (response.status === 404) {
          console.log(
            `[useCanvasSync] Workspace '${workspaceId}' sem blob — Y.Doc vazio.`
          );
          if (active) {
            lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
            setIsDocLoaded(true);
          }
          return;
        }

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const detail =
            typeof body.error === 'string' ? body.error : response.statusText;
          throw new Error(`Falha ao buscar canvas: ${detail}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        if (arrayBuffer.byteLength > 0 && active) {
          Y.applyUpdate(ydoc, new Uint8Array(arrayBuffer), 'initial-load');
          console.log(
            `[useCanvasSync] Workspace '${workspaceId}' carregado (${arrayBuffer.byteLength} bytes).`
          );
        }

        if (active) {
          lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
        }
      } catch (err: unknown) {
        console.error(`[useCanvasSync] Erro ao carregar '${workspaceId}':`, err);
        if (active) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (active) setIsDocLoaded(true);
      }
    }

    loadCanvas();

    return () => {
      active = false;
    };
  }, [ydoc, workspaceId]);

  useEffect(() => {
    if (!isDocLoaded || !isSyncReady) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const computeDiff = (): Uint8Array => {
      const fullState = Y.encodeStateAsUpdate(ydoc);
      return Y.diffUpdate(fullState, lastSyncedVectorRef.current);
    };

    const persistDiff = async (): Promise<ManualSaveResult> => {
      if (sessionExpiredRef.current) {
        return {
          ok: false,
          status: 'session_expired',
          message: SESSION_EXPIRED_MESSAGE,
        };
      }

      const diffUpdate = computeDiff();

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
          message: `Alteração muito grande (${diffUpdate.byteLength} bytes). Recarregue e tente de novo.`,
        };
      }

      try {
        setIsSaving(true);

        const response = await canvasFetch(workspaceId, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Canvas-Update': 'incremental',
          },
          body: yjsUpdateToPostBody(diffUpdate),
        });

        if (isAuthFailure(response)) {
          sessionExpiredRef.current = true;
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
              'Canvas excedeu o limite de envio (413). Recarregue a página.',
          };
        }

        if (response.status === 503) {
          const body = await response.json().catch(() => ({}));
          return {
            ok: false,
            status: 'error',
            message:
              typeof body.error === 'string'
                ? body.error
                : 'Armazenamento indisponível (configure Vercel Blob).',
          };
        }

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const detail =
            typeof body.error === 'string' ? body.error : response.statusText;
          return {
            ok: false,
            status: 'error',
            message: `Falha ao sincronizar: ${detail}`,
          };
        }

        const result = await response.json();

        if (result.persisted === false) {
          return {
            ok: false,
            status: 'error',
            message: 'Servidor não confirmou persistência no Blob.',
          };
        }

        lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
        setError(null);
        console.log(
          `[useCanvasSync] '${workspaceId}' salvo (+${diffUpdate.byteLength}B → ${result.mergedBytes ?? '?'}B no Blob).`
        );

        return {
          ok: true,
          status: 'saved',
          message: 'Canvas salvo na nuvem.',
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Erro desconhecido ao salvar.';
        console.error('[useCanvasSync] Erro no sync:', err);
        setError(err instanceof Error ? err : new Error(message));
        return { ok: false, status: 'error', message };
      } finally {
        setIsSaving(false);
      }
    };

    const runFlush = async () => {
      if (flushInFlightRef.current) {
        pendingFlushRef.current = true;
        return;
      }

      flushInFlightRef.current = true;
      try {
        do {
          pendingFlushRef.current = false;
          await persistDiff();
        } while (pendingFlushRef.current);
      } finally {
        flushInFlightRef.current = false;
      }
    };

    const scheduleFlush = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        void runFlush();
      }, debounceMs);
    };

    saveNowHandlerRef.current = async () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      return persistDiff();
    };

    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === 'initial-load') return;

      const diffUpdate = computeDiff();
      if (diffUpdate.byteLength === 0) return;

      scheduleFlush();
    };

    ydoc.on('update', handleUpdate);

    return () => {
      ydoc.off('update', handleUpdate);
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      saveNowHandlerRef.current = async () => ({
        ok: false,
        status: 'not_ready',
        message: 'Canvas ainda não está pronto.',
      });
    };
  }, [ydoc, workspaceId, isDocLoaded, isSyncReady, debounceMs]);

  const saveNow = useCallback(() => saveNowHandlerRef.current(), []);

  return {
    ydoc,
    isDocLoaded,
    isSaving,
    error,
    sessionExpired,
    saveNow,
  };
}
