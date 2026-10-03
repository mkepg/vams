import { ErrorBoundary, LocationProvider, Route, Router } from 'preact-iso';
import HomePage from '@/pages/home';
import EditorPage from '@/pages/editor';
import NotFoundPage from '@/pages/not-found';

export default function SiteApp() {
  return (
    <LocationProvider>
      <ErrorBoundary>
        <Router>
          <Route path="/" component={HomePage} />
          <Route path="/app" component={EditorPage} />
          <Route default component={NotFoundPage} />
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  );
}
