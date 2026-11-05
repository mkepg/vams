import { useEffect } from 'react';
import { useLabStore } from '@/entities/lab-project';
import { mayReplaceWork } from '@/features/lab-files';
import { LAB_SHARE_MESSAGES, LAB_SHARE_PARAM, openLabShare } from '@/features/share/lab';

/** The address without ?share=, so a reload never opens the link twice. */
function leaveShareParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(LAB_SHARE_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Opens /lab?share=<id> once, when the Lab mounts: the shared code and files replace the work the
 * way Open and the examples do, asking first when the work is unsaved. Then ?share= leaves the
 * address. `tell` says why a link can't be opened; `opened` runs once the work is in.
 */
export function useLabShareLink(opened: () => void, tell: (text: string) => void): void {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get(LAB_SHARE_PARAM);
    if (id === null) return;
    let live = true;
    void (async () => {
      try {
        const shared = await openLabShare(id);
        if (!live) return;
        if (!shared.ok) return tell(shared.message);
        if (!(await mayReplaceWork())) return;
        await useLabStore.getState().replaceWork(shared.work);
        if (live) opened();
      } catch {
        // Whatever went wrong, the link is the part the student can do something about.
        if (live) tell(LAB_SHARE_MESSAGES.damaged);
      } finally {
        if (live) leaveShareParam();
      }
    })();
    return () => {
      live = false;
    };
    // Once, as the page loads; the callbacks only change what the file list says.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
