import type { CurriculumSection } from '@/core/store/types';
import { JOURNEY_STAGES, JOURNEY_STAGE_TITLES, type JourneyStageId } from '@/core/inspector/journey-stage';
import type { PrimitiveType, SceneNode, TransformState, ViewportLimits } from '@/core/types/scene';
import type { TextureAsset, TextureWrap, UV } from '@/core/types/textures';
import { assemblyFor, provokingVertex } from '@/entities/scene/model/primitive-assembly';
import { fmt, int, short } from '@/shared/lib/format-number';
import { firstRasterY } from '@/shared/lib/text-raster';

export interface Point {
  x: number;
  y: number;
}

/** A step's words; `{ input }` is one of the student's own values, shown in amber. */
export type StepPart = string | { input: string };

export interface WorkingRow {
  step: StepPart[];
  value: string;
  /** The GL call that performs the step, or null. */
  call: string | null;
  /** The first row: where the value came from. */
  from?: boolean;
}

export interface JourneyStage {
  id: JourneyStageId;
  title: string;
  section: CurriculumSection;
  sentence: string;
  rows: WorkingRow[];
  /** What the closed row shows, and the working's last row. Null when there is nothing to follow. */
  result: string | null;
  point: Point | null;
}

export type JourneySubject =
  | { kind: 'none' }
  | { kind: 'group'; name: string }
  | { kind: 'text'; name: string }
  | { kind: 'shape'; name: string; vertex: number; count: number };

export interface VertexJourney {
  subject: JourneySubject;
  stages: JourneyStage[];
}

export interface JourneyScene {
  objects: readonly SceneNode[];
  viewportLimits: ViewportLimits;
  textures: readonly TextureAsset[];
}

export interface CanvasSize {
  width: number;
  height: number;
}

export const STAGE_INFO: Record<JourneyStageId, { title: string; section: CurriculumSection; description: string }> = {
  stored: { title: JOURNEY_STAGE_TITLES.stored, section: 'Buffers', description: 'Where a vertex is kept before drawing.' },
  transformed: { title: JOURNEY_STAGE_TITLES.transformed, section: 'Transforms', description: 'Moved, turned and scaled into place.' },
  projected: { title: JOURNEY_STAGE_TITLES.projected, section: 'Transforms', description: 'Fitted into the −1 to 1 box.' },
  assembled: { title: JOURNEY_STAGE_TITLES.assembled, section: 'Primitives', description: 'Joined into points, lines or shapes.' },
  rasterised: { title: JOURNEY_STAGE_TITLES.rasterised, section: 'Pipeline', description: 'Turned into pixels in the window.' },
  coloured: { title: JOURNEY_STAGE_TITLES.coloured, section: 'Primitives', description: 'Given its final colour.' },
};

const TRANSFORMED = 'Scale, rotate and move act on the vertex in the reverse of the order they appear in the code.';
const PROJECTED = 'Your viewing volume is squeezed into a −1 to 1 box on each axis, called normalised device coordinates (NDC).';
const RASTERISED = 'NDC is stretched to the window’s pixels, counted from the bottom-left corner as OpenGL does.';
const SMOOTH = 'With smooth shading, each pixel inside the shape mixes the vertex colours by how close it is to each one.';
const FLAT = 'With flat shading, the whole shape takes the colour of one vertex.';
const TEXTURED = 'Each pixel reads its colour from the texture, at the UV the vertices carry.';
const TEXT_STORED = 'The text starts at its raster position, set by glRasterPos2f in the text’s own coordinates.';
const TEXT_ASSEMBLED = 'Text is drawn as bitmap characters at this position, not assembled from vertices.';
const GROUP_TRANSFORMED = 'A group moves, turns and scales everything inside it. This is where its origin lands.';

const STORED_BY_MODE = {
  IMMEDIATE: 'Your vertex is sent straight to OpenGL by glVertex2f, one call per vertex.',
  VERTEX_ARRAY: 'Your vertex sits in a C array in the program’s memory; the draw call reads it from there.',
  VBO: 'Your vertex was copied to a buffer on the GPU once, in init(); drawing reads it from there.',
} as const;
/** DYNAMIC and STREAM buffers: update_buffers() sends the data again every frame. */
const VBO_REFRESHED = 'Your vertex was copied to a buffer on the GPU in init(), and update_buffers() copies it again every frame; drawing reads it from there.';

const pair = (p: Point) => `(${fmt(p.x)}, ${fmt(p.y)})`;

function stage(id: JourneyStageId, sentence: string, rows: WorkingRow[], result: string | null, point: Point | null): JourneyStage {
  const info = STAGE_INFO[id];
  return { id, title: info.title, section: info.section, sentence, rows, result, point };
}

function blankStages(): JourneyStage[] {
  return JOURNEY_STAGES.map((id) => stage(id, STAGE_INFO[id].description, [], null, null));
}

/** The object, then each enclosing group, innermost first. */
function chainOf(node: SceneNode, objects: readonly SceneNode[]): SceneNode[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const chain = [node];
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent && !chain.includes(parent)) {
    chain.push(parent);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return chain;
}

/** Scale, then rotate, then move, for the object and then each enclosing group. */
function transformRows(start: Point, chain: readonly SceneNode[]): { rows: WorkingRow[]; end: Point } {
  let p = start;
  const rows: WorkingRow[] = [];
  chain.forEach((node, depth) => {
    const t: TransformState = node.transform;
    const scope = depth === 0 ? '' : `${node.name}: `;
    p = { x: p.x * t.scaleX, y: p.y * t.scaleY };
    rows.push({ step: [`${scope}scale `, { input: short(t.scaleX) }, ', ', { input: short(t.scaleY) }], value: pair(p), call: 'glScalef' });
    const r = (t.rotate * Math.PI) / 180;
    p = { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
    rows.push({ step: [`${scope}rotate `, { input: `${short(t.rotate)}°` }], value: pair(p), call: 'glRotatef' });
    p = { x: p.x + t.translateX, y: p.y + t.translateY };
    rows.push({ step: [`${scope}move `, { input: fmt(t.translateX) }, ', ', { input: fmt(t.translateY) }], value: pair(p), call: 'glTranslatef' });
  });
  return { rows, end: p };
}

function ndcOf(p: Point, v: ViewportLimits): Point {
  return { x: (2 * (p.x - v.minX)) / (v.maxX - v.minX) - 1, y: (2 * (p.y - v.minY)) / (v.maxY - v.minY) - 1 };
}

function pixelOf(n: Point, c: CanvasSize): Point {
  return { x: Math.floor(((n.x + 1) / 2) * c.width), y: Math.floor(((n.y + 1) / 2) * c.height) };
}

function projectedRows(world: Point, ndc: Point, v: ViewportLimits): WorkingRow[] {
  return [
    { step: ['from Transformed'], value: pair(world), call: null, from: true },
    { step: ['volume x ', { input: short(v.minX) }, '…', { input: short(v.maxX) }], value: `x → ${fmt(ndc.x)}`, call: 'glOrtho' },
    { step: ['volume y ', { input: short(v.minY) }, '…', { input: short(v.maxY) }], value: `y → ${fmt(ndc.y)}`, call: 'glOrtho' },
  ];
}

// --- Colour -----------------------------------------------------------------------------------

function rgbOf(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const rgbText = ([r, g, b]: [number, number, number]) => `rgb(${r.toFixed(1)}, ${g.toFixed(1)}, ${b.toFixed(1)})`;

function wrapped(c: number, wrap: TextureWrap): number {
  return wrap === 'REPEAT' ? c - Math.floor(c) : Math.min(1, Math.max(0, c));
}

/** The texel a UV reads, before filtering. */
export function texelOf(uv: UV, size: { width: number; height: number }, wrap: TextureWrap): Point {
  return {
    x: Math.min(size.width - 1, Math.floor(wrapped(uv.u, wrap) * size.width)),
    y: Math.min(size.height - 1, Math.floor(wrapped(uv.v, wrap) * size.height)),
  };
}

function colouredStage(node: SceneNode, index: number, scene: JourneyScene): JourneyStage {
  const uv = node.uvs?.[index];
  if (node.texture && uv && node.uvs!.length === node.vertices.length) {
    const tex = scene.textures.find((t) => t.id === node.texture!.textureId);
    const result = tex ? `texel (${texelOf(uv, tex, node.texture.wrap).x}, ${texelOf(uv, tex, node.texture.wrap).y})` : 'texture missing';
    return { ...stage('coloured', TEXTURED, [], result, null), section: 'Textures' };
  }
  const flat = node.shading === 'FLAT';
  const source = flat ? provokingVertex(node.type as PrimitiveType, index, node.vertices.length) : index;
  return stage('coloured', flat ? FLAT : SMOOTH, [], rgbText(rgbOf(node.vertices[source]?.color ?? '#ffffff')), null);
}

// --- The journey ------------------------------------------------------------------------------

function shapeJourney(node: SceneNode, scene: JourneyScene, vertexIndex: number, canvas: CanvasSize): VertexJourney {
  const count = node.vertices.length;
  if (count === 0) return { subject: { kind: 'shape', name: node.name, vertex: 0, count: 0 }, stages: blankStages() };
  const i = Math.min(Math.max(0, Math.floor(vertexIndex)), count - 1);
  const v = node.vertices[i];
  const stored = { x: v.x, y: v.y };
  const { rows: moves, end: world } = transformRows(stored, chainOf(node, scene.objects));
  const ndc = ndcOf(world, scene.viewportLimits);
  const pixel = pixelOf(ndc, canvas);
  const mode = node.renderingMode ?? 'IMMEDIATE';
  const storedSentence = mode === 'VBO' && (node.bufferUsage ?? 'STATIC') !== 'STATIC' ? VBO_REFRESHED : STORED_BY_MODE[mode];
  const assembly = assemblyFor(node.type as PrimitiveType, i, count);
  return {
    subject: { kind: 'shape', name: node.name, vertex: i, count },
    stages: [
      stage('stored', storedSentence, [], pair(stored), stored),
      stage('transformed', TRANSFORMED, [
        { step: ['from Stored'], value: pair(stored), call: mode === 'IMMEDIATE' ? 'glVertex2f' : 'glVertexPointer', from: true },
        ...moves,
      ], pair(world), world),
      stage('projected', PROJECTED, projectedRows(world, ndc, scene.viewportLimits), `NDC ${pair(ndc)}`, ndc),
      stage('assembled', assembly.sentence, [], assembly.result, null),
      stage('rasterised', RASTERISED, [], `pixel (${int(pixel.x)}, ${int(pixel.y)})`, pixel),
      colouredStage(node, i, scene),
    ],
  };
}

function textJourney(node: SceneNode, scene: JourneyScene, canvas: CanvasSize): VertexJourney {
  // generator/render.ts centres the lines around the origin; the first line starts highest.
  const raster = { x: 0, y: firstRasterY(node.textContent ?? '') };
  const { rows: moves, end: world } = transformRows(raster, chainOf(node, scene.objects));
  const ndc = ndcOf(world, scene.viewportLimits);
  const pixel = pixelOf(ndc, canvas);
  return {
    subject: { kind: 'text', name: node.name },
    stages: [
      stage('stored', TEXT_STORED, [], pair(raster), raster),
      stage('transformed', TRANSFORMED, [{ step: ['from Stored'], value: pair(raster), call: 'glRasterPos2f', from: true }, ...moves], pair(world), world),
      stage('projected', PROJECTED, projectedRows(world, ndc, scene.viewportLimits), `NDC ${pair(ndc)}`, ndc),
      stage('assembled', TEXT_ASSEMBLED, [], 'bitmap text', null),
      stage('rasterised', RASTERISED, [], `pixel (${int(pixel.x)}, ${int(pixel.y)})`, pixel),
      stage('coloured', 'The text takes the colour set by glColor3f just before it.', [], rgbText(rgbOf(node.vertices[0]?.color ?? '#ffffff')), null),
    ],
  };
}

function groupJourney(node: SceneNode, scene: JourneyScene): VertexJourney {
  const origin = { x: 0, y: 0 };
  const { rows: moves, end: world } = transformRows(origin, chainOf(node, scene.objects));
  const stages = blankStages().map((s) =>
    s.id === 'transformed'
      ? stage('transformed', GROUP_TRANSFORMED, [{ step: ['group origin'], value: pair(origin), call: null, from: true }, ...moves], pair(world), world)
      : s,
  );
  return { subject: { kind: 'group', name: node.name }, stages };
}

/**
 * Follows one vertex of the selected object from where it was typed to the pixel it lands on,
 * with the student's own numbers. Text follows its raster position; a group has no vertices, so
 * only its own transform is worked.
 */
export function vertexJourney(scene: JourneyScene, objectId: string | null, vertexIndex: number, canvas: CanvasSize): VertexJourney {
  const node = objectId ? scene.objects.find((o) => o.id === objectId) : undefined;
  if (!node) return { subject: { kind: 'none' }, stages: blankStages() };
  if (node.type === 'GROUP') return groupJourney(node, scene);
  if (node.type === 'TEXT') return textJourney(node, scene, canvas);
  return shapeJourney(node, scene, vertexIndex, canvas);
}
