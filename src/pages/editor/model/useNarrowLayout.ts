import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 1099.98px)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

function snapshot() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

/** True below 1100 CSS px, where the section column becomes a drawer. */
export function useNarrowLayout(): boolean {
  return useSyncExternalStore(subscribe, snapshot);
}
