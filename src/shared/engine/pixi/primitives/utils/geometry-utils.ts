import * as PIXI from "pixi.js";
import type { SceneNode, Vertex } from "@/core/types/scene";
import { GLYPH_ADVANCE, GLYPH_DESCENT, GLYPH_HEIGHT } from "@/shared/lib/glut-bitmap-9x15";
import { TEXT_LINE_PIXELS, textLines } from "@/shared/lib/text-raster";

export function pxToWorld(px: number, worldScaleX?: number): number {
  return worldScaleX ? px / worldScaleX : 0.02;
}

export function bboxRadii(o: SceneNode): { cx: number; cy: number; rx: number; ry: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of o.vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  if (!isFinite(minX)) return { cx: 0, cy: 0, rx: 0.5, ry: 0.5 };
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(1e-6, (maxX - minX) / 2);
  const ry = Math.max(1e-6, (maxY - minY) / 2);
  return { cx, cy, rx, ry };
}

export function buildEllipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments = 128
): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry);
  }
  return pts;
}

export function hasUniformColor(o: SceneNode): boolean {
  if (o.vertices.length === 0) return true;
  const firstColor = o.vertices[0].color;
  return o.vertices.every(v => v.color === firstColor);
}

export function createPaddedHitArea(
  minX: number,
  minY: number,
  width: number,
  height: number,
  padding: number
): PIXI.Rectangle {
  return new PIXI.Rectangle(
    minX - padding,
    minY - padding,
    width + (padding * 2),
    height + (padding * 2)
  );
}

/** Window pixels per unit along each axis; they differ once the student stretches the window. */
export interface PixelsPerUnit {
  x: number;
  y: number;
}

/**
 * The box bitmap text's glyphs cover around its raster origin, in units: rightwards from the
 * origin, from the first line's ascent down to the last line's descent. Glyphs keep their pixel
 * size whatever the object's transform.
 */
export function textGlyphBox(text: string, perUnit: PixelsPerUnit): { left: number; right: number; bottom: number; top: number } {
  const lines = textLines(text);
  const widest = Math.max(0, ...lines.map((line) => line.length)) * GLYPH_ADVANCE;
  const below = GLYPH_DESCENT + (lines.length - 1) * TEXT_LINE_PIXELS;
  return { left: 0, right: widest / perUnit.x, bottom: -below / perUnit.y, top: (GLYPH_HEIGHT - GLYPH_DESCENT) / perUnit.y };
}

/**
 * The children's box in the group's coordinates. With `pixelsPerUnit` (window pixels per group
 * unit), a text child counts its glyphs, not just its origin.
 */
export function getGroupLocalBounds(
  children: SceneNode[],
  pixelsPerUnit?: PixelsPerUnit
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (!children || children.length === 0) {
    return { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0.5, width: 1, height: 1 };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  children.forEach(child => {
    const cRad = (child.transform.rotate * Math.PI) / 180;
    const cCos = Math.cos(cRad);
    const cSin = Math.sin(cRad);
    const cScaleX = child.transform.scaleX ?? 1;
    const cScaleY = child.transform.scaleY ?? 1;
    const cX = child.transform.translateX;
    const cY = child.transform.translateY;
    if (child.type === 'TEXT' && pixelsPerUnit && pixelsPerUnit.x > 0 && pixelsPerUnit.y > 0) {
      // The glyphs sit upright at the raster origin, so only the child's position moves them.
      const box = textGlyphBox(child.textContent ?? '', pixelsPerUnit);
      minX = Math.min(minX, cX + box.left);
      maxX = Math.max(maxX, cX + box.right);
      minY = Math.min(minY, cY + box.bottom);
      maxY = Math.max(maxY, cY + box.top);
      return;
    }
    const vertices = child.vertices.length > 0
      ? child.vertices
      : [{x: -0.5, y: -0.5}, {x: 0.5, y: -0.5}, {x: 0.5, y: 0.5}, {x: -0.5, y: 0.5}] as Vertex[];
      
    vertices.forEach(v => {
      const lx = (v.x * cScaleX * cCos) - (v.y * cScaleY * cSin) + cX;
      const ly = (v.x * cScaleX * cSin) + (v.y * cScaleY * cCos) + cY;
      if (lx < minX) minX = lx;
      if (lx > maxX) maxX = lx;
      if (ly < minY) minY = ly;
      if (ly > maxY) maxY = ly;
    });
  });

  if (!isFinite(minX)) return { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0.5, width: 1, height: 1 };
  
  return {
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}