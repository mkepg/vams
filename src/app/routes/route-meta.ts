export interface RouteMeta {
  /** Normalised path without a trailing slash; '/' for home. */
  path: string;
  title: string;
  description: string;
  /** Whether search engines may index the page (also controls sitemap inclusion). */
  indexable: boolean;
}

export const SITE_NAME = 'VAMS';
export const DEFAULT_SITE_URL = 'https://vams.pages.dev';

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
    path: '/learn',
    title: 'Learn — VAMS',
    description:
      'The VAMS course map: five sections of short OpenGL 1.5 lessons, from the rendering pipeline to textures. Open any lesson in the editor.',
    indexable: true,
  },
  {
    path: '/gallery',
    title: 'Gallery — VAMS',
    description:
      'Finished scenes made in VAMS, from a jeepney street to a solar system. Open one in the editor, press Run, and read the OpenGL that draws it.',
    indexable: true,
  },
  {
    path: '/guide',
    title: 'Guide — VAMS',
    description:
      'How the VAMS editor works, what each section teaches, the keyboard shortcuts, and a glossary of the OpenGL terms the course uses.',
    indexable: true,
  },
  {
    path: '/teach',
    title: 'Teaching with VAMS',
    description:
      'For instructors: how the VAMS course lines up with an OpenGL class, the links that open a lesson or scene, running a lab, and a one-hour session plan.',
    indexable: true,
  },
  {
    path: '/about',
    title: 'About — VAMS',
    description:
      'Why VAMS exists, what it teaches, where your work is kept, and the undergraduate thesis behind it, with a citation to copy.',
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
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  // A stored share link opens in the editor, so it has the editor's title and metadata.
  const clean = trimmed.startsWith('/s/') ? '/app' : trimmed;
  const match = ROUTES.find((route) => route.path === clean);
  if (match) return match;
  const notFound = ROUTES.find((route) => route.path === '/404');
  if (!notFound) throw new Error('ROUTES must contain a /404 entry');
  return notFound;
}
