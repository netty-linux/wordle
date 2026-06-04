import { useEffect, useMemo, useState } from 'react';
import { createTLStore, defaultShapeUtils, TLStoreWithStatus, TLRecord } from 'tldraw';
import * as Y from 'yjs';
import { TaskCardShapeUtil } from '../canvas/shapes/TaskCardShape';
import { canvasDebug } from '@/lib/canvas/debug';

interface UseYjsStoreProps {
  ydoc: Y.Doc;
  isDocLoaded: boolean;
}

/**
 * Hook para sincronizar o estado em memória do Tldraw (TLStore) com o documento Yjs (Y.Doc).
 * Resolve o problema de concorrência e loops infinitos usando mergeRemoteChanges e transações identificadas.
 */
export function useYjsStore({ ydoc, isDocLoaded }: UseYjsStoreProps) {
  // Inicializa a store local do tldraw apenas uma vez
  const store = useMemo(() => {
    return createTLStore({
      shapeUtils: [...defaultShapeUtils, TaskCardShapeUtil],
    });
  }, []);

  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: 'loading',
  });

  useEffect(() => {
    // Se o documento Yjs ainda não terminou o carregamento inicial, mantém o estado de loading
    if (!isDocLoaded) {
      setStoreWithStatus({ status: 'loading' });
      return;
    }

    // Mapa compartilhado do Yjs para armazenar os registros do Canvas
    const ymap = ydoc.getMap<TLRecord>('tldraw_records');

    // === 1. Sincronização Inicial ===
    if (ymap.size > 0) {
      // Se já existem registros salvos no Yjs, substitui a store local
      canvasDebug('hydrate from Y.Doc', { recordCount: ymap.size });
      console.log(`[useYjsStore] Carregando ${ymap.size} registros existentes do Y.Doc para a store do tldraw.`);
      store.mergeRemoteChanges(() => {
        store.clear();
        store.put(Array.from(ymap.values()));
      });
    } else {
      // Se o Yjs está vazio (canvas novo), popula o Yjs com os registros padrão da store
      canvasDebug('seed empty Y.Doc', {
        defaultRecordCount: store.allRecords().length,
      });
      console.log(`[useYjsStore] Novo Canvas detectado. Populando Y.Doc com os ${store.allRecords().length} registros default.`);
      ydoc.transact(() => {
        store.allRecords().forEach((record) => {
          ymap.set(record.id, record);
        });
      }, 'tldraw-local');
    }

    // Marca a store como pronta e sincronizada
    setStoreWithStatus({
      status: 'synced-remote',
      connectionStatus: 'online',
      store,
    });

    // === 2. Listener do Tldraw -> Yjs ===
    // Escuta mudanças feitas pelo usuário no canvas local e as propaga no Yjs
    const cleanupStoreListener = store.listen(
      (changes) => {
        ydoc.transact(() => {
          // Registros adicionados
          Object.values(changes.changes.added).forEach((record) => {
            ymap.set(record.id, record);
          });
          // Registros atualizados
          Object.values(changes.changes.updated).forEach(([_, record]) => {
            ymap.set(record.id, record);
          });
          // Registros removidos
          Object.values(changes.changes.removed).forEach((record) => {
            ymap.delete(record.id);
          });
        }, 'tldraw-local');
      },
      { source: 'user', scope: 'document' } // Escuta apenas modificações do usuário local no documento
    );

    // === 3. Listener do Yjs -> Tldraw ===
    // Escuta mudanças remotas no mapa compartilhado do Yjs e as aplica na store do tldraw
    const handleYMapObserve = (event: Y.YMapEvent<TLRecord>) => {
      // Evita loops infinitos ignorando transações que nós mesmos criamos localmente
      if (event.transaction.origin === 'tldraw-local') {
        return;
      }

      const toPut: TLRecord[] = [];
      const toRemove: TLRecord['id'][] = [];

      event.keysChanged.forEach((key) => {
        const change = event.changes.keys.get(key);
        if (change) {
          if (change.action === 'add' || change.action === 'update') {
            const val = ymap.get(key);
            if (val) {
              toPut.push(val);
            }
          } else if (change.action === 'delete') {
            toRemove.push(key as TLRecord['id']);
          }
        }
      });

      // Aplica as alterações remotas de forma segura na store
      if (toPut.length > 0 || toRemove.length > 0) {
        store.mergeRemoteChanges(() => {
          if (toPut.length > 0) {
            store.put(toPut);
          }
          if (toRemove.length > 0) {
            store.remove(toRemove);
          }
        });
      }
    };

    ymap.observe(handleYMapObserve);

    // Limpeza ao desmontar ou mudar dependências
    return () => {
      cleanupStoreListener();
      ymap.unobserve(handleYMapObserve);
    };
  }, [ydoc, isDocLoaded, store]);

  return storeWithStatus;
}
