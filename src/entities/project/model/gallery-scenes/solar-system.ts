import type { CallbacksState, SceneNode } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { at, node, vertices } from '../scene-nodes';
import { circle, disc, round, rule, type GalleryScene } from './gallery-scene';

const DASH = { factor: 2, pattern: 0x0f0f };

/** A loose, fixed starfield: the same points every time the scene opens. */
function starfield(): [number, number][] {
  const points: [number, number][] = [];
  let seed = 7;
  const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 48; i++) points.push([round(next() * 3.2 - 1.6), round(next() * 1.8 - 0.9)]);
  return points;
}

const path = (id: string, name: string, r: number): SceneNode =>
  node({
    id,
    name,
    type: 'LINE_LOOP',
    lineStipple: DASH,
    vertices: vertices(id, circle(r, 64).map(([x, y]) => [round(x), round(y)]), '#3d4a7a'),
  });

/**
 * Each orbit is a group at the Sun (or at Earth, for the Moon) that holds its planet out along x.
 * Turning the group carries the planet round it: the matrix stack does the orbiting.
 */
function build(): SceneNode[] {
  const stars = node({
    id: 'stars',
    name: 'Stars',
    type: 'POINTS',
    renderingMode: 'VBO',
    bufferUsage: 'STATIC',
    vertices: vertices('stars', starfield(), starfield().map((_, i) => (i % 4 ? '#ffffff' : '#9fb4ff'))),
  });
  const sun = node({ id: 'sun', name: 'Sun', type: 'TRIANGLE_FAN', vertices: disc('sun', 0.16, 24, '#fff3b0', '#ff9d1a') });

  const marsOrbit = node({ id: 'marsOrbit', name: 'Mars orbit', type: 'GROUP', vertices: [], children: ['mars'], transform: { ...at(0, 0), rotate: 140 } });
  const mars = node({ id: 'mars', name: 'Mars', type: 'TRIANGLE_FAN', parentId: 'marsOrbit', transform: at(0.8, 0), vertices: disc('mars', 0.045, 16, '#f29a6e', '#b8452a') });

  const earthOrbit = node({ id: 'earthOrbit', name: 'Earth orbit', type: 'GROUP', vertices: [], children: ['earth'], transform: { ...at(0, 0), rotate: 30 } });
  const earth = node({ id: 'earth', name: 'Earth', type: 'GROUP', vertices: [], parentId: 'earthOrbit', children: ['earthBody', 'moonPath', 'moonOrbit'], transform: at(0.5, 0) });
  const earthBody = node({ id: 'earthBody', name: 'Earth body', type: 'TRIANGLE_FAN', parentId: 'earth', vertices: disc('earthBody', 0.06, 20, '#8fd0ff', '#2a6fd1') });
  const moonPath = { ...path('moonPath', 'Moon path', 0.11), parentId: 'earth' };
  const moonOrbit = node({ id: 'moonOrbit', name: 'Moon orbit', type: 'GROUP', vertices: [], parentId: 'earth', children: ['moon'] });
  const moon = node({ id: 'moon', name: 'Moon', type: 'TRIANGLE_FAN', parentId: 'moonOrbit', transform: at(0.11, 0), vertices: disc('moon', 0.022, 12, '#ffffff', '#b9bcc6') });

  // Top first, as the store keeps objects.
  return [moon, moonOrbit, moonPath, earthBody, earth, earthOrbit, mars, marsOrbit, sun, path('marsPath', 'Mars path', 0.8), path('earthPath', 'Earth path', 0.5), stars];
}

function callbacks(): CallbacksState {
  const c = emptyCallbacks();
  const orbits: [string, number][] = [['earthOrbit', 2], ['marsOrbit', 1], ['moonOrbit', 8]];
  c.idle = { handlerName: 'onIdle', rules: orbits.map(([id, degrees]) => rule(`turn-${id}`, id, { kind: 'idle' }, { type: 'rotate', degrees })) };
  c.keyboard = { handlerName: 'onKey', rules: orbits.map(([id]) => rule(`reset-${id}`, id, { kind: 'keyboard', key: ' ' }, { type: 'reset' })) };
  return c;
}

export const solarSystem: GalleryScene = { section: 'Transforms', background: '#05081a', build, callbacks };
