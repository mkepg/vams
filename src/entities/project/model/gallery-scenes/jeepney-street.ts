import type { CallbacksState, SceneNode, SceneNodeType } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { node } from '../scene-nodes';
import { SIGN_TEXTURE } from './gallery-textures';
import { rule, type GalleryScene } from './gallery-scene';

type Point = [number, number];
type ColouredPoint = [number, number, string];

/** Four decimals, and never -0, which a saved file would turn into 0. */
const r4 = (v: number) => Math.round(v * 10000) / 10000 || 0;

interface Part {
  id: string;
  name: string;
  type: SceneNodeType;
  v?: ColouredPoint[];
  at?: Point;
  smooth?: boolean;
  parent?: string;
  lineWidth?: number;
  stipple?: { factor: number; pattern: number };
  text?: string;
}

const rect = (x0: number, y0: number, x1: number, y1: number, c: string): ColouredPoint[] => [[x0, y0, c], [x1, y0, c], [x1, y1, c], [x0, y1, c]];
const quad = (pts: Point[], c: string): ColouredPoint[] => pts.map(([x, y]) => [x, y, c]);
const ring = (r: number, n: number): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => [r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)]);
const star = (outer: number, inner: number): Point[] =>
  Array.from({ length: 11 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    return [r * Math.cos(a), r * Math.sin(a)];
  });

const HORIZON = -0.36;
const ROAD_TOP = -0.42;

/** The AVP street, finished: drawn bottom first, returned top first as the store keeps objects. */
function build(): SceneNode[] {
  const nodes: SceneNode[] = [];
  const add = (p: Part): SceneNode => {
    const n = node({
      id: p.id,
      name: p.name,
      type: p.type,
      shading: p.smooth ? 'SMOOTH' : 'FLAT',
      vertices: (p.v ?? []).map(([x, y, color], i) => ({ id: `${p.id}-v${i}`, x: r4(x), y: r4(y), color })),
      transform: { translateX: r4(p.at?.[0] ?? 0), translateY: r4(p.at?.[1] ?? 0), rotate: 0, scaleX: 1, scaleY: 1 },
      parentId: p.parent ?? null,
      lineStipple: p.stipple ?? null,
      ...(p.lineWidth ? { lineWidth: p.lineWidth } : {}),
    });
    if (p.text !== undefined) {
      n.textContent = p.text;
      n.rasterPosition = { x: n.transform.translateX, y: n.transform.translateY };
    }
    const parent = p.parent ? nodes.find((o) => o.id === p.parent) : undefined;
    if (parent) parent.children = [...(parent.children ?? []), p.id];
    nodes.push(n);
    return n;
  };

  // Sky, stars and moon.
  add({ id: 'sky', name: 'Sky', type: 'QUADS', smooth: true, v: [[-1.6, ROAD_TOP, '#4a2f63'], [1.6, ROAD_TOP, '#4a2f63'], [1.6, 0.9, '#0a0f2c'], [-1.6, 0.9, '#0a0f2c']] });
  const starPoints: Point[] = [[-1.45, 0.82], [-1.18, 0.64], [-0.92, 0.86], [-0.6, 0.74], [-0.28, 0.84], [0.05, 0.7], [0.3, 0.87], [0.62, 0.78], [0.9, 0.86], [1.48, 0.8], [1.4, 0.52], [-0.02, 0.5]];
  add({ id: 'stars', name: 'Stars', type: 'POINTS', v: starPoints.map(([x, y], i) => [x, y, i % 3 ? '#ffffff' : '#c9d3ff']) });
  add({ id: 'moon', name: 'Moon', type: 'TRIANGLE_FAN', smooth: true, at: [1.2, 0.6], v: [[0, 0, '#fffbe6'], ...ring(0.11, 20).map(([x, y]): ColouredPoint => [x, y, '#f3e3a6'])] });

  // Walk-ups of varied height, each with a parapet, and their windows.
  const blocks: [number, number, number, string][] = [
    [-1.6, -1.12, 0.38, '#2b2546'], [-1.12, -0.62, 0.2, '#342c52'], [-0.62, -0.02, 0.5, '#272140'],
    [-0.02, 0.5, 0.26, '#30294c'], [0.5, 1.02, 0.42, '#2a2445'], [1.02, 1.6, 0.16, '#352d53'],
  ];
  const buildings: ColouredPoint[] = [];
  for (const [x0, x1, top, c] of blocks) {
    buildings.push(...rect(x0, HORIZON, x1, top, c), ...rect(x0 - 0.015, top, x1 + 0.015, top + 0.025, '#3f3762'));
  }
  add({ id: 'buildings', name: 'Buildings', type: 'QUADS', v: buildings });
  const windows: ColouredPoint[] = [];
  let k = 0;
  for (const [x0, x1, top] of blocks) {
    const cols = Math.max(2, Math.round((x1 - x0) / 0.17));
    const w = (x1 - x0) / cols;
    for (let y = top - 0.13; y > HORIZON + 0.14; y -= 0.15) {
      for (let i = 0; i < cols; i++, k++) {
        const lit = (k * 7 + Math.round(y * 40)) % 5 < 2;
        const c = lit ? (k % 3 ? '#f6c66b' : '#ffe2a0') : '#1c1834';
        windows.push(...rect(x0 + i * w + 0.035, y - 0.055, x0 + (i + 1) * w - 0.035, y + 0.035, c));
      }
    }
  }
  add({ id: 'windows', name: 'Windows', type: 'QUADS', v: windows });

  // The sari-sari store, its awning and its painted sign.
  const sx0 = 0.56;
  const sx1 = 0.98;
  const awning = [0, 1, 2, 3, 4, 5].flatMap((i) =>
    quad([[sx0 - 0.03 + i * 0.08, -0.1], [sx0 + 0.05 + i * 0.08, -0.1], [sx0 + 0.06 + i * 0.08, -0.05], [sx0 - 0.02 + i * 0.08, -0.05]], i % 2 ? '#f4efe6' : '#d4372c'),
  );
  add({ id: 'store', name: 'Store', type: 'QUADS', v: [...rect(sx0, HORIZON, sx1, 0.02, '#5b3b2e'), ...rect(sx0 + 0.04, HORIZON + 0.03, sx1 - 0.04, -0.12, '#ffcf7a'), ...awning] });
  const sign = add({ id: 'sign', name: 'Store sign', type: 'QUADS', v: rect(sx0 + 0.02, -0.025, sx1 - 0.02, 0.07, '#ffffff') });
  sign.texture = { textureId: SIGN_TEXTURE.id, filter: 'NEAREST', wrap: 'REPEAT' };
  sign.uvs = [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }];

  // Poles, the wire between them and the parols hanging from it.
  add({ id: 'poles', name: 'Poles', type: 'QUADS', v: [...rect(-1.47, HORIZON, -1.445, 0.42, '#1a1726'), ...rect(1.38, HORIZON, 1.405, 0.42, '#1a1726'), ...rect(-1.52, 0.36, -1.395, 0.375, '#1a1726'), ...rect(1.33, 0.36, 1.455, 0.375, '#1a1726')] });
  const wireY = (x: number) => 0.37 - 0.2 * Math.sin(Math.PI * ((x + 1.46) / 2.85));
  const wire: ColouredPoint[] = Array.from({ length: 17 }, (_, i) => {
    const x = -1.46 + (i / 16) * 2.85;
    return [x, wireY(x), '#5d5680'];
  });
  add({ id: 'wire', name: 'Wire', type: 'LINE_STRIP', lineWidth: 2, v: wire });
  const parols: [number, string, string][] = [[-1.0, '#ff5a5f', '#ffd0c8'], [-0.4, '#39c7c0', '#d8fffb'], [0.32, '#ffc94a', '#fff3cf'], [1.17, '#7be37f', '#e6ffd9']];
  const tails: ColouredPoint[] = [];
  parols.forEach(([x, c, core], i) => {
    const y = wireY(x) - 0.14;
    add({ id: `parol${i + 1}`, name: `Parol ${i + 1}`, type: 'TRIANGLE_FAN', smooth: true, at: [x, y], v: [[0, 0, core], ...star(0.095, 0.042).map(([px, py]): ColouredPoint => [px, py, c])] });
    tails.push([x, wireY(x), '#8b84ad'], [x, y + 0.095, '#8b84ad']);
    tails.push([x - 0.025, y - 0.03, c], [x - 0.035, y - 0.17, c], [x + 0.025, y - 0.03, c], [x + 0.035, y - 0.17, c]);
  });
  add({ id: 'tails', name: 'Parol strings', type: 'LINES', lineWidth: 2, v: tails });

  // Street lamp, road and lane line.
  add({ id: 'lamp', name: 'Street lamp', type: 'QUADS', v: [...rect(-1.33, ROAD_TOP + 0.02, -1.31, 0.12, '#4b4f60'), ...rect(-1.33, 0.1, -1.2, 0.12, '#4b4f60')] });
  add({ id: 'lampLight', name: 'Lamp light', type: 'TRIANGLE_FAN', smooth: true, at: [-1.2, 0.095], v: [[0, 0, '#fff6d6'], ...ring(0.03, 12).map(([x, y]): ColouredPoint => [x, y, '#ffd27a'])] });
  add({ id: 'road', name: 'Road', type: 'QUADS', v: [...rect(-1.6, HORIZON - 0.065, 1.6, HORIZON, '#4a4560'), ...rect(-1.6, -0.9, 1.6, HORIZON - 0.065, '#1c1a26')] });
  add({ id: 'lane', name: 'Lane line', type: 'LINES', lineWidth: 3, stipple: { factor: 6, pattern: 0x00ff }, v: [[-1.6, -0.8, '#e9e3c8'], [1.6, -0.8, '#e9e3c8']] });

  // The jeepney: one group, drawn on a 1000-unit grid (x = 0 at the rear bumper, y = 0 at the road).
  const S = 0.0015;
  const P = ([x, y]: Point): Point => [(x - 500) * S, y * S];
  const R = (x0: number, y0: number, x1: number, y1: number, c: string) => quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((p) => P(p as Point)), c);
  const Q = (pts: Point[], c: string) => quad(pts.map(P), c);
  const STEEL = '#c6cbd3';
  const STEEL_D = '#9aa1ad';
  const CH = '#eef1f5';
  const RED = '#d4372c';
  const DARK = '#211a24';
  add({ id: 'jeep', name: 'Jeepney', type: 'GROUP', at: [-0.62, -0.7] });
  const body: ColouredPoint[] = [
    ...R(0, 40, 60, 70, '#2a2733'),
    ...R(60, 70, 615, 186, STEEL),
    ...Q([[150, 112], [615, 122], [615, 132], [150, 120]], '#f2c230'),
    ...Q([[150, 100], [615, 108], [615, 117], [150, 108]], '#2c5fd4'),
    ...R(60, 174, 615, 214, RED),
    ...R(60, 214, 615, 222, CH),
    ...R(60, 222, 615, 300, STEEL),
  ];
  for (const [x0, x1] of [[80, 196], [212, 328], [344, 460], [476, 592]]) {
    body.push(...R(x0, 232, x1, 292, DARK), ...R(x0 + 6, 236, x1 - 6, 254, '#9a6236'));
  }
  body.push(
    ...R(-6, 300, 790, 326, STEEL_D),
    ...R(-6, 300, 790, 305, CH),
    ...Q([[-6, 326], [790, 326], [784, 340], [2, 340]], '#dde0e6'),
    ...R(52, 70, 64, 300, CH),
    ...R(64, 150, 88, 182, '#ff3b3b'),
    ...R(0, 70, 120, 104, CH),
    ...R(615, 70, 780, 300, STEEL),
    ...R(615, 174, 780, 214, RED),
    ...Q([[632, 212], [722, 212], [728, 290], [640, 290]], DARK),
    ...Q([[644, 212], [676, 212], [676, 252], [644, 252]], '#3a2a26'),
    ...Q([[734, 222], [744, 300], [756, 300], [746, 222]], '#86a0c4'),
    ...Q([[780, 150], [780, 215], [940, 215], [954, 150]], STEEL),
    ...R(792, 178, 940, 188, RED),
    ...R(792, 196, 938, 200, CH),
    ...R(792, 166, 944, 170, CH),
    ...R(948, 120, 962, 214, CH),
    ...R(780, 70, 955, 150, STEEL_D),
    ...R(400, 40, 780, 70, STEEL_D),
    ...R(955, 66, 1000, 98, CH),
    ...R(986, 66, 996, 170, CH),
  );
  add({ id: 'jeepBody', name: 'Jeep body', type: 'QUADS', parent: 'jeep', v: body });
  const wells: ColouredPoint[] = [];
  for (const x of [300, 895]) {
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI;
      const a1 = ((i + 1) / 10) * Math.PI;
      wells.push([...P([x, 60]), '#141219'], [...P([x + 74 * Math.cos(a0), 60 + 74 * Math.sin(a0)]), '#141219'], [...P([x + 74 * Math.cos(a1), 60 + 74 * Math.sin(a1)]), '#141219']);
    }
  }
  add({ id: 'wells', name: 'Wheel wells', type: 'TRIANGLES', parent: 'jeep', v: wells });
  for (const [id, name, x] of [['rearArch', 'Rear arch', 300], ['fender', 'Front fender', 895]] as const) {
    const c = x > 500 ? STEEL_D : CH;
    const arch: ColouredPoint[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI - (i / 10) * Math.PI;
      arch.push([...P([x + 90 * Math.cos(a), 60 + 90 * Math.sin(a)]), c], [...P([x + 74 * Math.cos(a), 60 + 74 * Math.sin(a)]), c]);
    }
    add({ id, name, type: 'QUAD_STRIP', parent: 'jeep', v: arch });
  }
  add({ id: 'headlight', name: 'Headlight', type: 'TRIANGLE_FAN', smooth: true, parent: 'jeep', at: P([955, 190]), v: [[0, 0, '#ffffff'], ...ring(0.016, 10).map(([x, y]): ColouredPoint => [x, y, '#ffe6a3'])] });
  // GLUT bitmap text starts at its raster position: this one sits on the red band.
  add({ id: 'route', name: 'Route', type: 'TEXT', text: 'QUIAPO - MORAYTA', parent: 'jeep', at: P([280, 187]), v: [[0, 0, '#ffffff']] });
  for (const [name, x] of [['Rear', 300], ['Front', 895]] as const) {
    const id = `${name.toLowerCase()}Wheel`;
    const r = 60 * S;
    add({ id, name: `${name} wheel`, type: 'GROUP', parent: 'jeep', at: P([x, 60]) });
    add({ id: `${id}Tyre`, name: `${name} tyre`, type: 'TRIANGLE_FAN', smooth: true, parent: id, v: [[0, 0, '#2c2a34'], ...ring(r, 20).map(([px, py]): ColouredPoint => [px, py, '#141219'])] });
    add({ id: `${id}Rim`, name: `${name} rim`, type: 'TRIANGLE_FAN', parent: id, v: [[0, 0, '#cfd4dc'], ...ring(r * 0.58, 10).map(([px, py], i): ColouredPoint => [px, py, i % 2 ? '#e4e8ee' : '#a7aeb9'])] });
    add({ id: `${id}Hub`, name: `${name} hub`, type: 'TRIANGLE_FAN', smooth: true, parent: id, v: [[0, 0, '#f5f7fa'], ...ring(r * 0.2, 8).map(([px, py]): ColouredPoint => [px, py, '#7d8490'])] });
  }

  return nodes.reverse();
}

function callbacks(): CallbacksState {
  const c = emptyCallbacks();
  c.keyboard = {
    handlerName: 'onKey',
    rules: ['jeep', 'rearWheel', 'frontWheel'].map((id) => rule(`space-${id}`, id, { kind: 'keyboard', key: ' ' }, { type: 'reset' })),
  };
  c.idle = {
    handlerName: 'onIdle',
    rules: [
      rule('drive', 'jeep', { kind: 'idle' }, { type: 'translate', dx: 0.01, dy: 0 }),
      // The wheels' radius is 0.09, so 0.01 along the road turns them about 6°.
      rule('turn-rear', 'rearWheel', { kind: 'idle' }, { type: 'rotate', degrees: -6 }),
      rule('turn-front', 'frontWheel', { kind: 'idle' }, { type: 'rotate', degrees: -6 }),
    ],
  };
  return c;
}

export const jeepneyStreet: GalleryScene = {
  section: 'Primitives',
  background: '#0a0f2c',
  build,
  callbacks,
  textures: [SIGN_TEXTURE],
};
