/**
 * Chave pública do tldraw — obrigatória em produção (HTTPS fora de localhost).
 * Obtenha trial (100 dias) ou hobby (não comercial): https://tldraw.dev/get-a-license
 */
export const TLDRAW_LICENSE_KEY =
  process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY?.trim() ?? '';

export function isTldrawLicenseConfigured(): boolean {
  return TLDRAW_LICENSE_KEY.length > 0;
}

/** Espelha a detecção de produção do @tldraw/editor LicenseManager */
export function isTldrawProductionHost(): boolean {
  if (typeof window === 'undefined') return false;

  const { protocol, hostname } = window.location;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost');

  if (isLocal) return false;

  return protocol === 'https:' || protocol === 'http:';
}

export function needsTldrawLicenseKey(): boolean {
  return isTldrawProductionHost() && !isTldrawLicenseConfigured();
}
