import Logo from '@/shared/ui/logo';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import { NAV_LINKS } from '../model/nav';
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
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <a className="site-header__link" href={href} aria-current={href === current ? 'page' : undefined}>
                  {Icon && <Icon aria-hidden="true" />}
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          <ThemeToggleButton className="site-header__theme" />
          <a className="site-header__cta" href="/app">Open the app</a>
        </div>
      </header>
    </>
  );
}
