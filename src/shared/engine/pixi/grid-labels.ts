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

/** How the canvas grid is drawn: white on the black clear colour, back to front. */
export const GRID_STYLE = {
  minorAlpha: 0.035,
  majorAlpha: 0.085,
  axisAlpha: 0.22,
  numberAlpha: 0.38,
  /** Minor lines per numbered line. */
  minorPerMajor: 5,
  /** Minor lines closer than this on screen are left out. */
  minMinorPx: 6,
} as const;

/** The numbered ticks at `step` and the minor ticks between them, with no minor tick on a major one. */
export function gridLevels(start: number, end: number, step: number): { minor: number[]; major: number[] } {
  const major = tickRange(start, end, step);
  const minorStep = step / GRID_STYLE.minorPerMajor;
  const minor = tickRange(start, end, minorStep).filter((m) => {
    const k = Math.round(m / step);
    return Math.abs(m - k * step) > minorStep * 1e-6;
  });
  return { minor, major };
}
