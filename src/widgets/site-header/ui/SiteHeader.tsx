import Logo from '@/shared/ui/logo';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import { NAV_LINKS } from '../model/nav';
import SiteSearch from './SiteSearch';
import './site-header.scss';

export default function SiteHeader({ current }: { current?: string } = {}) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="site-header__home" href="/" aria-label="VAMS home">
          <Logo />
        </a>
        <nav className="site-header__nav" aria-label="Site">
          {/* The site's pages as one switcher; the current page is the raised segment. */}
          <ul className="site-header__pages">
            {NAV_LINKS.map(({ href, label, icon: Icon, native }) => (
              <li key={href}>
                <a className="site-header__link" href={href} target={native ? '_top' : undefined} aria-current={href === current ? 'page' : undefined}>
                  {Icon && <Icon aria-hidden="true" />}
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          <SiteSearch />
          <ThemeToggleButton className="site-header__theme" />
          {/* The Lab is a tool too, so the button names the one it opens; narrow screens show the short label. */}
          <a className="site-header__cta" href="/app" aria-label="Open the editor">
            <span className="site-header__cta-long">Open the editor</span>
            <span className="site-header__cta-short" aria-hidden="true">Editor</span>
          </a>
        </div>
      </header>
    </>
  );
}
