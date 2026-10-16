/**
 * Reference 2D affine matrix implementation used to cross-check the
 * production code in src/entities/scene/model/scene-slice.ts.
 *
 * Matrices are represented as a 6-element row-major array:
 *   [ a, b, tx,
 *     c, d, ty ]
 * which corresponds to the affine transform
 *   x' = a·x + b·y + tx
 *   y' = c·x + d·y + ty
 */
export type Mat = readonly number[];

export const IDENTITY: Mat = [1, 0, 0, 0, 1, 0];

export function makeMatrix(t: {
  translateX: number;
  translateY: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
}): number[] {
  const rad = (t.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    t.scaleX * cos, -t.scaleY * sin, t.translateX,
    t.scaleX * sin,  t.scaleY * cos, t.translateY,
  ];
}

export function multiply(m1: Mat, m2: Mat): number[] {
  return [
    m1[0] * m2[0] + m1[1] * m2[3],
    m1[0] * m2[1] + m1[1] * m2[4],
    m1[0] * m2[2] + m1[1] * m2[5] + m1[2],
    m1[3] * m2[0] + m1[4] * m2[3],
    m1[3] * m2[1] + m1[4] * m2[4],
    m1[3] * m2[2] + m1[4] * m2[5] + m1[5],
  ];
}

export function transformPoint(m: Mat, p: { x: number; y: number }): { x: number; y: number } {
  return {
    x: m[0] * p.x + m[1] * p.y + m[2],
    y: m[3] * p.x + m[4] * p.y + m[5],
  };
}

export function matrixDistance(a: Mat, b: Mat): number {
  let s = 0;
  for (let i = 0; i < 6; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/** glOrtho's mapping of a point in the viewing volume to normalised device coordinates. */
export function orthoToNdc(
  p: { x: number; y: number },
  v: { minX: number; maxX: number; minY: number; maxY: number },
): { x: number; y: number } {
  return {
    x: (2 * (p.x - v.minX)) / (v.maxX - v.minX) - 1,
    y: (2 * (p.y - v.minY)) / (v.maxY - v.minY) - 1,
  };
}

/**
 * A Keep proportions reshape handler's viewing volume: the axis that is too short for the
 * window's width-to-height ratio grows about the volume's centre until the two ratios match.
 */
export function keepAspectBounds(
  v: { minX: number; maxX: number; minY: number; maxY: number },
  size: { width: number; height: number },
): { minX: number; maxX: number; minY: number; maxY: number } {
  const windowRatio = size.width / size.height;
  const w = v.maxX - v.minX;
  const h = v.maxY - v.minY;
  const midX = (v.minX + v.maxX) / 2;
  const midY = (v.minY + v.maxY) / 2;
  if (w / h <= windowRatio) {
    const half = (h * windowRatio) / 2;
    return { minX: midX - half, maxX: midX + half, minY: v.minY, maxY: v.maxY };
  }
  const half = w / windowRatio / 2;
  return { minX: v.minX, maxX: v.maxX, minY: midY - half, maxY: midY + half };
}

/** The default viewport's mapping of NDC to window pixels, counted from the bottom-left as OpenGL does. */
export function ndcToWindow(p: { x: number; y: number }, size: { width: number; height: number }): { x: number; y: number } {
  // NDC exactly +1 is the last pixel; anything beyond ±1 keeps its real, unclamped pixel.
  // Rounding error under a millionth of a pixel is ignored, so 699.9999999999999 is pixel 700.
  const at = (v: number, n: number) => {
    const w = Math.round(((v + 1) / 2) * n * 1e6) / 1e6;
    return w === n ? n - 1 : Math.floor(w);
  };
  return { x: at(p.x, size.width), y: at(p.y, size.height) };
}
