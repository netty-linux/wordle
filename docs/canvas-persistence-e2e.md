# Canvas persistence — checklist E2E

Workspace padrão: `default-canvas-room`  
Blob path: `canvas/{userId}/{canvasId}.yjs`

Ative logs detalhados: `?debugCanvas=1` ou `NEXT_PUBLIC_DEBUG_CANVAS=1` no `.env.local`.

## 1. Autosave + refresh

1. `npm run doctor` → tudo OK
2. `npm run dev` → login
3. Desenhe **um traço** visível
4. Aguarde **~2s** (debounce) ou **Ctrl+S**
5. **Network**
   - `POST /api/canvas/default-canvas-room` → **200**
   - Body JSON: `persisted: true`, `mergedBytes` > 0
6. **F5**
   - `GET /api/canvas/default-canvas-room` → **200** (octet-stream, não 404)
7. Desenho **ainda visível**

## 2. Logout + login (mesmo usuário)

1. Com desenho salvo, clique **Sair**
2. Login de novo (mesma conta)
3. `GET` → **200** + desenho visível

## 3. Logs esperados (com debug)

| Fase | Frontend | Backend (terminal / Vercel logs) |
|------|----------|----------------------------------|
| Load | `[canvas:debug] GET start` → `GET ok` | `[canvas] GET ok` |
| Draw | `doc update` → `flush scheduled` → `flush executing` | — |
| Save | `POST ok` | `[canvas] POST ok` + blobPath |
| F5 | `GET ok` → `[useYjsStore] Carregando N registros` | `[canvas] GET ok` |

## Se falhar (ordem)

1. **POST nunca aparece** → `isSyncReady` / `isTldrawHydrated` (ver `sync gate skip`)
2. **POST 401/403** → sessão / middleware
3. **POST 500** → Turso schema / Blob token (`npm run doctor`)
4. **POST 200, GET 404** → path errado ou outro `userId`
5. **GET 200, tela vazia** → hidratação tldraw (`useYjsStore` + `isDocLoaded`)
