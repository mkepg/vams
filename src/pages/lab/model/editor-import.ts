import { openImport } from '@/features/lab-files';
import { LAB_IMPORT_PARAM, takeLabImport } from '@/shared/lib/lab-import';

/** The address without ?import=, so a reload never looks for the work again. */
function leaveImportParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(LAB_IMPORT_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * At /lab?import=1, opens what the editor's Open in Lab kept in sessionStorage: it replaces the
 * work the way Open and the examples do, asking first when the work is unsaved. The kept work
 * leaves storage whether or not it opens, and ?import= leaves the address.
 */
export async function openEditorImport(storage: Pick<Storage, 'getItem' | 'removeItem'>): Promise<void> {
  if (!new URLSearchParams(window.location.search).has(LAB_IMPORT_PARAM)) return;
  const imported = takeLabImport(storage);
  try {
    if (imported) await openImport(imported);
  } catch {
    // The student's work stays as it was.
  } finally {
    leaveImportParam();
  }
}
