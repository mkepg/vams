/**
 * Drawing a frame of the running scene for the editor's Run view, or a band of its rows: the Run
 * view worker draws the first band and its band workers the others, at the same time
 * (run-view-worker.ts). Each pixel of a band is the one drawing the whole window gives.
 */
import { drawDisplay, setUpTextures, type GlFrame, type GlImage, type GlScene } from '@/features/code-generation/model/gl-draw';
import { GLContext, type Band } from '@/shared/lib/gl-raster';

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

export class SceneDrawer {
  private scene: GlScene | null = null;
  private images = new Map<string, GlImage>();
  private gl: GLContext | null = null;
  private textures = new Map<string, number>();
  private key = '';
  /** Settles once the scene's images are decoded. */
  loading: Promise<void> = Promise.resolve();

  get ready(): boolean {
    return this.scene !== null;
  }

  setScene(scene: GlScene, images: { id: string; dataUrl: string }[]): void {
    this.scene = scene;
    this.gl = null;
    this.images = new Map();
    this.loading = Promise.all(
      images.map(async ({ id, dataUrl }) => {
        try {
          this.images.set(id, await decode(dataUrl));
        } catch {
          // An image that doesn't decode draws as the program draws a texture stbi_load can't read: untextured.
        }
      }),
    ).then(() => {
      this.gl = null;
    });
  }

  /**
   * A context for the window, its textures set up as init() sets them up, drawing the rows of
   * `band`. The bands move from frame to frame, and each frame clears the whole window first, so
   * one context serves every band.
   */
  private contextFor(width: number, height: number, band: Band): GLContext {
    const key = `${width}x${height}`;
    if (!this.gl || this.key !== key) {
      this.key = key;
      this.gl = new GLContext(width, height, { multisample: true });
      this.textures = setUpTextures(this.gl, this.scene!.objects, this.images);
    }
    this.gl.drawRows(band.y0 <= 0 && band.y1 >= height ? null : band);
    return this.gl;
  }

  /**
   * Rows `band` of the frame, top row first, RGBA: ImageData's order, where the framebuffer's row
   * 0 is the bottom one.
   */
  draw(frame: GlFrame, width: number, height: number, band: Band = { y0: 0, y1: height }): Uint8ClampedArray<ArrayBuffer> {
    const context = this.contextFor(width, height, band);
    drawDisplay(context, this.scene!, frame, this.textures);
    const color = context.fb.color;
    const rowBytes = width * 4;
    const out = new Uint8ClampedArray((band.y1 - band.y0) * rowBytes);
    for (let y = band.y0; y < band.y1; y++) out.set(color.subarray(y * rowBytes, (y + 1) * rowBytes), (band.y1 - 1 - y) * rowBytes);
    return out;
  }
}
