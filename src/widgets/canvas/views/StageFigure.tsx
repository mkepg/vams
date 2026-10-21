import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TextureWrap, UV } from '@/core/types/textures';
import { useVamsStore } from '@/core/store';
import { clipPolygon, clipSegment, figureFrame, worldPrimitives, type Pt } from '@/entities/scene/model/pipeline-geometry';
import { pixelGrid, rasterise, type Fragment } from '@/entities/scene/model/rasterise';
import type { Subject } from '../model/pipeline-subject';
import type { StageIndex } from '../model/stage-lines';

interface StageFigureProps {
  stage: StageIndex;
  subject: Subject;
  /** The drawing's width and height in CSS px. */
  size: number;
  /** Animate the change from the stage before, once. Reduced motion turns it off in the styles. */
  animate: boolean;
  /** Grow the frame by this share of the viewing volume on each side; the strip and focus use the default 20%. */
  margin?: number;
}

/** Stages 4 to 6 draw the shape on a grid this many pixels across the viewing volume. */
const ACROSS = 24;
/** Corner labels only while they stay readable. */
const MAX_LABELS = 12;

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// Decoded texture images, shared by every figure that shows the same image.
const decoded = new Map<string, Pixels | null>();

/** The texture's pixels, read through an offscreen canvas; null until loaded, or where no 2D context exists. */
function useTexturePixels(dataUrl: string | undefined): Pixels | null {
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (!dataUrl || decoded.has(dataUrl)) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      let pixels: Pixels | null = null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(img, 0, 0);
          pixels = { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
        }
      } catch {
        pixels = null;
      }
      decoded.set(dataUrl, pixels);
      if (live) setLoaded((n) => n + 1);
    };
    img.src = dataUrl;
    return () => {
      live = false;
    };
  }, [dataUrl]);
  return dataUrl ? (decoded.get(dataUrl) ?? null) : null;
}

/** The texel at a UV, nearest, wrapped as the shape's wrap mode says; v = 0 is the image's bottom row. */
function sample(px: Pixels, uv: UV, wrap: TextureWrap): string {
  const fold = (t: number) => (wrap === 'REPEAT' ? t - Math.floor(t) : Math.min(1, Math.max(0, t)));
  const x = Math.min(px.width - 1, Math.floor(fold(uv.u) * px.width));
  const y = Math.min(px.height - 1, Math.floor((1 - fold(uv.v)) * px.height));
  const i = (y * px.width + x) * 4;
  return `rgb(${px.data[i]}, ${px.data[i + 1]}, ${px.data[i + 2]})`;
}

const rgb = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** The primitives inside the viewing volume: polygons cut at its edges, segments shortened, points outside dropped. */
function clipped(prims: Pt[][], v: Subject['volume']): Pt[][] {
  return prims.flatMap((p) => {
    if (p.length === 1) return p[0].x >= v.minX && p[0].x <= v.maxX && p[0].y >= v.minY && p[0].y <= v.maxY ? [p] : [];
    if (p.length === 2) {
      const seg = clipSegment(p[0], p[1], v);
      return seg ? [seg] : [];
    }
    const poly = clipPolygon(p, v);
    return poly.length >= 3 ? [poly] : [];
  });
}

/**
 * One stage of the pipeline, drawn from the subject's own corners on its viewing volume plus a margin.
 * Pure SVG, so it reads the same in both themes through the tokens.
 */
export default function StageFigure({ stage, subject, size, animate, margin }: StageFigureProps) {
  const small = size < 100;
  const frame = (() => {
    if (margin === undefined) return figureFrame(subject.volume);
    const v0 = subject.volume;
    const dx = (v0.maxX - v0.minX) * margin;
    const dy = (v0.maxY - v0.minY) * margin;
    return { minX: v0.minX - dx, maxX: v0.maxX + dx, minY: v0.minY - dy, maxY: v0.maxY + dy };
  })();
  const fw = frame.maxX - frame.minX;
  const fh = frame.maxY - frame.minY;
  const k0 = size / Math.max(fw, fh);
  const k = Number.isFinite(k0) && k0 > 0 ? k0 : 1;
  const w = Math.min(size, fw * k);
  const h = Math.min(size, fh * k);
  const X = (x: number) => (x - frame.minX) * k;
  const Y = (y: number) => (frame.maxY - y) * k;
  const v = subject.volume;

  const textureUrl = useVamsStore((s) => (subject.texture ? s.getTextureById(subject.texture.textureId)?.dataUrl : undefined));
  const texels = useTexturePixels(textureUrl);

  const fragments = useMemo<Fragment[]>(
    () =>
      stage >= 4
        ? rasterise(
            { type: subject.type, corners: subject.world, colours: subject.colours, uvs: subject.uvs, shading: subject.shading },
            pixelGrid(subject.volume, ACROSS),
            false,
          )
        : [],
    [stage, subject],
  );

  const r = small ? 2 : 3.2;
  const edge = small ? 1 : 1.5;
  const labels = !small && subject.stored.length <= MAX_LABELS;
  const anim = (name: string) => (animate ? name : undefined);

  const pointsOf = (pts: Pt[]) => pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ');
  /** Each primitive's outline: a polygon, a segment, or nothing for a point. */
  const outlines = (prims: Pt[][], props: Record<string, unknown>, cls?: string) =>
    prims.map((p, i) =>
      p.length >= 3 ? (
        <polygon key={i} className={cls} points={pointsOf(p)} fill="none" {...props} />
      ) : p.length === 2 ? (
        <line key={i} className={cls} x1={X(p[0].x)} y1={Y(p[0].y)} x2={X(p[1].x)} y2={Y(p[1].y)} {...props} />
      ) : null,
    );
  /** Filled areas share one group opacity, so overlapping primitives don't darken each other. */
  const fills = (prims: Pt[][], cls?: string) => (
    <g className={['stage-figure__tint', cls].filter(Boolean).join(' ')}>
      {prims.filter((p) => p.length >= 3).map((p, i) => <polygon key={i} points={pointsOf(p)} />)}
    </g>
  );
  const dots = (pts: Pt[], radius: number, fill: string, withLabels: boolean, style?: (i: number) => CSSProperties, cls?: string) =>
    pts.map((p, i) => (
      <g key={i} className={cls} style={style?.(i)}>
        <circle cx={X(p.x)} cy={Y(p.y)} r={radius} fill={fill} />
        {withLabels && (
          <text x={X(p.x) + 6} y={Y(p.y) - 6} className="stage-figure__label">
            v{i}
          </text>
        )}
      </g>
    ));
  const volumeRect = (props: Record<string, unknown>) => (
    <rect x={X(v.minX)} y={Y(v.maxY)} width={(v.maxX - v.minX) * k} height={(v.maxY - v.minY) * k} {...props} />
  );
  const dashed = { fill: 'none', stroke: 'var(--rule-strong)', strokeDasharray: '3 3' };

  const grid = pixelGrid(subject.volume, ACROSS);
  const cellW = ((v.maxX - v.minX) * k) / grid.cols;
  const cellH = ((v.maxY - v.minY) * k) / grid.rows;
  /** The pixel grid. Where its cells are too small to rule singly, every few cells, so it still reads as a grid. */
  const gridLines = () => {
    const cell = Math.min(cellW, cellH);
    const step = cell >= 4 ? 1 : Math.ceil(4 / Math.max(cell, 1e-6));
    const lines = [];
    for (let i = step; i < grid.cols; i += step) {
      const x = X(v.minX) + i * cellW;
      lines.push(<line key={`c${i}`} x1={x} y1={Y(v.maxY)} x2={x} y2={Y(v.minY)} />);
    }
    for (let j = step; j < grid.rows; j += step) {
      const y = Y(v.maxY) + j * cellH;
      lines.push(<line key={`r${j}`} x1={X(v.minX)} y1={y} x2={X(v.maxX)} y2={y} />);
    }
    return (
      <g className="stage-figure__grid">
        {volumeRect({ fill: 'none' })}
        {lines}
      </g>
    );
  };
  const colourOf = (f: Fragment, coloured: boolean) => {
    if (!coloured) return 'var(--ink-muted)';
    if (subject.texture && textureUrl) return texels && f.uv ? sample(texels, f.uv, subject.texture.wrap) : 'var(--ink-muted)';
    return rgb(f.rgb);
  };
  const inset = Math.min(cellW, cellH) >= 5 ? 0.5 : 0;
  const pixels = (coloured: boolean) =>
    fragments.map((f) => (
      <rect
        key={`${f.col},${f.row}`}
        className={anim('stage-figure__pop')}
        style={animate ? { animationDelay: `${((f.row / grid.rows) * 0.35).toFixed(3)}s` } : undefined}
        x={X(v.minX) + f.col * cellW + inset}
        y={Y(v.maxY) + f.row * cellH + inset}
        width={Math.max(0, cellW - 2 * inset)}
        height={Math.max(0, cellH - 2 * inset)}
        fill={colourOf(f, coloured)}
        opacity={f.coverage}
      />
    ));

  const stored = worldPrimitives(subject.type, subject.stored);
  const world = worldPrimitives(subject.type, subject.world);
  const kept = stage >= 3 ? clipped(world.length > 0 ? world : subject.world.map((p) => [p]), v) : [];

  let body;
  switch (stage) {
    case 0:
      body = (
        <>
          {volumeRect(dashed)}
          {dots(subject.stored, r, 'var(--ink)', labels, (i) => ({ animationDelay: `${((i / subject.stored.length) * 0.35).toFixed(3)}s` }), anim('stage-figure__pop'))}
        </>
      );
      break;
    case 1:
      body = (
        <>
          {volumeRect(dashed)}
          {outlines(stored, { stroke: 'var(--rule-strong)', strokeDasharray: '2 3' })}
          {dots(subject.stored, r * 0.7, 'var(--rule-strong)', false)}
          {dots(
            subject.world,
            r,
            'var(--ink)',
            labels,
            (i) =>
              ({
                '--dx': `${X(subject.stored[i].x) - X(subject.world[i].x)}px`,
                '--dy': `${Y(subject.stored[i].y) - Y(subject.world[i].y)}px`,
              }) as CSSProperties,
            anim('stage-figure__move'),
          )}
        </>
      );
      break;
    case 2:
      body = (
        <>
          {volumeRect(dashed)}
          {fills(world, anim('stage-figure__fade'))}
          {outlines(world, { stroke: 'var(--ink)', strokeWidth: edge, strokeLinejoin: 'round' })}
          {dots(subject.world, r, 'var(--ink)', false)}
        </>
      );
      break;
    case 3:
      body = (
        <>
          {volumeRect({ fill: 'none', stroke: 'var(--ink)', strokeWidth: 1 })}
          {outlines(world, { stroke: 'var(--rule-strong)', strokeDasharray: '2 3' })}
          {fills(kept, anim('stage-figure__fade'))}
          {outlines(kept, { stroke: 'var(--ink)', strokeWidth: edge, strokeLinejoin: 'round' })}
          {dots(kept.flat(), r, 'var(--ink)', false)}
        </>
      );
      break;
    case 4:
      body = (
        <>
          {gridLines()}
          {pixels(false)}
          {outlines(kept, { stroke: 'var(--accent-text)', strokeWidth: 1, strokeLinejoin: 'round' })}
        </>
      );
      break;
    case 5:
      body = (
        <>
          {gridLines()}
          {pixels(true)}
        </>
      );
      break;
    case 6:
      body = (
        <>
          {volumeRect({ fill: subject.background, className: anim('stage-figure__fade') })}
          {pixels(true)}
        </>
      );
      break;
  }

  return (
    <svg
      className="stage-figure"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* The frame is centred; a nested svg cuts off whatever lies beyond it. */}
      <svg x={(size - w) / 2} y={(size - h) / 2} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">
        <g key={stage}>{body}</g>
      </svg>
    </svg>
  );
}
