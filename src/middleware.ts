export { auth as middleware } from '@/auth';

export const config = {
  matcher: [
    '/',
    '/login',
    '/api/canvas/:path*',
    '/api/auth/:path*',
  ],
};
