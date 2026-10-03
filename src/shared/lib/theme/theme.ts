export type SiteTheme = 'vellum' | 'blueprint';

export const THEME_STORAGE_KEY = 'vams-theme';
export const DEFAULT_THEME: SiteTheme = 'vellum';

type ThemeListener = (theme: SiteTheme) => void;
const listeners = new Set<ThemeListener>();

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === 'vellum' || value === 'blueprint';
}

export function readStoredTheme(): SiteTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isSiteTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function getActiveTheme(): SiteTheme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const applied = document.documentElement.dataset.theme;
  return isSiteTheme(applied) ? applied : readStoredTheme();
}

export function applyTheme(theme: SiteTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
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
  listeners.forEach((listener) => listener(theme));
}

export function toggleTheme(): SiteTheme {
  const next: SiteTheme = getActiveTheme() === 'vellum' ? 'blueprint' : 'vellum';
  setTheme(next);
  return next;
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The editor store and `.vams` files still record the theme as 'dark' | 'light'. */
export function toEditorTheme(theme: SiteTheme): 'dark' | 'light' {
  return theme === 'blueprint' ? 'dark' : 'light';
}
