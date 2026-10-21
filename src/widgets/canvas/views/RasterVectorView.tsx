import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useVamsStore } from '@/core/store';
import { figureFrame, worldPrimitives, type Pt } from '@/entities/scene/model/pipeline-geometry';
import { pixelGrid, rasterise } from '@/entities/scene/model/rasterise';
import { fmt } from '@/shared/lib/format-number';
import { SegmentedControl, Switch } from '@/shared/ui/controls';
import { pipelineSubject, type Subject } from '../model/pipeline-subject';
import './pedagogical-views.scss';

/** Each drawing's width and height in CSS px; the styles let it shrink in a narrow pane. */
const SIZE = 252;
/** Corner coordinates only while they stay readable. */
const MAX_LABELS = 8;
const ACROSS_OPTIONS = ['8', '16', '24', '48'].map((value) => ({ value, label: value }));
/** A label's width in px at the mono size used here, for keeping it inside the drawing. */
const LABEL_CHAR = 6.1;

interface Frame {
  w: number;
  h: number;
  k: number;
  X: (x: number) => number;
  Y: (y: number) => number;
}

/** The subject's frame (the viewing volume plus a margin) fitted to SIZE, as the Diagram draws it. */
function framing(volume: Subject['volume']): Frame {
  const f = figureFrame(volume);
  const fw = f.maxX - f.minX;
  const fh = f.maxY - f.minY;
  const k0 = SIZE / Math.max(fw, fh);
  const k = Number.isFinite(k0) && k0 > 0 ? k0 : 1;
  return { w: Math.min(SIZE, fw * k), h: Math.min(SIZE, fh * k), k, X: (x) => (x - f.minX) * k, Y: (y) => (f.maxY - y) * k };
}

/** The drawing, centred in its square; a nested svg cuts off whatever lies beyond the frame. */
function Drawing({ frame, label, children }: { frame: Frame; label: string; children: ReactNode }) {
  const { w, h } = frame;
  return (
    <svg className="rv-svg stage-figure" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} focusable="false">
      <svg x={(SIZE - w) / 2} y={(SIZE - h) / 2} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">
        {children}
      </svg>
    </svg>
  );
}

/**
 * The same shape twice: as the corners and straight edges the program describes, and as the pixels the
 * screen holds. Pixel size and multisampling are view settings only; nothing here is stored.
 */
export default function RasterVectorView() {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const canvasBackgroundColor = useVamsStore((s) => s.canvasBackgroundColor);
  const [across, setAcross] = useState(24);
  const [multisample, setMultisample] = useState(true);

  const subject = useMemo(
    () => pipelineSubject({ objects, selectedObjectId, viewportLimits, canvasBackgroundColor }),
    [objects, selectedObjectId, viewportLimits, canvasBackgroundColor],
  );
  const v = subject.volume;
  const frame = useMemo(() => framing(v), [v]);
  const { w, h, k, X, Y } = frame;
  const grid = useMemo(() => pixelGrid(v, across), [v, across]);
  const fragments = useMemo(
    () =>
      rasterise(
        { type: subject.type, corners: subject.world, colours: subject.colours, uvs: subject.uvs, shading: subject.shading },
        grid,
        multisample,
      ),
    [subject, grid, multisample],
  );

  const pointsOf = (pts: Pt[]) => pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ');
  const prims = worldPrimitives(subject.type, subject.world);
  const volumeRect = (props: Record<string, unknown>) => (
    <rect x={X(v.minX)} y={Y(v.maxY)} width={(v.maxX - v.minX) * k} height={(v.maxY - v.minY) * k} {...props} />
  );

  // Each corner's coordinates go beside it, away from the shape's centre where that is clear of the edges.
  const centre = subject.world.reduce((c, p) => ({ x: c.x + p.x / subject.world.length, y: c.y + p.y / subject.world.length }), { x: 0, y: 0 });
  const labelled = subject.world.length <= MAX_LABELS;
  const edges = prims.flatMap((p) =>
    p.length >= 2 ? p.map((a, i) => [a, p[(i + 1) % p.length]] as const).slice(0, p.length === 2 ? 1 : p.length) : [],
  );
  /** How many sample points along the edges fall inside the label's box. */
  const hits = (x0: number, y0: number, tw: number) =>
    edges.reduce(
      (n, [a, b]) =>
        n +
        Array.from({ length: 25 }, (_, t) => ({ x: X(a.x + ((b.x - a.x) * t) / 24), y: Y(a.y + ((b.y - a.y) * t) / 24) })).filter(
          (q) => q.x >= x0 - 2 && q.x <= x0 + tw + 2 && q.y >= y0 - 10 && q.y <= y0 + 4,
        ).length,
      0,
    );
  const corner = (p: Pt, i: number) => {
    const text = `(${fmt(p.x)}, ${fmt(p.y)})`;
    const tw = text.length * LABEL_CHAR;
    const cx = X(p.x);
    const cy = Y(p.y);
    const spots = [false, true].flatMap((flipH) =>
      [false, true].map((flipV) => {
        const right = (p.x >= centre.x) !== flipH;
        const above = (p.y >= centre.y) !== flipV;
        return {
          x: Math.min(Math.max(right ? cx + 7 : cx - 7 - tw, 2), Math.max(2, w - tw - 2)),
          y: Math.min(Math.max(above ? cy - 8 : cy + 15, 11), h - 4),
        };
      }),
    );
    // The first spot with the fewest edge points under it, so the preferred side wins a tie.
    const spot = spots.reduce((best, q) => (hits(q.x, q.y, tw) < hits(best.x, best.y, tw) ? q : best), spots[0]);
    return (
      <g key={i}>
        <circle cx={cx} cy={cy} r={3} className="rv-dot" />
        {labelled && (
          <text x={spot.x} y={spot.y} className="rv-corner">
            {text}
          </text>
        )}
      </g>
    );
  };

  const cellW = ((v.maxX - v.minX) * k) / grid.cols;
  const cellH = ((v.maxY - v.minY) * k) / grid.rows;
  const cell = Math.min(cellW, cellH);
  /** Where the cells are too small to rule singly, every few cells, so it still reads as a grid. */
  const step = cell >= 3 ? 1 : Math.ceil(3 / Math.max(cell, 1e-6));
  const lines = [];
  for (let i = step; i < grid.cols; i += step) {
    const x = X(v.minX) + i * cellW;
    lines.push(<line key={`c${i}`} x1={x} y1={Y(v.maxY)} x2={x} y2={Y(v.minY)} />);
  }
  for (let j = step; j < grid.rows; j += step) {
    const y = Y(v.maxY) + j * cellH;
    lines.push(<line key={`r${j}`} x1={X(v.minX)} y1={y} x2={X(v.maxX)} y2={y} />);
  }
  const inset = cell >= 5 ? 0.5 : 0;
  const areas = prims.filter((p) => p.length >= 3);

  return (
    <div className="pedagogical-overlay raster-vector-view">
      <div className="rv-sheet">
        <div className="rv-panes">
          <section className="rv-pane rv-pane--vector">
            <h3>
              Vector<span className="rv-tag">the code</span>
            </h3>
            <p className="rv-copy">Corners and straight edges. Zoom in as far as you like: the edge stays exact.</p>
            <Drawing frame={frame} label="The shape as corners and straight edges">
              {volumeRect({ className: 'rv-volume', fill: 'none' })}
              {areas.length > 0 && (
                <g className="rv-tint">
                  {areas.map((p, i) => (
                    <polygon key={i} points={pointsOf(p)} />
                  ))}
                </g>
              )}
              {prims.map((p, i) =>
                p.length >= 3 ? (
                  <polygon key={i} className="rv-edge" points={pointsOf(p)} fill="none" />
                ) : p.length === 2 ? (
                  <line key={i} className="rv-edge" x1={X(p[0].x)} y1={Y(p[0].y)} x2={X(p[1].x)} y2={Y(p[1].y)} />
                ) : null,
              )}
              {subject.world.map(corner)}
            </Drawing>
          </section>

          <section className="rv-pane rv-pane--raster">
            <h3>
              Raster<span className="rv-tag">the screen</span>
            </h3>
            <p className="rv-copy">
              {`The same shape as ${grid.cols} × ${grid.rows} pixels.`}
              {multisample
                ? ' Multisampling tests 4 points per pixel, so edge pixels are partly filled.'
                : ' Each pixel is either in or out, so the edges step.'}
            </p>
            <Drawing frame={frame} label="The shape as pixels">
              <g className="rv-grid">
                {volumeRect({ fill: 'none' })}
                {lines}
              </g>
              {fragments.map((f) => (
                <rect
                  key={`${f.col},${f.row}`}
                  className="rv-frag"
                  x={X(v.minX) + f.col * cellW + inset}
                  y={Y(v.maxY) + f.row * cellH + inset}
                  width={Math.max(0, cellW - 2 * inset)}
                  height={Math.max(0, cellH - 2 * inset)}
                  opacity={f.coverage}
                />
              ))}
            </Drawing>
          </section>
        </div>

        <div className="rv-controls">
          <span className="rv-controls__group">
            <span className="rv-controls__label">Pixels across</span>
            <SegmentedControl
              label="Pixels across"
              mono
              options={ACROSS_OPTIONS}
              value={String(across)}
              onChange={(value) => setAcross(Number(value))}
            />
          </span>
          <span title="Your program turns this on in glutInitDisplayMode">
            <Switch className="rv-controls__switch" label="GLUT_MULTISAMPLE" checked={multisample} onChange={setMultisample} />
          </span>
        </div>
      </div>
    </div>
  );
}
