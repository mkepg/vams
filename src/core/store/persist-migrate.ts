import { migrateLegacyCallbacks } from '@/core/callbacks/callbacks-model';

/**
 * Persisted store migrations. Version 7 kept a handler name per callback kind; version 8
 * keeps each callback's rules too. Saves older than version 7 were always discarded, and
 * still are: they start from a blank editor.
 */
export function migratePersistedState(persisted: unknown, version: number): unknown {
  if (version < 7) return {};
  if (!persisted || typeof persisted !== 'object') return persisted;
  const state = { ...(persisted as Record<string, unknown>) };
  if (version < 8) {
    state.callbacks = migrateLegacyCallbacks(state.callbacks);
    state.callbacksBackup = state.callbacksBackup == null ? null : migrateLegacyCallbacks(state.callbacksBackup);
  }
  return state;
}
