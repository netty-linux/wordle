import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { canvasDebug } from '@/lib/canvas/debug';

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

async function readResponseBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return '(corpo ilegível)';
  }
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
  const isSyncReadyRef = useRef(isSyncReady);
  const isDocLoadedRef = useRef(false);

  const [isDocLoaded, setIsDocLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  isSyncReadyRef.current = isSyncReady;
  isDocLoadedRef.current = isDocLoaded;

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
        isDocLoadedRef.current = false;
        setError(null);
        setSessionExpired(false);
        sessionExpiredRef.current = false;
        lastSyncedVectorRef.current = new Uint8Array();

        canvasDebug('GET start', { workspaceId });

        const response = await canvasFetch(workspaceId);

        if (isAuthFailure(response)) {
          throw new Error(SESSION_EXPIRED_MESSAGE);
        }

        if (response.status === 404) {
          canvasDebug('GET empty', {
            workspaceId,
            status: 404,
            note: 'primeiro acesso — Y.Doc vazio',
          });
          console.log(
            `[useCanvasSync] Workspace '${workspaceId}' sem blob — Y.Doc vazio.`
          );
          if (active) {
            lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
            setIsDocLoaded(true);
            isDocLoadedRef.current = true;
          }
          return;
        }

        if (!response.ok) {
          const bodyText = await readResponseBody(response);
          canvasDebug('GET error', {
            workspaceId,
            status: response.status,
            body: bodyText,
          });
          console.error(
            `[useCanvasSync] GET falhou: ${response.status}`,
            bodyText
          );
          let detail = response.statusText;
          try {
            const parsed = JSON.parse(bodyText) as { error?: string };
            if (parsed.error) detail = parsed.error;
          } catch {
            /* ignore */
          }
          throw new Error(`Falha ao buscar canvas: ${detail}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        canvasDebug('GET ok', {
          workspaceId,
          status: response.status,
          bytes: arrayBuffer.byteLength,
        });

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
        if (active) {
          setIsDocLoaded(true);
          isDocLoadedRef.current = true;
        }
      }
    }

    loadCanvas();

    return () => {
      active = false;
    };
  }, [ydoc, workspaceId]);

  useEffect(() => {
    if (!isDocLoaded) {
      canvasDebug('sync gate skip', {
        reason: '!isDocLoaded',
        workspaceId,
        isSyncReady,
      });
      return;
    }

    if (!isSyncReady) {
      canvasDebug('sync gate skip', {
        reason: '!isSyncReady (aguardando tldraw)',
        workspaceId,
        isDocLoaded,
      });
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const computeDiff = (): Uint8Array => {
      const fullState = Y.encodeStateAsUpdate(ydoc);
      return Y.diffUpdate(fullState, lastSyncedVectorRef.current);
    };

    const persistDiff = async (): Promise<ManualSaveResult> => {
      if (sessionExpiredRef.current) {
        canvasDebug('flush skip', { reason: 'session_expired', workspaceId });
        return {
          ok: false,
          status: 'session_expired',
          message: SESSION_EXPIRED_MESSAGE,
        };
      }

      const diffUpdate = computeDiff();

      if (diffUpdate.byteLength === 0) {
        canvasDebug('flush skip', { reason: 'no_changes', workspaceId });
        return {
          ok: true,
          status: 'already_synced',
          message: 'Tudo já está salvo na nuvem.',
        };
      }

      if (diffUpdate.byteLength > MAX_POST_BYTES) {
        canvasDebug('flush skip', {
          reason: 'payload_too_large',
          workspaceId,
          diffBytes: diffUpdate.byteLength,
        });
        return {
          ok: false,
          status: 'error',
          message: `Alteração muito grande (${diffUpdate.byteLength} bytes). Recarregue e tente de novo.`,
        };
      }

      try {
        setIsSaving(true);
        canvasDebug('POST start', {
          workspaceId,
          diffBytes: diffUpdate.byteLength,
        });

        const response = await canvasFetch(workspaceId, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Canvas-Update': 'incremental',
          },
          body: yjsUpdateToPostBody(diffUpdate),
        });

        if (isAuthFailure(response)) {
          const bodyText = await readResponseBody(response);
          console.error('[useCanvasSync] POST auth failure', {
            status: response.status,
            body: bodyText,
          });
          sessionExpiredRef.current = true;
          setSessionExpired(true);
          return {
            ok: false,
            status: 'session_expired',
            message: SESSION_EXPIRED_MESSAGE,
          };
        }

        if (response.status === 413) {
          const bodyText = await readResponseBody(response);
          console.error('[useCanvasSync] POST 413', bodyText);
          return {
            ok: false,
            status: 'error',
            message:
              'Canvas excedeu o limite de envio (413). Recarregue a página.',
          };
        }

        if (response.status === 503) {
          const bodyText = await readResponseBody(response);
          console.error('[useCanvasSync] POST 503', bodyText);
          let message = 'Armazenamento indisponível (configure Vercel Blob).';
          try {
            const parsed = JSON.parse(bodyText) as { error?: string };
            if (parsed.error) message = parsed.error;
          } catch {
            /* ignore */
          }
          return { ok: false, status: 'error', message };
        }

        if (!response.ok) {
          const bodyText = await readResponseBody(response);
          console.error('[useCanvasSync] POST failed', {
            status: response.status,
            body: bodyText,
          });
          let detail = response.statusText;
          try {
            const parsed = JSON.parse(bodyText) as { error?: string };
            if (parsed.error) detail = parsed.error;
          } catch {
            if (bodyText) detail = bodyText;
          }
          return {
            ok: false,
            status: 'error',
            message: `Falha ao sincronizar: ${detail}`,
          };
        }

        const result = (await response.json()) as {
          persisted?: boolean;
          mergedBytes?: number;
          blobUrl?: string;
        };

        if (result.persisted === false) {
          console.error('[useCanvasSync] POST persisted=false', result);
          return {
            ok: false,
            status: 'error',
            message: 'Servidor não confirmou persistência no Blob.',
          };
        }

        lastSyncedVectorRef.current = Y.encodeStateVector(ydoc);
        setError(null);

        canvasDebug('POST ok', {
          workspaceId,
          status: response.status,
          diffBytes: diffUpdate.byteLength,
          mergedBytes: result.mergedBytes,
          blobUrl: result.blobUrl,
        });

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
        canvasDebug('flush queued', { workspaceId });
        return;
      }

      canvasDebug('flush executing', { workspaceId });
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
      const diffBytes = computeDiff().byteLength;
      canvasDebug('flush scheduled', {
        workspaceId,
        debounceMs,
        diffBytes,
      });
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
      canvasDebug('flush manual (saveNow)', { workspaceId });
      return persistDiff();
    };

    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'initial-load') return;

      const diffBytes = computeDiff().byteLength;

      canvasDebug('doc update', {
        workspaceId,
        origin: String(origin ?? 'unknown'),
        updateBytes: update.byteLength,
        diffBytes,
        isSyncReady: isSyncReadyRef.current,
        isDocLoaded: isDocLoadedRef.current,
      });

      if (diffBytes === 0) {
        canvasDebug('flush skip', { reason: 'diff_zero_after_update', workspaceId });
        return;
      }

      scheduleFlush();
    };

    ydoc.on('update', handleUpdate);

    // Mudanças no Y.Doc antes do gate (ex.: useYjsStore seed) → flush ao abrir sync
    const pendingAfterGate = computeDiff().byteLength;
    if (pendingAfterGate > 0) {
      canvasDebug('flush pending on gate open', {
        workspaceId,
        diffBytes: pendingAfterGate,
      });
      scheduleFlush();
    }

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
