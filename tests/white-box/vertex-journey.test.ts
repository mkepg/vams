/**
 * WHITE-BOX TEST SUITE — WB-JOURNEY
 * The vertex journey's numbers, checked against the independent reference in tests/helpers/matrix.ts.
 */
import { describe, it, expect } from 'vitest';
import { vertexJourney, type JourneyScene } from '@/features/math-panel/model/vertex-journey';
import { assemblyFor, primitivesOf, provokingVertex } from '@/entities/scene/model/primitive-assembly';
import { fmt, int, short, whole } from '@/shared/lib/format-number';
import type { PrimitiveType, SceneNode, TransformState } from '@/core/types/scene';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { makeMatrix, multiply, transformPoint, orthoToNdc, ndcToWindow, keepAspectBounds } from '../helpers/matrix';

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
  it('matches the reference parent · child product and puts a heading row naming each group before its rows', () => {
    const outer = node('Outer', 'GROUP', [], { translateX: 0.2, rotate: 30, scaleX: 0.5, scaleY: 0.5 });
    const inner = node('Inner', 'GROUP', [], { translateY: -0.3, rotate: -10 }, { parentId: 'Outer' });
    const quad = node('Quad', 'QUADS', [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]], { translateX: 0.05, scaleX: 2, scaleY: 1.5 }, { parentId: 'Inner' });
    const j = vertexJourney(scene([outer, inner, quad]), 'Quad', 2, CANVAS);
    const m = multiply(makeMatrix(outer.transform), multiply(makeMatrix(inner.transform), makeMatrix(quad.transform)));
    const world = transformPoint(m, { x: 0.3, y: 0.4 });
    expect(stage(j, 'transformed').point!.x).toBeCloseTo(world.x, 10);
    expect(stage(j, 'transformed').point!.y).toBeCloseTo(world.y, 10);
    const rows = stage(j, 'transformed').rows;
    const steps = rows.map((r) => (r.heading !== undefined ? `[${r.heading}]` : typeof r.step[0] === 'string' ? r.step[0] : ''));
    expect(steps).toEqual(['from Stored', 'scale ', 'rotate ', 'move ', '[Inner]', 'scale ', 'rotate ', 'move ', '[Outer]', 'scale ', 'rotate ', 'move ']);
    expect(rows.filter((r) => r.heading !== undefined).every((r) => r.step.length === 0 && r.value === '' && r.call === null)).toBe(true);
    expect(rows.filter((r) => r.call !== null).map((r) => r.call)).toEqual(['glVertex2f', 'glScalef', 'glRotatef', 'glTranslatef', 'glScalef', 'glRotatef', 'glTranslatef', 'glScalef', 'glRotatef', 'glTranslatef']);;
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
    expect(colourSentence(flat('TRIANGLES', 6), 4)).toBe('With flat shading, each triangle takes the colour of one of its vertices: triangle 2 takes vertex 6’s.');
    expect(colourSentence(flat('QUAD_STRIP', 6), 2)).toBe('With flat shading, each quad takes the colour of one of its vertices: quad 1 takes vertex 4’s.');
    expect(colourSentence(flat('POLYGON', 5), 3)).toBe('With flat shading, the polygon takes vertex 1’s colour.');
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
    expect(ndcToWindow({ x: 1, y: 1 }, CANVAS)).toEqual({ x: 585, y: 499 });
  });
});

const rowsOf = (j: ReturnType<typeof vertexJourney>, id: string) =>
  stage(j, id).rows.map((r) => [r.step.map((p) => (typeof p === 'string' ? p : p.input)).join(''), r.value, r.call]);

describe('WB-JOURNEY-11: Stored says where the vertex lives in each rendering mode', () => {
  it('sends an immediate vertex directly, and names the array, offset and stride otherwise', () => {
    const tri = mockTriangle();
    expect(rowsOf(vertexJourney(scene([tri]), 'Triangle', 0, CANVAS), 'stored')).toEqual([
      ['typed in Vertices', '(0.00, 0.50)', null],
      ['sent by glVertex2f', 'no buffer holds it', 'glVertex2f'],
    ]);
    const array = { ...tri, renderingMode: 'VERTEX_ARRAY' as const };
    expect(rowsOf(vertexJourney(scene([array]), 'Triangle', 2, CANVAS), 'stored')).toEqual([
      ['typed in Vertices', '(0.50, −0.50)', null],
      ['in verts_Triangle', 'index 2', null],
      ['byte offset 2 × 8', '16 bytes', null],
      ['stride 0', 'packed, 8 bytes apart', 'glVertexPointer'],
    ]);
    const staticVbo = { ...tri, renderingMode: 'VBO' as const, bufferUsage: 'STATIC' as const };
    const once = vertexJourney(scene([staticVbo]), 'Triangle', 1, CANVAS);
    expect(rowsOf(once, 'stored')[1]).toEqual(['copied once, usage GL_STATIC_DRAW', 'vbo_Triangle on the GPU', 'glBufferData']);
    expect(stage(once, 'stored').sentence).toContain('once, in init()');
    const vbo = { ...tri, renderingMode: 'VBO' as const, bufferUsage: 'DYNAMIC' as const };
    const j = vertexJourney(scene([vbo]), 'Triangle', 1, CANVAS);
    expect(rowsOf(j, 'stored')[1]).toEqual(['refreshed every frame, usage GL_DYNAMIC_DRAW', 'vbo_Triangle on the GPU', 'glBufferSubData']);
    expect(stage(j, 'stored').rows[1].step).toContainEqual({ input: 'GL_DYNAMIC_DRAW' });
    expect(stage(j, 'stored').sentence).toContain('every frame');
    expect(stage(j, 'stored').result).toBe('(−0.50, −0.50)');
    const mapped = { ...vbo, updateMethod: 'MAP_BUFFER' as const };
    expect(rowsOf(vertexJourney(scene([mapped]), 'Triangle', 1, CANVAS), 'stored')[1][2]).toBe('glMapBuffer');
    const stream = { ...tri, renderingMode: 'VBO' as const, bufferUsage: 'STREAM' as const };
    expect(rowsOf(vertexJourney(scene([stream]), 'Triangle', 1, CANVAS), 'stored')[1]).toEqual(['refreshed every frame, usage GL_STREAM_DRAW', 'vbo_Triangle on the GPU', 'glBufferData']);
  });
});

describe('WB-JOURNEY-12: An indexed vertex has the index the generator gives it', () => {
  it('matches the position of the vertex in the generated verts_ array', () => {
    // Two triangles sharing an edge: six vertices, four unique.
    const quad = node('Pair', 'TRIANGLES', [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]], {}, { renderingMode: 'VERTEX_ARRAY', useIndexed: true });
    const code = generateCodeFromState({ objects: [quad], canvasBackgroundColor: '#000000', callbacks: emptyCallbacks(), viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, textures: [] }, CANVAS);
    const numbers = /GLfloat verts_Pair\[\] = \{ (.*) \};/.exec(code)![1].split(', ').map((n) => Number(n.replace('f', '')));
    const pairs = Array.from({ length: numbers.length / 2 }, (_, k) => `${numbers[2 * k]},${numbers[2 * k + 1]}`);
    for (let i = 0; i < 6; i++) {
      const j = vertexJourney(scene([quad]), 'Pair', i, CANVAS);
      const v = quad.vertices[i];
      expect(rowsOf(j, 'stored').find((r) => String(r[0]).startsWith('in verts_'))![1]).toBe(`index ${pairs.indexOf(`${v.x},${v.y}`)}`);
    }
    expect(rowsOf(vertexJourney(scene([quad]), 'Pair', 0, CANVAS), 'stored')[1]).toEqual(['deduplicated', '4 of 6 kept', 'glDrawElements']);
  });

  it('keeps two corners apart when only their colours differ, as the generator does', () => {
    const tinted = node('Tinted', 'TRIANGLES', [], {}, {
      renderingMode: 'VERTEX_ARRAY', useIndexed: true,
      vertices: [
        { id: 't0', x: 0, y: 0, color: '#ffffff' }, { id: 't1', x: 1, y: 0, color: '#ffffff' }, { id: 't2', x: 0, y: 1, color: '#ffffff' },
        { id: 't3', x: 0, y: 0, color: '#ff0000' }, { id: 't4', x: 1, y: 0, color: '#ffffff' }, { id: 't5', x: 0, y: 1, color: '#ffffff' },
      ],
    });
    const code = generateCodeFromState({ objects: [tinted], canvasBackgroundColor: '#000000', callbacks: emptyCallbacks(), viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, textures: [] }, CANVAS);
    const kept = /GLfloat verts_Tinted\[\] = \{ (.*) \};/.exec(code)![1].split(', ').length / 2;
    expect(kept).toBe(4);
    const indexOf = (i: number) => rowsOf(vertexJourney(scene([tinted]), 'Tinted', i, CANVAS), 'stored').find((r) => String(r[0]).startsWith('in verts_'))![1];
    expect([0, 1, 2, 3, 4, 5].map(indexOf)).toEqual(['index 0', 'index 1', 'index 2', 'index 3', 'index 1', 'index 2']);
    expect(rowsOf(vertexJourney(scene([tinted]), 'Tinted', 3, CANVAS), 'stored')[1]).toEqual(['deduplicated', `${kept} of 6 kept`, 'glDrawElements']);
  });

  it('keeps two corners apart when only their UVs differ, and indexes the UV arrays alike', () => {
    const quad = node('Skin', 'TRIANGLES', [[0, 0], [1, 0], [0, 1], [0, 0], [1, 0], [0, 1]], {}, {
      renderingMode: 'VERTEX_ARRAY', useIndexed: true,
      texture: { textureId: 'tex', filter: 'NEAREST', wrap: 'REPEAT' },
      uvs: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }, { u: 0.5, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }],
    });
    const code = generateCodeFromState({ objects: [quad], canvasBackgroundColor: '#000000', callbacks: emptyCallbacks(), viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, textures: [] }, CANVAS);
    const grab = (re: RegExp) => re.exec(code)![1].split(', ').map((n) => Number(n.replace('f', '')));
    const flat = grab(/GLfloat verts_Skin\[\] = \{ (.*) \};/);
    const uvFlat = grab(/GLfloat uvs_Skin\[\] = \{ (.*) \};/);
    expect(flat.length / 2).toBe(4);
    expect(uvFlat.length / 2).toBe(4);
    const indexOf = (i: number) => rowsOf(vertexJourney(scene([quad]), 'Skin', i, CANVAS), 'stored').find((r) => String(r[0]).startsWith('in verts_'))![1];
    expect([0, 1, 2, 3, 4, 5].map(indexOf)).toEqual(['index 0', 'index 1', 'index 2', 'index 3', 'index 1', 'index 2']);
    // The UV the generator stores at that index is the corner's own.
    quad.uvs!.forEach((uv, i) => {
      const at = Number(String(indexOf(i)).replace('index ', ''));
      expect([uvFlat[2 * at], uvFlat[2 * at + 1]]).toEqual([uv.u, uv.v]);
    });
  });

  it('names the array as the program does for an object called My Shape', () => {
    const shape = node('My Shape', 'TRIANGLES', [[0, 0], [1, 0], [0, 1]], {}, { renderingMode: 'VERTEX_ARRAY' });
    expect(rowsOf(vertexJourney(scene([shape]), shape.id, 0, CANVAS), 'stored')[1][0]).toBe('in verts_My_Shape');
  });
});

describe("WB-JOURNEY-13: Assembled works the rule with the student's primitive type", () => {
  it("names the draw call for the mode, the rule and the vertex's place", () => {
    const tri = mockTriangle();
    expect(rowsOf(vertexJourney(scene([tri]), 'Triangle', 0, CANVAS), 'assembled')).toEqual([
      ['from Projected', '(0.27, 0.31)', null],
      ['primitive GL_TRIANGLES', 'every 3 vertices make a triangle', 'glBegin'],
      ['this vertex', 'triangle, 1 of 3', null],
    ]);
    const indexed = { ...tri, renderingMode: 'VERTEX_ARRAY' as const, useIndexed: true };
    expect(rowsOf(vertexJourney(scene([indexed]), 'Triangle', 0, CANVAS), 'assembled')[1][2]).toBe('glDrawElements');
    expect(primitivesOf('TRIANGLE_FAN', 5)).toEqual([[0, 1, 2], [0, 2, 3], [0, 3, 4]]);
    expect(primitivesOf('LINES', 3)).toEqual([[0, 1]]);
  });

  it('lists every primitive of all ten types, and none below the minimum count', () => {
    expect(primitivesOf('POINTS', 3)).toEqual([[0], [1], [2]]);
    expect(primitivesOf('LINES', 4)).toEqual([[0, 1], [2, 3]]);
    expect(primitivesOf('LINE_STRIP', 4)).toEqual([[0, 1], [1, 2], [2, 3]]);
    expect(primitivesOf('LINE_LOOP', 3)).toEqual([[0, 1], [1, 2], [2, 0]]);
    expect(primitivesOf('LINE_LOOP', 2)).toEqual([[0, 1], [1, 0]]);
    expect(primitivesOf('TRIANGLES', 6)).toEqual([[0, 1, 2], [3, 4, 5]]);
    expect(primitivesOf('TRIANGLE_STRIP', 5)).toEqual([[0, 1, 2], [1, 2, 3], [2, 3, 4]]);
    expect(primitivesOf('QUADS', 8)).toEqual([[0, 1, 2, 3], [4, 5, 6, 7]]);
    expect(primitivesOf('QUAD_STRIP', 6)).toEqual([[0, 1, 3, 2], [2, 3, 5, 4]]);
    expect(primitivesOf('POLYGON', 4)).toEqual([[0, 1, 2, 3]]);
    const below: [PrimitiveType, number][] = [
      ['POINTS', 0], ['LINES', 1], ['LINE_STRIP', 1], ['LINE_LOOP', 1], ['TRIANGLES', 2], ['TRIANGLE_STRIP', 2],
      ['TRIANGLE_FAN', 2], ['QUADS', 3], ['QUAD_STRIP', 3], ['POLYGON', 2],
    ];
    for (const [type, count] of below) expect(primitivesOf(type, count)).toEqual([]);
  });

  it('says not drawn for a leftover vertex, and names glDrawArrays in array mode', () => {
    const lines = node('Lines', 'LINES', [[0, 0], [1, 0], [0, 1]]);
    expect(rowsOf(vertexJourney(scene([lines]), 'Lines', 2, CANVAS), 'assembled')[2]).toEqual(['this vertex', 'not drawn', null]);
    const array = { ...mockTriangle(), renderingMode: 'VERTEX_ARRAY' as const };
    expect(rowsOf(vertexJourney(scene([array]), 'Triangle', 0, CANVAS), 'assembled')[1][2]).toBe('glDrawArrays');
  });
});

describe("WB-JOURNEY-14: Rasterised maps NDC to the window's pixels, as the reference does", () => {
  it('works x and y with the canvas size and matches ndcToWindow', () => {
    const tri = mockTriangle();
    const j = vertexJourney(scene([tri]), 'Triangle', 0, CANVAS);
    const px = ndcToWindow(stage(j, 'projected').point!, CANVAS);
    expect(rowsOf(j, 'rasterised')).toEqual([
      ['from Projected', '(0.27, 0.31)', null],
      [`width ${CANVAS.width}`, `x → ${px.x}`, 'glViewport'],
      [`height ${CANVAS.height}`, `y → ${px.y}`, 'glViewport'],
    ]);
    expect(stage(j, 'rasterised').sentence).not.toContain('outside the window');
  });
});

describe('WB-JOURNEY-15: A vertex outside the viewing volume keeps its real numbers', () => {
  it('goes past ±1 and outside the window with no NaN, and the sentence says it is clipped', () => {
    const far = node('Far', 'TRIANGLES', [[3, 0], [3.5, 0], [3, 0.5]]);
    const j = vertexJourney(scene([far]), 'Far', 0, CANVAS);
    const ndc = stage(j, 'projected').point!;
    expect(ndc.x).toBeCloseTo(3, 10);
    expect(stage(j, 'rasterised').point!.x).toBeGreaterThan(CANVAS.width);
    expect(stage(j, 'rasterised').point).toEqual(ndcToWindow(ndc, CANVAS));
    expect(JSON.stringify(j)).not.toContain('NaN');
    expect(stage(j, 'rasterised').sentence).toContain('outside the window');
  });

  it('reports a negative pixel with a true minus and nothing clamped', () => {
    const left = node('Left', 'POINTS', [[-1.5, -2]]);
    const j = vertexJourney(scene([left]), 'Left', 0, CANVAS);
    const px = stage(j, 'rasterised').point!;
    expect(px).toEqual(ndcToWindow(stage(j, 'projected').point!, CANVAS));
    expect(px.x).toBeLessThan(0);
    expect(px.y).toBeLessThan(0);
    expect(rowsOf(j, 'rasterised')[1][1]).toBe(`x → ${int(px.x)}`);
    expect(rowsOf(j, 'rasterised')[1][1]).toContain('−');
    expect(JSON.stringify(j)).not.toContain('NaN');
    expect(stage(j, 'rasterised').sentence).toContain('outside the window');
  });

  it('puts NDC exactly 1 in the last pixel and anything beyond it past the window', () => {
    const edge = vertexJourney(scene([node('E', 'POINTS', [[1, 1]])]), 'E', 0, CANVAS);
    expect(stage(edge, 'rasterised').point).toEqual({ x: CANVAS.width - 1, y: CANVAS.height - 1 });
    expect(stage(edge, 'rasterised').point).toEqual(ndcToWindow({ x: 1, y: 1 }, CANVAS));
    expect(stage(edge, 'rasterised').sentence).not.toContain('outside the window');
    const past = vertexJourney(scene([node('P', 'POINTS', [[1.5, 1.2]])]), 'P', 0, CANVAS);
    const px = stage(past, 'rasterised').point!;
    expect(px.x).toBeGreaterThanOrEqual(CANVAS.width);
    expect(px.y).toBeGreaterThanOrEqual(CANVAS.height);
    expect(px).toEqual(ndcToWindow(stage(past, 'projected').point!, CANVAS));
    expect(stage(past, 'rasterised').sentence).toContain('outside the window');
  });
});

describe('WB-JOURNEY-16: Rasterised says GLUT calls glViewport when there is no reshape handler', () => {
  const NOTE = 'Without a reshape handler, GLUT calls glViewport for you with the window’s size.';
  const sizeRows = (j: ReturnType<typeof vertexJourney>) => stage(j, 'rasterised').rows.filter((r) => r.call === 'glViewport');

  it('adds the sentence and unlinks the size rows without a handler', () => {
    const j = vertexJourney({ ...scene([mockTriangle()]), reshape: false }, 'Triangle', 0, CANVAS);
    expect(stage(j, 'rasterised').sentence).toContain(NOTE);
    expect(sizeRows(j)).toHaveLength(2);
    expect(sizeRows(j).every((r) => r.linked === false)).toBe(true);
  });

  it('keeps the link and leaves the sentence out with a handler', () => {
    const j = vertexJourney({ ...scene([mockTriangle()]), reshape: true }, 'Triangle', 0, CANVAS);
    expect(stage(j, 'rasterised').sentence).not.toContain('reshape handler');
    expect(sizeRows(j).every((r) => r.linked === true)).toBe(true);
  });
});

describe('WB-JOURNEY-17: Coloured works the vertex colour and the shading, as the mock does', () => {
  it('shows the pixel, the colour and the smooth weights; flat names the provoking vertex', () => {
    const tri = mockTriangle();
    const j = vertexJourney(scene([tri]), 'Triangle', 0, CANVAS);
    const px = stage(j, 'rasterised').point!;
    expect(rowsOf(j, 'coloured')).toEqual([
      ['at pixel', `(${px.x}, ${px.y})`, null],
      ['vertex colour', '(1.0, 0.4, 0.2)', 'glColor3f'],
      ['shading smooth', 'weights 1, 0, 0', 'glShadeModel'],
    ]);
    const flat = vertexJourney(scene([{ ...tri, shading: 'FLAT' }]), 'Triangle', 0, CANVAS);
    expect(rowsOf(flat, 'coloured')[2]).toEqual(['shading flat', 'vertex 3’s colour', 'glShadeModel']);
  });

  it('works a textured vertex from UV to texel', () => {
    const quad = node('Quad', 'QUADS', [[0, 0], [1, 0], [1, 1], [0, 1]], {}, {
      texture: { textureId: 'tex', filter: 'LINEAR', wrap: 'REPEAT' },
      uvs: [{ u: 0, v: 0 }, { u: 1.25, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }],
    });
    const textured: JourneyScene = { ...scene([quad]), textures: [{ id: 'tex', name: 'Bricks', dataUrl: '', width: 64, height: 32 }] };
    expect(rowsOf(vertexJourney(textured, 'Quad', 1, CANVAS), 'coloured').slice(1)).toEqual([
      ['UV', '(1.25, 0.00)', 'glTexCoord2f'],
      ['wrap REPEAT', '(0.25, 0.00)', 'glTexParameteri'],
      ['texture 64×32', 'texel (16, 0)', 'glBindTexture'],
      ['filter LINEAR', 'a blend of the 4 around it', 'glTexParameteri'],
    ]);
  });
});

describe('WB-JOURNEY-17: Coloured edge cases', () => {
  const tex = (id = 'tex', width = 64, height = 32) => [{ id, name: 'Bricks', dataUrl: '', width, height }];
  const quadWith = (extra: Partial<SceneNode>, uvs = [{ u: 0, v: 0 }, { u: 1.25, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }]) =>
    node('Quad', 'QUADS', [[0, 0], [1, 0], [1, 1], [0, 1]], {}, { texture: { textureId: 'tex', filter: 'NEAREST', wrap: 'CLAMP' }, uvs, ...extra });

  it('shows the 0–255 integers glColor3ub receives, and floats under glColorPointer', () => {
    const tri = mockTriangle();
    const byte = vertexJourney(scene([{ ...tri, colorMode: 'BYTE' }]), 'Triangle', 0, CANVAS);
    expect(rowsOf(byte, 'coloured')[1]).toEqual(['vertex colour', '(255, 102, 51)', 'glColor3ub']);
    const array = vertexJourney(scene([{ ...tri, colorMode: 'BYTE', renderingMode: 'VERTEX_ARRAY' }]), 'Triangle', 0, CANVAS);
    expect(rowsOf(array, 'coloured')[1]).toEqual(['vertex colour', '(1.0, 0.4, 0.2)', 'glColorPointer']);
  });

  it('names the array-mode texture call and clamps the wrapped UV', () => {
    const q = quadWith({ renderingMode: 'VERTEX_ARRAY' });
    const j = vertexJourney({ ...scene([q]), textures: tex() }, 'Quad', 1, CANVAS);
    expect(rowsOf(j, 'coloured').slice(1)).toEqual([
      ['UV', '(1.25, 0.00)', 'glTexCoordPointer'],
      ['wrap CLAMP', '(1.00, 0.00)', 'glTexParameteri'],
      ['texture 64×32', 'texel (63, 0)', 'glBindTexture'],
      ['filter NEAREST', 'that texel alone', 'glTexParameteri'],
    ]);
  });

  it('has no size row for a missing or zero-size texture', () => {
    const missing = vertexJourney(scene([quadWith({})]), 'Quad', 1, CANVAS);
    expect(rowsOf(missing, 'coloured').map((r) => r[0])).toEqual(['at pixel', 'UV', 'wrap CLAMP', 'filter NEAREST']);
    expect(stage(missing, 'coloured').result).toBe('texture missing');
    const empty = vertexJourney({ ...scene([quadWith({})]), textures: tex('tex', 0, 32) }, 'Quad', 1, CANVAS);
    expect(rowsOf(empty, 'coloured').map((r) => r[0])).not.toContain('texture 0×32');
    expect(stage(empty, 'coloured').result).toBe('texture missing');
  });

  it('works a text object\'s colour, in bytes under glColor3ub', () => {
    const text = node('Label', 'TEXT', [[0, 0]], {}, { textContent: 'Hi', vertices: [{ id: 't', x: 0, y: 0, color: '#ff6633' }] });
    const j = vertexJourney(scene([text]), 'Label', 0, CANVAS);
    const px = stage(j, 'rasterised').point!;
    expect(rowsOf(j, 'coloured')).toEqual([['at pixel', `(${px.x}, ${px.y})`, null], ['text colour', '(1.0, 0.4, 0.2)', 'glColor3f']]);
    const byte = vertexJourney(scene([{ ...text, colorMode: 'BYTE' }]), 'Label', 0, CANVAS);
    expect(rowsOf(byte, 'coloured')[1]).toEqual(['text colour', '(255, 102, 51)', 'glColor3ub']);
  });

  it('says a leftover vertex is not drawn, smooth or flat', () => {
    const four = node('Tris', 'TRIANGLES', [[0, 0], [1, 0], [0, 1], [1, 1]]);
    for (const shading of ['SMOOTH', 'FLAT'] as const) {
      const j = vertexJourney(scene([{ ...four, shading }]), 'Tris', 3, CANVAS);
      expect(rowsOf(j, 'coloured')[2][1]).toBe('not drawn');
      expect(rowsOf(j, 'coloured')[2][2]).toBe('glShadeModel');
      expect(stage(j, 'coloured').result).toBe('not drawn');
    }
  });

  it('keeps a large polygon\'s weights short', () => {
    const hex = node('Hex', 'POLYGON', [[0, 0], [1, 0], [2, 1], [2, 2], [1, 2], [0, 1]]);
    const j = vertexJourney(scene([hex]), 'Hex', 2, CANVAS);
    expect(rowsOf(j, 'coloured')[2][1]).toBe('weights 1 here, 0 at the other 5');
  });
});

describe('WB-JOURNEY-18: A Keep proportions reshape handler widens the volume the journey projects with', () => {
  const WIDE = { width: 800, height: 600 };
  const tri = () => node('Tri', 'TRIANGLES', [[1, 0], [0, 1], [-1, 0]]);
  const WIDENED = 'The reshape callback first widened your viewing volume to match the window’s shape.';

  it('projects and rasterises with the widened bounds, as the reference does', () => {
    const limits = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    const j = vertexJourney({ ...scene([tri()], limits), reshape: true, resize: 'keep' }, 'Tri', 0, WIDE);
    const bounds = keepAspectBounds(limits, WIDE);
    const ndc = orthoToNdc({ x: 1, y: 0 }, bounds);
    expect(ndc.x).toBeCloseTo(0.75, 10);
    expect(stage(j, 'projected').point!.x).toBeCloseTo(ndc.x, 4);
    expect(stage(j, 'projected').point!.y).toBeCloseTo(ndc.y, 4);
    expect(stage(j, 'rasterised').point).toEqual(ndcToWindow(ndc, WIDE));
    expect(rowsOf(j, 'projected')[1]).toEqual(['volume x −1.33…1.33', 'x → 0.75', 'glOrtho']);
    expect(stage(j, 'projected').sentence).toContain(WIDENED);
  });

  it('widens y on a tall window, and leaves the volume alone when stretching or with no handler', () => {
    const limits = { minX: -2, maxX: 2, minY: -1, maxY: 1 };
    const tall = { width: 400, height: 600 };
    const j = vertexJourney({ ...scene([tri()], limits), reshape: true, resize: 'keep' }, 'Tri', 1, tall);
    const ndc = orthoToNdc({ x: 0, y: 1 }, keepAspectBounds(limits, tall));
    expect(stage(j, 'projected').point!.y).toBeCloseTo(ndc.y, 4);
    for (const s of [{ reshape: true, resize: 'stretch' as const }, { reshape: false, resize: 'keep' as const }]) {
      const plain = vertexJourney({ ...scene([tri()], limits), ...s }, 'Tri', 1, tall);
      expect(stage(plain, 'projected').point!.y).toBeCloseTo(orthoToNdc({ x: 0, y: 1 }, limits).y, 10);
      expect(stage(plain, 'projected').sentence).not.toContain('widened');
    }
  });

  it('says nothing about widening when the window already has the volume’s shape', () => {
    const j = vertexJourney({ ...scene([tri()]), reshape: true, resize: 'keep' }, 'Tri', 0, { width: 500, height: 500 });
    expect(stage(j, 'projected').sentence).not.toContain('widened');
    expect(stage(j, 'projected').point!.x).toBe(1);
  });

  it('matches the generated reshape handler’s numbers', () => {
    const limits = { minX: -1, maxX: 3, minY: -1, maxY: 1 };
    const callbacks = { ...emptyCallbacks(), reshape: { handlerName: 'onReshape', resize: 'keep' as const } };
    const code = generateCodeFromState({ objects: [tri()], canvasBackgroundColor: '#000000', callbacks, viewportLimits: limits }, WIDE);
    const num = (name: string) => Number(new RegExp(`${name} = (-?[0-9.]+)f`).exec(code)![1]);
    const aspect = WIDE.width / WIDE.height;
    let halfW = num('halfW');
    let halfH = num('halfH');
    if (aspect >= halfW / halfH) halfW = halfH * aspect; else halfH = halfW / aspect;
    const program = { minX: num('cx') - halfW, maxX: num('cx') + halfW, minY: num('cy') - halfH, maxY: num('cy') + halfH };
    const j = vertexJourney({ ...scene([tri()], limits), reshape: true, resize: 'keep' }, 'Tri', 1, WIDE);
    expect(program.minY).toBeCloseTo(-1.5, 10);
    expect(stage(j, 'projected').point!.x).toBeCloseTo(orthoToNdc({ x: 0, y: 1 }, program).x, 10);
    expect(stage(j, 'projected').point!.y).toBeCloseTo(orthoToNdc({ x: 0, y: 1 }, program).y, 10);
  });
});
