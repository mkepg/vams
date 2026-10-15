/**
 * WHITE-BOX TEST SUITE — WB-JOURNEY
 * The vertex journey's numbers, checked against the independent reference in tests/helpers/matrix.ts.
 */
import { describe, it, expect } from 'vitest';
import { vertexJourney, type JourneyScene } from '@/features/math-panel/model/vertex-journey';
import { assemblyFor, provokingVertex } from '@/entities/scene/model/primitive-assembly';
import { fmt, int, short, whole } from '@/shared/lib/format-number';
import type { PrimitiveType, SceneNode, TransformState } from '@/core/types/scene';
import { makeMatrix, multiply, transformPoint, orthoToNdc, ndcToWindow } from '../helpers/matrix';

const T = (t: Partial<TransformState> = {}): TransformState => ({ translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, ...t });
function node(id: string, type: SceneNode['type'], points: [number, number][], transform: Partial<TransformState> = {}, extra: Partial<SceneNode> = {}): SceneNode {
  return {
    id, name: id, type, visible: true, shading: 'SMOOTH', transform: T(transform), parentId: null, children: [],
    vertices: points.map(([x, y], i) => ({ id: `${id}-v${i}`, x, y, color: '#ffffff' })), ...extra,
  };
}
const scene = (objects: SceneNode[], limits = { minX: -1, maxX: 1, minY: -1, maxY: 1 }): JourneyScene => ({ objects, viewportLimits: limits, textures: [] });
const CANVAS = { width: 586, height: 500 };
const stage = (j: ReturnType<typeof vertexJourney>, id: string) => j.stages.find((s) => s.id === id)!;

/** The mocks' triangle: vertex 1 at (0, 0.5), moved 0.40, −0.17 and turned 15°. */
const mockTriangle = () => node('Triangle', 'TRIANGLES', [[0, 0.5], [-0.5, -0.5], [0.5, -0.5]], { translateX: 0.4, translateY: -0.17, rotate: 15 }, {
  vertices: [
    { id: 'v0', x: 0, y: 0.5, color: '#ff6633' }, { id: 'v1', x: -0.5, y: -0.5, color: '#3399ff' }, { id: 'v2', x: 0.5, y: -0.5, color: '#55dd88' },
  ],
});

describe('WB-JOURNEY-01: Each stage\'s numbers match the reference', () => {
  it('transforms, projects and rasterises the mocks\' vertex 1 as the reference does', () => {
    const tri = mockTriangle();
    const j = vertexJourney(scene([tri]), 'Triangle', 0, CANVAS);
    const world = transformPoint(makeMatrix(tri.transform), { x: 0, y: 0.5 });
    const ndc = orthoToNdc(world, scene([]).viewportLimits);
    const px = ndcToWindow(ndc, CANVAS);
    expect(stage(j, 'stored').result).toBe('(0.00, 0.50)');
    expect(stage(j, 'transformed').point!.x).toBeCloseTo(world.x, 10);
    expect(stage(j, 'transformed').point!.y).toBeCloseTo(world.y, 10);
    expect(stage(j, 'transformed').result).toBe('(0.27, 0.31)');
    expect(stage(j, 'projected').result).toBe('NDC (0.27, 0.31)');
    expect(stage(j, 'rasterised').point).toEqual(px);
    expect(stage(j, 'rasterised').result).toBe(`pixel (${px.x}, ${px.y})`);
    expect(stage(j, 'assembled').result).toBe('triangle, 1 of 3');
    expect(stage(j, 'coloured').result).toBe('rgb(1.0, 0.4, 0.2)');
    expect(j.subject).toEqual({ kind: 'shape', name: 'Triangle', vertex: 0, count: 3 });
  });

  it('works the Transformed stage as scale, rotate, move, with the student\'s inputs marked', () => {
    const j = vertexJourney(scene([mockTriangle()]), 'Triangle', 0, CANVAS);
    const rows = stage(j, 'transformed').rows;
    expect(rows.map((r) => r.call)).toEqual(['glVertex2f', 'glScalef', 'glRotatef', 'glTranslatef']);
    expect(rows[0]).toMatchObject({ step: ['from Stored'], value: '(0.00, 0.50)', from: true });
    expect(rows[1].step).toEqual(['scale ', { input: '1' }, ', ', { input: '1' }]);
    expect(rows[2]).toMatchObject({ step: ['rotate ', { input: '15°' }], value: '(−0.13, 0.48)' });
    expect(rows[3]).toMatchObject({ step: ['move ', { input: '0.40' }, ', ', { input: '−0.17' }], value: '(0.27, 0.31)' });
    const proj = stage(j, 'projected').rows;
    expect(proj[0]).toMatchObject({ step: ['from Transformed'], value: '(0.27, 0.31)', call: null, from: true });
    expect(proj[1]).toMatchObject({ step: ['volume x ', { input: '−1' }, '…', { input: '1' }], value: 'x → 0.27', call: 'glOrtho' });
    expect(proj[2]).toMatchObject({ step: ['volume y ', { input: '−1' }, '…', { input: '1' }], value: 'y → 0.31', call: 'glOrtho' });
  });
});

describe('WB-JOURNEY-02: Enclosing groups apply after the object, innermost first', () => {
  it('matches the reference parent · child product and names each group in its rows', () => {
    const outer = node('Outer', 'GROUP', [], { translateX: 0.2, rotate: 30, scaleX: 0.5, scaleY: 0.5 });
    const inner = node('Inner', 'GROUP', [], { translateY: -0.3, rotate: -10 }, { parentId: 'Outer' });
    const quad = node('Quad', 'QUADS', [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]], { translateX: 0.05, scaleX: 2, scaleY: 1.5 }, { parentId: 'Inner' });
    const j = vertexJourney(scene([outer, inner, quad]), 'Quad', 2, CANVAS);
    const m = multiply(makeMatrix(outer.transform), multiply(makeMatrix(inner.transform), makeMatrix(quad.transform)));
    const world = transformPoint(m, { x: 0.3, y: 0.4 });
    expect(stage(j, 'transformed').point!.x).toBeCloseTo(world.x, 10);
    expect(stage(j, 'transformed').point!.y).toBeCloseTo(world.y, 10);
    const steps = stage(j, 'transformed').rows.map((r) => (typeof r.step[0] === 'string' ? r.step[0] : ''));
    expect(steps).toEqual(['from Stored', 'scale ', 'rotate ', 'move ', 'Inner: scale ', 'Inner: rotate ', 'Inner: move ', 'Outer: scale ', 'Outer: rotate ', 'Outer: move ']);
  });
});

describe('WB-JOURNEY-03: A wider viewing volume changes the projection', () => {
  it('projects with the student\'s bounds, as the reference does', () => {
    const limits = { minX: -2, maxX: 4, minY: -1.5, maxY: 0.5 };
    const tri = mockTriangle();
    const j = vertexJourney(scene([tri], limits), 'Triangle', 1, CANVAS);
    const world = transformPoint(makeMatrix(tri.transform), { x: -0.5, y: -0.5 });
    const ndc = orthoToNdc(world, limits);
    expect(stage(j, 'projected').point!.x).toBeCloseTo(ndc.x, 10);
    expect(stage(j, 'projected').point!.y).toBeCloseTo(ndc.y, 10);
    expect(stage(j, 'projected').rows[1].step).toEqual(['volume x ', { input: '−2' }, '…', { input: '4' }]);
  });
});

describe('WB-JOURNEY-04: Every primitive type assembles by its own rule', () => {
  it('places the vertex in its primitive, or says it is not drawn', () => {
    const cases: Array<[PrimitiveType, number, number, string]> = [
      ['POINTS', 1, 3, 'point 2 of 3'],
      ['LINES', 2, 4, 'line 2, end 1 of 2'],
      ['LINES', 2, 3, 'not drawn'],
      ['LINE_STRIP', 1, 3, 'lines 1 and 2'],
      ['LINE_STRIP', 0, 3, 'line 1, end 1 of 2'],
      ['LINE_LOOP', 0, 3, 'lines 1 and 3'],
      ['TRIANGLES', 0, 3, 'triangle, 1 of 3'],
      ['TRIANGLES', 4, 6, 'triangle 2, 2 of 3'],
      ['TRIANGLES', 3, 4, 'not drawn'],
      ['TRIANGLE_STRIP', 2, 5, 'triangles 1–3'],
      ['TRIANGLE_FAN', 0, 5, 'triangles 1–3'],
      ['TRIANGLE_FAN', 1, 5, 'triangle 1, 2 of 3'],
      ['QUADS', 5, 8, 'quad 2, 2 of 4'],
      ['QUAD_STRIP', 2, 6, 'quads 1 and 2'],
      ['POLYGON', 3, 5, 'polygon, 4 of 5'],
    ];
    for (const [type, i, n, result] of cases) expect(assemblyFor(type, i, n).result, `${type} ${i}/${n}`).toBe(result);
    expect(assemblyFor('TRIANGLES', 0, 3).sentence).toBe('Every 3 vertices make one triangle; this is corner 1 of triangle 1.');
    expect(assemblyFor('TRIANGLES', 0, 3).note).toBe('every 3 vertices make a triangle');
  });
});

describe('WB-JOURNEY-05: Flat shading takes the provoking vertex\'s colour', () => {
  it('uses the last vertex of the primitive, the first for a polygon, and the highest for a quad strip', () => {
    expect(provokingVertex('TRIANGLES', 0, 6)).toBe(2);
    expect(provokingVertex('TRIANGLES', 4, 6)).toBe(5);
    expect(provokingVertex('TRIANGLE_STRIP', 0, 4)).toBe(2);
    expect(provokingVertex('QUADS', 1, 4)).toBe(3);
    expect(provokingVertex('POLYGON', 3, 5)).toBe(0);
    // OpenGL: quad strip quad i takes vertex 2i + 2 (from 1), though the quad is drawn 2j, 2j+1, 2j+3, 2j+2.
    expect(provokingVertex('QUAD_STRIP', 0, 6)).toBe(3);
    expect(provokingVertex('QUAD_STRIP', 4, 6)).toBe(5);
    const tri = mockTriangle();
    const flat = { ...tri, shading: 'FLAT' as const };
    expect(stage(vertexJourney(scene([flat]), 'Triangle', 0, CANVAS), 'coloured').result).toBe('rgb(0.3, 0.9, 0.5)');
    expect(stage(vertexJourney(scene([tri]), 'Triangle', 1, CANVAS), 'coloured').result).toBe('rgb(0.2, 0.6, 1.0)');
  });
});

describe('WB-JOURNEY-06: A textured vertex reads its texel', () => {
  it('maps the UV to a texel for the texture\'s size, with repeat and clamp', () => {
    const quad = node('Quad', 'QUADS', [[0, 0], [1, 0], [1, 1], [0, 1]], {}, {
      texture: { textureId: 'tex', filter: 'NEAREST', wrap: 'REPEAT' },
      uvs: [{ u: 0, v: 0 }, { u: 1.25, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }],
    });
    const textured: JourneyScene = { ...scene([quad]), textures: [{ id: 'tex', name: 'Bricks', dataUrl: '', width: 64, height: 32 }] };
    expect(stage(vertexJourney(textured, 'Quad', 1, CANVAS), 'coloured').result).toBe('texel (16, 0)');
    expect(stage(vertexJourney(textured, 'Quad', 2, CANVAS), 'coloured').result).toBe('texel (0, 0)');
    const clamped = { ...textured, objects: [{ ...quad, texture: { ...quad.texture!, wrap: 'CLAMP_TO_EDGE' as const } }] };
    expect(stage(vertexJourney(clamped, 'Quad', 1, CANVAS), 'coloured').result).toBe('texel (63, 0)');
    expect(stage(vertexJourney(textured, 'Quad', 1, CANVAS), 'coloured').section).toBe('Textures');
  });
});

describe('WB-JOURNEY-07: Text, groups and nothing selected', () => {
  it('follows the text\'s raster position, gives a group its own transform, and leaves results empty with nothing', () => {
    const text = node('Hello', 'TEXT', [[0, 0]], { translateX: 0.1, translateY: 0.2 }, { textContent: 'Hello' });
    const tj = vertexJourney(scene([text]), 'Hello', 0, CANVAS);
    expect(tj.subject).toEqual({ kind: 'text', name: 'Hello' });
    expect(stage(tj, 'stored').result).toBe('(0.00, 0.00)');
    expect(stage(tj, 'transformed').result).toBe('(0.10, 0.20)');
    expect(stage(tj, 'assembled').sentence).toBe('Text is drawn as bitmap characters at this position, not assembled from vertices.');
    const group = node('House', 'GROUP', [], { translateX: 0.2, translateY: 0.1 });
    const gj = vertexJourney(scene([group]), 'House', 0, CANVAS);
    expect(gj.subject).toEqual({ kind: 'group', name: 'House' });
    expect(stage(gj, 'transformed').result).toBe('(0.20, 0.10)');
    expect(stage(gj, 'stored').result).toBeNull();
    const none = vertexJourney(scene([group]), null, 0, CANVAS);
    expect(none.subject).toEqual({ kind: 'none' });
    expect(none.stages.map((s) => s.title)).toEqual(['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured']);
    expect(none.stages.every((s) => s.result === null && s.rows.length === 0 && s.sentence.length > 0)).toBe(true);
  });
});

describe('WB-JOURNEY-08: The followed vertex is clamped to the object', () => {
  it('follows the last vertex when the index is past it', () => {
    const j = vertexJourney(scene([mockTriangle()]), 'Triangle', 9, CANVAS);
    expect(j.subject).toEqual({ kind: 'shape', name: 'Triangle', vertex: 2, count: 3 });
    expect(stage(j, 'stored').result).toBe('(0.50, −0.50)');
  });
});

describe('WB-JOURNEY-09: Numbers read like the mock', () => {
  it('uses a true minus sign, never shows −0.00, and keeps short inputs short', () => {
    expect(fmt(-0.17)).toBe('−0.17');
    expect(fmt(-0.001)).toBe('0.00');
    expect(fmt(0.4)).toBe('0.40');
    expect([0, 1, -1, -0.001].map(whole)).toEqual(['0', '1', '−1', '0']);
    expect(whole(0.4)).toBe('0.40');
    expect(whole(1.005)).toBe('1');
    expect(short(1)).toBe('1');
    expect(short(1.6)).toBe('1.6');
    expect(short(-0.85)).toBe('−0.85');
    expect(int(-12)).toBe('−12');
    expect(int(0)).toBe('0');
    // A vertex left of and below the window: its pixel is negative, with a true minus sign.
    const left = vertexJourney(scene([node('Left', 'TRIANGLES', [[-3, -2], [-2.5, -2], [-3, -1.5]])]), 'Left', 0, CANVAS);
    expect(stage(left, 'rasterised').result).toBe('pixel (−586, −250)');
    const j = vertexJourney(scene([mockTriangle()]), 'Triangle', 1, CANVAS);
    // Every string a student reads: sentences, results and the working.
    const text = JSON.stringify(j.stages.map((s) => [s.sentence, s.result, s.rows]));
    expect(text).toContain('−0.50');
    expect(text).not.toMatch(/-\d/);
    expect(text).not.toMatch(/coming soon|not supported|future|deferred|\b3D\b|lighting/i);
  });
});

describe('WB-JOURNEY-10: Flat shading names the primitive and its vertex; text names its colour call; pixels stay in the window', () => {
  const flat = (type: SceneNode['type'], n: number) =>
    node('Flat', type, Array.from({ length: n }, (_, i) => [i * 0.1, 0] as [number, number]), {}, { shading: 'FLAT' });
  const colourSentence = (obj: SceneNode, i: number) => stage(vertexJourney(scene([obj]), obj.id, i, CANVAS), 'coloured').sentence;

  it('says which primitive takes which vertex\'s colour', () => {
    expect(colourSentence(flat('TRIANGLES', 6), 4)).toBe('With flat shading, each triangle takes the colour of one of its vertices: triangle 2 takes vertex 6\'s.');
    expect(colourSentence(flat('QUAD_STRIP', 6), 2)).toBe('With flat shading, each quad takes the colour of one of its vertices: quad 1 takes vertex 4\'s.');
    expect(colourSentence(flat('POLYGON', 5), 3)).toBe('With flat shading, the polygon takes vertex 1\'s colour.');
    expect(colourSentence(flat('POINTS', 3), 1)).toBe('With flat shading, each point keeps its own colour.');
  });

  it('names glColor3ub for byte-colour text and glColor3f otherwise', () => {
    const text = node('Hi', 'TEXT', [[0, 0]], {}, { textContent: 'Hi' });
    expect(colourSentence(text, 0)).toContain('glColor3f');
    expect(colourSentence({ ...text, colorMode: 'BYTE' }, 0)).toContain('glColor3ub');
  });

  it('keeps a vertex on the window edge inside the last pixel', () => {
    const edge = node('Edge', 'POINTS', [[1, -1]]);
    const j = vertexJourney(scene([edge]), 'Edge', 0, CANVAS);
    expect(stage(j, 'rasterised').result).toBe('pixel (585, 0)');
    expect(ndcToWindow({ x: 1, y: 1 }, CANVAS)).toEqual({ x: 586, y: 500 });
  });
});
