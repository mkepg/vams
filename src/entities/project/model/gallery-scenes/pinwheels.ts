import type { CallbacksState, SceneNode } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { at, node, vertices } from '../scene-nodes';
import { disc, round, rule, type GalleryScene } from './gallery-scene';

const GROUND = -0.52;

interface Wheel {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  colours: [string, string];
  /** Degrees turned per idle frame; negative turns clockwise. */
  speed: number;
}

const WHEELS: Wheel[] = [
  { id: 'big', name: 'Big pinwheel', x: -0.85, y: 0.12, r: 0.34, colours: ['#ff5d73', '#ffd24d'], speed: -5 },
  { id: 'middle', name: 'Middle pinwheel', x: 0.25, y: 0.26, r: 0.25, colours: ['#4d8dff', '#7be0c3'], speed: 7 },
  { id: 'small', name: 'Small pinwheel', x: 1.05, y: 0.02, r: 0.2, colours: ['#a46bff', '#ff9b4a'], speed: -9 },
];

/** Four vanes, each a triangle from the hub out along one arm and back to the diagonal. */
function blades(w: Wheel): SceneNode {
  const points: [number, number][] = [];
  const colors: string[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const turn = ([x, y]: [number, number]): [number, number] => [round(x * Math.cos(a) - y * Math.sin(a)), round(x * Math.sin(a) + y * Math.cos(a))];
    points.push(turn([0, 0]), turn([0, w.r]), turn([w.r * 0.62, w.r * 0.62]));
    const colour = w.colours[k % 2];
    colors.push('#ffffff', colour, colour);
  }
  return node({ id: `${w.id}Blades`, name: `${w.name} vanes`, type: 'TRIANGLES', parentId: w.id, vertices: vertices(`${w.id}Blades`, points, colors) });
}

/** Each pinwheel is a group at its hub: turning the group turns the vanes and the pin together. */
function wheel(w: Wheel): SceneNode[] {
  const group = node({ id: w.id, name: w.name, type: 'GROUP', vertices: [], children: [`${w.id}Pin`, `${w.id}Blades`], transform: { ...at(w.x, w.y), rotate: 15 } });
  const pin = node({ id: `${w.id}Pin`, name: `${w.name} pin`, type: 'TRIANGLE_FAN', parentId: w.id, vertices: disc(`${w.id}Pin`, round(w.r * 0.12), 12, '#ffffff', '#c9ced8') });
  const stick = node({
    id: `${w.id}Stick`,
    name: `${w.name} stick`,
    type: 'LINES',
    lineWidth: 4,
    vertices: vertices(`${w.id}Stick`, [[w.x, w.y], [w.x, GROUND - 0.05]], ['#b98a5a', '#7a5534']),
  });
  return [pin, blades(w), group, stick];
}

function hill(): SceneNode {
  const points: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const x = round(-1.6 + (3.2 * i) / 16);
    points.push([x, round(GROUND + 0.07 * Math.sin(1.6 * x + 0.8))], [x, -0.9]);
  }
  return node({ id: 'hill', name: 'Hill', type: 'TRIANGLE_STRIP', vertices: vertices('hill', points, points.map((_, i) => (i % 2 ? '#3f8f45' : '#86d66f'))) });
}

const cloud = (id: string, x: number, y: number): SceneNode =>
  node({ id, name: id === 'cloud1' ? 'Cloud 1' : 'Cloud 2', type: 'TRIANGLE_FAN', transform: { ...at(x, y), scaleX: 2.2, scaleY: 1 }, vertices: disc(id, 0.08, 20, '#ffffff', '#e4f1ff') });

function build(): SceneNode[] {
  const sun = node({ id: 'sun', name: 'Sun', type: 'TRIANGLE_FAN', transform: at(-1.28, 0.64), vertices: disc('sun', 0.11, 24, '#fffbd6', '#ffd44d') });
  // Top first, as the store keeps objects.
  return [...WHEELS.flatMap(wheel), hill(), cloud('cloud1', 0.7, 0.66), cloud('cloud2', -0.25, 0.74), sun];
}

function callbacks(): CallbacksState {
  const c = emptyCallbacks();
  c.idle = { handlerName: 'onIdle', rules: WHEELS.map((w) => rule(`spin-${w.id}`, w.id, { kind: 'idle' }, { type: 'rotate', degrees: w.speed })) };
  c.special = {
    handlerName: 'onSpecial',
    rules: [
      rule('push-left', 'big', { kind: 'special', key: 'left' }, { type: 'rotate', degrees: 30 }),
      rule('push-right', 'big', { kind: 'special', key: 'right' }, { type: 'rotate', degrees: -30 }),
    ],
  };
  c.keyboard = { handlerName: 'onKey', rules: WHEELS.map((w) => rule(`reset-${w.id}`, w.id, { kind: 'keyboard', key: ' ' }, { type: 'reset' })) };
  return c;
}

export const pinwheels: GalleryScene = { section: 'Transforms', background: '#9ed8ff', build, callbacks };
