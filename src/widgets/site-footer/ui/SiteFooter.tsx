import { VertexMark } from '@/shared/ui/logo';
import './site-footer.scss';

const REPO_URL = 'https://github.com/mkepg/vams';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <VertexMark size={24} />
        <p>
          <strong>VAMS</strong> · Visual Animation Modeling Simulator
        </p>
      </div>
      <p className="site-footer__credits">
        An undergraduate thesis project, FEU Institute of Technology. Gomez · Taguiam · Vizco.
      </p>
      <p className="site-footer__links">
        <a href={REPO_URL} rel="noopener">Source on GitHub</a> · MIT License
      </p>
    </footer>
  );
}
