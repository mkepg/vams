/**
 * The exported program's display(), done on a GLContext instead of printed: the same calls, in the
 * same order, with the same values, as the C++ that code-generator.ts writes. The editor's Run view
 * draws through it, so a running scene shows what the program draws on the lab PCs, pixel for pixel.
 *
 * Every number is the one the C++ holds: a literal as the generator prints it (colours to 2 places,
 * coordinates to 4) read back, and a state field as a 32-bit float.
 */
import type { CallbacksState, SceneNode, ViewportLimits, Vertex } from '@/core/types/scene';
import type { UV } from '@/core/types/textures';
import { deduplicate, hasTexture } from '@/entities/scene/model/vertex-dedup';
import { GL, type GLContext } from '@/shared/lib/gl-raster';
import { POINT_SIZE } from '@/shared/lib/gl-geometry';
import { GLUT_FONTS, glutBitmapCharacter } from '@/shared/lib/glut-fonts';
import { effectiveScaleY, rasterLineYs, textLineStep, textLines } from '@/shared/lib/text-raster';
import { planCallbacks, type CallbackPlan } from './generator/handlers';

/** One object's state struct, as the Run runtime keeps it (features/callbacks/model/runtime.ts). */
export interface GlObjectState {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  r: number;
  g: number;
  b: number;
  useColor: boolean;
  visible: boolean;
}

/** An image as stbi_load hands it over, top row first, 4 bytes a pixel. */
export interface GlImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface GlScene {
  /** Every object of the scene, as the store keeps them. */
  objects: SceneNode[];
  callbacks: CallbacksState;
  canvasBackgroundColor: string;
  /** The program window the code was generated for (glutInitWindowSize). */
  canvasSize: { width: number; height: number };
  viewportLimits?: ViewportLimits;
}

export interface GlFrame {
  /** Each object's state struct by object id; an object without one draws from its transform. */
  state: Readonly<Record<string, GlObjectState>>;
  /** The view the program's glOrtho takes when a reshape rule moves it (viewMinX and the rest). */
  view: ViewportLimits | null;
}

const DEFAULT_LIMITS: ViewportLimits = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const f32 = Math.fround;
/** A number as the generator prints it with toFixed(digits), read back as the compiler reads it. */
const printed = (v: number, digits: number) => f32(Number(v.toFixed(digits)));
const colourOf = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => printed(parseInt(hex.slice(i, i + 2), 16) / 255, 2)) as [number, number, number];
const bytesOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

const PRIMITIVES: Record<Exclude<SceneNode['type'], 'GROUP' | 'TEXT'>, number> = {
  POINTS: GL.POINTS,
  LINES: GL.LINES,
  LINE_STRIP: GL.LINE_STRIP,
  LINE_LOOP: GL.LINE_LOOP,
  TRIANGLES: GL.TRIANGLES,
  TRIANGLE_STRIP: GL.TRIANGLE_STRIP,
  TRIANGLE_FAN: GL.TRIANGLE_FAN,
  QUADS: GL.QUADS,
  QUAD_STRIP: GL.QUAD_STRIP,
  POLYGON: GL.POLYGON,
};

const isLine = (t: SceneNode['type']) => t === 'LINES' || t === 'LINE_STRIP' || t === 'LINE_LOOP';

/** The objects the program draws: those visible, with every parent visible too (generate-from-state.ts). */
export function drawnObjects(objects: SceneNode[]): SceneNode[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const hidden = (o: SceneNode): boolean => !o.visible || (!!o.parentId && !!byId.get(o.parentId) && hidden(byId.get(o.parentId)!));
  return objects.filter((o) => !hidden(o));
}

/** Uploads every texture the program sets up in init(), and returns each object's texture name. */
export function setUpTextures(gl: GLContext, objects: SceneNode[], images: ReadonlyMap<string, GlImage>): Map<string, number> {
  const names = new Map<string, number>();
  const drawn = drawnObjects(objects);
  if (!drawn.some((o) => o.type !== 'GROUP' && o.type !== 'TEXT' && hasTexture(o))) return names;
  gl.texEnvi(GL.TEXTURE_ENV, GL.TEXTURE_ENV_MODE, GL.REPLACE);
  for (const o of drawn) {
    if (o.type === 'GROUP' || o.type === 'TEXT' || !o.texture) continue;
    const [name] = gl.genTextures(1);
    names.set(o.id, name);
    gl.bindTexture(GL.TEXTURE_2D, name);
    const wrap = o.texture.wrap === 'CLAMP_TO_EDGE' ? GL.CLAMP_TO_EDGE : GL.REPEAT;
    const filter = o.texture.filter === 'NEAREST' ? GL.NEAREST : GL.LINEAR;
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, filter);
    const image = images.get(o.texture.textureId);
    if (!image) continue;
    // stbi_set_flip_vertically_on_load(true): the bottom row comes first.
    const rowBytes = image.width * 4;
    const flipped = new Uint8Array(image.rgba.length);
    for (let y = 0; y < image.height; y++) flipped.set(image.rgba.subarray(y * rowBytes, (y + 1) * rowBytes), (image.height - 1 - y) * rowBytes);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, image.width, image.height, 0, GL.RGBA, GL.UNSIGNED_BYTE, flipped);
  }
  return names;
}

/** The background the program clears to: main()'s glClearColor. */
export function clearColourOf(scene: GlScene): [number, number, number] {
  return colourOf(scene.canvasBackgroundColor);
}

/** display(): clears, sets the projection, and draws every object as draw() does. */
export function drawDisplay(gl: GLContext, scene: GlScene, frame: GlFrame, textures: ReadonlyMap<string, number>): void {
  const drawn = drawnObjects(scene.objects);
  const plan = planCallbacks(scene.callbacks, drawn);
  const limits = scene.viewportLimits ?? DEFAULT_LIMITS;
  const pixelsPerUnitY = scene.canvasSize.height / (limits.maxY - limits.minY);
  const [r, g, b] = clearColourOf(scene);
  gl.clearColor(r, g, b, 1);
  gl.clear(GL.COLOR_BUFFER_BIT);
  gl.matrixMode(GL.PROJECTION);
  gl.loadIdentity();
  const view = plan.needsView ? (frame.view ?? limits) : limits;
  if (plan.needsView) gl.ortho(f32(view.minX), f32(view.maxX), f32(view.minY), f32(view.maxY), -1, 1);
  // glOrtho takes doubles: its printed bounds stay doubles; viewMinX and the rest are floats.
  else gl.ortho(...([limits.minX, limits.maxX, limits.minY, limits.maxY].map((v) => Number(v.toFixed(4))) as [number, number, number, number]), -1, 1);
  gl.matrixMode(GL.MODELVIEW);
  gl.loadIdentity();
  const ctx: DrawContext = { gl, drawn, plan, frame, textures, pixelsPerUnitY };
  for (const o of [...drawn.filter((d) => !d.parentId)].reverse()) {
    if (plan.visibilityIds.has(o.id) && !stateOf(ctx, o).visible) continue;
    drawObject(ctx, o);
  }
}

interface DrawContext {
  gl: GLContext;
  drawn: SceneNode[];
  plan: CallbackPlan;
  frame: GlFrame;
  textures: ReadonlyMap<string, number>;
  pixelsPerUnitY: number;
}

/** An object's state struct as the program holds it: its initializer's printed values until a rule moves it. */
function stateOf(ctx: DrawContext, o: SceneNode): GlObjectState {
  const t = o.transform;
  const initial: GlObjectState = {
    x: printed(t.translateX, 4),
    y: printed(t.translateY, 4),
    rotation: printed(t.rotate, 4),
    scaleX: printed(t.scaleX, 4),
    scaleY: printed(t.scaleY, 4),
    r: 0,
    g: 0,
    b: 0,
    useColor: false,
    visible: true,
  };
  const s = ctx.frame.state[o.id];
  if (!s) return initial;
  const field = (k: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY', raw: number) => (s[k] === raw ? initial[k] : f32(s[k]));
  return {
    x: field('x', t.translateX),
    y: field('y', t.translateY),
    rotation: field('rotation', t.rotate),
    scaleX: field('scaleX', t.scaleX),
    scaleY: field('scaleY', t.scaleY),
    r: f32(s.r),
    g: f32(s.g),
    b: f32(s.b),
    useColor: s.useColor,
    visible: s.visible,
  };
}

function transformPrelude(ctx: DrawContext, s: GlObjectState): void {
  const { gl } = ctx;
  gl.pushMatrix();
  gl.translatef(s.x, s.y, 0);
  gl.rotatef(s.rotation, 0, 0, 1);
  gl.scalef(s.scaleX, s.scaleY, 1);
}

function drawObject(ctx: DrawContext, o: SceneNode): void {
  const s = stateOf(ctx, o);
  if (o.type === 'GROUP') return drawGroup(ctx, o, s);
  if (o.type === 'TEXT') return drawText(ctx, o, s);
  drawPrimitive(ctx, o, s);
}

function drawGroup(ctx: DrawContext, o: SceneNode, s: GlObjectState): void {
  transformPrelude(ctx, s);
  for (const child of [...ctx.drawn.filter((c) => c.parentId === o.id)].reverse()) {
    if (ctx.plan.visibilityIds.has(child.id) && !stateOf(ctx, child).visible) continue;
    drawObject(ctx, child);
  }
  ctx.gl.popMatrix();
}

function drawText(ctx: DrawContext, o: SceneNode, s: GlObjectState): void {
  const { gl } = ctx;
  transformPrelude(ctx, s);
  const recolor = ctx.plan.colorIds.has(o.id);
  const hex = o.vertices[0]?.color || '#ffffff';
  if (!(recolor && s.useColor)) {
    if (o.colorMode === 'BYTE') gl.color3ub(...bytesOf(hex));
    else gl.color3f(...colourOf(hex));
  }
  if (recolor && s.useColor) gl.color3f(s.r, s.g, s.b);
  const lines = textLines(o.textContent || '');
  const ys = rasterLineYs(lines.length, textLineStep(ctx.pixelsPerUnitY, effectiveScaleY(o, ctx.drawn)));
  lines.forEach((line, i) => {
    gl.rasterPos2f(0, printed(ys[i], 4));
    for (let k = 0; k < line.length; k++) glutBitmapCharacter(gl, GLUT_FONTS.GLUT_BITMAP_9_BY_15, line.charCodeAt(k));
  });
  gl.popMatrix();
}

function rasterStateBefore(gl: GLContext, o: SceneNode): void {
  if (isLine(o.type)) {
    gl.lineWidth(printed(o.lineWidth ?? 1, 2));
    if (o.lineStipple) {
      gl.enable(GL.LINE_STIPPLE);
      gl.lineStipple(Math.max(1, Math.min(256, Math.floor(o.lineStipple.factor))), o.lineStipple.pattern & 0xffff);
    }
  }
  if (o.type === 'POINTS') gl.pointSize(POINT_SIZE);
}

function rasterStateAfter(gl: GLContext, o: SceneNode): void {
  if (o.type === 'POINTS') gl.pointSize(1);
  if (isLine(o.type)) {
    if (o.lineStipple) gl.disable(GL.LINE_STIPPLE);
    gl.lineWidth(1);
  }
}

/**
 * A primitive in any rendering mode. Vertex arrays and buffer objects draw the same vertices in the
 * same order as glBegin/glEnd, with float colours from colors_<name>, so one path serves all three.
 */
function drawPrimitive(ctx: DrawContext, o: SceneNode, s: GlObjectState): void {
  const { gl } = ctx;
  const mode = o.renderingMode ?? 'IMMEDIATE';
  const recolor = ctx.plan.colorIds.has(o.id);
  transformPrelude(ctx, s);
  gl.shadeModel(o.shading === 'FLAT' ? GL.FLAT : GL.SMOOTH);
  rasterStateBefore(gl, o);
  const textured = hasTexture(o);
  if (textured) {
    gl.enable(GL.TEXTURE_2D);
    gl.bindTexture(GL.TEXTURE_2D, ctx.textures.get(o.id) ?? 0);
  }
  let verts: Vertex[] = o.vertices;
  let uvs: UV[] | null = textured ? o.uvs! : null;
  if (mode !== 'IMMEDIATE') {
    const dedup = deduplicate(o);
    if (dedup) {
      verts = dedup.indices.map((i) => dedup.uniqueVerts[i]);
      uvs = dedup.uniqueUvs ? dedup.indices.map((i) => dedup.uniqueUvs![i]) : uvs;
    }
  }
  const flat = recolor && s.useColor;
  if (flat) gl.color3f(s.r, s.g, s.b);
  gl.begin(PRIMITIVES[o.type as keyof typeof PRIMITIVES] ?? GL.POINTS);
  verts.forEach((v, i) => {
    if (!flat) {
      if (mode === 'IMMEDIATE' && o.colorMode === 'BYTE') gl.color3ub(...bytesOf(v.color));
      else gl.color3f(...colourOf(v.color));
    }
    if (uvs) gl.texCoord2f(printed(uvs[i].u, 4), printed(uvs[i].v, 4));
    gl.vertex2f(printed(v.x, 4), printed(v.y, 4));
  });
  gl.end();
  if (textured) gl.disable(GL.TEXTURE_2D);
  rasterStateAfter(gl, o);
  gl.popMatrix();
}
