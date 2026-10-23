import type { CurriculumSection } from '@/core/store/types';
import type { CallbacksState, SceneNode } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { sanitizeProjectData, type VamsProjectData } from './project-io';
import { PRESET_LINKS, type PresetSlug } from './preset-links';
import { at, node, vertices } from './scene-nodes';
import { GALLERY_SCENES, type GallerySlug } from './gallery-links';
import { GALLERY_BUILDERS, GALLERY_VIEW } from './gallery-scenes';

export interface ScenePreset {
  slug: PresetSlug | GallerySlug;
  title: string;
  section: CurriculumSection;
  data: VamsProjectData;
}

/** Id of the editor's built-in "Brick wall" sample texture (features/textures/lib/sample-textures.ts). */
const SAMPLE_BRICKS_ID = 'sample-bricks';
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
      vertices: vertices(
        'sun',
        [[0, 0], [0.15, 0], [0, 0.15], [-0.15, 0], [0, -0.15], [0.15, 0]],
        ['#ffd23f', '#ff8c1a', '#ff8c1a', '#ff8c1a', '#ff8c1a', '#ff8c1a'],
      ),
    }),
  ];
}

/** The sun spins while the scene runs: an idle rule turns it a little every frame. */
function spinningSun(): CallbacksState {
  const callbacks = emptyCallbacks();
  callbacks.idle = {
    handlerName: 'onIdle',
    rules: [{ id: 'sun-spin', objectId: 'sun', trigger: { kind: 'idle' }, action: { type: 'rotate', degrees: 2 } }],
  };
  return callbacks;
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

const BUILDERS: Record<PresetSlug, { section: CurriculumSection; build: () => SceneNode[]; callbacks?: () => CallbacksState }> = {
  triangle: { section: 'Primitives', build: triangle },
  transforms: { section: 'Transforms', build: transforms, callbacks: spinningSun },
  primitives: { section: 'Primitives', build: primitives },
  'textured-quad': { section: 'Textures', build: texturedQuad },
};

/** A slug a scene link can name: a starter scene or a gallery scene. */
export function isPresetSlug(slug: string): slug is PresetSlug | GallerySlug {
  return PRESET_LINKS.some((link) => link.slug === slug) || GALLERY_SCENES.some((scene) => scene.slug === slug);
}

/** A gallery scene draws on its own background in the 16:9 view, without the editor's axes and grid. */
function galleryData(slug: GallerySlug) {
  const scene = GALLERY_BUILDERS[slug];
  return {
    objects: scene.build(),
    callbacks: scene.callbacks(),
    viewportLimits: { ...GALLERY_VIEW },
    axisVisibility: { showGlobalAxes: false, showLocalAxes: false, showOriginMarker: false, showGridlines: false, showGridNumbers: false },
    showCoordinateTracker: true,
    canvasBackgroundColor: scene.background,
    uploadedTextures: [...(scene.textures ?? [])],
  };
}

/** A fresh copy of a prepared scene, passed through the same validator as an opened file. */
export function getPreset(slug: string): ScenePreset | undefined {
  const link = PRESET_LINKS.find((l) => l.slug === slug);
  if (link) {
    const { section, build, callbacks } = BUILDERS[link.slug];
    return { slug: link.slug, title: link.title, section, data: sanitizeProjectData({ objects: build(), callbacks: callbacks?.() }) };
  }
  const scene = GALLERY_SCENES.find((s) => s.slug === slug);
  if (!scene) return undefined;
  return { slug: scene.slug, title: scene.title, section: GALLERY_BUILDERS[scene.slug].section, data: sanitizeProjectData(galleryData(scene.slug)) };
}
