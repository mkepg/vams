import { drawPrimitive, type ClipVertex, type Viewport } from './assembly';
import { drawBitmap, type RasterPos } from './bitmap';
import type { Scissor } from './clip';
import { clearFramebuffer, resolvePending, type Band, type Framebuffer } from './framebuffer';
import type { RasterState, RGBA } from './fragment';
import { textureFor, type TextureObject } from './textures';

/**
 * One drawing command, as data: what GLContext draws for a Begin/End object or a vertex array, a
 * glBitmap and a glClear, with the state it was issued in. Data, rather than a closure, so it can
 * be held back for a frame nobody will see, and drawn by another thread.
 */
export type DrawCommand =
  | {
      kind: 'primitive';
      mode: number;
      vertices: ClipVertex[];
      state: RasterState;
      viewport: Viewport;
      /** The bound texture while GL_TEXTURE_2D is on and it is complete, otherwise null. */
      texture: TextureObject | null;
    }
  | {
      kind: 'bitmap';
      state: RasterState;
      pos: RasterPos;
      width: number;
      height: number;
      xorig: number;
      yorig: number;
      xmove: number;
      ymove: number;
      bits: Uint8Array | null;
    }
  | { kind: 'clear'; value: RGBA; scissor: Scissor | null };

/**
 * Draws `command` into `fb`. Drawing a primitive moves its state's stipple counter on, and a
 * bitmap moves its raster position, as GL does.
 */
export function runCommand(fb: Framebuffer, command: DrawCommand): void {
  switch (command.kind) {
    case 'primitive': {
      const texture = command.texture;
      drawPrimitive(
        { fb, state: command.state, viewport: command.viewport, texture: texture ? (lambda) => textureFor(texture, lambda) : null },
        command.mode,
        command.vertices,
      );
      return;
    }
    case 'bitmap': {
      const c = command;
      drawBitmap(fb, c.state, c.pos, c.width, c.height, c.xorig, c.yorig, c.xmove, c.ymove, c.bits);
      return;
    }
    case 'clear':
      clearFramebuffer(fb, command.value, command.scissor);
      return;
  }
}

/**
 * Draws `commands`, in order, into the rows of `fb` in `band`, and averages the pixels they
 * touched, so the band's colour is up to date. Another thread draws the other bands at the same
 * time; no pixel is in two bands.
 */
export function drawBand(fb: Framebuffer, band: Band | null, commands: readonly DrawCommand[]): void {
  const before = fb.band;
  fb.band = band;
  try {
    for (const command of commands) runCommand(fb, command);
    resolvePending(fb);
  } finally {
    fb.band = before;
  }
}

/**
 * Threads that draw bands of a window at the same time. `draw` draws `commands` into every row of
 * `fb`, which must be in shared memory (createSharedFramebuffer), and returns once all of them are
 * drawn and averaged. `share` puts bytes every thread drawing reads, a texture image's, in shared
 * memory.
 */
export interface RasterPool {
  draw(fb: Framebuffer, commands: readonly DrawCommand[]): void;
  share(bytes: Uint8Array): Uint8Array;
}
