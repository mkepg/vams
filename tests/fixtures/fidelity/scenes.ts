/**
 * The render fidelity battery: scenes the canvas must draw as the exported program draws them on
 * the course toolchain. Scenes are saved-state objects, so the battery seeds them the way a saved
 * scene opens. Gallery scenes open from their link instead.
 */

export interface FidelityScene {
  /** File name of the reference image, and the test's name. */
  id: string;
  objects?: unknown[];
  /** Uploaded textures, by name; the battery makes each image and hands the program the same PNG. */
  textures?: { id: string; name: string; kind: 'checker' }[];
  /** Opens /app?scene=<gallery> instead of seeding objects. */
  gallery?: string;
  /**
   * Pixels allowed to differ where GL_NEAREST samples within a twentieth of a pixel of a texel
   * boundary: the driver and the browser round that tie differently. Each use says where.
   */
  texelTies?: number;
}

type Rgb = string;
type Extra = Record<string, unknown>;

let counter = 0;
const v = (x: number, y: number, color: Rgb) => ({ id: `fv${counter++}`, x, y, color });

function node(id: string, type: string, vertices: [number, number, Rgb][], extra: Extra = {}) {
  return {
    id, name: id, type, visible: true, shading: 'SMOOTH',
    vertices: vertices.map(([x, y, c]) => v(x, y, c)),
    transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 },
    parentId: null, children: [], colorMode: 'FLOAT', lineStipple: null, renderingMode: 'IMMEDIATE',
    bufferUsage: 'STATIC', useIndexed: false, updateMethod: 'BUFFER_SUB_DATA', texture: null, uvs: null,
    ...extra,
  };
}

const at = (x: number, y: number, rotate = 0, scaleX = 1, scaleY = 1) => ({ transform: { translateX: x, translateY: y, rotate, scaleX, scaleY } });

const PALETTE = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
const ring = (n: number, r: number): [number, number, Rgb][] =>
  Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n + 0.3), r * Math.sin((2 * Math.PI * i) / n + 0.3), PALETTE[i % 6]]);

/** The Line style panel's presets (LineStylePanel.tsx). */
const PRESETS = [
  { factor: 1, pattern: 0xffff },
  { factor: 1, pattern: 0x00ff },
  { factor: 1, pattern: 0x5555 },
  { factor: 1, pattern: 0x6f6f },
  { factor: 2, pattern: 0x0fff },
  { factor: 4, pattern: 0xaaaa },
];

function presetLines(width: number) {
  return PRESETS.map((stipple, i) => {
    const y = 0.8 - i * 0.3;
    return node(`preset${i}`, 'LINE_STRIP', [[-0.9, y, '#ffffff'], [0.3, y, '#ffffff'], [0.85, y - 0.17, '#ffffff']], { lineWidth: width, lineStipple: stipple });
  });
}

/** Every primitive with more than one colour, in a 3 × 3 grid, all FLAT or all SMOOTH. */
function everyPrimitive(shading: 'FLAT' | 'SMOOTH') {
  const cell = (i: number) => at(-0.62 + (i % 3) * 0.62, 0.62 - Math.floor(i / 3) * 0.62);
  const strip = (n: number): [number, number, Rgb][] =>
    Array.from({ length: n }, (_, i) => [-0.25 + Math.floor(i / 2) * (0.5 / Math.ceil(n / 2 - 1 || 1)), i % 2 ? 0.2 : -0.2, PALETTE[i % 6]]);
  const lines: [number, number, Rgb][] = [[-0.25, -0.2, PALETTE[0]], [0.25, 0.2, PALETTE[1]], [-0.25, 0.2, PALETTE[2]], [0.25, -0.15, PALETTE[3]]];
  const shapes: [string, [number, number, Rgb][], Extra?][] = [
    ['TRIANGLES', ring(3, 0.25)],
    ['TRIANGLE_STRIP', strip(5)],
    ['TRIANGLE_FAN', [[0, 0, PALETTE[5]], ...ring(4, 0.25)]],
    ['QUADS', ring(4, 0.25)],
    ['QUAD_STRIP', strip(6)],
    ['POLYGON', ring(5, 0.25)],
    ['LINES', lines, { lineWidth: 3 }],
    ['LINE_STRIP', lines, { lineWidth: 3 }],
    ['LINE_LOOP', ring(4, 0.22), { lineWidth: 3 }],
  ];
  return shapes.map(([type, verts, extra], i) => node(`${type.toLowerCase()}`, type, verts, { shading, ...cell(i), ...extra }));
}

const SQUARE: [number, number, Rgb][] = [[-0.3, -0.3, '#ffffff'], [0.3, -0.3, '#ffffff'], [0.3, 0.3, '#ffffff'], [-0.3, 0.3, '#ffffff']];
const UVS = [{ u: 0, v: 0 }, { u: 2, v: 0 }, { u: 2, v: 2 }, { u: 0, v: 2 }];

export const FIDELITY_SCENES: FidelityScene[] = [
  { id: 'smooth-triangle', objects: [node('tri', 'TRIANGLES', [[0, 0.8, '#ff0000'], [-0.8, -0.6, '#00ff00'], [0.8, -0.6, '#0000ff']])] },
  { id: 'smooth-quad', objects: [node('quad', 'QUADS', [[-0.6, -0.6, '#ff0000'], [0.6, -0.6, '#00ff00'], [0.6, 0.6, '#0000ff'], [-0.6, 0.6, '#ffff00']])] },
  { id: 'flat-polygon', objects: [node('poly', 'POLYGON', ring(5, 0.7), { shading: 'FLAT', ...at(0, 0, 30) })] },
  {
    id: 'lines',
    objects: [
      node('stip', 'LINE_STRIP', [[-0.9, 0.8, '#ffffff'], [0.9, 0.8, '#ffffff'], [0.9, 0.3, '#ffffff'], [-0.9, 0, '#ffffff']], { lineWidth: 4.5, lineStipple: { factor: 2, pattern: 0xaaaa } }),
      node('thin', 'LINES', [[-0.9, -0.2, '#ffff00'], [0.9, -0.5, '#ffff00'], [-0.9, -0.9, '#00ffff'], [0.9, -0.9, '#00ffff']]),
      node('thick', 'LINES', [[-0.8, -0.35, '#ff0000'], [0.8, -0.75, '#00ff00']], { lineWidth: 3 }),
    ],
  },
  { id: 'points', objects: [node('pts', 'POINTS', [[-0.6, 0.5, '#ff0000'], [0, 0.5, '#00ff00'], [0.6, 0.5, '#0000ff'], [-0.3, -0.4, '#ffffff'], [0.3, -0.4, '#ffff00']])] },
  {
    id: 'scaled-lines-and-points',
    objects: [
      node('loop', 'LINE_LOOP', SQUARE, { lineWidth: 3, ...at(-0.3, 0.3, 20, 2.5, 0.6) }),
      node('pts', 'POINTS', [[-0.1, 0, '#ff0000'], [0.1, 0, '#00ff00']], at(0.2, -0.5, 0, 3, 0.4)),
    ],
  },
  { id: 'bitmap-text', objects: [node('txt', 'TEXT', [[0, 0, '#ffffff']], { textContent: 'Hello VAMS', rasterPosition: { x: -0.5, y: 0 } })] },
  { id: 'stipple-presets-1px', objects: presetLines(1) },
  { id: 'stipple-presets-4.5px', objects: presetLines(4.5) },
  { id: 'every-primitive-flat', objects: everyPrimitive('FLAT') },
  { id: 'every-primitive-smooth', objects: everyPrimitive('SMOOTH') },
  {
    id: 'textured-quads',
    textures: [{ id: 'fid-checker', name: 'checker', kind: 'checker' }],
    objects: [
      node('nearest', 'QUADS', SQUARE, { ...at(-0.45, 0), texture: { textureId: 'fid-checker', filter: 'NEAREST', wrap: 'REPEAT' }, uvs: UVS }),
      node('linear', 'QUADS', SQUARE, { ...at(0.45, 0), texture: { textureId: 'fid-checker', filter: 'LINEAR', wrap: 'REPEAT' }, uvs: UVS }),
    ],
  },
  {
    id: 'group-with-text',
    objects: [
      { ...node('group', 'GROUP', [], at(0.1, 0.1, 45)), children: ['g-tri', 'g-quad', 'g-text'] },
      { ...node('g-tri', 'TRIANGLES', [[-0.3, 0, '#ff8800'], [0, 0.4, '#ff8800'], [0.3, 0, '#ff8800']]), parentId: 'group' },
      { ...node('g-quad', 'QUADS', [[-0.2, -0.5, '#3366ff'], [0.2, -0.5, '#3366ff'], [0.2, -0.1, '#3366ff'], [-0.2, -0.1, '#3366ff']]), parentId: 'group' },
      { ...node('g-text', 'TEXT', [[0, 0, '#ffffff']], { textContent: 'Hello', rasterPosition: { x: -0.1, y: 0.5 } }), parentId: 'group' },
    ],
  },
  { id: 'vbo-dynamic', objects: [node('vbo', 'TRIANGLES', ring(3, 0.6), { renderingMode: 'VBO', bufferUsage: 'DYNAMIC' })] },
  { id: 'indexed-strip', objects: [node('ix', 'TRIANGLE_STRIP', [[-0.6, -0.3, '#ff0000'], [-0.6, 0.3, '#00ff00'], [0, -0.3, '#0000ff'], [0, 0.3, '#ffff00'], [0.6, -0.3, '#ff00ff'], [0.6, 0.3, '#00ffff']], { renderingMode: 'VERTEX_ARRAY', useIndexed: true })] },
  { id: 'gallery-jeepney-street', gallery: 'jeepney-street' },
  { id: 'gallery-solar-system', gallery: 'solar-system' },
  { id: 'gallery-parol', gallery: 'parol' },
  { id: 'gallery-clock', gallery: 'clock' },
  // The cloud tile repeats 4.5 times over 302 rows, so row 117 samples texel 87.97 of 144: 0.055 px
  // from a boundary. 9 pixels of that row take the next texel on the reference machine.
  { id: 'gallery-pixel-fox', gallery: 'pixel-fox', texelTies: 16 },
];
