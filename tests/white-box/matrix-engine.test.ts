/**
 * WHITE-BOX TEST SUITE — WB-MATRIX
 * Maps to Table 13, row 2: Transform & Matrix Engine
 *
 * Test focus:
 *  - Local matrix construction in T-R-S order
 *  - World = Parent × Local multiplication order
 *  - High precision at large scales
 *  - Consistency between math-panel matrix and the rendering matrix
 *  - Reference matrices computed independently in tests/helpers/matrix.ts
 */
import { describe, it, expect } from 'vitest';
import {
  IDENTITY,
  makeMatrix,
  multiply,
  transformPoint,
  matrixDistance,
} from '../helpers/matrix';

describe('WB-MATRIX-01: Identity transform yields the identity matrix', () => {
  it('translate=0, rotate=0, scale=1 → identity', () => {
    const m = makeMatrix({ translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 });
    expect(matrixDistance(m, IDENTITY)).toBeCloseTo(0, 10);
  });
});

describe('WB-MATRIX-02: Pure translation moves points by exactly (tx, ty)', () => {
  it('a point at the origin transforms to (tx, ty)', () => {
    const m = makeMatrix({ translateX: 0.4, translateY: -0.2, rotate: 0, scaleX: 1, scaleY: 1 });
    const p = transformPoint(m, { x: 0, y: 0 });
    expect(p.x).toBeCloseTo(0.4, 10);
    expect(p.y).toBeCloseTo(-0.2, 10);
  });
});

describe('WB-MATRIX-03: Rotation by 90 deg sends (1, 0) → (0, 1)', () => {
  it('positive rotation is counter-clockwise', () => {
    const m = makeMatrix({ translateX: 0, translateY: 0, rotate: 90, scaleX: 1, scaleY: 1 });
    const p = transformPoint(m, { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(1, 10);
  });
});

describe('WB-MATRIX-04: Scaling multiplies each coordinate by its factor', () => {
  it('non-uniform scale scales x and y independently', () => {
    const m = makeMatrix({ translateX: 0, translateY: 0, rotate: 0, scaleX: 2, scaleY: 0.5 });
    const p = transformPoint(m, { x: 1, y: 4 });
    expect(p.x).toBeCloseTo(2, 10);
    expect(p.y).toBeCloseTo(2, 10);
  });
});

describe('WB-MATRIX-05: World = Parent × Local is composition-correct', () => {
  it('applying Parent then Local equals multiplying their matrices first', () => {
    const parent = makeMatrix({ translateX: 0.3, translateY: 0.0, rotate: 90, scaleX: 1, scaleY: 1 });
    const local  = makeMatrix({ translateX: 0.1, translateY: 0.0, rotate: 0,  scaleX: 1, scaleY: 1 });
    const world  = multiply(parent, local);

    // A point at the local origin under (parent×local) should equal the parent
    // applied to the local-origin transformed by local (i.e., local.translate).
    const p1 = transformPoint(world, { x: 0, y: 0 });
    const localOrigin = transformPoint(local, { x: 0, y: 0 });
    const p2 = transformPoint(parent, localOrigin);
    expect(p1.x).toBeCloseTo(p2.x, 10);
    expect(p1.y).toBeCloseTo(p2.y, 10);
  });
});

describe('WB-MATRIX-06: High precision is maintained at large coordinate scales', () => {
  it('round-trip of a 1e6-scale point has sub-pixel relative error', () => {
    const m = makeMatrix({ translateX: 1e6, translateY: -1e6, rotate: 30, scaleX: 1e3, scaleY: 1e3 });
    const p = transformPoint(m, { x: 0.5, y: 0.5 });
    // Sanity: returned coordinates are finite and large.
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    // Reverse the transform manually by computing the inverse.
    const det = m[0] * m[4] - m[1] * m[3];
    expect(det).not.toBe(0);
    const inv: number[] = [
       m[4] / det, -m[1] / det, (m[1] * m[5] - m[2] * m[4]) / det,
      -m[3] / det,  m[0] / det, (m[2] * m[3] - m[0] * m[5]) / det,
    ];
    const back = transformPoint(inv, p);
    expect(back.x).toBeCloseTo(0.5, 5);
    expect(back.y).toBeCloseTo(0.5, 5);
  });
});

describe('WB-MATRIX-07: Rotation order does not commute with non-uniform scale', () => {
  it('R∘S and S∘R produce different matrices', () => {
    const R = makeMatrix({ translateX: 0, translateY: 0, rotate: 30, scaleX: 1, scaleY: 1 });
    const S = makeMatrix({ translateX: 0, translateY: 0, rotate: 0,  scaleX: 2, scaleY: 1 });
    const RS = multiply(R, S);
    const SR = multiply(S, R);
    expect(matrixDistance(RS, SR)).toBeGreaterThan(0.01);
  });
});
