/** Reads a `#rrggbb` custom property from <html> as a number for PixiJS, or returns the fallback. */
export function readCssColor(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(raw);
  return match ? parseInt(match[1], 16) : fallback;
}
