import type { CallbacksState, SceneNode } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { at, node, vertices } from '../scene-nodes';
import { disc, round, rule, type GalleryScene } from './gallery-scene';

const INK = '#2a2620';

/** Tick marks as GL_LINES pairs, from `inner` to `outer`, for the given minutes. */
function ticks(minutes: number[], inner: number, outer: number): [number, number][] {
  return minutes.flatMap((m) => {
    const a = Math.PI / 2 - (m / 60) * 2 * Math.PI;
    return [
      [round(inner * Math.cos(a)), round(inner * Math.sin(a))],
      [round(outer * Math.cos(a)), round(outer * Math.sin(a))],
    ] as [number, number][];
  });
}

/** A hand pointing up from the centre, so turning it turns it about the centre. */
function hand(id: string, name: string, length: number, width: number, tail: number, color: string, rotate: number): SceneNode {
  return node({
    id,
    name,
    type: 'QUADS',
    transform: { ...at(0, 0), rotate },
    vertices: vertices(id, [[-width, -tail], [width, -tail], [width * 0.6, length], [-width * 0.6, length]], color),
  });
}

/** Bitmap text starts at its raster position, so each number is placed left of and below its spot. */
function numeral(text: string, name: string, x: number, y: number): SceneNode {
  return node({ id: `n${text}`, name, type: 'TEXT', transform: at(x, y), textContent: text, rasterPosition: { x, y }, vertices: vertices(`n${text}`, [[0, 0]], INK) });
}

function build(): SceneNode[] {
  const minutes = Array.from({ length: 60 }, (_, m) => m).filter((m) => m % 5 !== 0);
  const hours = Array.from({ length: 12 }, (_, h) => h * 5);
  // Top first, as the store keeps objects. It opens at ten past ten.
  return [
    node({ id: 'cap', name: 'Centre cap', type: 'TRIANGLE_FAN', vertices: disc('cap', 0.028, 12, '#ff6b5b', '#b8231a') }),
    hand('secondHand', 'Second hand', 0.6, 0.007, 0.12, '#d4372c', 0),
    hand('minuteHand', 'Minute hand', 0.56, 0.022, 0.05, INK, -60),
    hand('hourHand', 'Hour hand', 0.36, 0.03, 0.05, INK, 55),
    numeral('12', 'Twelve', -0.045, 0.5),
    numeral('3', 'Three', 0.5, -0.03),
    numeral('6', 'Six', -0.02, -0.58),
    numeral('9', 'Nine', -0.55, -0.03),
    node({ id: 'hourTicks', name: 'Hour ticks', type: 'LINES', lineWidth: 3, vertices: vertices('hourTicks', ticks(hours, 0.6, 0.7), INK) }),
    node({ id: 'minuteTicks', name: 'Minute ticks', type: 'LINES', vertices: vertices('minuteTicks', ticks(minutes, 0.66, 0.7), '#7a7262') }),
    node({ id: 'face', name: 'Face', type: 'TRIANGLE_FAN', vertices: disc('face', 0.74, 48, '#fdfaf2', '#e6dcc6') }),
    node({ id: 'rim', name: 'Rim', type: 'TRIANGLE_FAN', vertices: disc('rim', 0.8, 48, '#e2c27c', '#8a6a2e') }),
  ];
}

function callbacks(): CallbacksState {
  const c = emptyCallbacks();
  c.idle = { handlerName: 'onIdle', rules: [rule('sweep', 'secondHand', { kind: 'idle' }, { type: 'rotate', degrees: -1 })] };
  c.keyboard = {
    handlerName: 'onKey',
    rules: [
      rule('minute', 'minuteHand', { kind: 'keyboard', key: 'm' }, { type: 'rotate', degrees: -6 }),
      rule('hour', 'hourHand', { kind: 'keyboard', key: 'h' }, { type: 'rotate', degrees: -30 }),
      ...['secondHand', 'minuteHand', 'hourHand'].map((id) => rule(`reset-${id}`, id, { kind: 'keyboard', key: ' ' }, { type: 'reset' })),
    ],
  };
  return c;
}

export const clock: GalleryScene = { section: 'Transforms', background: '#1e2638', build, callbacks };
