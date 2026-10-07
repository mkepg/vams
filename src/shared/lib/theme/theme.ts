export type SiteTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'vams-theme';
/** Used only where no window exists (prerendering). In the browser the OS decides. */
export const DEFAULT_THEME: SiteTheme = 'light';

const DARK_QUERY = '(prefers-color-scheme: dark)';

type ThemeListener = (theme: SiteTheme) => void;
const listeners = new Set<ThemeListener>();

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === 'dark' || value === 'light';
}

/** Theme names written by builds before Ink + Cobalt. */
function migrateLegacy(value: string | null): SiteTheme | null {
  if (value === 'blueprint') return 'dark';
  if (value === 'vellum') return 'light';
  return null;
}

/** The student's explicit choice, or null when none is stored. Legacy names are rewritten in place. */
export function readStoredTheme(): SiteTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isSiteTheme(stored)) return stored;
    const migrated = migrateLegacy(stored);
    if (migrated) window.localStorage.setItem(THEME_STORAGE_KEY, migrated);
    return migrated;
  } catch {
    return null;
  }
}

export function systemTheme(): SiteTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return DEFAULT_THEME;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** The stored choice, else the operating system's scheme. */
export function resolveTheme(): SiteTheme {
  return readStoredTheme() ?? systemTheme();
}

export function getActiveTheme(): SiteTheme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const applied = document.documentElement.dataset.theme;
  return isSiteTheme(applied) ? applied : resolveTheme();
}

export function applyTheme(theme: SiteTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

function notify(theme: SiteTheme) {
  listeners.forEach((listener) => listener(theme));
}

export function setTheme(theme: SiteTheme): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable (private mode, quota); the theme still applies for this visit.
    }
  }
  applyTheme(theme);
  notify(theme);
}

export function toggleTheme(): SiteTheme {
  const next: SiteTheme = getActiveTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Follows OS scheme changes while the student has not chosen a theme. Returns the unsubscribe. */
export function followSystemTheme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (readStoredTheme() !== null) return;
    const next: SiteTheme = query.matches ? 'dark' : 'light';
    applyTheme(next);
    notify(next);
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** The editor store and `.vams` files record the theme as 'dark' | 'light', the same names. */
export function toEditorTheme(theme: SiteTheme): 'dark' | 'light' {
  return theme;
}
