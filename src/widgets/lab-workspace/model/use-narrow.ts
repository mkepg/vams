import { useEffect, useState } from 'react';
import { NARROW_QUERY } from './split';

const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null);

/**
 * True while the viewport is narrower than 760 px; updates when it crosses. The first render is
 * always false, as the prerendered page is, so hydration matches it; the real value is read after.
 */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const list = query();
    if (!list) return;
    const update = () => setNarrow(list.matches);
    // Two-pass render: the second pass, after hydration, takes the screen's layout.
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, []);
  return narrow;
}
