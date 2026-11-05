import { useLabStore } from '@/entities/lab-project';
import { confirm, type ConfirmOptions } from '@/shared/ui/confirm-dialog/confirm-store';

export type Ask = (options: ConfirmOptions) => Promise<boolean>;

export const REPLACE_QUESTION: ConfirmOptions = {
  title: 'Replace your work?',
  message: 'Your code or files have changed since you last saved them with Save. Replacing them loses those changes, here and in this browser.',
  confirmLabel: 'Replace',
  cancelLabel: 'Keep my work',
  tone: 'danger',
};

/** Whether New, Open or an example may replace the work: at once when it is saved, or when the student agrees. */
export async function mayReplaceWork(ask: Ask = confirm): Promise<boolean> {
  if (!useLabStore.getState().unsaved) return true;
  return ask(REPLACE_QUESTION);
}
