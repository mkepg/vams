import Logo from '@/shared/ui/logo';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import { NAV_LINKS } from '../model/nav';
import './site-header.scss';

export default function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="site-header__home" href="/" aria-label="VAMS home">
          <Logo />
        </a>
        <nav className="site-header__nav" aria-label="Site">
          {NAV_LINKS.map((link) => (
            <a key={link.href} className="site-header__link" href={link.href}>{link.label}</a>
          ))}
        </nav>
        <div className="site-header__actions">
          <ThemeToggleButton className="site-header__theme" />
          <a className="site-header__cta" href="/app">Open the app</a>
        </div>
      </header>
    </>
  );
}
