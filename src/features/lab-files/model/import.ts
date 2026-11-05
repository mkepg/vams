import { labFileType, useLabStore, type LabFile, type LabWork } from '@/entities/lab-project';
import type { LabImport } from '@/shared/lib/lab-import';
import { CONTROL_CHARACTER, MAX_LAB_FILES } from '@/shared/lib/share-schema';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';
import { dataUrlBytes } from './example-images';
import { mayReplaceWork, type Ask } from './replace';

/** Redraws an image given as a data URL, and gives it back as PNG bytes. */
export type RedrawAsPng = (dataUrl: string) => Promise<Uint8Array>;

/** The image formats stb_image reads, which keep their bytes. */
const READABLE = new Set(['image/png', 'image/jpeg', 'image/bmp']);

/** Draws the image on a canvas at its own size and encodes the canvas as PNG. */
export const canvasRedrawAsPng: RedrawAsPng = async (dataUrl) => {
  const type = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? '';
  const bitmap = await createImageBitmap(new Blob([dataUrlBytes(dataUrl) as Uint8Array<ArrayBuffer>], { type }));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas to redraw the image with');
    ctx.drawImage(bitmap, 0, 0);
  } finally {
    bitmap.close();
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The image could not be encoded');
  return new Uint8Array(await blob.arrayBuffer());
};

/**
 * The work the editor's Open in Lab sent: its code, and its images as the file list, each under
 * the name the code's stbi_load gives. PNG, JPEG and BMP keep their bytes, since stb_image reads
 * the format from the bytes; any other image (WebP) is redrawn as PNG under the same name. A file
 * the list can't hold, or one that won't decode, is left out.
 */
export async function importedWork(imported: LabImport, redraw: RedrawAsPng = canvasRedrawAsPng): Promise<LabWork> {
  const files: LabFile[] = [];
  for (const { name, type: imageType, dataUrl } of imported.files) {
    const type = labFileType(name);
    if (!type?.startsWith('image/') || /[\\/]/.test(name) || CONTROL_CHARACTER.test(name)) continue;
    if (files.length >= MAX_LAB_FILES || files.some((f) => f.name.toLowerCase() === name.toLowerCase())) continue;
    try {
      files.push({ name, bytes: READABLE.has(imageType) ? dataUrlBytes(dataUrl) : await redraw(dataUrl), type });
    } catch {
      // Not an image this browser can read.
    }
  }
  return { source: imported.source, files };
}

/** Replaces the work with what the editor sent, asking first when it is unsaved. Resolves whether it did. */
export async function openImport(imported: LabImport, ask: Ask = confirm, redraw?: RedrawAsPng): Promise<boolean> {
  if (!(await mayReplaceWork(ask))) return false;
  await useLabStore.getState().replaceWork(await importedWork(imported, redraw));
  return true;
}
