/**
 * BLACK-BOX TEST SUITE — BB-PFIG
 * The Pipeline illustrations' geometry: the student's corners in world space, the primitives they make, and clipping.
 */
import { describe, it, expect } from 'vitest';
import type { SceneNode } from '@/core/types/scene';
import { chainOf, clipOutcome, clipPolygon, clipSegment, figureFrame, worldPoint, worldPrimitives } from '@/entities/scene/model/pipeline-geometry';
import { provokingOf } from '@/entities/scene/model/primitive-assembly';

const identity = { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 };
const quad: SceneNode = { id: 'q', name: 'Quad', type: 'QUADS', visible: true, shading: 'SMOOTH', vertices: [], transform: identity };
const volume = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const pt = (x: number, y: number) => ({ x, y });
const corners = (n: number) => Array.from({ length: n }, (_, k) => pt(k, k * k));

describe('BB-PFIG-01: Corners go through the transform chain in OpenGL order', () => {
  it('scales, rotates, then moves', () => {
    const node = { ...quad, transform: { translateX: 0.2, translateY: 0, rotate: 90, scaleX: 2, scaleY: 1 } };
    const p = worldPoint({ x: 0.5, y: 0 }, [node]);
    expect(p.x).toBeCloseTo(0.2);
    expect(p.y).toBeCloseTo(1);
  });
  it('applies an enclosing group after the shape', () => {
    const group: SceneNode = { ...quad, id: 'g', name: 'Group', type: 'GROUP', transform: { ...identity, translateX: 0.3 } };
    const child: SceneNode = { ...quad, parentId: 'g', transform: { ...identity, translateX: 0.1 } };
    const chain = chainOf(child, [group, child]);
    expect(chain.map((n) => n.id)).toEqual(['q', 'g']);
    const p = worldPoint({ x: 0, y: 0 }, chain);
    expect(p.x).toBeCloseTo(0.4);
    expect(p.y).toBeCloseTo(0);
  });
});

describe('BB-PFIG-02: Primitives follow the GL type', () => {
  it('makes two triangles from six corners', () => expect(worldPrimitives('TRIANGLES', corners(6)).map((p) => p.length)).toEqual([3, 3]));
  it('fans three triangles around corner 0', () => {
    const prims = worldPrimitives('TRIANGLE_FAN', corners(5));
    expect(prims).toHaveLength(3);
    prims.forEach((p) => expect(p[0]).toEqual(corners(5)[0]));
  });
  it('makes one quad from four corners', () => expect(worldPrimitives('QUADS', corners(4))).toHaveLength(1));
  it('closes a line loop with three segments', () => {
    const prims = worldPrimitives('LINE_LOOP', corners(3));
    expect(prims).toHaveLength(3);
    expect(prims[2]).toEqual([corners(3)[2], corners(3)[0]]);
  });
  it('makes a point of each corner', () => expect(worldPrimitives('POINTS', corners(2)).map((p) => p.length)).toEqual([1, 1]));
  it('names the provoking corner as OpenGL does', () => {
    expect(provokingOf('POLYGON', [0, 1, 2, 3])).toBe(0);
    expect(provokingOf('QUAD_STRIP', [0, 1, 3, 2])).toBe(3);
    expect(provokingOf('TRIANGLES', [3, 4, 5])).toBe(5);
  });
});

describe('BB-PFIG-03: Clipping cuts a polygon at the viewing volume', () => {
  it('cuts the corner past x = 1 and adds two corners on the edge', () => {
    const tri = [pt(0, 0), pt(1.5, 0), pt(0, 0.5)];
    const out = clipPolygon(tri, volume);
    expect(out).toHaveLength(4);
    expect(out.filter((p) => Math.abs(p.x - 1) < 1e-9)).toHaveLength(2);
  });
  it('keeps a polygon wholly inside unchanged', () => {
    const tri = [pt(0, 0), pt(0.5, 0), pt(0, 0.5)];
    expect(clipPolygon(tri, volume)).toEqual(tri);
  });
  it('cuts a segment at the edge, and drops one wholly outside', () => {
    const cut = clipSegment(pt(0, 0), pt(2, 0), volume);
    expect(cut?.[1].x).toBeCloseTo(1);
    expect(clipSegment(pt(2, 0), pt(3, 0), volume)).toBeNull();
  });
});

describe('BB-PFIG-04: Clip outcome for inside, partial, outside and degenerate shapes', () => {
  it('reads inside, partial and outside', () => {
    expect(clipOutcome('TRIANGLES', [pt(0, 0), pt(0.5, 0), pt(0, 0.5)], volume)).toBe('inside');
    expect(clipOutcome('TRIANGLES', [pt(0, 0), pt(1.5, 0), pt(0, 0.5)], volume)).toBe('partial');
    expect(clipOutcome('TRIANGLES', [pt(2, 0), pt(3, 0), pt(2, 0.5)], volume)).toBe('outside');
  });
  it('judges lines and points too', () => {
    expect(clipOutcome('LINES', [pt(0, 0), pt(2, 0)], volume)).toBe('partial');
    expect(clipOutcome('POINTS', [pt(0, 0), pt(2, 0)], volume)).toBe('partial');
    expect(clipOutcome('POINTS', [pt(2, 0)], volume)).toBe('outside');
  });
  it('does not throw for two corners or a collinear triangle', () => {
    expect(() => clipOutcome('TRIANGLES', [pt(0, 0), pt(1, 1)], volume)).not.toThrow();
    expect(() => clipOutcome('TRIANGLES', [pt(0, 0), pt(0.5, 0.5), pt(1, 1)], volume)).not.toThrow();
    expect(() => clipPolygon([pt(0, 0), pt(2, 2), pt(4, 4)], volume)).not.toThrow();
    expect(clipOutcome('TRIANGLES', [pt(0, 0), pt(0.5, 0.5), pt(0.8, 0.8)], volume)).toBe('inside');
  });
});

describe('BB-PFIG-05: The frame is the viewing volume plus 20% each side', () => {
  it('grows each side by a fifth of the width and height', () => {
    const f = figureFrame({ minX: -1, maxX: 1, minY: -2, maxY: 2 });
    expect(f.minX).toBeCloseTo(-1.4);
    expect(f.maxX).toBeCloseTo(1.4);
    expect(f.minY).toBeCloseTo(-2.8);
    expect(f.maxY).toBeCloseTo(2.8);
  });
});
