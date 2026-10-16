import { isUpload, type SharePayload } from '@/entities/project/model/share';

/** Shared copies of uploaded images are at most this many pixels on their longer side. */
export const SHARE_IMAGE_MAX = 512;

export function fitWithin(width: number, height: number, max: number = SHARE_IMAGE_MAX): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type ResizeImage = (dataUrl: string, size: { width: number; height: number }) => Promise<string>;

/** Redraws an image at a smaller size, smoothly, as WebP (PNG where WebP can't be encoded). */
export const canvasResize: ResizeImage = async (dataUrl, size) => {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas to shrink the image with');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/webp', 0.85);
};

/** The payload with every uploaded image larger than SHARE_IMAGE_MAX shrunk. The student's own images are untouched. */
export async function shrinkPayloadImages(p: SharePayload, resize: ResizeImage = canvasResize): Promise<{ payload: SharePayload; shrunk: number }> {
  let shrunk = 0;
  const textures = await Promise.all(
    p.textures.map(async (t) => {
      if (!isUpload(t)) return t;
      const size = fitWithin(t.width, t.height);
      if (size.width === t.width && size.height === t.height) return t;
      shrunk++;
      return { ...t, ...size, dataUrl: await resize(t.dataUrl, size) };
    }),
  );
  return { payload: { ...p, textures }, shrunk };
}
