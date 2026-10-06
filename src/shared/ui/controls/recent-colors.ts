import { useSyncExternalStore } from 'react';

const MAX_RECENT = 8;
let recent: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Remembers a committed colour for this session (not persisted). */
export function pushRecentColor(hex: string) {
  const normalized = hex.toLowerCase();
  recent = [normalized, ...recent.filter((c) => c !== normalized)].slice(0, MAX_RECENT);
  notify();
}

export function getRecentColors(): string[] {
  return recent;
}

export function subscribeRecentColors(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetRecentColorsForTests() {
  recent = [];
  notify();
}

export function useRecentColors(): string[] {
  return useSyncExternalStore(subscribeRecentColors, getRecentColors);
}
