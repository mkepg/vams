/** Generated text draws each line at its own glRasterPos2f, this far apart, centred on the text's origin (generator/render.ts). */
export const TEXT_LINE_HEIGHT = 0.07;

/** The y of the first line's raster position, in the text's own coordinates: the highest line. */
export function firstRasterY(text: string): number {
  return ((text.split('\n').length - 1) / 2) * TEXT_LINE_HEIGHT;
}
