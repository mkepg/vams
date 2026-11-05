/** The sessionStorage key that marks the page's one automatic reload. */
export const ISOLATION_RELOAD_KEY = 'vams-lab-isolation-reload';

export type IsolationOutcome = 'ready' | 'reloading' | 'needs-reload';

export interface IsolationEnv {
  crossOriginIsolated: boolean;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  reload: () => void;
}

/**
 * The program's worker shares memory with the page, which only an isolated page may do. A page
 * that arrives without isolation (served from a cache that predates the headers, say) reloads
 * once; if the reload doesn't isolate it either, the page asks the student to reload.
 */
export function ensureIsolation(env: IsolationEnv): IsolationOutcome {
  const mark = (): string | null => {
    try {
      return env.storage.getItem(ISOLATION_RELOAD_KEY);
    } catch {
      return null;
    }
  };
  if (env.crossOriginIsolated) {
    try {
      env.storage.removeItem(ISOLATION_RELOAD_KEY);
    } catch {
      /* storage can be blocked */
    }
    return 'ready';
  }
  if (mark() !== null) return 'needs-reload';
  try {
    env.storage.setItem(ISOLATION_RELOAD_KEY, '1');
  } catch {
    // Without a mark a reload could repeat for ever, so ask instead.
    return 'needs-reload';
  }
  env.reload();
  return 'reloading';
}
