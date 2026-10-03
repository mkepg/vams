import { useEffect, useState } from 'react';
import { DEFAULT_THEME, getActiveTheme, subscribeTheme, type SiteTheme } from './theme';

export function useSiteTheme(): SiteTheme {
  const [theme, setThemeState] = useState<SiteTheme>(DEFAULT_THEME);
  useEffect(() => {
    // Two-pass render: the first pass must match the prerendered HTML, so the stored theme is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(getActiveTheme());
    return subscribeTheme(setThemeState);
  }, []);
  return theme;
}
