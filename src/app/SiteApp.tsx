import { useEffect } from 'react';
import { ErrorBoundary, LocationProvider, Route, Router, lazy } from 'preact-iso';
import HomePage from '@/pages/home';
import LearnPage from '@/pages/learn';
import AboutPage from '@/pages/about';
import GalleryPage from '@/pages/gallery';
import GuidePage from '@/pages/guide';
import TeachPage from '@/pages/teach';
import { LAB_ENABLED } from '@/shared/config/lab';
import EditorPage from '@/pages/editor';
import NotFoundPage from '@/pages/not-found';
import { findRouteMeta } from '@/app/routes/route-meta';
import UpdateNotice from '@/app/pwa/UpdateNotice';
import { followSystemTheme } from '@/shared/lib/theme';

/**
 * The Lab loads on its own, and only in a build that has it, so the pages every visitor sees never
 * carry the Lab's code. preact-iso waits for it when prerendering and keeps the prerendered page
 * while it hydrates.
 */
const LabPage = LAB_ENABLED ? lazy(() => import('@/pages/lab')) : null;

/** Prerendering sets each page's title; client-side navigation keeps it in step. */
function syncDocumentTitle(url: string) {
  document.title = findRouteMeta(url.split(/[?#]/)[0]).title;
}

/** The editor has its own boundary with a recovery screen; other pages only log. */
function logRenderError(error: unknown) {
  console.error('Render error', error);
}

export default function SiteApp() {
  useEffect(() => {
    syncDocumentTitle(window.location.pathname);
    return followSystemTheme();
  }, []);
  return (
    <LocationProvider>
      <ErrorBoundary onError={logRenderError}>
        <Router onRouteChange={syncDocumentTitle}>
          <Route path="/" component={HomePage} />
          <Route path="/learn" component={LearnPage} />
          <Route path="/gallery" component={GalleryPage} />
          <Route path="/guide" component={GuidePage} />
          <Route path="/teach" component={TeachPage} />
          <Route path="/about" component={AboutPage} />
          {LabPage ? [<Route key="lab" path="/lab" component={LabPage} />] : []}
          <Route path="/app" component={EditorPage} />
          <Route path="/s/:id" component={EditorPage} />
          <Route default component={NotFoundPage} />
        </Router>
      </ErrorBoundary>
      <UpdateNotice />
    </LocationProvider>
  );
}
