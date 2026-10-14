export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}

/** Space kept between the callout, the regions and the window edge. */
export const CALLOUT_GAP = 12;

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/**
 * Where the callout goes: beside a spotlighted region, never covering any region, inside the window.
 * Each region's right, left, bottom and top are tried in turn and the first spot that covers no region
 * wins. With no such spot, the one covering the regions least wins; with no regions, the bottom centre.
 */
export function placeCallout(
  regions: readonly Box[],
  viewport: Size,
  callout: Size,
  gap = CALLOUT_GAP,
): { left: number; top: number } {
  if (regions.length === 0) {
    return {
      left: Math.max(gap, (viewport.width - callout.width) / 2),
      top: Math.max(gap, viewport.height - gap - callout.height),
    };
  }
  const clampLeft = (left: number) => Math.max(gap, Math.min(left, viewport.width - gap - callout.width));
  const clampTop = (top: number) => Math.max(gap, Math.min(top, viewport.height - gap - callout.height));
  const at = (left: number, top: number): Box => ({ left: clampLeft(left), top: clampTop(top), ...callout });
  const candidates = regions.flatMap((r) => [
    at(r.left + r.width + gap, r.top),
    at(r.left - gap - callout.width, r.top),
    at(r.left, r.top + r.height + gap),
    at(r.left, r.top - gap - callout.height),
  ]);
  let best = candidates[0];
  let bestCost = Infinity;
  for (const box of candidates) {
    const cost = regions.reduce((sum, r) => sum + overlapArea(box, r), 0);
    if (cost < bestCost) {
      best = box;
      bestCost = cost;
    }
    if (cost === 0) break;
  }
  return { left: best.left, top: best.top };
}
