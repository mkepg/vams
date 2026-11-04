import { CLOUD_TEXTURE, SIGN_TEXTURE } from '@/entities/project';

/**
 * The images the examples load, by file name, as PNG data URLs.
 * - checkerboard.png: 8 × 8 cells of one texel, white where x + y is even and red where it is odd.
 * - Pixel fox.png: the editor's Pixel fox sample, each sprite character a 4 × 4 px square.
 * - Cloud tile.png and Sari-sari sign.png: the gallery's own textures.
 */
export const EXAMPLE_IMAGES: Record<string, string> = {
  'checkerboard.png':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAGUlEQVR4nGP4DwR35ORAFFaaAZ8kCAwPEwA51MJh3IBBPAAAAABJRU5ErkJggg==',
  'Pixel fox.png':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAA50lEQVR4nO3bsQ3CMBAFUCahYAwk1mEGdoBJmIQJWAJa6tCniHWyEx/4RfplTj+view4u8vjNY0cAL0L9A6A2gGH/XEx2ecDyF4QQDaAeYHP9bSYaOG15wMAAGBbgFLh1vMAAACQG6B1AAAAsC5AtgduDQIAAIA6gNJVu7gpXQAAAMgFULvYKd0PAACAXADRvM+3UKLzAQAA8NsAtfMBAADQFiD7BoldYQAAtgWIHmJq/YDdD0kBADA4wLzA9LwvpvaARGl+97cAAAAAQgXDH0YAAACQCmD4HyYAAADwVwHQu0DvDA/wBZ3CI6Xe9OVWAAAAAElFTkSuQmCC',
  [`${CLOUD_TEXTURE.name}.png`]: CLOUD_TEXTURE.dataUrl,
  [`${SIGN_TEXTURE.name}.png`]: SIGN_TEXTURE.dataUrl,
};

/** The bytes of a data URL's base64 payload. */
export function dataUrlBytes(dataUrl: string): Uint8Array {
  const text = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}
