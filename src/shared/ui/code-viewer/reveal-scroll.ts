/** Room left above a line the code scrolls to the top. */
export const REVEAL_PADDING = 24;

/** Beyond this many screens a scroll jumps: a long glide lands after Run's flash has faded. */
const GLIDE_SCREENS = 2;

/**
 * Where the code scrolls to show lines that start `top` px down it and run `height` px: centred
 * when they fit, else from the top with a little room.
 */
export function revealTop(top: number, height: number, viewHeight: number): number {
  const padded = top - REVEAL_PADDING;
  const centred = top - viewHeight / 2 + height / 2;
  return Math.max(0, height > viewHeight * 0.7 || centred > padded ? padded : centred);
}

/** A short way glides; a long way, or any way with reduced motion, jumps. */
export function scrollBehavior(from: number, to: number, viewHeight: number, reduced: boolean): ScrollBehavior {
  return reduced || Math.abs(to - from) > viewHeight * GLIDE_SCREENS ? 'auto' : 'smooth';
}
