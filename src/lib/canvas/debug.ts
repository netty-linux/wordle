/**
 * Logs de persistência do canvas.
 * Ative com DEBUG_CANVAS=1 (server) e/ou NEXT_PUBLIC_DEBUG_CANVAS=1 (client),
 * ou ?debugCanvas=1 na URL.
 */

export function isCanvasDebugEnabled(): boolean {
  if (process.env.DEBUG_CANVAS === '1') return true;
  if (process.env.NEXT_PUBLIC_DEBUG_CANVAS === '1') return true;

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugCanvas') === '1') return true;
  }

  return false;
}

export function canvasDebug(...args: unknown[]): void {
  if (isCanvasDebugEnabled()) {
    console.log('[canvas:debug]', ...args);
  }
}

export function canvasLog(label: string, data: Record<string, unknown>): void {
  console.log(`[canvas] ${label}`, data);
}

export function canvasLogError(
  label: string,
  data: Record<string, unknown>,
  error?: unknown
): void {
  const payload = {
    ...data,
    error: error instanceof Error ? error.message : String(error ?? ''),
    stack: error instanceof Error ? error.stack : undefined,
  };
  console.error(`[canvas] ${label}`, payload);
}
