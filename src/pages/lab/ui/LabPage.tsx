import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { LabWorkspace } from '@/widgets/lab-workspace';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import { useSiteTheme } from '@/shared/lib/theme';
import { LAB_COPY } from '../model/copy';
import { openEditorImport } from '../model/editor-import';
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
  const theme = useSiteTheme();

  useEffect(() => {
    // Only the browser knows whether the page is isolated, so the server's page renders the workspace.
    const storage = sessionStore();
    const isolation = ensureIsolation({ crossOriginIsolated: window.crossOriginIsolated, storage, reload });
    setNeedsReload(isolation === 'needs-reload');
    // What the editor's Open in Lab sent waits in sessionStorage until the page that can run it.
    if (isolation === 'ready') void openEditorImport(storage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The workspace is a whole-window tool with its own top bar; only the reload notice is a site page.
  // The page hosts the one confirm dialog that New, Open, the examples and Open in Lab ask through, and the
  // toasts that say Share's link was copied.
  if (!needsReload)
    return (
      <>
        <LabWorkspace />
        <ConfirmDialog />
        <Toaster position="bottom-center" theme={theme} />
      </>
    );

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
