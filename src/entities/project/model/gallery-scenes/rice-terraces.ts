import type { CallbacksState, SceneNode } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { at, node, vertices } from '../scene-nodes';
import { disc, round, rule, type GalleryScene } from './gallery-scene';

const TERRACES = 4;
const STEPS = 16;
const GREENS: [string, string][] = [['#a6d65e', '#6fa63c'], ['#93ca52', '#5e9433'], ['#7fbb48', '#4e822b'], ['#6aa83d', '#3f6f24']];

/** The top edge of terrace `k` at `x`: each step lower than the last, with a gentle swell. Below the last is the window's edge. */
const edge = (k: number, x: number) => (k >= TERRACES ? -0.9 : round(-0.16 - 0.19 * k + 0.045 * Math.sin(2.1 * x + k * 1.3)));
const xs = Array.from({ length: STEPS + 1 }, (_, i) => round(-1.6 + (3.2 * i) / STEPS));

/**
 * One terrace as quads between its own edge and the next one down. Neighbouring quads share their
 * side vertices, so indexed drawing stores each corner once.
 */
function terrace(k: number): SceneNode {
  const points: [number, number][] = [];
  const colors: string[] = [];
  const [light, dark] = GREENS[k];
  for (let i = 0; i < STEPS; i++) {
    const [a, b] = [xs[i], xs[i + 1]];
    points.push([a, edge(k, a)], [a, edge(k + 1, a)], [b, edge(k + 1, b)], [b, edge(k, b)]);
    colors.push(light, dark, dark, light);
  }
  return node({
    id: `terrace${k}`,
    name: `Terrace ${k + 1}`,
    type: 'QUADS',
    renderingMode: 'VBO',
    bufferUsage: 'STATIC',
    useIndexed: true,
    vertices: vertices(`terrace${k}`, points, colors),
  });
}

/** The paddy wall along a terrace's top edge, as a line strip from client-side arrays. */
const dyke = (k: number): SceneNode =>
  node({
    id: `dyke${k}`,
    name: `Wall ${k + 1}`,
    type: 'LINE_STRIP',
    lineWidth: 2,
    renderingMode: 'VERTEX_ARRAY',
    vertices: vertices(`dyke${k}`, xs.map((x) => [x, edge(k, x)]), '#e3f5b0'),
  });

function ridge(): SceneNode {
  const points: [number, number][] = [];
  xs.forEach((x, i) => points.push([x, round(0.08 + 0.16 * Math.abs(Math.sin(1.7 * x + 0.4)) + (i % 3) * 0.02)], [x, -0.5]));
  return node({
    id: 'ridge',
    name: 'Mountains',
    type: 'TRIANGLE_STRIP',
    renderingMode: 'VBO',
    bufferUsage: 'STATIC',
    vertices: vertices('ridge', points, points.map((_, i) => (i % 2 ? '#2f2856' : '#5a4a8c'))),
  });
}

function stars(): SceneNode {
  let seed = 23;
  const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const points: [number, number][] = Array.from({ length: 36 }, () => [round(next() * 3.2 - 1.6), round(0.3 + next() * 0.58)]);
  return node({ id: 'stars', name: 'Stars', type: 'POINTS', visible: false, vertices: vertices('stars', points, '#ffffff') });
}

function build(): SceneNode[] {
  const sky = node({
    id: 'sky',
    name: 'Sky',
    type: 'QUADS',
    renderingMode: 'VERTEX_ARRAY',
    vertices: vertices('sky', [[-1.6, 0.9], [1.6, 0.9], [1.6, -0.9], [-1.6, -0.9]], ['#26245e', '#26245e', '#f39a55', '#f39a55']),
  });
  const sun = node({
    id: 'sun',
    name: 'Sun',
    type: 'TRIANGLE_FAN',
    renderingMode: 'VBO',
    bufferUsage: 'STATIC',
    transform: at(0.55, 0.45),
    vertices: disc('sun', 0.13, 28, '#fff3c4', '#ff9348'),
  });
  const layers = Array.from({ length: TERRACES }, (_, k) => k);
  // Top first, as the store keeps objects: walls over terraces, the nearest terrace on top.
  return [...layers.map(dyke).reverse(), ...layers.map(terrace).reverse(), ridge(), sun, stars(), sky];
}

function callbacks(): CallbacksState {
  const c = emptyCallbacks();
  c.motion = { handlerName: 'onDrag', rules: [rule('drag-sun', 'sun', { kind: 'motion' }, { type: 'moveToPointer' })] };
  c.keyboard = {
    handlerName: 'onKey',
    rules: [
      rule('night', 'stars', { kind: 'keyboard', key: 'n' }, { type: 'visibility', mode: 'toggle' }),
      rule('reset-sun', 'sun', { kind: 'keyboard', key: ' ' }, { type: 'reset' }),
    ],
  };
  return c;
}

export const riceTerraces: GalleryScene = { section: 'Buffers', background: '#26245e', build, callbacks };
