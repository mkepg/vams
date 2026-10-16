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
