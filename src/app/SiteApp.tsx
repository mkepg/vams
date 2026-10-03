import { ErrorBoundary, LocationProvider, Route, Router } from 'preact-iso';
import HomePage from '@/pages/home';
import EditorPage from '@/pages/editor';
import NotFoundPage from '@/pages/not-found';
import { findRouteMeta } from '@/app/routes/route-meta';

const CHUNK_RELOAD_FLAG = 'vams-chunk-reload';

/** Prerendering sets each page's title; client-side navigation keeps it in step. */
function syncDocumentTitle(url: string) {
  document.title = findRouteMeta(url.split(/[?#]/)[0]).title;
}

/**
 * A failed editor chunk load (for example a stale hashed file after a deploy)
 * would leave /app blank. Reload once per tab session to fetch fresh assets.
 */
function recoverFromRenderError() {
  if (typeof window === 'undefined') return;
  if (findRouteMeta(window.location.pathname).path !== '/app') return;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) return;
    sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
  } catch {
    return;
  }
  window.location.reload();
}

export default function SiteApp() {
  return (
    <LocationProvider>
      <ErrorBoundary onError={recoverFromRenderError}>
        <Router onRouteChange={syncDocumentTitle}>
          <Route path="/" component={HomePage} />
          <Route path="/app" component={EditorPage} />
          <Route default component={NotFoundPage} />
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  );
}
