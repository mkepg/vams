import { prerender as renderToHtml } from 'preact-iso';
import SiteApp from './SiteApp';
import { findRouteMeta } from './routes/route-meta';
import { buildHead } from './seo/head';
import { SITE_URL } from './seo/site-url';

export async function prerender(data: { url: string }) {
  const { html, links } = await renderToHtml(<SiteApp />);
  const pathname = new URL(data.url, 'http://localhost').pathname;
  return { html, links, head: buildHead(findRouteMeta(pathname), SITE_URL) };
}
