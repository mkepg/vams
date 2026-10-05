import type { CurriculumSection } from '@/core/store/types';
import type { SceneNode, TransformState, Vertex } from '@/core/types/scene';
import { sanitizeProjectData, type VamsProjectData } from './project-io';
import { PRESET_LINKS, type PresetSlug } from './preset-links';

export interface ScenePreset {
  slug: PresetSlug;
  title: string;
  section: CurriculumSection;
  data: VamsProjectData;
}

/** Id of the editor's built-in "Tiling Bricks" sample texture (features/textures/lib/sample-textures.ts). */
const SAMPLE_BRICKS_ID = 'sample-bricks';
const IDENTITY: TransformState = { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 };

/** A scene object with the same defaults the editor gives a newly placed shape. */
function node(fields: Pick<SceneNode, 'id' | 'name' | 'type' | 'vertices'> & Partial<SceneNode>): SceneNode {
  return {
    visible: true,
    shading: 'SMOOTH',
    transform: { ...IDENTITY },
    parentId: null,
    children: [],
    colorMode: 'FLOAT',
    lineStipple: null,
    renderingMode: 'IMMEDIATE',
    bufferUsage: 'STATIC',
    useIndexed: false,
    updateMethod: 'BUFFER_SUB_DATA',
    texture: null,
    uvs: null,
    animation: null,
    ...fields,
  };
}

function vertices(prefix: string, points: [number, number][], colors: string | string[]): Vertex[] {
  return points.map(([x, y], i) => ({
    id: `${prefix}-v${i}`,
    x,
    y,
    color: typeof colors === 'string' ? colors : colors[i],
  }));
}

function at(x: number, y: number): TransformState {
  return { ...IDENTITY, translateX: x, translateY: y };
}

/** The home page's live demo triangle (src/pages/home/model/demo-code.ts), so the talk hands over seamlessly. */
function triangle(): SceneNode[] {
  return [
    node({
      id: 'triangle',
      name: 'Triangle',
      type: 'TRIANGLES',
      vertices: vertices('triangle', [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]], ['#ff0000', '#00ff00', '#0000ff']),
    }),
  ];
}

function transforms(): SceneNode[] {
  return [
    node({
      id: 'house',
      name: 'House',
      type: 'GROUP',
      vertices: [],
      children: ['walls', 'roof'],
      transform: { translateX: 0.2, translateY: 0.1, rotate: 15, scaleX: 0.8, scaleY: 0.8 },
    }),
    node({
      id: 'walls',
      name: 'Walls',
      type: 'QUADS',
      parentId: 'house',
      vertices: vertices('walls', [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.15], [-0.3, 0.15]], '#e8d5b5'),
    }),
    node({
      id: 'roof',
      name: 'Roof',
      type: 'TRIANGLES',
      parentId: 'house',
      vertices: vertices('roof', [[-0.38, 0.15], [0.38, 0.15], [0, 0.45]], '#b91c1c'),
    }),
    node({
      id: 'sun',
      name: 'Sun',
      type: 'TRIANGLE_FAN',
      transform: at(-0.6, 0.6),
      animation: { motion: 'rotate', speed: 1 },
      vertices: vertices(
        'sun',
        [[0, 0], [0.15, 0], [0, 0.15], [-0.15, 0], [0, -0.15], [0.15, 0]],
        ['#ffd23f', '#ff8c1a', '#ff8c1a', '#ff8c1a', '#ff8c1a', '#ff8c1a'],
      ),
    }),
  ];
}

function primitives(): SceneNode[] {
  return [
    node({
      id: 'points',
      name: 'Points',
      type: 'POINTS',
      transform: at(-0.5, 0.5),
      vertices: vertices('points', [[-0.2, -0.15], [0, 0.15], [0.2, -0.15], [0, 0]], '#ffd23f'),
    }),
    node({
      id: 'line-strip',
      name: 'Line strip',
      type: 'LINE_STRIP',
      lineWidth: 3,
      transform: at(0.5, 0.5),
      vertices: vertices('line-strip', [[-0.25, -0.15], [-0.1, 0.15], [0.05, -0.15], [0.25, 0.15]], '#38bdf8'),
    }),
    node({
      id: 'triangle-fan',
      name: 'Triangle fan',
      type: 'TRIANGLE_FAN',
      transform: at(-0.5, -0.5),
      vertices: vertices(
        'triangle-fan',
        [[0, 0], [0.25, 0], [0.18, 0.18], [0, 0.25], [-0.18, 0.18], [-0.25, 0]],
        ['#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
      ),
    }),
    node({
      id: 'quad',
      name: 'Quad',
      type: 'QUADS',
      transform: at(0.5, -0.5),
      vertices: vertices('quad', [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]], ['#a855f7', '#ec4899', '#f97316', '#22c55e']),
    }),
  ];
}

function texturedQuad(): SceneNode[] {
  return [
    node({
      id: 'bricks',
      name: 'Bricks',
      type: 'QUADS',
      texture: { textureId: SAMPLE_BRICKS_ID, filter: 'NEAREST', wrap: 'REPEAT' },
      // UVs run 0..2, so with GL_REPEAT the bricks tile twice in each direction.
      uvs: [{ u: 0, v: 0 }, { u: 2, v: 0 }, { u: 2, v: 2 }, { u: 0, v: 2 }],
      vertices: vertices('bricks', [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]], '#ffffff'),
    }),
  ];
}

const BUILDERS: Record<PresetSlug, { section: CurriculumSection; build: () => SceneNode[] }> = {
  triangle: { section: 'Primitives', build: triangle },
  transforms: { section: 'Transforms', build: transforms },
  primitives: { section: 'Primitives', build: primitives },
  'textured-quad': { section: 'Textures', build: texturedQuad },
};

export function isPresetSlug(slug: string): slug is PresetSlug {
  return PRESET_LINKS.some((link) => link.slug === slug);
}

/** A fresh copy of a prepared scene, passed through the same validator as an opened file. */
export function getPreset(slug: string): ScenePreset | undefined {
  const link = PRESET_LINKS.find((l) => l.slug === slug);
  if (!link) return undefined;
  const { section, build } = BUILDERS[link.slug];
  return { slug: link.slug, title: link.title, section, data: sanitizeProjectData({ objects: build() }) };
}
