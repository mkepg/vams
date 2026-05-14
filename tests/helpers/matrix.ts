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
