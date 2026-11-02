/**
 * ALG-LAB: the Lab's software rasteriser against the OpenGL 1.5 specification's rules (3.3, 3.4.1,
 * 3.4.2, 3.5, 3.4.4, 3.5.6 and Table 2.12). Every expected pixel set and value is worked out by hand
 * from those rules; the comment beside each one names the rule.
 */
import { describe, expect, it } from 'vitest';
import { lineSegments } from '@/shared/lib/gl-geometry';
import {
  clearFramebuffer,
  createFramebuffer,
  defaultRasterState,
  rasterLine,
  rasterPoint,
  rasterPolygon,
  rasterTriangle,
  type Framebuffer,
  type RasterState,
  type RGBA,
  type WinVertex,
} from '@/shared/lib/gl-raster';

const WHITE: RGBA = [1, 1, 1, 1];
const RED: RGBA = [1, 0, 0, 1];
const GREEN: RGBA = [0, 1, 0, 1];
const BLUE: RGBA = [0, 0, 1, 1];

const v = (x: number, y: number, color: RGBA = WHITE): WinVertex => ({ x, y, z: 0, w: 1, color });

function state(patch: Partial<RasterState> = {}): RasterState {
  return { ...defaultRasterState(), ...patch };
}

function px(fb: Framebuffer, x: number, y: number): number[] {
  const i = (y * fb.width + x) * 4;
  return Array.from(fb.color.slice(i, i + 4));
}

/** Every pixel with any colour in it, as "x,y", in row order from the bottom. */
function covered(fb: Framebuffer): string[] {
  const out: string[] = [];
  for (let y = 0; y < fb.height; y++) {
    for (let x = 0; x < fb.width; x++) {
      const [r, g, b, a] = px(fb, x, y);
      if (r || g || b || a) out.push(`${x},${y}`);
    }
  }
  return out;
}

/** The pixels x0..x1 by y0..y1, both ends included, in row order from the bottom. */
function block(x0: number, x1: number, y0: number, y1: number): string[] {
  const out: string[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(`${x},${y}`);
  return out;
}

/** The listed pixels in row order from the bottom, as `covered` gives them. */
function pixels(list: [number, number][]): string[] {
  return [...list].sort((p, q) => p[1] - q[1] || p[0] - q[0]).map(([x, y]) => `${x},${y}`);
}

describe('ALG-LAB-01: A point is a size × size square of pixels (3.3)', () => {
  const cases: [number, number, string[]][] = [
    // Odd sizes centre on (⌊xw⌋ + ½, ⌊yw⌋ + ½); even sizes on (⌊xw + ½⌋, ⌊yw + ½⌋), a pixel corner.
    [1, 10.5, block(10, 10, 10, 10)],
    [2, 10.5, block(10, 11, 10, 11)],
    [3, 10.5, block(9, 11, 9, 11)],
    [4, 10.5, block(9, 12, 9, 12)],
    [1, 10, block(10, 10, 10, 10)],
    [2, 10, block(9, 10, 9, 10)],
    [3, 10, block(9, 11, 9, 11)],
    [4, 10, block(8, 11, 8, 11)],
  ];
  it.each(cases)('size %d at (%d, %d) covers its square', (size, at, expected) => {
    const fb = createFramebuffer(24, 24);
    rasterPoint(fb, v(at, at), state({ pointSize: size }));
    expect(covered(fb)).toEqual(expected);
  });
});

describe('ALG-LAB-02: A width-1 line covers the diamond-exit pixels and leaves out its last (3.4.1)', () => {
  it('draws a horizontal line from its first pixel up to, not including, its last', () => {
    const fb = createFramebuffer(16, 16);
    rasterLine(fb, v(2.5, 5.5), v(8.5, 5.5), state());
    // Endpoints on centres: Bresenham, half-open, so (8, 5) holding pb is left out.
    expect(covered(fb)).toEqual(block(2, 7, 5, 5));
  });

  it('draws a vertical line the same way', () => {
    const fb = createFramebuffer(16, 16);
    rasterLine(fb, v(4.5, 1.5), v(4.5, 6.5), state());
    // Endpoints on centres: rows 1 to 5, (4, 6) holding pb is left out.
    expect(covered(fb)).toEqual(block(4, 4, 1, 5));
  });

  it('draws a 30° line one pixel a column, leaving out the pixel that holds its end', () => {
    const fb = createFramebuffer(16, 16);
    const end = v(0.5 + 10 * Math.cos(Math.PI / 6), 0.5 + 10 * Math.sin(Math.PI / 6));
    rasterLine(fb, v(0.5, 0.5), end, state());
    // x-major: column c is entered at the diamond row ⌊0.5 + c·tan 30°⌋ (0.5, 1.08, 1.65, 2.23, 2.81,
    // 3.39, 3.96, 4.54, 5.12); pb = (9.16, 5.5) lies in the diamond of (9, 5), which is left out.
    expect(covered(fb)).toEqual(
      pixels([[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 4], [8, 5]]),
    );
  });
});

describe('ALG-LAB-03: A wide line is width pixels in the minor direction (3.4.2)', () => {
  it('rounds width 4.5 to 5 and stacks 5 pixels a column', () => {
    const fb = createFramebuffer(16, 20);
    rasterLine(fb, v(2.5, 10.5), v(8.5, 10.5), state({ lineWidth: 4.5 }));
    // Width rounds to the nearest integer, 4.5 to 5; the segment moves down (5 − 1)/2 = 2 to y 8.5,
    // whose fragments (2..7, 8) are each the lowest of a column 5 high.
    expect(covered(fb)).toEqual(block(2, 7, 8, 12));
  });

  it('lays a y-major wide line out as rows in x', () => {
    const fb = createFramebuffer(16, 16);
    rasterLine(fb, v(5.5, 2.5), v(5.5, 6.5), state({ lineWidth: 4.5 }));
    // y-major: the segment moves left 2 to x 3.5; fragments (3, 2..5) each start a row 5 long.
    expect(covered(fb)).toEqual(block(3, 7, 2, 5));
  });

  it('builds a slanted wide line from columns, not a turned rectangle', () => {
    const fb = createFramebuffer(16, 16);
    const end = v(0.5 + 10 * Math.cos(Math.PI / 6), 3.5 + 10 * Math.sin(Math.PI / 6));
    rasterLine(fb, v(0.5, 3.5), end, state({ lineWidth: 3 }));
    // Width 3 moves the segment down 1 to start at (0.5, 2.5): ALG-LAB-02's 30° rows plus 2 give
    // each column's lowest pixel, and the column is 3 high.
    const lowest: [number, number][] = [[0, 2], [1, 3], [2, 3], [3, 4], [4, 4], [5, 5], [6, 5], [7, 6], [8, 7]];
    expect(covered(fb)).toEqual(pixels(lowest.flatMap(([x, y]) => [[x, y], [x, y + 1], [x, y + 2]] as [number, number][])));
  });
});

describe('ALG-LAB-04: Stipple (2, 0xAAAA) is 2 off and 2 on, counted per fragment (3.4.2)', () => {
  const stipple = { factor: 2, pattern: 0xaaaa, enabled: true, counter: 0 };
  const strip = [v(0.5, 5.5), v(5.5, 5.5), v(10.5, 5.5)];

  it('carries the counter from one strip segment to the next', () => {
    const fb = createFramebuffer(16, 16);
    const s = state({ stipple: { ...stipple } });
    for (const seg of lineSegments('LINE_STRIP', strip.length)) {
      if (seg.resetsStipple) s.stipple.counter = 0;
      rasterLine(fb, strip[seg.a], strip[seg.b], s);
    }
    // Fragments x = 0..9 take s = 0..9; bit ⌊s/2⌋ of 0xAAAA is set for s = 2, 3, 6, 7.
    expect(covered(fb)).toEqual(pixels([[2, 5], [3, 5], [6, 5], [7, 5]]));
    expect(s.stipple.counter).toBe(10);
  });

  it('restarts the counter for each GL_LINES segment', () => {
    const fb = createFramebuffer(16, 16);
    const s = state({ stipple: { ...stipple } });
    const lines = [strip[0], strip[1], strip[1], strip[2]];
    for (const seg of lineSegments('LINES', lines.length)) {
      if (seg.resetsStipple) s.stipple.counter = 0;
      rasterLine(fb, lines[seg.a], lines[seg.b], s);
    }
    // First segment x = 0..4 with s = 0..4 (on at 2, 3); the second restarts, x = 5..9 with s = 0..4 (on at 7, 8).
    expect(covered(fb)).toEqual(pixels([[2, 5], [3, 5], [7, 5], [8, 5]]));
  });
});

describe('ALG-LAB-05: Two triangles sharing an edge cover each pixel once (3.5.1)', () => {
  it('splits a square along its diagonal with no gap and no overlap', () => {
    const fb = createFramebuffer(16, 16);
    // Additive blending makes a pixel drawn twice twice as bright.
    const s = state({ blend: { enabled: true, src: 'ONE', dst: 'ONE' } });
    const c: RGBA = [0.2, 0.2, 0.2, 0.2];
    rasterTriangle(fb, v(2.5, 2.5, c), v(12.5, 2.5, c), v(12.5, 12.5, c), s);
    rasterTriangle(fb, v(2.5, 2.5, c), v(12.5, 12.5, c), v(2.5, 12.5, c), s);
    // Centres inside count; centres on the left (x 2.5) and top (y 12.5) edges count, the right and bottom do not.
    expect(covered(fb)).toEqual(block(2, 11, 3, 12));
    for (const key of block(2, 11, 3, 12)) {
      const [x, y] = key.split(',').map(Number);
      expect(px(fb, x, y)).toEqual([51, 51, 51, 51]);
    }
  });
});

describe('ALG-LAB-06: FLAT shading takes the provoking vertex of Table 2.12', () => {
  it('colours a triangle with its last vertex', () => {
    const fb = createFramebuffer(16, 16);
    rasterTriangle(fb, v(1, 1, RED), v(13, 1, GREEN), v(7, 13, BLUE), state({ shadeModel: 'FLAT' }));
    // Table 2.12: independent triangle i takes vertex 3i, its last.
    const colours = new Set(covered(fb).map((k) => px(fb, ...(k.split(',').map(Number) as [number, number])).join()));
    expect([...colours]).toEqual(['0,0,255,255']);
  });

  it('colours a GL_POLYGON with its first vertex', () => {
    const fb = createFramebuffer(16, 16);
    const polygon = [v(1, 1, RED), v(13, 1, GREEN), v(13, 13, BLUE), v(1, 13, WHITE)];
    rasterPolygon(fb, polygon, state({ shadeModel: 'FLAT' }), 0);
    // Table 2.12: a single polygon takes vertex 1, its first.
    const colours = new Set(covered(fb).map((k) => px(fb, ...(k.split(',').map(Number) as [number, number])).join()));
    expect([...colours]).toEqual(['255,0,0,255']);
  });
});

describe('ALG-LAB-07: Blending rounds to 8 bits as round(c × 255)', () => {
  it('blends GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA at alpha 0.5', () => {
    const fb = createFramebuffer(4, 4);
    clearFramebuffer(fb, [0, 100 / 255, 1, 1]);
    const s = state({ blend: { enabled: true, src: 'SRC_ALPHA', dst: 'ONE_MINUS_SRC_ALPHA' } });
    rasterPoint(fb, v(1.5, 1.5, [1, 0.5, 0.2, 0.5]), s);
    // c = src·0.5 + dst·0.5: r 0.5 → 127.5 → 128; g 0.25 + 50/255 → 113.75 → 114; b 0.1 + 0.5 → 153;
    // a 0.25 + 0.5 → 191.25 → 191.
    expect(px(fb, 1, 1)).toEqual([128, 114, 153, 191]);
    expect(px(fb, 0, 0)).toEqual([0, 100, 255, 255]);
  });

  it('writes the fragment as it is with blending off', () => {
    const fb = createFramebuffer(4, 4);
    clearFramebuffer(fb, [0, 100 / 255, 1, 1]);
    rasterPoint(fb, v(1.5, 1.5, [1, 0.5, 0.2, 0.5]), state());
    // round(c × 255): 255, 127.5 → 128, 51, 127.5 → 128.
    expect(px(fb, 1, 1)).toEqual([255, 128, 51, 128]);
  });
});

describe('ALG-LAB-08: GL_LINE polygon mode draws the outline with the line rules (3.5.4)', () => {
  const square = [v(2.5, 2.5), v(8.5, 2.5), v(8.5, 8.5), v(2.5, 8.5)];

  it('draws each edge as a half-open width-1 line', () => {
    const fb = createFramebuffer(16, 16);
    rasterPolygon(fb, square, state({ polygonMode: { front: 'LINE', back: 'LINE' } }), 3);
    // Bottom (2..7, 2), right (8, 2..7), top leftwards (8..3, 8), left downwards (2, 8..3): each edge
    // leaves out the pixel holding its end, which the next edge starts on, so the ring is closed.
    const ring = block(2, 8, 2, 8).filter((k) => {
      const [x, y] = k.split(',').map(Number);
      return x === 2 || x === 8 || y === 2 || y === 8;
    });
    expect(covered(fb)).toEqual(ring);
  });

  it('uses the back mode for a clockwise polygon', () => {
    const fb = createFramebuffer(16, 16);
    rasterPolygon(fb, [...square].reverse(), state({ polygonMode: { front: 'LINE', back: 'FILL' } }), 3);
    // Clockwise is back facing (3.5.1), so it fills: left and top edges' centres included.
    expect(covered(fb)).toEqual(block(2, 7, 3, 8));
  });
});

describe('ALG-LAB-17: Multisample mode covers 4 samples a pixel (3.4.4, 3.5.6)', () => {
  it('blends half the colour into an edge pixel half covered', () => {
    const fb = createFramebuffer(24, 24);
    const s = state({ multisample: true });
    const rect = [v(10.5, 0, RED), v(20, 0, RED), v(20, 20, RED), v(10.5, 20, RED)];
    rasterPolygon(fb, rect, s, 3);
    // Pixel 10's samples sit at x 10.375, 10.875, 10.125, 10.625; the two right of 10.5 are covered, so
    // the resolve averages (255 + 255 + 0 + 0) / 4 = 127.5 → 128.
    expect(px(fb, 10, 5)).toEqual([128, 0, 0, 128]);
    expect(px(fb, 9, 5)).toEqual([0, 0, 0, 0]);
    // Every sample inside belongs to exactly one of the two triangles, so the diagonal leaves no seam.
    for (let y = 1; y < 19; y++) for (let x = 11; x < 20; x++) expect(px(fb, x, y)).toEqual([255, 0, 0, 255]);
  });

  it('draws a width-3 line as the rectangle gl-geometry builds', () => {
    const fb = createFramebuffer(16, 20);
    rasterLine(fb, v(2, 10), v(12, 10), state({ multisample: true, lineWidth: 3 }));
    // The rectangle x 2..12, y 8.5..11.5: columns 2..11 have every sample inside; rows 9 and 10 are
    // whole, and rows 8 and 11 hold 2 samples each (y offsets ±2/16 and ±6/16 on the inner side).
    expect(covered(fb)).toEqual(block(2, 11, 8, 11));
    for (let x = 2; x <= 11; x++) {
      expect(px(fb, x, 8)).toEqual([128, 128, 128, 128]);
      expect(px(fb, x, 9)).toEqual([255, 255, 255, 255]);
      expect(px(fb, x, 10)).toEqual([255, 255, 255, 255]);
      expect(px(fb, x, 11)).toEqual([128, 128, 128, 128]);
    }
  });

  it('carries the stipple counter through a strip', () => {
    const fb = createFramebuffer(16, 16);
    const s = state({ multisample: true, stipple: { factor: 2, pattern: 0xaaaa, enabled: true, counter: 0 } });
    rasterLine(fb, v(0, 5.5), v(5, 5.5), s);
    rasterLine(fb, v(5, 5.5), v(10, 5.5), s);
    // Columns 0..4 then 5..9 take s = 0..9; the set bits are s = 2, 3, 6, 7, each a whole pixel column.
    expect(covered(fb)).toEqual(pixels([[2, 5], [3, 5], [6, 5], [7, 5]]));
  });
});
