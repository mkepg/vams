import './styles/fonts';
import './styles/global.scss';
import './styles/site-page.scss';
import { hydrate } from 'preact-iso';
import SiteApp from './SiteApp';

if (typeof window !== 'undefined') {
  hydrate(<SiteApp />, document.getElementById('root')!);
}

// Loaded on demand so server-only rendering code stays out of the browser bundle.
export async function prerender(data: { url: string }) {
  const { prerender: render } = await import('./prerender');
  return render(data);
}
