/**
 * WHITE-BOX TEST — confirm() store
 * The imperative, promise-based confirmation used to replace native window.confirm.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useConfirmStore, confirm } from '@/shared/ui/confirm-dialog/confirm-store';

describe('confirm store', () => {
  beforeEach(() => {
    useConfirmStore.setState({ open: false, options: null, resolve: null });
  });

  it('opens with the provided options', () => {
    confirm({ title: 'Delete?', message: 'Sure?', tone: 'danger' });
    const state = useConfirmStore.getState();
    expect(state.open).toBe(true);
    expect(state.options?.title).toBe('Delete?');
    expect(state.options?.tone).toBe('danger');
  });

  it('resolves true when confirmed and closes', async () => {
    const promise = confirm({ title: 'Proceed?' });
    useConfirmStore.getState().handleConfirm();
    await expect(promise).resolves.toBe(true);
    expect(useConfirmStore.getState().open).toBe(false);
  });

  it('resolves false when cancelled and closes', async () => {
    const promise = confirm({ title: 'Proceed?' });
    useConfirmStore.getState().handleCancel();
    await expect(promise).resolves.toBe(false);
    expect(useConfirmStore.getState().open).toBe(false);
  });
});
