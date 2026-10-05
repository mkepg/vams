import { useEffect } from 'react';
import { useMyScenesDialog } from '@/features/scene-library';
import { applyEditorLink, parseEditorLink, stripEditorLinkParams } from './editor-link';

const openLibrary = () => useMyScenesDialog.getState().open();

/**
 * Apply a ?lesson= or ?scene= link once when the editor mounts. The parameter is removed from the
 * URL first, so a reload (or a crash mid-way) never applies it twice.
 */
export function useEditorLink(): void {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const link = parseEditorLink(search);
    if (link.kind === 'none') return;
    window.history.replaceState(window.history.state, '', `${pathname}${stripEditorLinkParams(search)}${hash}`);
    void applyEditorLink(link, { openLibrary });
  }, []);
}
