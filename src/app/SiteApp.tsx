import { ErrorBoundary, LocationProvider, Route, Router } from 'preact-iso';
import HomePage from '@/pages/home';
import EditorPage from '@/pages/editor';
import NotFoundPage from '@/pages/not-found';
import { findRouteMeta } from '@/app/routes/route-meta';
import UpdateNotice from '@/app/pwa/UpdateNotice';

/** Prerendering sets each page's title; client-side navigation keeps it in step. */
function syncDocumentTitle(url: string) {
  document.title = findRouteMeta(url.split(/[?#]/)[0]).title;
}

/** The editor has its own boundary with a recovery screen; other pages only log. */
function logRenderError(error: unknown) {
  console.error('Render error', error);
}

export default function SiteApp() {
  return (
    <LocationProvider>
      <ErrorBoundary onError={logRenderError}>
        <Router onRouteChange={syncDocumentTitle}>
          <Route path="/" component={HomePage} />
          <Route path="/app" component={EditorPage} />
          <Route default component={NotFoundPage} />
        </Router>
      </ErrorBoundary>
      <UpdateNotice />
    </LocationProvider>
  );
}
