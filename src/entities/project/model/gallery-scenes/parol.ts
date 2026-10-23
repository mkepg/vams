import type { CallbacksState, SceneNode } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { at, node, vertices } from '../scene-nodes';
import { circle, disc, round, rule, type GalleryScene } from './gallery-scene';

const SKY = '#0d1236';
const CENTRE: [number, number] = [0, 0.12];

/** The star's ten points, outer and inner in turn, starting at the top. */
function starPoints(outer: number, inner: number): [number, number][] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    return [round(r * Math.cos(a)), round(r * Math.sin(a))];
  });
}

function build(): SceneNode[] {
  const points = starPoints(0.4, 0.18);
  let seed = 11;
  const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const sky: [number, number][] = Array.from({ length: 40 }, () => [round(next() * 3.2 - 1.6), round(next() * 1.8 - 0.9)]);
  // The two lower points (indices 4 and 6) carry the tails.
  const [lx, ly] = points[4];
  const [rx, ry] = points[6];
  const tails: [number, number][] = [
    [lx, ly], [lx - 0.05, ly - 0.42],
    [lx + 0.03, ly], [lx - 0.01, ly - 0.36],
    [rx, ry], [rx + 0.05, ry - 0.42],
    [rx - 0.03, ry], [rx + 0.01, ry - 0.36],
  ];

  // Top first, as the store keeps objects.
  return [
    node({ id: 'outline', name: 'Outline', type: 'LINE_LOOP', lineWidth: 3, transform: at(...CENTRE), vertices: vertices('outline', points, '#ff7a3d') }),
    node({ id: 'ring', name: 'Inner ring', type: 'LINE_LOOP', lineWidth: 2, transform: at(...CENTRE), vertices: vertices('ring', circle(0.1, 24).map(([x, y]) => [round(x), round(y)]), '#fff8e1') }),
    node({
      id: 'star',
      name: 'Star',
      type: 'TRIANGLE_FAN',
      transform: at(...CENTRE),
      vertices: vertices('star', [[0, 0], ...points, points[0]], ['#fff3cf', ...points.map(() => '#ffc94a'), '#ffc94a']),
    }),
    node({ id: 'tails', name: 'Tails', type: 'LINES', lineWidth: 3, transform: at(...CENTRE), vertices: vertices('tails', tails, ['#ffc94a', '#ff7a3d', '#ffc94a', '#ff7a3d', '#ffc94a', '#ff7a3d', '#ffc94a', '#ff7a3d']) }),
    node({ id: 'string', name: 'String', type: 'LINES', lineWidth: 2, vertices: vertices('string', [[0, 0.9], [0, round(CENTRE[1] + 0.4)]], '#8b84ad') }),
    node({ id: 'glow', name: 'Glow', type: 'TRIANGLE_FAN', transform: at(...CENTRE), vertices: disc('glow', 0.7, 40, '#5e4a2c', SKY) }),
    node({ id: 'sky', name: 'Night sky', type: 'POINTS', vertices: vertices('sky', sky, sky.map((_, i) => (i % 3 ? '#ffffff' : '#c9d3ff'))) }),
  ];
}

function callbacks(): CallbacksState {
  const c = emptyCallbacks();
  const colours: [string, string][] = [['1', '#ff5a5f'], ['2', '#ffc94a'], ['3', '#39c7c0']];
  c.keyboard = { handlerName: 'onKey', rules: colours.map(([key, color]) => rule(`colour-${key}`, 'star', { kind: 'keyboard', key }, { type: 'setColor', color })) };
  c.mouse = { handlerName: 'onMouse', rules: [rule('glow-toggle', 'glow', { kind: 'mouse', button: 'left', state: 'down' }, { type: 'visibility', mode: 'toggle' })] };
  return c;
}

export const parol: GalleryScene = { section: 'Primitives', background: SKY, build, callbacks };
