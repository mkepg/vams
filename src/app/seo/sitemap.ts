import { ROUTES, type RouteMeta } from '../routes/route-meta';
import { absoluteUrl } from './head';

export function buildSitemap(siteUrl: string, routes: readonly RouteMeta[] = ROUTES): string {
  const urls = routes
    .filter((route) => route.indexable)
    .map((route) => `  <url><loc>${absoluteUrl(siteUrl, route.path)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}\n`;
}
