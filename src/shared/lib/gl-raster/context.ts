import {
  createPointer,
  elementCount,
  GL_TYPE,
  elementReader,
  readIndices,
  readNormalised,
  readsMapped,
  readValue,
  typeSize,
  type ArrayPointer,
  type ArraySource,
  type BufferObject,
} from './arrays';
import { clearFramebuffer, createFramebuffer, type Framebuffer } from './framebuffer';
import { defaultRasterState, type BlendFactor, type EnvMode, type Filter, type RasterState, type RGBA, type TextureUnit, type Wrap } from './fragment';
import { drawPrimitive, GL_MODE, insideVolume, toWindow, type ClipVertex, type Target, type Viewport } from './assembly';
import { drawBitmap, initialRasterPos } from './bitmap';
import { GL_LIST, DisplayLists } from './lists';
import { MAX_LINE_WIDTH } from './lines';
import * as M from './matrix';
import { MAX_POINT_SIZE } from './points';
import {
  createTexture,
  MAX_TEXTURE_LEVEL,
  formatComponents,
  internalBase,
  isComplete,
  MAX_TEXTURE_SIZE,
  textureFor,
  unpackImage,
  type MinFilter,
  type TextureObject,
} from './textures';

/** The GL enums the context reads, with the values of GL/gl.h. */
export const GL = {
  NO_ERROR: 0,
  INVALID_ENUM: 0x0500,
  INVALID_VALUE: 0x0501,
  INVALID_OPERATION: 0x0502,
  STACK_OVERFLOW: 0x0503,
  STACK_UNDERFLOW: 0x0504,
  OUT_OF_MEMORY: 0x0505,
  ...GL_MODE,
  ...GL_TYPE,
  ...GL_LIST,
  COLOR_BUFFER_BIT: 0x4000,
  DEPTH_BUFFER_BIT: 0x0100,
  STENCIL_BUFFER_BIT: 0x0400,
  ACCUM_BUFFER_BIT: 0x0200,
  MODELVIEW: 0x1700,
  PROJECTION: 0x1701,
  BLEND: 0x0be2,
  LINE_STIPPLE: 0x0b24,
  TEXTURE_2D: 0x0de1,
  SCISSOR_TEST: 0x0c11,
  FLAT: 0x1d00,
  SMOOTH: 0x1d01,
  FRONT: 0x0404,
  BACK: 0x0405,
  FRONT_AND_BACK: 0x0408,
  POINT: 0x1b00,
  LINE: 0x1b01,
  FILL: 0x1b02,
  VERTEX_ARRAY: 0x8074,
  COLOR_ARRAY: 0x8076,
  TEXTURE_COORD_ARRAY: 0x8078,
  TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  TEXTURE_BORDER_COLOR: 0x1004,
  NEAREST: 0x2600,
  LINEAR: 0x2601,
  NEAREST_MIPMAP_NEAREST: 0x2700,
  LINEAR_MIPMAP_NEAREST: 0x2701,
  NEAREST_MIPMAP_LINEAR: 0x2702,
  LINEAR_MIPMAP_LINEAR: 0x2703,
  REPEAT: 0x2901,
  CLAMP: 0x2900,
  CLAMP_TO_EDGE: 0x812f,
  TEXTURE_ENV: 0x2300,
  TEXTURE_ENV_MODE: 0x2200,
  MODULATE: 0x2100,
  REPLACE: 0x1e01,
  DECAL: 0x2101,
  ADD: 0x0104,
  ALPHA: 0x1906,
  RGB: 0x1907,
  RGBA: 0x1908,
  LUMINANCE: 0x1909,
  LUMINANCE_ALPHA: 0x190a,
  BGR: 0x80e0,
  BGRA: 0x80e1,
  UNPACK_ALIGNMENT: 0x0cf5,
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  READ_ONLY: 0x88b8,
  WRITE_ONLY: 0x88b9,
  READ_WRITE: 0x88ba,
  VENDOR: 0x1f00,
  RENDERER: 0x1f01,
  VERSION: 0x1f02,
  EXTENSIONS: 0x1f03,
  ZERO: 0,
  ONE: 1,
  SRC_COLOR: 0x0300,
  ONE_MINUS_SRC_COLOR: 0x0301,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  DST_ALPHA: 0x0304,
  ONE_MINUS_DST_ALPHA: 0x0305,
  DST_COLOR: 0x0306,
  ONE_MINUS_DST_COLOR: 0x0307,
  SRC_ALPHA_SATURATE: 0x0308,
} as const;

// GL_MAX_MODELVIEW_STACK_DEPTH and GL_MAX_PROJECTION_STACK_DEPTH.
export const MAX_STACK_DEPTH = 32;
// GL_MAX_VIEWPORT_DIMS: glViewport clamps its width and height to this.
export const MAX_VIEWPORT_SIZE = 16384;
// The most elements one glDrawArrays or glDrawElements takes; a larger count draws nothing and is
// GL_OUT_OF_MEMORY, where a lab PC would read past the program's arrays and stop.
export const MAX_DRAW_ELEMENTS = 1 << 20;
// The most names one glGenTextures or glGenBuffers hands out.
const MAX_GEN_NAMES = 1 << 16;

/** GL 1.1's blend factors (Tables 4.1, 4.2); SRC_ALPHA_SATURATE is a source factor only. */
const BLEND_FACTORS: Record<number, BlendFactor> = {
  [GL.ZERO]: 'ZERO',
  [GL.ONE]: 'ONE',
  [GL.SRC_COLOR]: 'SRC_COLOR',
  [GL.ONE_MINUS_SRC_COLOR]: 'ONE_MINUS_SRC_COLOR',
  [GL.DST_COLOR]: 'DST_COLOR',
  [GL.ONE_MINUS_DST_COLOR]: 'ONE_MINUS_DST_COLOR',
  [GL.SRC_ALPHA]: 'SRC_ALPHA',
  [GL.ONE_MINUS_SRC_ALPHA]: 'ONE_MINUS_SRC_ALPHA',
  [GL.DST_ALPHA]: 'DST_ALPHA',
  [GL.ONE_MINUS_DST_ALPHA]: 'ONE_MINUS_DST_ALPHA',
  [GL.SRC_ALPHA_SATURATE]: 'SRC_ALPHA_SATURATE',
};

const MIN_FILTERS: Record<number, MinFilter> = {
  [GL.NEAREST]: 'NEAREST',
  [GL.LINEAR]: 'LINEAR',
  [GL.NEAREST_MIPMAP_NEAREST]: 'NEAREST_MIPMAP_NEAREST',
  [GL.LINEAR_MIPMAP_NEAREST]: 'LINEAR_MIPMAP_NEAREST',
  [GL.NEAREST_MIPMAP_LINEAR]: 'NEAREST_MIPMAP_LINEAR',
  [GL.LINEAR_MIPMAP_LINEAR]: 'LINEAR_MIPMAP_LINEAR',
};
const MAG_FILTERS: Record<number, Filter> = { [GL.NEAREST]: 'NEAREST', [GL.LINEAR]: 'LINEAR' };
const WRAPS: Record<number, Wrap> = { [GL.REPEAT]: 'REPEAT', [GL.CLAMP]: 'CLAMP', [GL.CLAMP_TO_EDGE]: 'CLAMP_TO_EDGE' };
const ENV_MODES: Record<number, EnvMode> = {
  [GL.MODULATE]: 'MODULATE',
  [GL.REPLACE]: 'REPLACE',
  [GL.DECAL]: 'DECAL',
  [GL.BLEND]: 'BLEND',
  [GL.ADD]: 'ADD',
};
const POLYGON_MODES = { [GL.POINT]: 'POINT', [GL.LINE]: 'LINE', [GL.FILL]: 'FILL' } as const;
const BUFFER_USAGES = new Set([0x88e0, 0x88e1, 0x88e2, 0x88e4, 0x88e5, 0x88e6, 0x88e8, 0x88e9, 0x88ea]);
const INDEX_TYPES = new Set<number>([GL.UNSIGNED_BYTE, GL.UNSIGNED_SHORT, GL.UNSIGNED_INT]);
const POSITION_TYPES = new Set<number>([GL.SHORT, GL.INT, GL.FLOAT, GL.DOUBLE]);

const GLU_ERRORS: Record<number, string> = {
  [GL.NO_ERROR]: 'no error',
  [GL.INVALID_ENUM]: 'invalid enumerant',
  [GL.INVALID_VALUE]: 'invalid value',
  [GL.INVALID_OPERATION]: 'invalid operation',
  [GL.STACK_OVERFLOW]: 'stack overflow',
  [GL.STACK_UNDERFLOW]: 'stack underflow',
  [GL.OUT_OF_MEMORY]: 'out of memory',
};

const GL_STRINGS: Record<number, string> = {
  [GL.VENDOR]: 'VAMS',
  [GL.RENDERER]: 'VAMS Lab',
  [GL.VERSION]: '1.5',
  [GL.EXTENSIONS]: '',
};

const clamp01 = (c: number) => Math.min(1, Math.max(0, c));

const emptyBuffer = (): BufferObject => ({ data: new Uint8Array(0), usage: 0x88e4, mapped: false });

/** One array element as glArrayElement reads it: the values of each enabled array. */
interface ArrayElement {
  color?: RGBA;
  tex?: [number, number];
  vertex?: [number, number, number, number];
}

/** A pointer argument: an offset into the bound buffer object, an address in program memory, or the bytes themselves. */
export type Pointer = number | Uint8Array;

export interface GLContextOptions {
  /** GLUT_MULTISAMPLE: four samples a pixel. */
  multisample?: boolean;
  /** Memory the framebuffer's colour bytes live in, for a worker to share with the page. */
  buffer?: SharedArrayBuffer;
  /** The program's memory, which a numeric pointer addresses when no buffer object is bound. */
  memory?: () => Uint8Array;
}

/**
 * OpenGL 1.5 for a 2D program, drawn in software. Each method is one GL or GLU call, named
 * without its prefix; `error` is what glGetError would return. Commands are compiled into an open
 * display list as GL compiles them (5.4), and a command between glBegin and glEnd that GL doesn't
 * allow there sets GL_INVALID_OPERATION and does nothing (2.6.3).
 */
export class GLContext {
  fb: Framebuffer;
  /** The error flag (2.5): the first error since glGetError last read it, or GL_NO_ERROR. */
  error: number = GL.NO_ERROR;

  private readonly memory: (() => Uint8Array) | undefined;
  private readonly raster: RasterState;
  private vp: Viewport;
  private clearValue: RGBA = [0, 0, 0, 0];
  private matrixModeValue: number = GL.MODELVIEW;
  private readonly modelview = new M.MatrixStack(MAX_STACK_DEPTH);
  private readonly projection = new M.MatrixStack(MAX_STACK_DEPTH);
  private color: RGBA = [1, 1, 1, 1];
  private texCoord: [number, number] = [0, 0];
  private prim: { mode: number; vertices: ClipVertex[] } | null = null;
  private readonly pos = initialRasterPos();
  private readonly lists = new DisplayLists();
  private texture2D = false;
  private readonly textures = new Map<number, TextureObject>([[0, createTexture()]]);
  private boundTexture = 0;
  private unpackAlignment = 4;
  private readonly buffers = new Map<number, BufferObject>();
  private arrayBuffer = 0;
  private elementBuffer = 0;
  private readonly arrays = { vertex: createPointer(4), color: createPointer(4), tex: createPointer(4) };

  constructor(width: number, height: number, options: GLContextOptions = {}) {
    this.fb = createFramebuffer(width, height, options.buffer);
    this.memory = options.memory;
    this.raster = defaultRasterState();
    this.raster.multisample = !!options.multisample;
    this.raster.scissor = { enabled: false, x: 0, y: 0, width, height };
    this.vp = { x: 0, y: 0, width, height };
  }

  /** A new window size: a fresh framebuffer, cleared to 0. The viewport stays as the program set it. */
  resize(width: number, height: number, buffer?: SharedArrayBuffer): void {
    this.fb = createFramebuffer(width, height, buffer);
  }

  // Errors and command dispatch.

  private fail(code: number): void {
    if (this.error === GL.NO_ERROR) this.error = code;
  }

  /**
   * A command GL compiles into display lists: recorded while one is open, run unless it is
   * COMPILE. When it runs between glBegin and glEnd without `inBegin`, it is GL_INVALID_OPERATION.
   */
  private compiled(run: () => void, inBegin = false): void {
    const exec = () => {
      if (this.prim && !inBegin) return this.fail(GL.INVALID_OPERATION);
      run();
    };
    if (this.lists.record(exec)) exec();
  }

  /** A command GL runs at once even while a list is open; between glBegin and glEnd it is GL_INVALID_OPERATION. */
  private immediate<T>(run: () => T, otherwise: T): T {
    if (this.prim) {
      this.fail(GL.INVALID_OPERATION);
      return otherwise;
    }
    return run();
  }

  getError(): number {
    return this.immediate(() => {
      const e = this.error;
      this.error = GL.NO_ERROR;
      return e;
    }, GL.NO_ERROR);
  }

  getString(name: number): string | null {
    return this.immediate(() => {
      if (!(name in GL_STRINGS)) {
        this.fail(GL.INVALID_ENUM);
        return null;
      }
      return GL_STRINGS[name];
    }, null);
  }

  /** gluErrorString. */
  errorString(code: number): string | null {
    return GLU_ERRORS[code] ?? null;
  }

  // Vertices and their attributes (2.6, 2.7).

  private target(): Target {
    return { fb: this.fb, state: this.raster, viewport: this.vp, texture: this.textureView() };
  }

  /** The bound texture for a level of detail, when GL_TEXTURE_2D is on and the texture is complete. */
  private textureView(): ((lambda: number) => TextureUnit) | null {
    if (!this.texture2D) return null;
    const t = this.textures.get(this.boundTexture);
    if (!t || !isComplete(t)) return null;
    return (lambda) => textureFor(t, lambda);
  }

  /** Object coordinates to clip coordinates: the model-view matrix, then the projection (2.11). */
  private toClip(x: number, y: number, z: number, w: number): [number, number, number, number] {
    const [ex, ey, ez, ew] = M.transform(this.modelview.top, x, y, z, w);
    return M.transform(this.projection.top, ex, ey, ez, ew);
  }

  private processed(x: number, y: number, z: number, w: number): ClipVertex {
    const [cx, cy, cz, cw] = this.toClip(x, y, z, w);
    const c = this.color;
    // Colours are clamped to 0..1 before rasterisation (2.14.6).
    return { x: cx, y: cy, z: cz, w: cw, color: [clamp01(c[0]), clamp01(c[1]), clamp01(c[2]), clamp01(c[3])], tex: [...this.texCoord] };
  }

  /** A vertex between glBegin and glEnd; outside them it does nothing. */
  private vertex(x: number, y: number, z: number, w: number): void {
    this.prim?.vertices.push(this.processed(x, y, z, w));
  }

  begin(mode: number): void {
    this.compiled(() => {
      if (mode < GL.POINTS || mode > GL.POLYGON || !Number.isInteger(mode)) return this.fail(GL.INVALID_ENUM);
      this.prim = { mode, vertices: [] };
    });
  }

  end(): void {
    this.compiled(() => {
      const prim = this.prim;
      if (!prim) return this.fail(GL.INVALID_OPERATION);
      this.prim = null;
      drawPrimitive(this.target(), prim.mode, prim.vertices);
    }, true);
  }

  vertex2d(x: number, y: number): void {
    this.compiled(() => this.vertex(x, y, 0, 1), true);
  }
  vertex2f(x: number, y: number): void {
    this.compiled(() => this.vertex(x, y, 0, 1), true);
  }
  vertex2i(x: number, y: number): void {
    this.compiled(() => this.vertex(x, y, 0, 1), true);
  }
  vertex2fv(v: ArrayLike<number>): void {
    this.vertex2f(v[0], v[1]);
  }
  vertex3d(x: number, y: number, z: number): void {
    this.compiled(() => this.vertex(x, y, z, 1), true);
  }
  vertex3f(x: number, y: number, z: number): void {
    this.compiled(() => this.vertex(x, y, z, 1), true);
  }
  vertex3i(x: number, y: number, z: number): void {
    this.compiled(() => this.vertex(x, y, z, 1), true);
  }
  vertex3fv(v: ArrayLike<number>): void {
    this.vertex3f(v[0], v[1], v[2]);
  }

  private setColor(r: number, g: number, b: number, a: number): void {
    this.compiled(() => {
      this.color = [r, g, b, a];
    }, true);
  }
  color3d(r: number, g: number, b: number): void {
    this.setColor(r, g, b, 1);
  }
  color3f(r: number, g: number, b: number): void {
    this.setColor(r, g, b, 1);
  }
  color3ub(r: number, g: number, b: number): void {
    this.setColor(r / 255, g / 255, b / 255, 1);
  }
  color3fv(v: ArrayLike<number>): void {
    this.setColor(v[0], v[1], v[2], 1);
  }
  color3ubv(v: ArrayLike<number>): void {
    this.color3ub(v[0], v[1], v[2]);
  }
  color4d(r: number, g: number, b: number, a: number): void {
    this.setColor(r, g, b, a);
  }
  color4f(r: number, g: number, b: number, a: number): void {
    this.setColor(r, g, b, a);
  }
  color4ub(r: number, g: number, b: number, a: number): void {
    this.setColor(r / 255, g / 255, b / 255, a / 255);
  }
  color4fv(v: ArrayLike<number>): void {
    this.setColor(v[0], v[1], v[2], v[3]);
  }
  color4ubv(v: ArrayLike<number>): void {
    this.color4ub(v[0], v[1], v[2], v[3]);
  }

  private setTexCoord(s: number, t: number): void {
    this.compiled(() => {
      this.texCoord = [s, t];
    }, true);
  }
  texCoord2d(s: number, t: number): void {
    this.setTexCoord(s, t);
  }
  texCoord2f(s: number, t: number): void {
    this.setTexCoord(s, t);
  }
  texCoord2i(s: number, t: number): void {
    this.setTexCoord(s, t);
  }
  texCoord2fv(v: ArrayLike<number>): void {
    this.setTexCoord(v[0], v[1]);
  }

  /** glRect: a GL_POLYGON (x1, y1), (x2, y1), (x2, y2), (x1, y2) (2.10). */
  private rect(x1: number, y1: number, x2: number, y2: number): void {
    this.compiled(() => {
      const vs = [this.processed(x1, y1, 0, 1), this.processed(x2, y1, 0, 1), this.processed(x2, y2, 0, 1), this.processed(x1, y2, 0, 1)];
      drawPrimitive(this.target(), GL.POLYGON, vs);
    });
  }
  rectd(x1: number, y1: number, x2: number, y2: number): void {
    this.rect(x1, y1, x2, y2);
  }
  rectf(x1: number, y1: number, x2: number, y2: number): void {
    this.rect(x1, y1, x2, y2);
  }
  recti(x1: number, y1: number, x2: number, y2: number): void {
    this.rect(x1, y1, x2, y2);
  }

  // The raster position and bitmaps (2.13, 3.7).

  private setRasterPos(x: number, y: number, z: number): void {
    this.compiled(() => {
      const v = this.processed(x, y, z, 1);
      this.pos.valid = insideVolume(v);
      if (!this.pos.valid) return;
      const win = toWindow(v, this.vp);
      // The reference driver keeps the position on a 1/256-pixel grid, so a rounding error under that
      // doesn't move a bitmap by a pixel.
      this.pos.x = Math.round(win.x * 256) / 256;
      this.pos.y = Math.round(win.y * 256) / 256;
      this.pos.z = win.z;
      this.pos.color = v.color;
      this.pos.tex = v.tex;
    });
  }
  rasterPos2d(x: number, y: number): void {
    this.setRasterPos(x, y, 0);
  }
  rasterPos2f(x: number, y: number): void {
    this.setRasterPos(x, y, 0);
  }
  rasterPos2i(x: number, y: number): void {
    this.setRasterPos(x, y, 0);
  }
  rasterPos3f(x: number, y: number, z: number): void {
    this.setRasterPos(x, y, z);
  }

  /**
   * glBitmap, unpacked as GLUT unpacks its fonts: `height` rows of ⌈width / 8⌉ bytes, bottom row
   * first, most significant bit leftmost. The bits are copied when the call is compiled.
   */
  bitmap(width: number, height: number, xorig: number, yorig: number, xmove: number, ymove: number, bits: Uint8Array | null): void {
    const copy = bits ? bits.slice() : null;
    this.compiled(() => {
      if (width < 0 || height < 0) return this.fail(GL.INVALID_VALUE);
      const view = this.textureView();
      const state = view ? { ...this.raster, texture: view(-Infinity) } : this.raster;
      drawBitmap(this.fb, state, this.pos, width, height, xorig, yorig, xmove, ymove, copy);
    });
  }

  // State.

  private capability(cap: number, on: boolean): void {
    switch (cap) {
      case GL.BLEND:
        this.raster.blend.enabled = on;
        return;
      case GL.LINE_STIPPLE:
        this.raster.stipple.enabled = on;
        return;
      case GL.TEXTURE_2D:
        this.texture2D = on;
        return;
      case GL.SCISSOR_TEST:
        this.raster.scissor!.enabled = on;
        return;
    }
    this.fail(GL.INVALID_ENUM);
  }
  enable(cap: number): void {
    this.compiled(() => this.capability(cap, true));
  }
  disable(cap: number): void {
    this.compiled(() => this.capability(cap, false));
  }

  isEnabled(cap: number): boolean {
    return this.immediate(() => {
      switch (cap) {
        case GL.BLEND:
          return this.raster.blend.enabled;
        case GL.LINE_STIPPLE:
          return this.raster.stipple.enabled;
        case GL.TEXTURE_2D:
          return this.texture2D;
        case GL.SCISSOR_TEST:
          return this.raster.scissor!.enabled;
      }
      const array = this.clientArray(cap);
      if (array) return array.enabled;
      this.fail(GL.INVALID_ENUM);
      return false;
    }, false);
  }

  shadeModel(mode: number): void {
    this.compiled(() => {
      if (mode === GL.FLAT) this.raster.shadeModel = 'FLAT';
      else if (mode === GL.SMOOTH) this.raster.shadeModel = 'SMOOTH';
      else this.fail(GL.INVALID_ENUM);
    });
  }

  /** glPointSize; the size is held at the widest point the rasteriser draws in either mode. */
  pointSize(size: number): void {
    this.compiled(() => {
      if (!(size > 0)) return this.fail(GL.INVALID_VALUE);
      this.raster.pointSize = Math.min(MAX_POINT_SIZE, size);
    });
  }

  /** glLineWidth; the width is held at the widest line the rasteriser draws in either mode. */
  lineWidth(width: number): void {
    this.compiled(() => {
      if (!(width > 0)) return this.fail(GL.INVALID_VALUE);
      this.raster.lineWidth = Math.min(MAX_LINE_WIDTH, width);
    });
  }

  lineStipple(factor: number, pattern: number): void {
    this.compiled(() => {
      this.raster.stipple.factor = Math.min(256, Math.max(1, Math.trunc(factor)));
      this.raster.stipple.pattern = pattern & 0xffff;
    });
  }

  polygonMode(face: number, mode: number): void {
    this.compiled(() => {
      const m = POLYGON_MODES[mode as keyof typeof POLYGON_MODES];
      if (!m || (face !== GL.FRONT && face !== GL.BACK && face !== GL.FRONT_AND_BACK)) return this.fail(GL.INVALID_ENUM);
      if (face !== GL.BACK) this.raster.polygonMode.front = m;
      if (face !== GL.FRONT) this.raster.polygonMode.back = m;
    });
  }

  blendFunc(sfactor: number, dfactor: number): void {
    this.compiled(() => {
      const src = BLEND_FACTORS[sfactor];
      const dst = BLEND_FACTORS[dfactor];
      if (!src || !dst || dst === 'SRC_ALPHA_SATURATE') return this.fail(GL.INVALID_ENUM);
      this.raster.blend.src = src;
      this.raster.blend.dst = dst;
    });
  }

  pixelStorei(pname: number, param: number): void {
    this.immediate(() => {
      if (pname !== GL.UNPACK_ALIGNMENT) return this.fail(GL.INVALID_ENUM);
      if (![1, 2, 4, 8].includes(param)) return this.fail(GL.INVALID_VALUE);
      this.unpackAlignment = param;
    }, undefined);
  }

  // The frame.

  clear(mask: number): void {
    this.compiled(() => {
      const all = GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT | GL.ACCUM_BUFFER_BIT;
      if (mask & ~all) return this.fail(GL.INVALID_VALUE);
      // Only the colour buffer exists; the scissor test limits the clear when it is on (4.2.3).
      if (mask & GL.COLOR_BUFFER_BIT) clearFramebuffer(this.fb, this.clearValue, this.raster.scissor);
    });
  }

  clearColor(r: number, g: number, b: number, a: number): void {
    this.compiled(() => {
      this.clearValue = [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
    });
  }

  viewport(x: number, y: number, width: number, height: number): void {
    this.compiled(() => {
      if (width < 0 || height < 0) return this.fail(GL.INVALID_VALUE);
      this.vp = { x, y, width: Math.min(MAX_VIEWPORT_SIZE, width), height: Math.min(MAX_VIEWPORT_SIZE, height) };
    });
  }

  /** glScissor: the box glClear and every fragment keep to while GL_SCISSOR_TEST is on (4.1.2). */
  scissor(x: number, y: number, width: number, height: number): void {
    this.compiled(() => {
      if (width < 0 || height < 0) return this.fail(GL.INVALID_VALUE);
      this.raster.scissor = { enabled: this.raster.scissor!.enabled, x, y, width, height };
    });
  }

  flush(): void {
    this.immediate(() => undefined, undefined);
  }

  finish(): void {
    this.immediate(() => undefined, undefined);
  }

  // Matrices (2.11.2).

  private get stack(): M.MatrixStack {
    return this.matrixModeValue === GL.PROJECTION ? this.projection : this.modelview;
  }

  /** Multiplies the current matrix by `m` on the right, as every transform command does. */
  private apply(m: () => M.Mat4): void {
    this.compiled(() => {
      this.stack.top = M.multiply(this.stack.top, m());
    });
  }

  matrixMode(mode: number): void {
    this.compiled(() => {
      if (mode !== GL.MODELVIEW && mode !== GL.PROJECTION) return this.fail(GL.INVALID_ENUM);
      this.matrixModeValue = mode;
    });
  }

  loadIdentity(): void {
    this.compiled(() => {
      this.stack.top = M.identity();
    });
  }

  ortho(left: number, right: number, bottom: number, top: number, zNear: number, zFar: number): void {
    this.compiled(() => {
      if (left === right || bottom === top || zNear === zFar) return this.fail(GL.INVALID_VALUE);
      this.stack.top = M.multiply(this.stack.top, M.orthographic(left, right, bottom, top, zNear, zFar));
    });
  }

  /** gluOrtho2D: glOrtho with near −1 and far 1. */
  ortho2D(left: number, right: number, bottom: number, top: number): void {
    this.ortho(left, right, bottom, top, -1, 1);
  }

  pushMatrix(): void {
    this.compiled(() => {
      if (!this.stack.push()) this.fail(GL.STACK_OVERFLOW);
    });
  }

  popMatrix(): void {
    this.compiled(() => {
      if (!this.stack.pop()) this.fail(GL.STACK_UNDERFLOW);
    });
  }

  translated(x: number, y: number, z: number): void {
    this.apply(() => M.translation(x, y, z));
  }
  translatef(x: number, y: number, z: number): void {
    this.apply(() => M.translation(x, y, z));
  }
  rotated(angle: number, x: number, y: number, z: number): void {
    this.apply(() => M.rotation(angle, x, y, z));
  }
  rotatef(angle: number, x: number, y: number, z: number): void {
    this.apply(() => M.rotation(angle, x, y, z));
  }
  scaled(x: number, y: number, z: number): void {
    this.apply(() => M.scaling(x, y, z));
  }
  scalef(x: number, y: number, z: number): void {
    this.apply(() => M.scaling(x, y, z));
  }

  private load(values: ArrayLike<number>): void {
    const m = M.fromArray(values);
    this.compiled(() => {
      this.stack.top = new Float64Array(m);
    });
  }
  loadMatrixd(m: ArrayLike<number>): void {
    this.load(m);
  }
  loadMatrixf(m: ArrayLike<number>): void {
    this.load(m);
  }
  multMatrixd(m: ArrayLike<number>): void {
    const copy = M.fromArray(m);
    this.apply(() => copy);
  }
  multMatrixf(m: ArrayLike<number>): void {
    this.multMatrixd(m);
  }

  /** The current model-view or projection matrix, column-major. */
  currentMatrix(mode: number): Float64Array {
    return new Float64Array(mode === GL.PROJECTION ? this.projection.top : this.modelview.top);
  }

  // Client-side arrays (2.8).

  private clientArray(array: number): ArrayPointer | null {
    if (array === GL.VERTEX_ARRAY) return this.arrays.vertex;
    if (array === GL.COLOR_ARRAY) return this.arrays.color;
    if (array === GL.TEXTURE_COORD_ARRAY) return this.arrays.tex;
    return null;
  }

  enableClientState(array: number): void {
    this.immediate(() => {
      const p = this.clientArray(array);
      if (!p) return this.fail(GL.INVALID_ENUM);
      p.enabled = true;
    }, undefined);
  }

  disableClientState(array: number): void {
    this.immediate(() => {
      const p = this.clientArray(array);
      if (!p) return this.fail(GL.INVALID_ENUM);
      p.enabled = false;
    }, undefined);
  }

  /** Where a pointer argument reads: client bytes, or the buffer object bound to `binding`, or program memory. */
  private source(pointer: Pointer, binding: number): ArraySource {
    if (pointer instanceof Uint8Array) return { buffer: null, view: pointer, offset: 0 };
    return { buffer: this.buffers.get(binding) ?? null, view: null, offset: pointer };
  }

  private setPointer(p: ArrayPointer, size: number, type: number, stride: number, pointer: Pointer, sizes: number[], types: Set<number>): void {
    this.immediate(() => {
      if (!sizes.includes(size) || stride < 0) return this.fail(GL.INVALID_VALUE);
      if (!types.has(type)) return this.fail(GL.INVALID_ENUM);
      Object.assign(p, { size, type, stride }, this.source(pointer, this.arrayBuffer));
    }, undefined);
  }

  vertexPointer(size: number, type: number, stride: number, pointer: Pointer): void {
    this.setPointer(this.arrays.vertex, size, type, stride, pointer, [2, 3, 4], POSITION_TYPES);
  }

  colorPointer(size: number, type: number, stride: number, pointer: Pointer): void {
    this.setPointer(this.arrays.color, size, type, stride, pointer, [3, 4], new Set(Object.values(GL_TYPE)));
  }

  texCoordPointer(size: number, type: number, stride: number, pointer: Pointer): void {
    this.setPointer(this.arrays.tex, size, type, stride, pointer, [1, 2, 3, 4], POSITION_TYPES);
  }

  /** glArrayElement's values for each index, read now, as a display list compiles them. */
  private elements(indices: readonly number[]): ArrayElement[] {
    const { vertex, color, tex } = this.arrays;
    const readColor = color.enabled ? elementReader(color, this.memory, readNormalised) : null;
    const readTex = tex.enabled ? elementReader(tex, this.memory, readValue) : null;
    const readVertex = vertex.enabled ? elementReader(vertex, this.memory, readValue) : null;
    return indices.map((i) => {
      const e: ArrayElement = {};
      if (readColor) {
        const c = readColor(i);
        e.color = [c[0], c[1], c[2], color.size === 4 ? c[3] : 1];
      }
      if (readTex) {
        const t = readTex(i);
        e.tex = [t[0], tex.size > 1 ? t[1] : 0];
      }
      if (readVertex) {
        const v = readVertex(i);
        e.vertex = [v[0], v[1], vertex.size > 2 ? v[2] : 0, vertex.size > 3 ? v[3] : 1];
      }
      return e;
    });
  }

  /** Whether an enabled array reads a mapped buffer object, which GL refuses to draw from. */
  private mappedSource(): boolean {
    return Object.values(this.arrays).some((p) => p.enabled && readsMapped(p));
  }

  /** Draws array elements as glBegin(mode), glArrayElement for each, glEnd. */
  private drawElementsOf(mode: number, elements: readonly ArrayElement[]): void {
    this.compiled(() => {
      const vertices: ClipVertex[] = [];
      for (const e of elements) {
        if (e.color) this.color = e.color;
        if (e.tex) this.texCoord = e.tex;
        if (e.vertex) vertices.push(this.processed(...e.vertex));
      }
      drawPrimitive(this.target(), mode, vertices);
    });
  }

  private validDraw(mode: number, count: number, first = 0): boolean {
    if (this.prim) {
      this.fail(GL.INVALID_OPERATION);
      return false;
    }
    if (!Number.isInteger(mode) || mode < GL.POINTS || mode > GL.POLYGON) {
      this.fail(GL.INVALID_ENUM);
      return false;
    }
    if (count < 0 || first < 0) {
      this.fail(GL.INVALID_VALUE);
      return false;
    }
    if (count > MAX_DRAW_ELEMENTS) {
      this.fail(GL.OUT_OF_MEMORY);
      return false;
    }
    if (this.mappedSource()) {
      this.fail(GL.INVALID_OPERATION);
      return false;
    }
    return true;
  }

  drawArrays(mode: number, first: number, count: number): void {
    if (!this.validDraw(mode, count, first)) return;
    // Elements past the end of every enabled array hold nothing to read.
    const enabled = Object.values(this.arrays).filter((p) => p.enabled);
    if (enabled.length === 0) return;
    const available = Math.max(0, Math.min(...enabled.map((p) => elementCount(p, this.memory))) - first);
    const n = Math.min(count, available);
    this.drawElementsOf(mode, this.elements(Array.from({ length: n }, (_, k) => first + k)));
  }

  drawElements(mode: number, count: number, type: number, indices: Pointer): void {
    if (!this.validDraw(mode, count)) return;
    if (!INDEX_TYPES.has(type)) return this.fail(GL.INVALID_ENUM);
    const source = this.source(indices, this.elementBuffer);
    if (readsMapped(source)) return this.fail(GL.INVALID_OPERATION);
    this.drawElementsOf(mode, this.elements(readIndices(source, count, type, this.memory)));
  }

  // Textures (3.8).

  genTextures(n: number): number[] {
    return this.genNames(n, this.textures, createTexture);
  }

  /** `n` names unused in `used`, the lowest first, each given a new object by `make`. */
  private genNames<V>(n: number, used: Map<number, V>, make: () => V): number[] {
    return this.immediate(() => {
      if (n < 0) {
        this.fail(GL.INVALID_VALUE);
        return [];
      }
      if (n > MAX_GEN_NAMES) {
        this.fail(GL.OUT_OF_MEMORY);
        return [];
      }
      const out: number[] = [];
      for (let name = 1; out.length < n; name++) if (!used.has(name)) out.push(name);
      for (const name of out) used.set(name, make());
      return out;
    }, []);
  }

  deleteTextures(names: ArrayLike<number>): void {
    this.immediate(() => {
      for (const name of Array.from(names)) {
        if (name === 0) continue;
        if (this.boundTexture === name) this.boundTexture = 0;
        this.textures.delete(name);
      }
    }, undefined);
  }

  /** The texture object `name`, made with the initial state the first time it is bound. */
  private textureObject(name: number): TextureObject {
    let t = this.textures.get(name);
    if (!t) {
      t = createTexture();
      this.textures.set(name, t);
    }
    return t;
  }

  bindTexture(target: number, texture: number): void {
    this.compiled(() => {
      if (target !== GL.TEXTURE_2D) return this.fail(GL.INVALID_ENUM);
      this.textureObject(texture);
      this.boundTexture = texture;
    });
  }

  /**
   * glTexImage2D for `level` of the bound texture, unpacked from `pixels` (bytes, or an address in
   * program memory) at the call, as a display list compiles it.
   */
  texImage2D(
    target: number,
    level: number,
    internalformat: number,
    width: number,
    height: number,
    border: number,
    format: number,
    type: number,
    pixels: Pointer | null,
  ): void {
    const base = internalBase(internalformat);
    let image: ReturnType<typeof unpackImage> | null = null;
    let error: number = GL.NO_ERROR;
    if (target !== GL.TEXTURE_2D || formatComponents(format) === 0 || typeSize(type) === 0) error = GL.INVALID_ENUM;
    else if (!base || level < 0 || level > MAX_TEXTURE_LEVEL || width < 0 || height < 0 || width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE || border !== 0) {
      error = GL.INVALID_VALUE;
    } else {
      const bytes = typeof pixels === 'number' ? (this.memory?.().subarray(pixels) ?? null) : pixels;
      const size = typeSize(type);
      image = unpackImage(width, height, base, format, bytes, size, (view, at) => readNormalised(view, at, type), this.unpackAlignment);
    }
    this.compiled(() => {
      if (error) return this.fail(error);
      this.textureObject(this.boundTexture).levels[level] = image!;
    });
  }

  private texParameter(target: number, pname: number, param: number): void {
    this.compiled(() => {
      if (target !== GL.TEXTURE_2D) return this.fail(GL.INVALID_ENUM);
      const t = this.textureObject(this.boundTexture);
      switch (pname) {
        case GL.TEXTURE_MIN_FILTER:
          if (!MIN_FILTERS[param]) return this.fail(GL.INVALID_ENUM);
          t.minFilter = MIN_FILTERS[param];
          return;
        case GL.TEXTURE_MAG_FILTER:
          if (!MAG_FILTERS[param]) return this.fail(GL.INVALID_ENUM);
          t.magFilter = MAG_FILTERS[param];
          return;
        case GL.TEXTURE_WRAP_S:
        case GL.TEXTURE_WRAP_T:
          if (!WRAPS[param]) return this.fail(GL.INVALID_ENUM);
          if (pname === GL.TEXTURE_WRAP_S) t.wrapS = WRAPS[param];
          else t.wrapT = WRAPS[param];
          return;
      }
      this.fail(GL.INVALID_ENUM);
    });
  }
  texParameterf(target: number, pname: number, param: number): void {
    this.texParameter(target, pname, param);
  }
  texParameteri(target: number, pname: number, param: number): void {
    this.texParameter(target, pname, param);
  }
  /** glTexParameterfv: GL_TEXTURE_BORDER_COLOR's four values, clamped to 0..1, or any other parameter's one. */
  texParameterfv(target: number, pname: number, params: ArrayLike<number>): void {
    if (pname !== GL.TEXTURE_BORDER_COLOR) return this.texParameter(target, pname, params[0]);
    const border: RGBA = [clamp01(params[0]), clamp01(params[1]), clamp01(params[2]), clamp01(params[3])];
    this.compiled(() => {
      if (target !== GL.TEXTURE_2D) return this.fail(GL.INVALID_ENUM);
      this.textureObject(this.boundTexture).border = border;
    });
  }

  private texEnv(target: number, pname: number, param: number): void {
    this.compiled(() => {
      if (target !== GL.TEXTURE_ENV || pname !== GL.TEXTURE_ENV_MODE || !ENV_MODES[param]) return this.fail(GL.INVALID_ENUM);
      this.raster.envMode = ENV_MODES[param];
    });
  }
  texEnvf(target: number, pname: number, param: number): void {
    this.texEnv(target, pname, param);
  }
  texEnvi(target: number, pname: number, param: number): void {
    this.texEnv(target, pname, param);
  }

  // Display lists (5.4).

  genLists(range: number): number {
    return this.immediate(() => {
      if (range < 0) {
        this.fail(GL.INVALID_VALUE);
        return 0;
      }
      return this.lists.gen(range);
    }, 0);
  }

  newList(list: number, mode: number): void {
    this.immediate(() => {
      if (list === 0) return this.fail(GL.INVALID_VALUE);
      if (mode !== GL.COMPILE && mode !== GL.COMPILE_AND_EXECUTE) return this.fail(GL.INVALID_ENUM);
      if (this.lists.open) return this.fail(GL.INVALID_OPERATION);
      this.lists.begin(list, mode);
    }, undefined);
  }

  endList(): void {
    this.immediate(() => {
      if (!this.lists.open) return this.fail(GL.INVALID_OPERATION);
      this.lists.end();
    }, undefined);
  }

  /** glCallList: runs the list's commands; it is allowed between glBegin and glEnd. */
  callList(list: number): void {
    this.compiled(() => {
      if (list === 0) return this.fail(GL.INVALID_VALUE);
      this.lists.call(list);
    }, true);
  }

  deleteLists(list: number, range: number): void {
    this.immediate(() => {
      if (range < 0) return this.fail(GL.INVALID_VALUE);
      this.lists.delete(list, range);
    }, undefined);
  }

  // Buffer objects (2.9).

  genBuffers(n: number): number[] {
    return this.genNames(n, this.buffers, emptyBuffer);
  }

  deleteBuffers(names: ArrayLike<number>): void {
    this.immediate(() => {
      for (const name of Array.from(names)) {
        if (name === 0) continue;
        if (this.arrayBuffer === name) this.arrayBuffer = 0;
        if (this.elementBuffer === name) this.elementBuffer = 0;
        this.buffers.delete(name);
      }
    }, undefined);
  }

  private bound(target: number): BufferObject | null | undefined {
    if (target === GL.ARRAY_BUFFER) return this.buffers.get(this.arrayBuffer) ?? null;
    if (target === GL.ELEMENT_ARRAY_BUFFER) return this.buffers.get(this.elementBuffer) ?? null;
    return undefined;
  }

  bindBuffer(target: number, buffer: number): void {
    this.immediate(() => {
      if (target !== GL.ARRAY_BUFFER && target !== GL.ELEMENT_ARRAY_BUFFER) return this.fail(GL.INVALID_ENUM);
      if (buffer !== 0 && !this.buffers.has(buffer)) this.buffers.set(buffer, emptyBuffer());
      if (target === GL.ARRAY_BUFFER) this.arrayBuffer = buffer;
      else this.elementBuffer = buffer;
    }, undefined);
  }

  /** glBufferData: the bound buffer's store becomes a copy of `bytes`. */
  bufferData(target: number, bytes: Uint8Array, usage: number): void {
    this.immediate(() => {
      const b = this.bound(target);
      if (b === undefined || !BUFFER_USAGES.has(usage)) return this.fail(GL.INVALID_ENUM);
      if (!b) return this.fail(GL.INVALID_OPERATION);
      b.data = bytes.slice();
      b.usage = usage;
      b.mapped = false;
    }, undefined);
  }

  bufferSubData(target: number, offset: number, bytes: Uint8Array): void {
    this.immediate(() => {
      const b = this.bound(target);
      if (b === undefined) return this.fail(GL.INVALID_ENUM);
      if (!b || b.mapped) return this.fail(GL.INVALID_OPERATION);
      if (offset < 0 || offset + bytes.length > b.data.length) return this.fail(GL.INVALID_VALUE);
      b.data.set(bytes, offset);
    }, undefined);
  }

  /** glMapBuffer: the bound buffer's store itself, until glUnmapBuffer. */
  mapBuffer(target: number, access: number): Uint8Array | null {
    return this.immediate(() => {
      const b = this.bound(target);
      if (b === undefined || (access !== GL.READ_ONLY && access !== GL.WRITE_ONLY && access !== GL.READ_WRITE)) {
        this.fail(GL.INVALID_ENUM);
        return null;
      }
      if (!b || b.mapped) {
        this.fail(GL.INVALID_OPERATION);
        return null;
      }
      b.mapped = true;
      return b.data;
    }, null);
  }

  unmapBuffer(target: number): boolean {
    return this.immediate(() => {
      const b = this.bound(target);
      if (b === undefined) {
        this.fail(GL.INVALID_ENUM);
        return false;
      }
      if (!b || !b.mapped) {
        this.fail(GL.INVALID_OPERATION);
        return false;
      }
      b.mapped = false;
      return true;
    }, false);
  }
}
