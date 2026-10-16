const PAD = 4;

/**
 * Moves a label's anchor point so the whole label stays at least PAD px inside the canvas.
 * Labels well inside are untouched.
 */
export function insetLabel(
  at: { x: number; y: number },
  size: { width: number; height: number },
  anchor: { x: number; y: number },
  screen: { width: number; height: number },
): { x: number; y: number } {
  const left = at.x - anchor.x * size.width;
  const top = at.y - anchor.y * size.height;
  const dx = Math.max(PAD - left, Math.min(0, screen.width - PAD - (left + size.width)));
  const dy = Math.max(PAD - top, Math.min(0, screen.height - PAD - (top + size.height)));
  return { x: at.x + dx, y: at.y + dy };
}

/** Rounding slack for the view's edges: world.toLocal can land a hair inside an edge tick. */
const EDGE_SLACK = 1e-6;

/** The multiples of `step` from `start` to `end`, keeping a tick that sits on either edge. */
export function tickRange(start: number, end: number, step: number): number[] {
  const first = Math.ceil(start / step - EDGE_SLACK);
  const last = Math.floor(end / step + EDGE_SLACK);
  const ticks: number[] = [];
  // Built from integer counts so ticks don't drift (0.1 + 0.2), and -0 reads as 0.
  for (let i = first; i <= last; i++) ticks.push(i * step + 0);
  return ticks;
}
