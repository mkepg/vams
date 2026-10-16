import { useEffect } from 'react';
import { useVamsStore } from '@/core/store';
import { useMyScenesDialog } from '@/features/scene-library';
import { applyEditorLink, parseEditorLink, stripEditorLinkParams } from './editor-link';
import { openSharedScene } from './open-shared';
import { parseShareLink } from './share-link';

const openLibrary = () => useMyScenesDialog.getState().open();

/**
 * Apply a ?lesson=, ?scene= or shared link once when the editor mounts, and a #s= link whenever the
 * hash changes. The link is removed from the URL first, so a reload (or a crash mid-way) never applies it twice.
 */
export function useEditorLink(): void {
  useEffect(() => {
    const apply = () => {
      const { pathname, search, hash } = window.location;
      const share = parseShareLink(pathname, hash);
      const link = parseEditorLink(search);
      if (!share && link.kind === 'none') return;
      const path = share ? '/app' : pathname;
      window.history.replaceState(window.history.state, '', `${path}${stripEditorLinkParams(search)}${share ? '' : hash}`);
      if (share) {
        useVamsStore.getState().markWelcomeSeen();
        void openSharedScene(share, { openLibrary });
        return;
      }
      void applyEditorLink(link, { openLibrary });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
}
