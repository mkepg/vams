import { useEffect, useState } from 'react';
import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { LabWorkspace } from '@/widgets/lab-workspace';
import { LAB_COPY } from '../model/copy';
import { ensureIsolation } from '../model/isolation';
import './lab-page.scss';

interface LabPageProps {
  /** Reloads the page; the tests replace it. */
  reload?: () => void;
}

/** sessionStorage, or a store that holds nothing when the browser blocks it (a reload then can't be marked). */
function sessionStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    return window.sessionStorage;
  } catch {
    return { getItem: () => null, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
  }
}

export default function LabPage({ reload = () => window.location.reload() }: LabPageProps) {
  const [needsReload, setNeedsReload] = useState(false);

  useEffect(() => {
    // Only the browser knows whether the page is isolated, so the server's page renders the workspace.
    setNeedsReload(ensureIsolation({ crossOriginIsolated: window.crossOriginIsolated, storage: sessionStore(), reload }) === 'needs-reload');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The workspace is a whole-window tool with its own top bar; only the reload notice is a site page.
  if (!needsReload) return <LabWorkspace />;

  return (
    <div className="site-page">
      <SiteHeader current="/lab" />
      <main id="main" className="lab">
        <div className="lab__intro">
          <h1 className="lab__title">{LAB_COPY.title}</h1>
          <p className="lab__lede">{LAB_COPY.lede}</p>
        </div>
        <p className="lab__notice" role="alert">
          {LAB_COPY.reloadMessage}{' '}
          <button type="button" className="lab__reload" onClick={reload}>
            {LAB_COPY.reload}
          </button>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
