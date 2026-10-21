import type { Vertex } from '@/core/types/scene';

/** The Quick Gradients, in the order they are shown. */
export const GRADIENT_PRESETS: readonly { label: string; colors: readonly string[] }[] = [
  { label: 'RGB corners', colors: ['#ff0000', '#00ff00', '#0000ff'] },
  { label: 'Black to white', colors: ['#000000', '#ffffff'] },
  { label: 'Sunset', colors: ['#ff5e3a', '#ffd166', '#c9184a'] },
  { label: 'Ocean', colors: ['#03045e', '#0077b6', '#90e0ef'] },
  { label: 'Neon', colors: ['#f72585', '#7209b7', '#4cc9f0'] },
];

/** The colour at `position` (0..1) along a run of evenly spaced colour stops. */
export const getGradientColor = (colors: readonly string[], position: number): string => {
  if (colors.length === 0) return '#ffffff';
  if (colors.length === 1) return colors[0];
  if (position <= 0) return colors[0];
  if (position >= 1) return colors[colors.length - 1];

  const segment = 1 / (colors.length - 1);
  const index = Math.floor(position / segment);
  const factor = (position - index * segment) / segment;

  const c1 = colors[index];
  const c2 = colors[index + 1];

  const r1 = parseInt(c1.substring(1, 3), 16);
  const g1 = parseInt(c1.substring(3, 5), 16);
  const b1 = parseInt(c1.substring(5, 7), 16);

  const r2 = parseInt(c2.substring(1, 3), 16);
  const g2 = parseInt(c2.substring(3, 5), 16);
  const b2 = parseInt(c2.substring(5, 7), 16);

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/**
 * One colour per vertex, spread along the shape's wider axis (by vertex order when the
 * shape is flat).
 */
export function gradientColours(vertices: readonly Vertex[], colors: readonly string[]): string[] {
  const numVertices = vertices.length;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  const useY = width < 0.0001 && height > 0.0001;
  const range = useY ? height : width;

  return vertices.map((v, i) => {
    let position = 0;
    if (range > 0.0001) {
      position = useY ? (v.y - minY) / range : (v.x - minX) / range;
    } else {
      position = numVertices > 1 ? i / (numVertices - 1) : 0;
    }
    return getGradientColor(colors, position);
  });
}
