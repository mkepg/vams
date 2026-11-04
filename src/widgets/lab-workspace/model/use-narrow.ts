import { useEffect, useState } from 'react';
import { NARROW_QUERY } from './split';

const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null);

/** True while the viewport is narrower than 760 px; updates when it crosses. */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const list = query();
    if (!list) return;
    const update = () => setNarrow(list.matches);
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, []);
  return narrow;
}
