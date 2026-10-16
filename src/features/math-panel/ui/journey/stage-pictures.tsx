import { useId } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import type { JourneyStageId } from '@/core/inspector';
import type { PrimitiveType, SceneNode, ViewportLimits } from '@/core/types/scene';
import { assemblyFor, primitivesOf, provokingVertex } from '@/entities/scene/model/primitive-assembly';
import BuffersMathContent from '../BuffersMathContent';
import PipelineMathContent from '../PipelineMathContent';
import TexturesMathContent from '../TexturesMathContent';
import { BarycentricMixer, ColorConversion, isLine, PrimitivesSection, StippleBits, VertexTable } from '../PrimitivesMathContent';
import { buildMatrix4, getAncestorChain, Matrix4, MatrixStack, OrthoMapping, TransformsSection, TRSCompositionTrace } from '../TransformsMathContent';
import { fmt, int, short, whole } from '@/shared/lib/format-number';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import type { JourneyStage, Point } from '../../model/vertex-journey';

/** A labelled picture under the working. */
export function Picture({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <figure className="journey-picture">
      <figcaption className="journey-picture__label">{label}</figcaption>
      {children}
    </figure>
  );
}

/** The object's own transform as one 3 × 3 matrix, with the move column in amber. */
function MatrixPicture({ node }: { node: SceneNode }) {
  const m = buildMatrix4(node.transform);
  const cells = [
    [m[0][0], m[0][1], m[0][3]],
    [m[1][0], m[1][1], m[1][3]],
    [0, 0, 1],
  ];
  return (
    <Picture label="As one matrix">
      <div className="journey-picture__box">
        <div className="journey-matrix" role="img" aria-label="The transform as one matrix">
          {cells.flatMap((rowCells, r) =>
            rowCells.map((v, c) => (
              <span key={`${r}-${c}`} className={c === 2 && r < 2 ? 'is-value' : undefined}>{r === 2 ? whole(v) : fmt(v)}</span>
            )),
          )}
        </div>
        <p className="journey-picture__caption">M = T · R · S. The last column is your move; the rest is your rotate and scale.</p>
      </div>
    </Picture>
  );
}

/** One decimal with a true minus sign: 372.1, −12.3. */
const short1 = (n: number) => n.toFixed(1).replace('-', '−');

const signed = (a: string, b: number) => (b < 0 ? `${a} + ${whole(-b)}` : `${a} − ${whole(b)}`);

/** glOrtho's formula with the student's numbers in it. */
function OrthoFormula({ world, limits, ndc, widened }: { world: Point; limits: ViewportLimits; ndc: Point; widened: boolean }) {
  const line = (axis: 'x' | 'y', v: number, lo: number, hi: number, out: number) => (
    <>
      {axis}' = 2({axis} − {axis === 'x' ? 'l' : 'b'})/({axis === 'x' ? 'r − l' : 't − b'}) − 1
      <br />
      {'   '}= 2({signed(fmt(v), lo)})/({signed(whole(hi), lo)}) − 1 = <span className="is-value">{fmt(out)}</span>
    </>
  );
  const unit = limits.minX === -1 && limits.maxX === 1 && limits.minY === -1 && limits.maxY === 1;
  return (
    <Picture label="The formula, with your numbers">
      <p className="journey-formula">
        {line('x', world.x, limits.minX, limits.maxX, ndc.x)}
        <br />
        {line('y', world.y, limits.minY, limits.maxY, ndc.y)}
      </p>
      <p className="journey-picture__caption">
        {widened
          ? 'The reshape callback widened your volume to match the window’s shape, so the numbers change on the way in.'
          : unit
          ? 'Your volume is already −1 to 1, so the numbers don’t change. Widen it in Settings and they will.'
          : 'Your volume is wider or narrower than −1 to 1, so the numbers change on the way in.'}
      </p>
    </Picture>
  );
}

/** NDC to a window pixel, with the student's numbers. The pixel is the stage's own, so the arithmetic lives once. */
function PixelFormula({ ndc, pixel, canvas }: { ndc: Point; pixel: Point; canvas: { width: number; height: number } }) {
  const line = (axis: 'x' | 'y', v: number, size: number, out: number) => {
    // The unrounded value, then the pixel it falls in; the arrow is dropped when they read the same.
    const raw = ((v + 1) / 2) * size;
    // Truncated, not rounded, so the shown value never crosses into the next pixel.
    const cut = Math.floor(raw * 10) / 10;
    const rawText = Number.isInteger(cut) ? int(cut) : short1(cut);
    return (
    <>
      {axis} = ({axis} + 1) / 2 · {axis === 'x' ? 'width' : 'height'}
      <br />
      {'  '}= ({fmt(v)} + 1) / 2 · {size} = {rawText === int(out) ? null : <>{rawText} → </>}<span className="is-value">{int(out)}</span>
    </>
    );
  };
  return (
    <Picture label="The formula, with your numbers">
      <p className="journey-formula">
        {line('x', ndc.x, canvas.width, pixel.x)}
        <br />
        {line('y', ndc.y, canvas.height, pixel.y)}
      </p>
      <p className="journey-picture__caption">The pixel is the whole number at or below it; a vertex exactly on the far edge takes the last pixel.</p>
    </Picture>
  );
}

/**
 * Maps some of a shape's vertices into a box `width` × `height` whose top-left is (left, top),
 * centred and keeping proportions, with y pointing up as in the scene.
 */
function fitInBox(vertices: readonly { x: number; y: number }[], box: { left: number; top: number; width: number; height: number }) {
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(Math.max(...xs) - minX, 1e-6);
  const spanY = Math.max(Math.max(...ys) - minY, 1e-6);
  const scale = Math.min(box.width / spanX, box.height / spanY);
  return {
    at: (v: { x: number; y: number }) => ({
      x: box.left + (v.x - minX) * scale + (box.width - spanX * scale) / 2,
      y: box.top + box.height - (v.y - minY) * scale - (box.height - spanY * scale) / 2,
    }),
  };
}

/** The object's shape, small: each primitive outlined, the ones holding the vertex shaded, the vertex ringed. */
function ShapeSketch({ node, vertex }: { node: SceneNode; vertex: number }) {
  const n = node.vertices.length;
  if (n === 0) return null;
  const fit = fitInBox(node.vertices, { left: 6, top: 6, width: 84, height: 68 });
  const mapped = node.vertices.map((v) => fit.at(v));
  const at = (k: number) => mapped[k];
  const i = Math.min(Math.max(0, vertex), n - 1);
  const type = node.type as PrimitiveType;
  const prims = primitivesOf(type, n);
  const held = prims.some((members) => members.includes(i));
  const caption = !held
    ? 'This vertex is left over, so nothing is drawn for it.'
    : type === 'POINTS'
      ? 'Your vertex is ringed; the point it makes is highlighted.'
      : type.startsWith('LINE')
        ? 'Your vertex is ringed; the lines it belongs to are highlighted.'
        : 'Your vertex is ringed; the shapes it belongs to are shaded.';
  const points = (members: number[]) => members.map((k) => `${at(k).x},${at(k).y}`).join(' ');
  return (
    <Picture label="Your shape">
      <div className="journey-picture__box">
        <svg className="journey-sketch" width="96" height="80" viewBox="0 0 96 80" role="img" aria-label={`${node.name}, with vertex ${i + 1} ringed`}>
          {prims.map((members, j) => {
            const holds = members.includes(i);
            if (type === 'POINTS') return <circle key={j} cx={at(members[0]).x} cy={at(members[0]).y} r={holds ? 3 : 2} className={`journey-sketch__point${holds ? ' is-held' : ''}`} />;
            if (members.length === 2) {
              const [a, b] = members.map(at);
              return <line key={j} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`journey-sketch__edge${holds ? ' is-held' : ''}`} />;
            }
            return <polygon key={j} points={points(members)} className={`journey-sketch__face${holds ? ' is-held' : ''}`} />;
          })}
          <circle cx={at(i).x} cy={at(i).y} r="4.5" className="journey-sketch__ring" />
        </svg>
        <p className="journey-picture__caption">{caption}</p>
      </div>
    </Picture>
  );
}

const FILLED: readonly string[] = ['TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN', 'QUADS', 'QUAD_STRIP', 'POLYGON'];

/** The primitive the vertex belongs to, each corner's colour fading in from its corner, the vertex ringed. */
function FacePicture({ node, vertex }: { node: SceneNode; vertex: number }) {
  const baseId = useId();
  const n = node.vertices.length;
  if (n === 0) return null;
  const i = Math.min(Math.max(0, vertex), n - 1);
  const type = node.type as PrimitiveType;
  const members = assemblyFor(type, i, n).members[0];
  if (!members || members.length < 3) return null;
  const box = { left: 6, top: 4, width: 84, height: 72 };
  const fit = fitInBox(members.map((k) => node.vertices[k]), box);
  const at = (k: number) => fit.at(node.vertices[k]);
  const points = members.map((k) => `${at(k).x},${at(k).y}`).join(' ');
  const flat = node.shading === 'FLAT';
  const flatColour = node.vertices[provokingVertex(type, i, n)]?.color ?? '#ffffff';
  // Each corner's colour runs from the corner toward the middle of the others and is gone by the nearest of them,
  // so it never tints another corner.
  const fade = (k: number) => {
    const others = members.filter((m) => m !== k).map(at);
    const cx = others.reduce((sum, o) => sum + o.x, 0) / others.length;
    const cy = others.reduce((sum, o) => sum + o.y, 0) / others.length;
    const from = at(k);
    const len = Math.hypot(cx - from.x, cy - from.y) || 1;
    const ux = (cx - from.x) / len;
    const uy = (cy - from.y) / len;
    const reach = Math.max(1, Math.min(...others.map((o) => (o.x - from.x) * ux + (o.y - from.y) * uy)));
    return { x1: from.x, y1: from.y, x2: from.x + ux * reach, y2: from.y + uy * reach };
  };
  return (
    <Picture label="Across the face">
      <div className="journey-picture__box">
        <svg className="journey-face" width="96" height="80" viewBox="0 0 96 80" role="img" aria-label={`${node.name}, ${flat ? 'flat' : 'smooth'} shading, with vertex ${i + 1} ringed`}>
          {!flat && <defs>
            {members.map((k) => (
              <linearGradient key={k} id={`${baseId}-${k}`} gradientUnits="userSpaceOnUse" {...fade(k)}>
                <stop offset="0" stopColor={node.vertices[k].color} />
                <stop offset="1" stopColor={node.vertices[k].color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>}
          {flat ? (
            <polygon points={points} fill={flatColour} />
          ) : (
            <>
              <polygon points={points} className="journey-face__base" />
              {members.map((k) => <polygon key={k} points={points} fill={`url(#${baseId}-${k})`} />)}
            </>
          )}
          <circle cx={at(i).x} cy={at(i).y} r="4.5" className="journey-face__ring" />
        </svg>
        <p className="journey-picture__caption">
          {flat
            ? 'With flat shading the whole shape takes one vertex’s colour.'
            : 'Your vertex sits at a corner, so it keeps its own colour. Pixels further in blend toward the others.'}
        </p>
      </div>
    </Picture>
  );
}

interface PicturesProps {
  stage: JourneyStage;
  node: SceneNode | undefined;
  /** Deeper detail, shown under the pictures when the student opens it. */
  deeper: boolean;
  /** Id of the deeper-detail region, which the toggle controls. */
  deeperId: string;
  /** For Projected: where the vertex was before projection. */
  world: Point | null;
  /** For Rasterised: the Projected point, in NDC. */
  ndc: Point | null;
}

/** Deeper detail each stage offers, by label; none for the stages whose cards are all shown. */
export const DEEPER_LABEL: Partial<Record<JourneyStageId, string>> = {
  transformed: 'Full 4×4',
  projected: 'Viewing volume',
};

export function StagePictures({ stage, node, deeper, deeperId, world, ndc }: PicturesProps) {
  const objects = useVamsStore((s) => s.objects);
  const storeLimits = useVamsStore((s) => s.viewportLimits);
  // The volume the program's glOrtho receives, once a reshape handler has widened it.
  const volume = stage.volume?.limits ?? storeLimits;
  const vertex = useVamsStore((s) => s.journeyVertex);
  const canvas = useCanvasSize();
  const shape = node && node.type !== 'GROUP' && node.type !== 'TEXT' ? node : undefined;
  switch (stage.id) {
    case 'stored':
      // With nothing selected the follow row already says what to do.
      return node ? <BuffersMathContent /> : null;
    case 'transformed': {
      if (!node) return null;
      const chain = getAncestorChain(node.id, objects);
      // The Transforms cards' styles live under .transforms-math (_transforms-math.scss).
      return (
        <div className="transforms-math">
          <MatrixPicture node={node} />
          {chain.length > 1 && (
            <Picture label="Matrix stack">
              <p className="journey-picture__caption">
                Walking from the root down to <code>{node.name}</code>. Each
                <code> glPushMatrix</code> stacks a new local frame on top of its parent.
              </p>
              <MatrixStack chain={chain} />
            </Picture>
          )}
          {deeper && (
            <div id={deeperId}>
            <TransformsSection title="Selected Matrix (4×4)">
              <p className="explanation">
                Composed in conventional <strong>T · R · S</strong> order, then multiplied with
                every vertex during rendering.
              </p>
              <TRSCompositionTrace t={node.transform} />
              <Matrix4 m={buildMatrix4(node.transform)} />
            </TransformsSection>
            </div>
          )}
        </div>
      );
    }
    case 'projected':
      return (
        <div className="transforms-math">
          {world && stage.point && <OrthoFormula world={world} limits={volume} ndc={stage.point} widened={stage.volume?.widened ?? false} />}
          {(deeper || !node) && (
            <div id={deeperId}>
            <TransformsSection title="glOrtho — Viewing Volume">
              <p className="explanation">
                <code>glOrtho</code> defines the rectangle of world space that maps to the visible
                window. Anything outside is clipped.
              </p>
              <OrthoMapping limits={volume} />
            </TransformsSection>
            </div>
          )}
        </div>
      );
    case 'assembled':
      if (!shape) return null;
      return (
        <div className="primitives-math">
          <ShapeSketch node={shape} vertex={vertex} />
          <PrimitivesSection title="Vertices">
            <VertexTable vertices={shape.vertices} />
          </PrimitivesSection>
          {isLine(shape.type) && shape.lineStipple && (
            <PrimitivesSection title="Stipple Pattern">
              <StippleBits pattern={shape.lineStipple.pattern} factor={shape.lineStipple.factor} />
            </PrimitivesSection>
          )}
          {isLine(shape.type) && (
            <p className="journey-picture__caption">Each line is drawn {short(shape.lineWidth ?? 1)} {(shape.lineWidth ?? 1) === 1 ? 'pixel' : 'pixels'} wide, set by glLineWidth.</p>
          )}
          {shape.type === 'POINTS' && (
            <p className="journey-picture__caption">Each point is drawn 8 pixels wide, set by glPointSize.</p>
          )}
        </div>
      );
    case 'rasterised':
      return (
        <>
          {stage.point && ndc && <PixelFormula ndc={ndc} pixel={stage.point} canvas={canvas} />}
          <PipelineMathContent />
        </>
      );
    case 'coloured': {
      if (!node || node.type === 'GROUP') return null;
      if (node.texture) return <TexturesMathContent />;
      const multi = node.vertices.length > 1 && node.vertices.some((v) => v.color !== node.vertices[0].color);
      return (
        <div className="primitives-math">
          {FILLED.includes(node.type) && <FacePicture node={node} vertex={vertex} />}
          <PrimitivesSection title="Color">
            <ColorConversion hex={node.vertices[0]?.color ?? '#ffffff'} />
          </PrimitivesSection>
          {node.type !== 'POINTS' && multi && (
            <PrimitivesSection title="Barycentric Interpolation">
              <BarycentricMixer vertices={node.vertices} />
            </PrimitivesSection>
          )}
        </div>
      );
    }
  }
}
