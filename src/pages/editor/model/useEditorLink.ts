import { useEffect, useState } from 'react';
import { useVamsStore } from '@/core/store';
import { useMyScenesDialog } from '@/features/scene-library';
import { applyEditorLink, parseEditorLink, stripEditorLinkParams } from './editor-link';
import { openSharedScene } from './open-shared';
import { parseShareLink } from './share-link';

const openLibrary = () => useMyScenesDialog.getState().open();

/** The longest the editor stays covered while a link opens; a stalled backup or fetch then shows the editor anyway. */
export const OPENING_COVER_MS = 4000;

/** Whether the current URL carries a scene to open (a lesson link applies at once and never needs a cover). */
function opensScene(): boolean {
  const { pathname, search, hash } = window.location;
  return parseShareLink(pathname, hash) !== null || parseEditorLink(search).kind === 'scene';
}

/**
 * Apply a ?lesson=, ?scene= or shared link once when the editor mounts, and a #s= link whenever the
 * hash changes. The link is removed from the URL first, so a reload (or a crash mid-way) never applies it twice.
 * Returns true while a linked scene is still opening, so the editor can hide the saved scene it replaces.
 */
export function useEditorLink(): boolean {
  const [opening, setOpening] = useState(opensScene);
  useEffect(() => {
    let pending = 0;
    let cover: ReturnType<typeof setTimeout> | undefined;
    const track = (work: Promise<unknown>) => {
      pending++;
      setOpening(true);
      clearTimeout(cover);
      cover = setTimeout(() => setOpening(false), OPENING_COVER_MS);
      void work.finally(() => {
        if (--pending > 0) return;
        clearTimeout(cover);
        setOpening(false);
      });
    };
    const apply = () => {
      const { pathname, search, hash } = window.location;
      const share = parseShareLink(pathname, hash);
      const link = parseEditorLink(search);
      if (!share && link.kind === 'none') return setOpening(false);
      const path = share ? '/app' : pathname;
      window.history.replaceState(window.history.state, '', `${path}${stripEditorLinkParams(search)}${share ? '' : hash}`);
      if (share) {
        useVamsStore.getState().markWelcomeSeen();
        track(openSharedScene(share, { openLibrary }));
        return;
      }
      track(applyEditorLink(link, { openLibrary }));
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => {
      clearTimeout(cover);
      window.removeEventListener('hashchange', apply);
    };
  }, []);
  return opening;
}
