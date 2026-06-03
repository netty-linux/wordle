import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

interface UseCanvasSyncProps {
  id: string;
  debounceMs?: number;
}

/**
 * Hook customizado para gerenciar um Y.Doc local e sincronizá-lo com o backend.
 * Implementa o mecanismo de "Lazy Sync" com debounce para requisições POST.
 */
export function useCanvasSync({ id, debounceMs = 2000 }: UseCanvasSyncProps) {
  // Mantém a mesma instância do Y.Doc durante todo o ciclo de vida do componente
  const ydoc = useMemo(() => {
    const doc = new Y.Doc();
    doc.gc = true; // Habilita garbage collection para otimização de memória
    return doc;
  }, []);

  const [isDocLoaded, setIsDocLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 1. Carregamento inicial do estado do Canvas (GET)
  useEffect(() => {
    let active = true;

    async function loadCanvas() {
      try {
        setIsDocLoaded(false);
        setError(null);

        const response = await fetch(`/api/canvas/${id}`);

        if (response.status === 404) {
          // Documento novo (ainda não salvo no banco)
          console.log(`[useCanvasSync] Canvas '${id}' não encontrado no banco. Iniciando canvas vazio.`);
          if (active) setIsDocLoaded(true);
          return;
        }

        if (!response.ok) {
          throw new Error(`Falha ao buscar estado inicial: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        if (arrayBuffer.byteLength > 0 && active) {
          const update = new Uint8Array(arrayBuffer);
          Y.applyUpdate(ydoc, update);
          console.log(`[useCanvasSync] Estado inicial de '${id}' carregado com sucesso (${arrayBuffer.byteLength} bytes).`);
        }
      } catch (err: any) {
        console.error(`[useCanvasSync] Erro no carregamento inicial de '${id}':`, err);
        if (active) setError(err);
      } finally {
        if (active) setIsDocLoaded(true);
      }
    }

    loadCanvas();

    return () => {
      active = false;
    };
  }, [ydoc, id]);

  // 2. Mecanismo de Lazy Sync (POST com debounce)
  useEffect(() => {
    if (!isDocLoaded) return;

    let timeoutId: NodeJS.Timeout;

    const handleUpdate = (update: Uint8Array, origin: any) => {
      // Ignora atualizações se a origem for o carregamento inicial ou local-sync
      // (origin === 'tldraw-local' etc.) para evitar re-enviar dados inalterados
      if (origin === 'initial-load') return;

      clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        try {
          setIsSaving(true);
          
          // Codifica o estado completo atualizado do Y.Doc para salvar
          const documentUpdate = Y.encodeStateAsUpdate(ydoc);

          const response = await fetch(`/api/canvas/${id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
            },
            body: documentUpdate as any,
          });

          if (!response.ok) {
            throw new Error(`Falha ao sincronizar o estado com o servidor: ${response.statusText}`);
          }

          setError(null);
          console.log(`[useCanvasSync] Canvas '${id}' sincronizado com sucesso no backend.`);
        } catch (err: any) {
          console.error('[useCanvasSync] Erro no Lazy Sync:', err);
          setError(err);
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
