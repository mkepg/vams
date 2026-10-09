import { useMemo } from 'react';
import { useVamsStore } from '@/core/store';
import type { SceneNode, Vertex } from '@/core/types/scene';

function hexToRGB255(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgb255ToFloat([r, g, b]: [number, number, number]): [number, number, number] {
  return [r / 255, g / 255, b / 255];
}

function isLine(t: SceneNode['type']): boolean {
  return t === 'LINES' || t === 'LINE_STRIP' || t === 'LINE_LOOP';
}

/**
 * Color section — split into:
 *   1. A "stage" with a large swatch on the left and three R/G/B channel
 *      chips on the right (each chip uses the same hue convention as the
 *      pipeline panel's x/y axes — R red, G green, B blue).
 *   2. Two glColor* call cards stacked, with the float variant flagged as
 *      `result` to mirror the "result" treatment used in the Transforms
 *      composition trace.
 *   3. A faint conversion formula footer.
 */
function ColorConversion({ hex }: { hex: string }) {
  const [r, g, b] = hexToRGB255(hex);
  const [rf, gf, bf] = rgb255ToFloat([r, g, b]);

  return (
    <div className="primitives-color-conv">
      <div className="cc-stage">
        <div className="cc-swatch" style={{ background: hex }}>
          <span className="cc-swatch-hex">{hex.toUpperCase()}</span>
        </div>
        <div className="cc-channels">
          <div className="cc-chan r">
            <span className="cc-chan-label">R</span>
            <code className="cc-chan-byte">{r}</code>
            <span className="cc-chan-sep">·</span>
            <code className="cc-chan-float">{rf.toFixed(2)}f</code>
          </div>
          <div className="cc-chan g">
            <span className="cc-chan-label">G</span>
            <code className="cc-chan-byte">{g}</code>
            <span className="cc-chan-sep">·</span>
            <code className="cc-chan-float">{gf.toFixed(2)}f</code>
          </div>
          <div className="cc-chan b">
            <span className="cc-chan-label">B</span>
            <code className="cc-chan-byte">{b}</code>
            <span className="cc-chan-sep">·</span>
            <code className="cc-chan-float">{bf.toFixed(2)}f</code>
          </div>
        </div>
      </div>

      <div className="cc-calls">
        <div className="cc-call">
          <span className="cc-call-mode">glColor3ub</span>
          <code className="cc-call-args">({r}, {g}, {b})</code>
        </div>
        <div className="cc-call result">
          <span className="cc-call-mode">glColor3f</span>
          <code className="cc-call-args">
            ({rf.toFixed(2)}f, {gf.toFixed(2)}f, {bf.toFixed(2)}f)
          </code>
        </div>
      </div>

      <div className="cc-formula">
        <span className="cc-formula-label">conversion</span>
        <code>float = byte / 255.0</code>
      </div>
    </div>
  );
}

/**
 * Stipple — three rows: a stat header (hex / factor / lit count), the bits
 * themselves with the bit value printed inside each cell, and a "renders"
 * preview strip showing how the pattern would actually appear when drawn.
 *
 * The preview iterates each bit `factor` times since glLineStipple repeats
 * each bit `factor` pixels in the rasterizer — this is the feature that
 * `factor` actually controls, so we visualize it.
 */
function StippleBits({ pattern, factor }: { pattern: number; factor: number }) {
  const bits = useMemo(() => {
    const out: boolean[] = [];
    for (let i = 15; i >= 0; i--) out.push(((pattern >> i) & 1) === 1);
    return out;
  }, [pattern]);

  const hex = `0x${pattern.toString(16).toUpperCase().padStart(4, '0')}`;
  const onCount = bits.filter(Boolean).length;

  // Bit 0 is rendered first along the line, so the preview reads bit 0 → 15
  // (i.e. the reverse of the visual bit array).
  const previewBits = useMemo(() => {
    const out: boolean[] = [];
    for (let i = 0; i < 16; i++) out.push(((pattern >> i) & 1) === 1);
    return out;
  }, [pattern]);

  return (
    <div className="primitives-stipple">
      <div className="ps-header">
        <code className="ps-hex">{hex}</code>
        <div className="ps-meta-pill">
          <span className="ps-meta-label">factor</span>
          <code>×{factor}</code>
        </div>
        <div className="ps-meta-pill">
          <span className="ps-meta-num">{onCount}</span>
          <span className="ps-meta-total">/16 lit</span>
        </div>
      </div>

      <div className="ps-bits-stage">
        <div className="ps-bits">
          {bits.map((on, i) => (
            <span key={i} className={`ps-bit ${on ? 'on' : ''}`}>
              {on ? '1' : '0'}
            </span>
          ))}
        </div>
      </div>

      <div className="ps-preview">
        <span className="ps-preview-label">renders</span>
        <div className="ps-preview-line">
          {previewBits.map((on, bi) =>
            Array.from({ length: factor }).map((_, fi) => (
              <span key={`${bi}-${fi}`} className={`ps-pixel ${on ? 'on' : ''}`} />
            )),
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Barycentric mixer.
 *
 * For triangles (3 vertices) we draw a small SVG with three corner-anchored
 * radial gradients composited with `mix-blend-mode: screen` inside a
 * triangular clip. This is not a mathematically faithful reproduction of
 * barycentric interpolation (which would be a per-pixel weighted sum), but
 * it produces a continuous, intuition-correct gradient between the three
 * corner colors — much more illustrative than a list of swatches alone.
 *
 * For non-triangle multi-vertex primitives we fall back to the corner row
 * with the centroid result.
 */
function BarycentricMixer({ vertices }: { vertices: Vertex[] }) {
  if (vertices.length < 2) return null;

  let rSum = 0, gSum = 0, bSum = 0;
  vertices.forEach((v) => {
    const [r, g, b] = hexToRGB255(v.color);
    rSum += r;
    gSum += g;
    bSum += b;
  });

  const num = vertices.length;
  const avg: [number, number, number] = [
    Math.round(rSum / num),
    Math.round(gSum / num),
    Math.round(bSum / num),
  ];
  const avgHex = `#${avg.map((n) => n.toString(16).padStart(2, '0')).join('')}`;

  const getSubscript = (n: number) => {
    const subs = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
    return n.toString().split('').map((c) => subs[parseInt(c)]).join('');
  };

  const terms = vertices.map((_, i) => `w${getSubscript(i)}·C${getSubscript(i)}`).join(' + ');
  const weights = vertices.map((_, i) => `w${getSubscript(i)}`).join(' + ');

  const showTriangle = vertices.length === 3;

  return (
    <div className="primitives-bary">
      {showTriangle && (
        <div className="pb-mesh">
          <svg
            viewBox="0 0 220 160"
            className="pb-mesh-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="bary-c0" cx="50%" cy="10%" r="95%">
                <stop offset="0%" stopColor={vertices[0].color} stopOpacity="1" />
                <stop offset="100%" stopColor={vertices[0].color} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="bary-c1" cx="92%" cy="88%" r="95%">
                <stop offset="0%" stopColor={vertices[1].color} stopOpacity="1" />
                <stop offset="100%" stopColor={vertices[1].color} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="bary-c2" cx="8%" cy="88%" r="95%">
                <stop offset="0%" stopColor={vertices[2].color} stopOpacity="1" />
                <stop offset="100%" stopColor={vertices[2].color} stopOpacity="0" />
              </radialGradient>
              <clipPath id="bary-tri-clip">
                <polygon points="110,15 200,140 20,140" />
              </clipPath>
            </defs>

            <g clipPath="url(#bary-tri-clip)">
              <rect x="0" y="0" width="220" height="160" fill="#000" />
              <g style={{ mixBlendMode: 'screen' }}>
                <rect x="0" y="0" width="220" height="160" fill="url(#bary-c0)" />
                <rect x="0" y="0" width="220" height="160" fill="url(#bary-c1)" />
                <rect x="0" y="0" width="220" height="160" fill="url(#bary-c2)" />
              </g>
            </g>

            <polygon
              points="110,15 200,140 20,140"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1"
            />

            <g>
              <circle cx="110" cy="15" r="7" fill={vertices[0].color}
                stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" />
              <circle cx="200" cy="140" r="7" fill={vertices[1].color}
                stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" />
              <circle cx="20" cy="140" r="7" fill={vertices[2].color}
                stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" />

              <text x="121" y="19" textAnchor="start" className="pb-mesh-label" fontSize={10.5}>C₀</text>
              <text x="200" y="157" textAnchor="middle" className="pb-mesh-label" fontSize={10.5}>C₁</text>
              <text x="20" y="157" textAnchor="middle" className="pb-mesh-label" fontSize={10.5}>C₂</text>
            </g>
          </svg>
        </div>
      )}

      <div className="pb-formula">
        <code>C = {terms}</code>
        <span className="pb-note">{weights} = 1</span>
      </div>

      <div className="pb-corners">
        {vertices.map((v, i) => (
          <div key={v.id} className="pb-corner">
            <span className="pb-corner-swatch" style={{ background: v.color }} />
            <span className="pb-corner-label">C{i}</span>
          </div>
        ))}
        <span className="pb-arrow" aria-hidden>→</span>
        <div className="pb-corner pb-result">
          <span className="pb-corner-swatch" style={{ background: avgHex }} />
          <span className="pb-corner-label">centroid</span>
        </div>
      </div>
    </div>
  );
}

function VertexTable({ vertices }: { vertices: Vertex[] }) {
  if (vertices.length === 0) return null;

  return (
    <div className="primitives-vertex-table">
      <div className="pvt-head">
        <span>#</span>
        <span className="pvt-axis x">x</span>
        <span className="pvt-axis y">y</span>
        <span>color</span>
      </div>
      <div className="pvt-body">
        {vertices.map((v, i) => (
          <div key={v.id} className="pvt-row">
            <span className="pvt-i">V{i}</span>
            <code className="pvt-x">{v.x.toFixed(3)}</code>
            <code className="pvt-y">{v.y.toFixed(3)}</code>
            <span className="pvt-c">
              <span className="pvt-swatch" style={{ background: v.color }} />
              <code>{v.color.toUpperCase()}</code>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="math-section">
      <h4 className="math-section-title">{title}</h4>
      <div className="math-section-body">{children}</div>
    </div>
  );
}

export default function PrimitivesMathContent() {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);

  const selected = objects.find((o) => o.id === selectedObjectId);

  if (!selected) {
    return (
      <div className="empty-state">
        Select a primitive to see color conversions, vertex data, and (for line primitives) stipple breakdown.
      </div>
    );
  }

  if (selected.type === 'GROUP') {
    return (
      <div className="empty-state">
        Groups don't emit drawing calls of their own — select a primitive inside the group.
      </div>
    );
  }

  const firstColor = selected.vertices[0]?.color || '#ffffff';

  const isMultiColor =
    selected.vertices.length > 1 &&
    selected.vertices.some((v) => v.color !== selected.vertices[0].color);

  const showBarycentric = selected.type !== 'POINTS' && isMultiColor;

  return (
    <div className="primitives-math">
      <Section title="Color">
        <ColorConversion hex={firstColor} />
      </Section>

      {showBarycentric && (
        <Section title="Barycentric Interpolation">
          <BarycentricMixer vertices={selected.vertices} />
        </Section>
      )}

      {isLine(selected.type) && selected.lineStipple && (
        <Section title="Stipple Pattern">
          <StippleBits
            pattern={selected.lineStipple.pattern}
            factor={selected.lineStipple.factor}
          />
        </Section>
      )}

      <Section title="Vertices">
        <VertexTable vertices={selected.vertices} />
      </Section>
    </div>
  );
}