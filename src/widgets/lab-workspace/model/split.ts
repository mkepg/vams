/**
 * Marey's split: the code over the log on the left, the stage on the right, a handle between the
 * panes and one between the code and the log. Below 760 px the panes stack, stage first, then the
 * code and the log, with no handles.
 */
import type { JSX } from 'preact';

export interface SplitLimits {
  initial: number;
  min: number;
  max: number;
}

/** The left pane's share of the width. The stage keeps at least a fifth. */
export const PANE_SPLIT: SplitLimits = { initial: 0.52, min: 0.2, max: 0.8 };
/** The code's share of the left pane's height, above the log. */
export const LOG_SPLIT: SplitLimits = { initial: 0.72, min: 0.3, max: 0.88 };
/** One arrow key's move, and Shift with an arrow. */
export const SPLIT_STEP = 0.02;
export const SPLIT_PAGE = 0.1;
/** Marey's breakpoint: narrower than 760 px. */
export const NARROW_QUERY = '(max-width: 759px)';
/** The handles' thickness. */
export const HANDLE_SIZE = 6;

/** A ratio held to its limits, to a thousandth. */
export function clampSplit(value: number, limits: SplitLimits): number {
  return Math.round(Math.min(limits.max, Math.max(limits.min, value)) * 1000) / 1000;
}

const fr = (n: number) => `minmax(0, ${Math.round(n * 1000) / 1000}fr)`;

/** The split's grid: the panes' shares, with the log folded to its bar or not. */
export function splitStyle(options: { narrow: boolean; pane: number; log: number; logFolded: boolean }): JSX.CSSProperties {
  if (options.narrow) {
    return { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'auto auto auto', gridTemplateAreas: '"stage" "code" "log"' };
  }
  const { pane, log, logFolded } = options;
  return {
    gridTemplateColumns: `${fr(pane)} ${HANDLE_SIZE}px ${fr(1 - pane)}`,
    gridTemplateRows: logFolded ? 'minmax(0, 1fr) auto' : `${fr(log)} ${HANDLE_SIZE}px ${fr(1 - log)}`,
    gridTemplateAreas: logFolded ? '"code panes stage" "log panes stage"' : '"code panes stage" "log-handle panes stage" "log panes stage"',
  };
}
