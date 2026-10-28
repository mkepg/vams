export { sanitizeName } from '@/shared/lib/sanitize-name';

/** Float color emission: `glColor3f(r, g, b)` with values in [0, 1]. */
export const hexToGlColor = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return `${r.toFixed(2)}f, ${g.toFixed(2)}f, ${b.toFixed(2)}f`;
};

/** Byte color emission: `glColor3ub(r, g, b)` with integer values in [0, 255]. */
export const hexToGlByteColor = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

import type { PrimitiveType, SceneNode } from "@/core/types/scene";
import { POINT_SIZE } from "@/shared/lib/gl-geometry";
export const getGlPrimitive = (type: PrimitiveType): string => {
  const map: Record<PrimitiveType, string> = {
    POINTS:         'GL_POINTS',
    LINES:          'GL_LINES',
    LINE_STRIP:     'GL_LINE_STRIP',
    LINE_LOOP:      'GL_LINE_LOOP',
    TRIANGLES:      'GL_TRIANGLES',
    TRIANGLE_STRIP: 'GL_TRIANGLE_STRIP',
    TRIANGLE_FAN:   'GL_TRIANGLE_FAN',
    QUADS:          'GL_QUADS',
    QUAD_STRIP:     'GL_QUAD_STRIP',
    POLYGON:        'GL_POLYGON',
  };
  return map[type] ?? 'GL_POINTS';
};

const isLine = (t: SceneNode['type']): boolean => t === 'LINES' || t === 'LINE_STRIP' || t === 'LINE_LOOP';

/** The point size, line width and stipple a primitive draws with, set before it in every rendering mode. */
export function rasterStateBefore(o: SceneNode): string {
  let out = '';
  if (isLine(o.type)) {
    out += `    glLineWidth(${(o.lineWidth ?? 1).toFixed(2)}f);
`;
    if (o.lineStipple) {
      const factor = Math.max(1, Math.min(256, Math.floor(o.lineStipple.factor)));
      const pattern = o.lineStipple.pattern & 0xFFFF;
      out += `    glEnable(GL_LINE_STIPPLE);
`;
      out += `    glLineStipple(${factor}, 0x${pattern.toString(16).toUpperCase().padStart(4, '0')});
`;
    }
  }
  if (o.type === 'POINTS') {
    out += `    // Adjust visible point size — default is 1px
`;
    out += `    glPointSize(${POINT_SIZE}.0f);
`;
  }
  return out;
}

/** Puts the state rasterStateBefore set back to OpenGL's defaults. */
export function rasterStateAfter(o: SceneNode): string {
  let out = '';
  if (o.type === 'POINTS') out += `    glPointSize(1.0f); // Reset
`;
  if (isLine(o.type)) {
    if (o.lineStipple) out += `    glDisable(GL_LINE_STIPPLE);
`;
    out += `    glLineWidth(1.0f);
`;
  }
  return out;
}
