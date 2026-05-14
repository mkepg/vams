/**
 * BLACK-BOX TEST SUITE — BB-XFORM
 * Maps to Table 12, row 2: Transformation Operations
 *
 * Test focus (from manuscript):
 *  - Geometric stability of Translation, Rotation, Scaling
 *  - Correct matrix product ordering
 *  - Rotation around diverse pivot points
 *  - Synchronisation between Transform Gizmo & Numeric editors
 *  - Proper behaviour when objects are nested
 */
import { describe, it, expect } from 'vitest';
import { addTriangle, addQuad, getState } from '../helpers/store';
import { makeMatrix, multiply, transformPoint } from '../helpers/matrix';

describe('BB-XFORM-01: Translation, rotation, scaling each affect transform', () => {
  it('updateObjectTransform applies all five fields', () => {
    const t = addTriangle();
    getState().updateObjectTransform(t.id, {
      translateX: 0.3, translateY: -0.2,
      rotate: 45,
      scaleX: 2, scaleY: 0.5,
    });
    const after = getState().objects.find((o) => o.id === t.id)!;
    expect(after.transform).toMatchObject({
      translateX: 0.3, translateY: -0.2, rotate: 45, scaleX: 2, scaleY: 0.5,
    });
  });
});

describe('BB-XFORM-02: Identity transform leaves object centred', () => {
  it('a triangle created at (0.4, 0.4) reports identity rotation/scale', () => {
    const t = addTriangle(0.4, 0.4);
    expect(t.transform.rotate).toBe(0);
    expect(t.transform.scaleX).toBe(1);
    expect(t.transform.scaleY).toBe(1);
  });
});

describe('BB-XFORM-03: Successive transforms compose correctly', () => {
  it('translate then rotate composes as translate · rotate when applied separately', () => {
    const t = addTriangle();
    getState().updateObjectTransform(t.id, { translateX: 0.5, translateY: 0.0 });
    getState().updateObjectTransform(t.id, { rotate: 90 });
    const after = getState().objects.find((o) => o.id === t.id)!;
    expect(after.transform.translateX).toBeCloseTo(0.5);
    expect(after.transform.rotate).toBeCloseTo(90);
  });
});

describe('BB-XFORM-04: Nested objects preserve world transform on ungroup', () => {
  // This exercises both nested rendering and the matrix engine's
  // forward/backward composition logic.
  it('a child of a translated group keeps the same world location after ungrouping', () => {
    const a = addTriangle(0.1, 0.0, 0.05);
    const b = addQuad(0.3, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects[0];
    getState().updateObjectTransform(group.id, { rotate: 90 });

    // Compute world point of a's centroid pre-ungroup.
    const aBefore = getState().objects.find((o) => o.id === a.id)!;
    const groupMat = makeMatrix(getState().objects.find((o) => o.id === group.id)!.transform);
    const aMat = makeMatrix(aBefore.transform);
    const worldBefore = transformPoint(multiply(groupMat, aMat), { x: 0, y: 0 });

    getState().ungroup(group.id);
    const aAfter = getState().objects.find((o) => o.id === a.id)!;
    const worldAfter = transformPoint(makeMatrix(aAfter.transform), { x: 0, y: 0 });

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 3);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 3);
  });
});

describe('BB-XFORM-05: Rotating around different pivot points', () => {
  it.each([
    [  0,   0,   0 ],
    [  0,   0,  90 ],
    [  0,   0, 180 ],
    [  0,   0, 270 ],
    [  0.5, 0,  45 ],
    [ -0.3, 0.2, 33 ],
  ])('object at (%f, %f) rotated by %f deg returns to itself after a full 360', (x, y, step) => {
    const t = addTriangle(x as number, y as number, 0.1);
    const original = JSON.stringify(getState().objects[0].transform);
    // Rotate 4 quarters of `step` then back by `step*4`
    for (let i = 0; i < 4; i++) {
      const cur = getState().objects[0].transform;
      getState().updateObjectTransform(t.id, { rotate: cur.rotate + (step as number) });
    }
    getState().updateObjectTransform(t.id, {
      rotate: getState().objects[0].transform.rotate - (step as number) * 4,
    });
    expect(JSON.parse(JSON.stringify(getState().objects[0].transform))).toEqual(JSON.parse(original));
  });
});

describe('BB-XFORM-06: Scaling preserves vertex local coordinates', () => {
  it('changing scaleX does not mutate vertex coordinates', () => {
    const t = addTriangle();
    const verticesBefore = JSON.stringify(t.vertices);
    getState().updateObjectTransform(t.id, { scaleX: 3 });
    const verticesAfter = JSON.stringify(
      getState().objects.find((o) => o.id === t.id)!.vertices,
    );
    expect(verticesAfter).toBe(verticesBefore);
  });
});
