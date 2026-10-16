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

import type { PrimitiveType } from "@/core/types/scene";
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
