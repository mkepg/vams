import { TEMPLATE, useLabStore } from '@/entities/lab-project';
import { mayReplaceWork, type Ask } from './replace';

// The template is the store's first program too, so it lives with the store.
export { TEMPLATE };

/** New: the template and an empty file list, once unsaved changes may go. Resolves whether it replaced the work. */
export async function newWork(ask?: Ask): Promise<boolean> {
  if (!(await mayReplaceWork(ask))) return false;
  await useLabStore.getState().replaceWork({ source: TEMPLATE, files: [] });
  return true;
}
