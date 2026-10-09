import type { ComponentChildren } from 'preact';
import Logo from '@/shared/ui/logo';
import './site-footer.scss';

const REPO_URL = 'https://github.com/mkepg/vams';

export default function SiteFooter({ actions }: { actions?: ComponentChildren }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <Logo plate />
        <p>Visual Animation Modeling Simulator</p>
      </div>
      <p className="site-footer__credits">
        An undergraduate thesis project, FEU Institute of Technology. Gomez, Taguiam and Vizco.
      </p>
      <p className="site-footer__links">
        <a href={REPO_URL} rel="noopener">Source on GitHub</a>
        <span>MIT License</span>
      </p>
      {actions && <div className="site-footer__actions">{actions}</div>}
    </footer>
  );
}
