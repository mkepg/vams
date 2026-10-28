/**
 * ALG-FID: points, lines, stipple and flat colours as OpenGL 1.5 draws them with multisampling.
 * Every expected value is worked out by hand from the specification's rules (3.3, 3.4, Table 2.12).
 */
import { describe, expect, it } from 'vitest';
import {
  POINT_SIZE,
  lineSegments,
  lineTriangles,
  pointTriangles,
  polygonTriangles,
  stippleRuns,
  type GeoVertex,
  type Rgba,
  type Triangles,
} from '@/shared/lib/gl-geometry';

const RED: Rgba = [1, 0, 0, 1];
const GREEN: Rgba = [0, 1, 0, 1];
const WHITE: Rgba = [1, 1, 1, 1];
const v = (x: number, y: number, color: Rgba = WHITE): GeoVertex => ({ x, y, color });
const palette = (n: number): Rgba[] => Array.from({ length: n }, (_, i) => [i / 10, 0, 0, 1] as Rgba);

function bounds(t: Triangles) {
  const xs = t.positions.filter((_, i) => i % 2 === 0);
  const ys = t.positions.filter((_, i) => i % 2 === 1);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function area(t: Triangles): number {
  let sum = 0;
  for (let i = 0; i < t.positions.length; i += 6) {
    const [ax, ay, bx, by, cx, cy] = t.positions.slice(i, i + 6);
    sum += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return sum;
}

/** The colour of each triangle's first vertex, as [r, g, b, a]. */
function triangleColours(t: Triangles): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < t.colors.length; i += 12) out.push(t.colors.slice(i, i + 4));
  return out;
}

/** Each stipple piece is one rectangle: two triangles, six vertices. Returns each piece's bounds. */
function pieces(t: Triangles) {
  const out: ReturnType<typeof bounds>[] = [];
  for (let i = 0; i < t.positions.length; i += 12) {
    out.push(bounds({ positions: t.positions.slice(i, i + 12), colors: [] }));
  }
  return out;
}

describe('ALG-FID-01: A point is a size × size square centred on its vertex', () => {
  it('draws 8 × 8 at the generator\'s glPointSize(8.0f)', () => {
    expect(POINT_SIZE).toBe(8);
    const t = pointTriangles([v(10.5, 20.5, RED)], POINT_SIZE);
    expect(bounds(t)).toEqual({ minX: 6.5, maxX: 14.5, minY: 16.5, maxY: 24.5 });
    expect(area(t)).toBeCloseTo(64);
    expect(triangleColours(t)).toEqual([[1, 0, 0, 1], [1, 0, 0, 1]]);
  });
});

describe('ALG-FID-02: A line segment is a rectangle with no caps', () => {
  it('is exactly as long as the segment and width wide', () => {
    const t = lineTriangles('LINES', [v(10, 10), v(30, 10)], 4, 'SMOOTH', null);
    expect(bounds(t)).toEqual({ minX: 10, maxX: 30, minY: 8, maxY: 12 });
    expect(area(t)).toBeCloseTo(80);
  });

  it('keeps its width at any angle', () => {
    const len = 20;
    const a = (30 * Math.PI) / 180;
    const t = lineTriangles('LINES', [v(0, 0), v(len * Math.cos(a), len * Math.sin(a))], 3, 'SMOOTH', null);
    expect(area(t)).toBeCloseTo(len * 3);
  });

  it('draws nothing for a segment of zero length', () => {
    expect(lineTriangles('LINES', [v(5, 5), v(5, 5)], 3, 'SMOOTH', null).positions).toEqual([]);
  });
});

describe('ALG-FID-03: Strip segments are separate rectangles with no join', () => {
  it('leaves the outer corner of a right angle empty', () => {
    const t = lineTriangles('LINE_STRIP', [v(0, 0), v(20, 0), v(20, 20)], 2, 'SMOOTH', null);
    expect(area(t)).toBeCloseTo(80);
    for (let i = 0; i < t.positions.length; i += 2) {
      const [x, y] = [t.positions[i], t.positions[i + 1]];
      expect(x > 20 && y < 0).toBe(false);
    }
  });

  it('closes a loop with a segment back to the first vertex', () => {
    const t = lineTriangles('LINE_LOOP', [v(0, 0), v(10, 0), v(10, 10)], 1, 'SMOOTH', null);
    expect(area(t)).toBeCloseTo(10 + 10 + Math.hypot(10, 10));
  });
});

describe('ALG-FID-04: Stipple bits are read from bit 0, factor fragments each', () => {
  it.each([
    [1, 0x5555, 16, [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15]]],
    [1, 0x00ff, 32, [[0, 8], [16, 24]]],
    [2, 0xaaaa, 16, [[2, 4], [6, 8], [10, 12], [14, 16]]],
    [4, 0xaaaa, 32, [[4, 8], [12, 16], [20, 24], [28, 32]]],
    [2, 0x0fff, 32, [[0, 24]]],
  ])('factor %i, pattern %i over %i fragments', (factor, pattern, length, runs) => {
    expect(stippleRuns(0, length, factor, pattern)).toEqual(runs);
  });

  it('starts part-way through the pattern when the counter has advanced', () => {
    expect(stippleRuns(3, 5, 1, 0x5555)).toEqual([[4, 5], [6, 7]]);
  });
});

describe('ALG-FID-05: The stipple counter carries through a strip and resets for each GL_LINES segment', () => {
  it('carries on into the second strip segment', () => {
    const t = lineTriangles('LINE_STRIP', [v(0, 0), v(3, 0), v(3, 5)], 1, 'SMOOTH', { factor: 1, pattern: 0x5555 });
    const ps = pieces(t);
    expect(ps.map((p) => [p.minX, p.maxX])).toEqual([[0, 1], [2, 3]].concat([[2.5, 3.5], [2.5, 3.5]]));
    expect(ps.slice(2).map((p) => [p.minY, p.maxY])).toEqual([[1, 2], [3, 4]]);
  });

  it('starts again for each GL_LINES segment', () => {
    const t = lineTriangles('LINES', [v(0, 0), v(3, 0), v(3, 0), v(3, 5)], 1, 'SMOOTH', { factor: 1, pattern: 0x5555 });
    expect(pieces(t).slice(2).map((p) => [p.minY, p.maxY])).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it('cuts dashes at pixel edges, counting from the first pixel centre on the segment', () => {
    // Measured on the reference machine: a line from x = 26.8 with (2, 0xAAAA) lights columns 29 and 30 first.
    const right = lineTriangles('LINES', [v(26.8, 52.5), v(100, 52.5)], 1, 'SMOOTH', { factor: 2, pattern: 0xaaaa });
    expect([pieces(right)[0].minX, pieces(right)[0].maxX]).toEqual([29, 31]);
    // Leftwards from 50.3 the first fragment is column 49, so (1, 0xAAAA) lights column 48 first.
    const left = lineTriangles('LINES', [v(50.3, 0.5), v(40, 0.5)], 1, 'SMOOTH', { factor: 1, pattern: 0xaaaa });
    expect([pieces(left)[0].minX, pieces(left)[0].maxX]).toEqual([48, 49]);
  });

  it('counts fragments along the major axis, not the length', () => {
    // 40 px across and 10 up: 40 fragments, so 20 dashes of 0x5555.
    const t = lineTriangles('LINES', [v(0, 0), v(40, 10)], 1, 'SMOOTH', { factor: 1, pattern: 0x5555 });
    expect(pieces(t)).toHaveLength(20);
  });
});

describe('ALG-FID-06: FLAT shading takes the provoking vertex of Table 2.12', () => {
  it('names the provoking vertex of each line segment', () => {
    expect(lineSegments('LINES', 4).map((s) => s.provoking)).toEqual([1, 3]);
    expect(lineSegments('LINE_STRIP', 3).map((s) => s.provoking)).toEqual([1, 2]);
    expect(lineSegments('LINE_LOOP', 3).map((s) => s.provoking)).toEqual([1, 2, 0]);
  });

  it('colours a flat line with its second vertex', () => {
    const t = lineTriangles('LINES', [v(0, 0, RED), v(10, 0, GREEN)], 1, 'FLAT', null);
    expect(triangleColours(t)).toEqual([[0, 1, 0, 1], [0, 1, 0, 1]]);
  });

  it.each([
    ['TRIANGLES', 6, [2, 5]],
    ['TRIANGLE_STRIP', 4, [2, 3]],
    ['TRIANGLE_FAN', 4, [2, 3]],
    ['QUADS', 4, [3, 3]],
    ['QUAD_STRIP', 6, [3, 3, 5, 5]],
    ['POLYGON', 5, [0, 0, 0]],
  ] as const)('%s with %i vertices', (mode, n, provoking) => {
    const colours = palette(n);
    const verts = colours.map((c, i) => v(Math.cos(i), Math.sin(i), c));
    const t = polygonTriangles(mode, verts, 'FLAT');
    expect(triangleColours(t)).toEqual(provoking.map((i) => [...colours[i]]));
    // Every vertex of a flat triangle carries the same colour.
    for (let i = 0; i < t.colors.length; i += 12) {
      expect(t.colors.slice(i + 4, i + 8)).toEqual(t.colors.slice(i, i + 4));
      expect(t.colors.slice(i + 8, i + 12)).toEqual(t.colors.slice(i, i + 4));
    }
  });
});

describe('ALG-FID-07: SMOOTH shading blends along a line', () => {
  it('is the mean of the two ends half-way along', () => {
    // 0x00FF over 16 fragments cuts the line exactly at its middle.
    const t = lineTriangles('LINES', [v(0, 0, RED), v(16, 0, GREEN)], 1, 'SMOOTH', { factor: 1, pattern: 0x00ff });
    const colours = t.colors;
    const ends = new Set<string>();
    for (let i = 0; i < colours.length; i += 4) ends.add(colours.slice(i, i + 4).map((c) => c.toFixed(3)).join(','));
    expect([...ends].sort()).toEqual(['0.500,0.500,0.000,1.000', '1.000,0.000,0.000,1.000']);
  });

  it('keeps each vertex colour in a smooth polygon', () => {
    const t = polygonTriangles('TRIANGLES', [v(0, 0, RED), v(1, 0, GREEN), v(0, 1, WHITE)], 'SMOOTH');
    expect(t.colors).toEqual([...RED, ...GREEN, ...WHITE]);
  });
});
