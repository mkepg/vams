export interface RouteMeta {
  /** Normalised path without a trailing slash; '/' for home. */
  path: string;
  title: string;
  description: string;
  /** Whether search engines may index the page (also controls sitemap inclusion). */
  indexable: boolean;
}

export const SITE_NAME = 'VAMS';
export const DEFAULT_SITE_URL = 'https://panic-vams.netlify.app';

/** Add a route here only when its page is finished. */
export const ROUTES: readonly RouteMeta[] = [
  {
    path: '/',
    title: 'VAMS — See the OpenGL behind every shape',
    description:
      'Build 2D scenes by hand and watch VAMS write the OpenGL 1.5 code that draws them, with the math underneath, live in your browser.',
    indexable: true,
  },
  {
    path: '/app',
    title: 'VAMS Editor',
    description: 'Author 2D scenes and read the generated OpenGL 1.5 code and math side by side.',
    indexable: false,
  },
  {
    path: '/404',
    title: 'Page not found — VAMS',
    description: 'The page you were looking for is not here.',
    indexable: false,
  },
];

export function findRouteMeta(pathname: string): RouteMeta {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const match = ROUTES.find((route) => route.path === clean);
  if (match) return match;
  const notFound = ROUTES.find((route) => route.path === '/404');
  if (!notFound) throw new Error('ROUTES must contain a /404 entry');
  return notFound;
}
