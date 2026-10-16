import type { CurriculumSection } from '@/core/store/types';
import { JOURNEY_STAGES, JOURNEY_STAGE_TITLES, type JourneyStageId } from '@/core/inspector/journey-stage';
import type { PrimitiveType, ResizeMode, SceneNode, TransformState, ViewportLimits } from '@/core/types/scene';
import { keepProportionsView } from '@/core/callbacks/reshape-view';
import type { TextureAsset, TextureWrap, UV } from '@/core/types/textures';
import { assemblyFor, provokingVertex } from '@/entities/scene/model/primitive-assembly';
import { deduplicate } from '@/entities/scene/model/vertex-dedup';
import { fmt, int, short } from '@/shared/lib/format-number';
import { sanitizeName } from '@/shared/lib/sanitize-name';
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
  /** A heading row, not a step: it names the enclosing group whose rows follow, and has no step, value or call. */
  heading?: string;
  /** False when the call is named but no line of the student's code makes it, so it is plain text, not a link. */
  linked?: boolean;
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
  /** Projected: the volume glOrtho receives, and whether a Keep proportions reshape handler widened it. */
  volume?: { limits: ViewportLimits; widened: boolean };
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
  /** Whether the program has a reshape handler (the generator emits one). Unset reads as true. */
  reshape?: boolean;
  /** The reshape handler's choice: Keep proportions widens the viewing volume to the window's shape. Unset reads as stretch. */
  resize?: ResizeMode;
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
const WIDENED = ' The reshape callback first widened your viewing volume to match the window’s shape.';
const RASTERISED = 'NDC is stretched to the window’s pixels, counted from the bottom-left corner as OpenGL does.';
const SMOOTH = 'With smooth shading, each pixel inside the shape mixes the vertex colours by how close it is to each one.';
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

/** Flat shading: each primitive takes one of its own vertices' colour, so name the first primitive this vertex is in. */
function flatSentence(type: PrimitiveType, index: number, count: number): string {
  const a = assemblyFor(type, index, count);
  if (type === 'POINTS') return 'With flat shading, each point keeps its own colour.';
  if (a.primitives.length === 0) return 'With flat shading, each shape takes the colour of one of its vertices; this vertex is not drawn.';
  const taken = provokingVertex(type, index, count) + 1;
  if (type === 'POLYGON') return `With flat shading, the polygon takes vertex ${taken}’s colour.`;
  return `With flat shading, each ${a.noun} takes the colour of one of its vertices: ${a.noun} ${a.primitives[0] + 1} takes vertex ${taken}’s.`;
}

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
    if (depth > 0) rows.push({ heading: node.name, step: [], value: '', call: null });
    p = { x: p.x * t.scaleX, y: p.y * t.scaleY };
    rows.push({ step: ['scale ', { input: short(t.scaleX) }, ', ', { input: short(t.scaleY) }], value: pair(p), call: 'glScalef' });
    const r = (t.rotate * Math.PI) / 180;
    p = { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
    rows.push({ step: ['rotate ', { input: `${short(t.rotate)}°` }], value: pair(p), call: 'glRotatef' });
    p = { x: p.x + t.translateX, y: p.y + t.translateY };
    rows.push({ step: ['move ', { input: fmt(t.translateX) }, ', ', { input: fmt(t.translateY) }], value: pair(p), call: 'glTranslatef' });
  });
  return { rows, end: p };
}

function ndcOf(p: Point, v: ViewportLimits): Point {
  return { x: (2 * (p.x - v.minX)) / (v.maxX - v.minX) - 1, y: (2 * (p.y - v.minY)) / (v.maxY - v.minY) - 1 };
}

function pixelOf(n: Point, c: CanvasSize): Point {
  // A vertex exactly on the far edge (NDC +1) still lands in the last pixel: pixels run 0 to size − 1.
  // Anything beyond ±1 keeps its real pixel, which can be negative or past the window.
  const at = (v: number, size: number) => (v === 1 ? size - 1 : Math.floor(((v + 1) / 2) * size));
  return { x: at(n.x, c.width), y: at(n.y, c.height) };
}

const NO_RESHAPE = ' Without a reshape handler, GLUT calls glViewport for you with the window’s size.';
const OUTSIDE = ' This vertex lands outside the window, so the part of the shape out there is clipped.';

function rasterisedStage(ndc: Point, pixel: Point, canvas: CanvasSize, reshape: boolean): JourneyStage {
  const outside = pixel.x < 0 || pixel.y < 0 || pixel.x >= canvas.width || pixel.y >= canvas.height;
  return stage('rasterised', RASTERISED + (reshape ? '' : NO_RESHAPE) + (outside ? OUTSIDE : ''), [
    { step: ['from Projected'], value: pair(ndc), call: null, from: true },
    { step: [`width ${canvas.width}`], value: `x → ${int(pixel.x)}`, call: 'glViewport', linked: reshape },
    { step: [`height ${canvas.height}`], value: `y → ${int(pixel.y)}`, call: 'glViewport', linked: reshape },
  ], `pixel (${int(pixel.x)}, ${int(pixel.y)})`, pixel);
}

/** The volume glOrtho receives: a Keep proportions reshape handler widens one axis to the window's shape first. */
interface ProgramView {
  limits: ViewportLimits;
  widenedX: boolean;
  widenedY: boolean;
}

function programView(scene: JourneyScene, canvas: CanvasSize): ProgramView {
  const v = scene.viewportLimits;
  if (!(scene.reshape ?? true) || scene.resize !== 'keep') return { limits: v, widenedX: false, widenedY: false };
  const limits = keepProportionsView(v, canvas.width, canvas.height);
  // Only a real change counts: the program prints four decimals.
  const moved = (a: number, b: number) => Math.abs(a - b) > 5e-5;
  return { limits, widenedX: moved(limits.minX, v.minX) || moved(limits.maxX, v.maxX), widenedY: moved(limits.minY, v.minY) || moved(limits.maxY, v.maxY) };
}

/** The student's own bounds are amber; widened ones are the program's, so they are plain. */
const bounds = (min: number, max: number, widened: boolean): StepPart[] =>
  widened ? [`${short(min)}…${short(max)}`] : [{ input: short(min) }, '…', { input: short(max) }];

function projectedStage(world: Point, ndc: Point, view: ProgramView): JourneyStage {
  const v = view.limits;
  const rows: WorkingRow[] = [
    { step: ['from Transformed'], value: pair(world), call: null, from: true },
    { step: ['volume x ', ...bounds(v.minX, v.maxX, view.widenedX)], value: `x → ${fmt(ndc.x)}`, call: 'glOrtho' },
    { step: ['volume y ', ...bounds(v.minY, v.maxY, view.widenedY)], value: `y → ${fmt(ndc.y)}`, call: 'glOrtho' },
  ];
  const widened = view.widenedX || view.widenedY;
  return { ...stage('projected', PROJECTED + (widened ? WIDENED : ''), rows, `NDC ${pair(ndc)}`, ndc), volume: { limits: v, widened } };
}

// --- Colour -----------------------------------------------------------------------------------

function rgbOf(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** The colour as the call receives it: 0–255 integers for glColor3ub, otherwise one-decimal floats. */
const rgbArgs = (hex: string, bytes: boolean) =>
  `(${(bytes ? [1, 3, 5].map((i) => `${parseInt(hex.slice(i, i + 2), 16)}`) : rgbOf(hex).map((c) => c.toFixed(1))).join(', ')})`;

const rgbText = ([r, g, b]: [number, number, number]) => `rgb(${r.toFixed(1)}, ${g.toFixed(1)}, ${b.toFixed(1)})`;

function wrappedCoord(c: number, wrap: TextureWrap): number {
  return wrap === 'REPEAT' ? c - Math.floor(c) : Math.min(1, Math.max(0, c));
}

/** The texel a UV reads, before filtering. */
export function texelOf(uv: UV, size: { width: number; height: number }, wrap: TextureWrap): Point | null {
  if (size.width < 1 || size.height < 1) return null;
  return {
    x: Math.min(size.width - 1, Math.floor(wrappedCoord(uv.u, wrap) * size.width)),
    y: Math.min(size.height - 1, Math.floor(wrappedCoord(uv.v, wrap) * size.height)),
  };
}

function colouredStage(node: SceneNode, index: number, scene: JourneyScene, pixel: Point): JourneyStage {
  const at: WorkingRow = { step: ['at pixel'], value: `(${int(pixel.x)}, ${int(pixel.y)})`, call: null, from: true };
  const mode = node.renderingMode ?? 'IMMEDIATE';
  const uv = node.uvs?.[index];
  if (node.texture && uv && node.uvs!.length === node.vertices.length) {
    const tex = scene.textures.find((t) => t.id === node.texture!.textureId);
    const texel = tex ? texelOf(uv, tex, node.texture.wrap) : null;
    const result = texel ? `texel (${texel.x}, ${texel.y})` : 'texture missing';
    const wrap = node.texture.wrap;
    const sized = tex && texel ? tex : null;
    const wu = { u: wrappedCoord(uv.u, wrap), v: wrappedCoord(uv.v, wrap) };
    const rows: WorkingRow[] = [
      at,
      { step: ['UV'], value: `(${fmt(uv.u)}, ${fmt(uv.v)})`, call: mode === 'IMMEDIATE' ? 'glTexCoord2f' : 'glTexCoordPointer' },
      { step: ['wrap ', { input: wrap }], value: `(${fmt(wu.u)}, ${fmt(wu.v)})`, call: 'glTexParameteri' },
      ...(sized ? [{ step: [`texture ${sized.width}×${sized.height}`], value: result, call: 'glBindTexture' } as WorkingRow] : []),
      { step: ['filter ', { input: node.texture.filter }], value: node.texture.filter === 'NEAREST' ? 'that texel alone' : 'a blend of the 4 around it', call: 'glTexParameteri' },
    ];
    return { ...stage('coloured', TEXTURED, rows, result, null), section: 'Textures' };
  }
  const type = node.type as PrimitiveType;
  const count = node.vertices.length;
  const flat = node.shading === 'FLAT';
  const source = flat ? provokingVertex(type, index, count) : index;
  const members = assemblyFor(type, index, count).members[0] ?? [index];
  const drawn = assemblyFor(type, index, count).primitives.length > 0;
  const colourHex = node.vertices[index]?.color ?? '#ffffff';
  const colourCall = mode === 'IMMEDIATE' ? (node.colorMode === 'BYTE' ? 'glColor3ub' : 'glColor3f') : 'glColorPointer';
  // A polygon can have many corners: past 4, name only the followed one so the value stays in its column.
  const weights = members.length > 4 ? `1 here, 0 at the other ${members.length - 1}` : members.map((k) => (k === index ? '1' : '0')).join(', ');
  const shadingValue = !drawn ? 'not drawn' : flat ? `vertex ${source + 1}’s colour` : `weights ${weights}`;
  const rows: WorkingRow[] = [
    at,
    { step: ['vertex colour'], value: rgbArgs(colourHex, mode === 'IMMEDIATE' && node.colorMode === 'BYTE'), call: colourCall },
    { step: ['shading ', { input: flat ? 'flat' : 'smooth' }], value: shadingValue, call: 'glShadeModel' },
  ];
  if (!drawn) return stage('coloured', flat ? flatSentence(type, index, count) : SMOOTH, rows, 'not drawn', null);
  return stage('coloured', flat ? flatSentence(type, index, count) : SMOOTH, rows, rgbText(rgbOf(node.vertices[source]?.color ?? '#ffffff')), null);
}

// --- The journey ------------------------------------------------------------------------------

/** The vertex's place in the program's arrays: deduplicated when indexed, by the key generator/buffers.ts uses. */
function arrayIndex(node: SceneNode, i: number): { index: number; unique: number } {
  const dedup = deduplicate(node);
  return dedup ? { index: dedup.indices[i], unique: dedup.uniqueVerts.length } : { index: i, unique: node.vertices.length };
}

function storedRows(node: SceneNode, i: number, stored: Point): WorkingRow[] {
  const from: WorkingRow = { step: ['typed in Vertices'], value: pair(stored), call: null, from: true };
  const mode = node.renderingMode ?? 'IMMEDIATE';
  if (mode === 'IMMEDIATE') return [from, { step: ['sent by glVertex2f'], value: 'no buffer holds it', call: 'glVertex2f' }];
  const code = sanitizeName(node.name);
  const { index, unique } = arrayIndex(node, i);
  const rows: WorkingRow[] = [from];
  if (node.useIndexed) rows.push({ step: ['deduplicated'], value: `${unique} of ${node.vertices.length} kept`, call: 'glDrawElements' });
  if (mode === 'VBO') {
    const usage = node.bufferUsage ?? 'STATIC';
    const hint = { input: `GL_${usage}_DRAW` };
    if (usage === 'STATIC') {
      rows.push({ step: ['copied once, usage ', hint], value: `vbo_${code} on the GPU`, call: 'glBufferData' });
    } else {
      // update_buffers() sends the data again every frame (generator/buffers.ts).
      const refresh = usage === 'STREAM' ? 'glBufferData' : node.updateMethod === 'MAP_BUFFER' ? 'glMapBuffer' : 'glBufferSubData';
      rows.push({ step: ['refreshed every frame, usage ', hint], value: `vbo_${code} on the GPU`, call: refresh });
    }
    rows.push({ step: [`in vbo_${code}`], value: `index ${index}`, call: 'glBindBuffer' });
  } else {
    rows.push({ step: [`in verts_${code}`], value: `index ${index}`, call: null });
  }
  rows.push({ step: [`byte offset ${index} × 8`], value: `${index * 8} bytes`, call: null });
  rows.push({ step: ['stride 0'], value: 'packed, 8 bytes apart', call: 'glVertexPointer' });
  return rows;
}

function assembledRows(node: SceneNode, ndc: Point, assembly: ReturnType<typeof assemblyFor>): WorkingRow[] {
  const mode = node.renderingMode ?? 'IMMEDIATE';
  const call = mode === 'IMMEDIATE' ? 'glBegin' : node.useIndexed ? 'glDrawElements' : 'glDrawArrays';
  return [
    { step: ['from Projected'], value: pair(ndc), call: null, from: true },
    { step: ['primitive ', { input: `GL_${node.type}` }], value: assembly.note, call },
    { step: ['this vertex'], value: assembly.result, call: null },
  ];
}

function shapeJourney(node: SceneNode, scene: JourneyScene, vertexIndex: number, canvas: CanvasSize): VertexJourney {
  const count = node.vertices.length;
  if (count === 0) return { subject: { kind: 'shape', name: node.name, vertex: 0, count: 0 }, stages: blankStages() };
  const i = Math.min(Math.max(0, Math.floor(vertexIndex)), count - 1);
  const v = node.vertices[i];
  const stored = { x: v.x, y: v.y };
  const { rows: moves, end: world } = transformRows(stored, chainOf(node, scene.objects));
  const view = programView(scene, canvas);
  const ndc = ndcOf(world, view.limits);
  const pixel = pixelOf(ndc, canvas);
  const mode = node.renderingMode ?? 'IMMEDIATE';
  const storedSentence = mode === 'VBO' && (node.bufferUsage ?? 'STATIC') !== 'STATIC' ? VBO_REFRESHED : STORED_BY_MODE[mode];
  const assembly = assemblyFor(node.type as PrimitiveType, i, count);
  return {
    subject: { kind: 'shape', name: node.name, vertex: i, count },
    stages: [
      stage('stored', storedSentence, storedRows(node, i, stored), pair(stored), stored),
      stage('transformed', TRANSFORMED, [
        { step: ['from Stored'], value: pair(stored), call: mode === 'IMMEDIATE' ? 'glVertex2f' : 'glVertexPointer', from: true },
        ...moves,
      ], pair(world), world),
      projectedStage(world, ndc, view),
      stage('assembled', assembly.sentence, assembledRows(node, ndc, assembly), assembly.result, null),
      rasterisedStage(ndc, pixel, canvas, scene.reshape ?? true),
      colouredStage(node, i, scene, pixel),
    ],
  };
}

function textJourney(node: SceneNode, scene: JourneyScene, canvas: CanvasSize): VertexJourney {
  // generator/render.ts centres the lines around the origin; the first line starts highest.
  const raster = { x: 0, y: firstRasterY(node.textContent ?? '') };
  const { rows: moves, end: world } = transformRows(raster, chainOf(node, scene.objects));
  const view = programView(scene, canvas);
  const ndc = ndcOf(world, view.limits);
  const pixel = pixelOf(ndc, canvas);
  const textHex = node.vertices[0]?.color ?? '#ffffff';
  const textRgb = rgbOf(textHex);
  const colouredRows: WorkingRow[] = [
    { step: ['at pixel'], value: `(${int(pixel.x)}, ${int(pixel.y)})`, call: null, from: true },
    { step: ['text colour'], value: rgbArgs(textHex, node.colorMode === 'BYTE'), call: node.colorMode === 'BYTE' ? 'glColor3ub' : 'glColor3f' },
  ];
  return {
    subject: { kind: 'text', name: node.name },
    stages: [
      stage('stored', TEXT_STORED, [{ step: ['raster position'], value: pair(raster), call: 'glRasterPos2f', from: true }], pair(raster), raster),
      stage('transformed', TRANSFORMED, [{ step: ['from Stored'], value: pair(raster), call: 'glRasterPos2f', from: true }, ...moves], pair(world), world),
      projectedStage(world, ndc, view),
      stage('assembled', TEXT_ASSEMBLED, [], 'bitmap text', null),
      rasterisedStage(ndc, pixel, canvas, scene.reshape ?? true),
      stage('coloured', `The text takes the colour set by ${node.colorMode === 'BYTE' ? 'glColor3ub' : 'glColor3f'} just before it.`, colouredRows, rgbText(textRgb), null),
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
