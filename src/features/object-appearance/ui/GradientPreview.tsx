import type { SceneNodeType, Vertex } from '@/core/types/scene';
import { pixelGrid, rasterise } from '@/entities/scene/model/rasterise';
import { gradientColours } from '../lib/gradient';

const ACROSS = 28;
const PAD = 0.08;

export interface GradientPreviewProps {
  vertices: readonly Vertex[];
  type: SceneNodeType;
  colors: readonly string[];
}

/** The frame is the shape's own bounding box, padded; a flat box is widened so it never divides by zero. */
function frameOf(vertices: readonly Vertex[]) {
  const xs = vertices.map((v) => v.x).filter(Number.isFinite);
  const ys = vertices.map((v) => v.y).filter(Number.isFinite);
  if (xs.length === 0 || ys.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const longest = Math.max(maxX - minX, maxY - minY);
  const base = longest > 0 ? longest : 1;
  // Keep a hairline shape visible: the thin side is at least a thirtieth of the long side.
  const w = Math.max(maxX - minX, base / 30);
  const h = Math.max(maxY - minY, base / 30);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return { minX: cx - (w / 2) * (1 + 2 * PAD), maxX: cx + (w / 2) * (1 + 2 * PAD), minY: cy - (h / 2) * (1 + 2 * PAD), maxY: cy + (h / 2) * (1 + 2 * PAD) };
}

/** The selected shape, already painted with one Quick Gradient: a coarse pixel picture of what OpenGL would draw. */
export default function GradientPreview({ vertices, type, colors }: GradientPreviewProps) {
  const grid = pixelGrid(frameOf(vertices), ACROSS);
  const fragments = type === 'TEXT' || type === 'GROUP' ? [] : rasterise(
    { type, corners: vertices.map((v) => ({ x: v.x, y: v.y })), colours: gradientColours(vertices, colors), uvs: null, shading: 'SMOOTH' },
    grid,
    false,
  );
  return (
    <svg className="gradient-preview__picture" viewBox={`0 0 ${grid.cols} ${grid.rows}`} preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
      {fragments.map((f) => (
        <rect key={`${f.col}-${f.row}`} x={f.col} y={f.row} width={1} height={1} fill={`rgb(${f.rgb[0]}, ${f.rgb[1]}, ${f.rgb[2]})`} />
      ))}
    </svg>
  );
}
