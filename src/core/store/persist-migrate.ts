import { migrateLegacyCallbacks } from '@/core/callbacks/callbacks-model';

/**
 * Persisted store migrations. Version 7 kept a handler name per callback kind; version 8
 * keeps each callback's rules too. Version 9 drops the saved per-object animation, since
 * motion now comes from idle rules. Saves older than version 7 were always discarded, and
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
  if (version < 9) {
    state.objects = withoutAnimation(state.objects);
    state.sceneBackup = withoutAnimation(state.sceneBackup);
  }
  return state;
}

function withoutAnimation(objects: unknown): unknown {
  if (!Array.isArray(objects)) return objects;
  return objects.map((o) => {
    if (!o || typeof o !== 'object') return o;
    const copy = { ...(o as Record<string, unknown>) };
    delete copy.animation;
    return copy;
  });
}
