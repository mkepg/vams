/// <reference lib="webworker" />
/**
 * The editor's Run view, off the page's thread: it draws each frame of the running scene with the
 * Lab's software renderer, through gl-draw (the exported program's display()), and hands the pixels
 * back, top row first. The page posts a frame only when the last is back, so a slow frame never
 * holds up Run's steps.
 */
import { drawDisplay, setUpTextures, type GlFrame, type GlImage, type GlScene } from '@/features/code-generation/model/gl-draw';
import { GLContext } from '@/shared/lib/gl-raster';
import type { RunViewReply, RunViewRequest } from '../model/run-view-protocol';

let scene: GlScene | null = null;
let images = new Map<string, GlImage>();
let gl: GLContext | null = null;
let textures = new Map<string, number>();
let size = { width: 0, height: 0 };
let loading: Promise<void> = Promise.resolve();

/** An image's pixels from its data URL, exactly as stored: no colour conversion, no premultiplied alpha. */
async function decode(dataUrl: string): Promise<GlImage> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })!;
  ctx.drawImage(bitmap, 0, 0);
  const rgba = new Uint8Array(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data.buffer);
  return { width: bitmap.width, height: bitmap.height, rgba };
}

/** A context for the window, its textures set up as init() sets them up. */
function contextFor(width: number, height: number): GLContext {
  if (gl && size.width === width && size.height === height) return gl;
  size = { width, height };
  gl = new GLContext(width, height, { multisample: true });
  textures = setUpTextures(gl, scene!.objects, images);
  return gl;
}

function draw(frame: GlFrame, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const context = contextFor(width, height);
  drawDisplay(context, scene!, frame, textures);
  // The framebuffer's row 0 is the bottom one; ImageData's is the top.
  const color = context.fb.color;
  const rowBytes = width * 4;
  const out = new Uint8ClampedArray(color.length);
  for (let y = 0; y < height; y++) out.set(color.subarray(y * rowBytes, (y + 1) * rowBytes), (height - 1 - y) * rowBytes);
  return out;
}

self.onmessage = (event: MessageEvent<RunViewRequest>) => {
  const message = event.data;
  if (message.type === 'scene') {
    scene = message.scene;
    gl = null;
    images = new Map();
    loading = Promise.all(
      message.images.map(async ({ id, dataUrl }) => {
        try {
          images.set(id, await decode(dataUrl));
        } catch {
          // An image that doesn't decode draws as the program draws a texture stbi_load can't read: untextured.
        }
      }),
    ).then(() => {
      gl = null;
    });
    return;
  }
  const { frame, width, height, seq } = message;
  void loading.then(() => {
    if (!scene) return;
    const pixels = draw(frame, width, height);
    const reply: RunViewReply = { type: 'frame', seq, width, height, pixels };
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(reply, [pixels.buffer]);
  });
};
