/**
 * BLACK-BOX TEST SUITE — BB-PFIG
 * The Pipeline illustrations' geometry: the student's corners in world space, the primitives they make, and clipping.
 */
import { describe, it, expect } from 'vitest';
import type { SceneNode } from '@/core/types/scene';
import { chainOf, clipOutcome, clipPolygon, clipSegment, figureFrame, worldPoint, worldPrimitives } from '@/entities/scene/model/pipeline-geometry';
import { provokingOf } from '@/entities/scene/model/primitive-assembly';
import { pixelGrid, rasterise, type RasterInput } from '@/entities/scene/model/rasterise';

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

const grid = (n: number) => pixelGrid(volume, n);
const input = (over: Partial<RasterInput>): RasterInput => ({ type: 'TRIANGLES', corners: [], colours: [], uvs: null, shading: 'SMOOTH', ...over });
const RED = '#ff0000';
const GREEN = '#00ff00';
const BLUE = '#0000ff';

describe('BB-PFIG-06: A covered pixel is one whose centre the shape covers', () => {
  it('covers exactly the four middle pixels of a 4 x 4 grid, each with coverage 1', () => {
    const square = [pt(-0.5, -0.5), pt(0.5, -0.5), pt(0.5, 0.5), pt(-0.5, 0.5)];
    const out = rasterise(input({ type: 'QUADS', corners: square, colours: Array(4).fill(RED) }), grid(4), false);
    expect(out.map((f) => `${f.col},${f.row}`).sort()).toEqual(['1,1', '1,2', '2,1', '2,2']);
    out.forEach((f) => expect(f.coverage).toBe(1));
  });
  it('numbers rows from the top and sets uv only when given', () => {
    const tri = [pt(-1, 0.5), pt(-0.5, 0.5), pt(-1, 1)];
    const out = rasterise(input({ corners: tri, colours: Array(3).fill(RED), uvs: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }] }), grid(4), false);
    expect(out.some((f) => f.col === 0 && f.row === 0 && f.uv !== null)).toBe(true);
    expect(rasterise(input({ corners: tri, colours: Array(3).fill(RED) }), grid(4), false)[0].uv).toBeNull();
  });
});

describe('BB-PFIG-07: The grid follows the volume shape and stays bounded', () => {
  it('matches the volume shape and bounds the rows', () => {
    expect(pixelGrid({ minX: -1, maxX: 1, minY: -1, maxY: 1 }, 24)).toMatchObject({ cols: 24, rows: 24 });
    expect(pixelGrid({ minX: 0, maxX: 10, minY: 0, maxY: 1 }, 24).rows).toBe(2);
    expect(pixelGrid({ minX: 0, maxX: 0.1, minY: 0, maxY: 10 }, 24).rows).toBe(96);
    expect(pixelGrid({ minX: 0, maxX: 10, minY: 0, maxY: 0.01 }, 8).rows).toBe(1);
  });
  it('covers pixels for a triangle inside a very small volume', () => {
    const tiny = pixelGrid({ minX: 0, maxX: 0.00001, minY: 0, maxY: 0.00001 }, 8);
    const out = rasterise(input({ corners: [pt(0, 0), pt(0.00001, 0), pt(0, 0.00001)], colours: Array(3).fill(RED) }), tiny, false);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('BB-PFIG-08: Multisampling gives edge pixels partial coverage', () => {
  const tri = [pt(-1, -1), pt(1, -1), pt(-1, 1)];
  const shape = input({ corners: tri, colours: Array(3).fill(RED) });
  it('gives edge pixels a quarter, half or three quarters with multisampling', () => {
    const out = rasterise(shape, grid(8), true);
    out.forEach((f) => expect([0.25, 0.5, 0.75, 1]).toContain(f.coverage));
    expect(out.some((f) => f.coverage < 1)).toBe(true);
  });
  it('gives whole pixels only without it', () => {
    rasterise(shape, grid(8), false).forEach((f) => expect(f.coverage).toBe(1));
  });
  it('gives nothing for a shape outside the grid or with two corners, and does not throw', () => {
    const away = input({ corners: [pt(2, 2), pt(3, 2), pt(2, 3)], colours: Array(3).fill(RED) });
    expect(rasterise(away, grid(8), true)).toEqual([]);
    const two = input({ corners: [pt(0, 0), pt(1, 1)], colours: [RED, RED] });
    expect(() => rasterise(two, grid(8), true)).not.toThrow();
    expect(rasterise(two, grid(8), true)).toEqual([]);
  });
});

describe('BB-PFIG-09: Smooth shading blends corner colours; flat takes the provoking corner', () => {
  const tri = [pt(-1, -1), pt(1, -1), pt(-1, 1)];
  it('is reddest nearest the red corner when smooth', () => {
    const out = rasterise(input({ corners: tri, colours: [RED, GREEN, BLUE] }), grid(12), false);
    const near = out.find((f) => f.col === 0 && f.row === 11)!;
    expect(near.rgb[0]).toBeGreaterThan(near.rgb[1]);
    expect(near.rgb[0]).toBeGreaterThan(near.rgb[2]);
  });
  it('gives every fragment the last corner colour for flat triangles', () => {
    const out = rasterise(input({ corners: tri, colours: [RED, GREEN, BLUE], shading: 'FLAT' }), grid(12), false);
    expect(out.length).toBeGreaterThan(0);
    out.forEach((f) => expect(f.rgb).toEqual([0, 0, 255]));
  });
  it('gives every fragment the first corner colour for a flat polygon', () => {
    const square = [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)];
    const out = rasterise(input({ type: 'POLYGON', corners: square, colours: [RED, GREEN, BLUE, GREEN], shading: 'FLAT' }), grid(6), false);
    expect(out.length).toBe(36);
    out.forEach((f) => expect(f.rgb).toEqual([255, 0, 0]));
  });
  const uvs = [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }];
  it('still interpolates texture coordinates under flat shading', () => {
    const out = rasterise(input({ corners: tri, colours: [RED, GREEN, BLUE], uvs, shading: 'FLAT' }), grid(12), false);
    const a = out.find((f) => f.col === 0 && f.row === 11)!;
    const b = out.find((f) => f.col === 10 && f.row === 11)!;
    expect(a.uv!.u).not.toBeCloseTo(b.uv!.u);
  });
  it('gives a flat line the provoking corner colour', () => {
    const out = rasterise(input({ type: 'LINES', corners: [pt(-1, 0.125), pt(1, 0.125)], colours: [RED, BLUE], shading: 'FLAT' }), grid(8), false);
    expect(out).toHaveLength(8);
    out.forEach((f) => expect(f.rgb).toEqual([0, 0, 255]));
  });
});

describe('BB-PFIG-10: Lines and points rasterise', () => {
  it('covers one row of eight pixels with a horizontal segment', () => {
    const out = rasterise(input({ type: 'LINES', corners: [pt(-1, 0.125), pt(1, 0.125)], colours: [RED, BLUE] }), grid(8), false);
    expect(out).toHaveLength(8);
    expect(new Set(out.map((f) => f.row))).toEqual(new Set([3]));
    expect(out[0].rgb[0]).toBeGreaterThan(out[7].rgb[0]);
  });
  it('covers the one pixel that contains a point', () => {
    const out = rasterise(input({ type: 'POINTS', corners: [pt(0.1, 0.1)], colours: [RED] }), grid(8), true);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ col: 4, row: 3, coverage: 1 });
  });
});
