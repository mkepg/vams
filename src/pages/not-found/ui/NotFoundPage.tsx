import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';

export default function NotFoundPage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main id="main" className="not-found">
        <p className="not-found__code">404</p>
        <h1 className="not-found__title">Page not found</h1>
        <p className="not-found__text">The page you were looking for is not here.</p>
        <p className="not-found__actions">
          <a href="/">Go to the home page</a> · <a href="/app">Open the app</a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
