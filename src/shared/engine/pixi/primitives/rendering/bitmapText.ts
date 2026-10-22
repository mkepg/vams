import { BufferImageSource, Container, Matrix, Rectangle, Sprite, Texture } from 'pixi.js';
import { lineOrigin, rasterLineYs, rasterizeLine } from '@/shared/lib/text-raster';

/** Window pixels around each drawn line that still pick the text. */
const HIT_PADDING = 4;
/** Half the side of the pick square at the origin when no line is drawn. */
const EMPTY_HIT = 6;

function lineTexture(line: string, color: number): Texture | null {
  const { width, height, bits } = rasterizeLine(line);
  if (width === 0) return null;
  const rgba = new Uint8Array(width * height * 4);
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  bits.forEach((bit, i) => {
    if (!bit) return;
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  });
  const source = new BufferImageSource({ resource: rgba, width, height, scaleMode: 'nearest', antialias: false });
  return new Texture({ source });
}

/**
 * Bitmap text as glutBitmapCharacter draws it: one sprite per line, one texel per window pixel,
 * placed each frame at its raster position and never turned or stretched by the object's
 * transform. It is also the text container's hit area, in the container's own coordinates.
 */
export class BitmapTextLayout {
  readonly sprites: (Sprite | null)[];
  /** The drawn lines' boxes in window pixels, from the last placement. */
  private rects: Rectangle[] = [];
  private origin = { x: 0, y: 0 };
  private toScreen = new Matrix();

  constructor(lines: readonly string[], color: number) {
    this.sprites = lines.map((line) => {
      const texture = lineTexture(line, color);
      if (!texture) return null;
      const sprite = new Sprite(texture);
      sprite.label = 'glut-bitmap-line';
      sprite.roundPixels = true;
      return sprite;
    });
  }

  /** Puts every line at its raster position for a window `width` × `height` pixels, lines `step` units apart. */
  place(container: Container, step: number, width: number, height: number): void {
    const m = container.getGlobalTransform(this.toScreen, false);
    const det = m.a * m.d - m.b * m.c;
    const toLocal = det === 0 ? null : m.clone().invert();
    const o = m.apply({ x: 0, y: 0 });
    this.origin = { x: o.x, y: o.y };
    this.rects = [];
    rasterLineYs(this.sprites.length, step).forEach((y, i) => {
      const sprite = this.sprites[i];
      if (!sprite) return;
      const raster = m.apply({ x: 0, y });
      const at = toLocal ? lineOrigin(raster.x, raster.y, width, height) : null;
      if (!at || !toLocal) {
        sprite.visible = false;
        return;
      }
      sprite.visible = true;
      sprite.setFromMatrix(toLocal.clone().append(new Matrix(1, 0, 0, 1, at.left, at.top)));
      this.rects.push(new Rectangle(at.left, at.top, sprite.texture.width, sprite.texture.height));
    });
  }

  /** The drawn lines' box in window pixels, or a small square at the origin when none is drawn. */
  screenBounds(): Rectangle {
    if (this.rects.length === 0) {
      return new Rectangle(this.origin.x - EMPTY_HIT, this.origin.y - EMPTY_HIT, EMPTY_HIT * 2, EMPTY_HIT * 2);
    }
    const left = Math.min(...this.rects.map((r) => r.x));
    const top = Math.min(...this.rects.map((r) => r.y));
    const right = Math.max(...this.rects.map((r) => r.x + r.width));
    const bottom = Math.max(...this.rects.map((r) => r.y + r.height));
    return new Rectangle(left, top, right - left, bottom - top);
  }

  contains(x: number, y: number): boolean {
    const p = this.toScreen.apply({ x, y });
    if (this.rects.length === 0) return this.screenBounds().contains(p.x, p.y);
    return this.rects.some((r) =>
      p.x >= r.x - HIT_PADDING && p.x <= r.x + r.width + HIT_PADDING &&
      p.y >= r.y - HIT_PADDING && p.y <= r.y + r.height + HIT_PADDING);
  }

  destroy(): void {
    this.sprites.forEach((sprite) => sprite?.destroy({ texture: true, textureSource: true }));
  }
}

/** Frees the glyph textures a text container holds before its content is replaced or destroyed. */
export function releaseBitmapText(container: Container): void {
  if (container.hitArea instanceof BitmapTextLayout) container.hitArea.destroy();
}
