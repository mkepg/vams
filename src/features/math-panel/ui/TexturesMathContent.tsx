import { useVamsStore } from '@/core/store';

const TEXTURABLE_TYPES = new Set([
  'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN',
  'QUADS', 'QUAD_STRIP', 'POLYGON',
]);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="math-section">
      <h4 className="math-section-title">{title}</h4>
      <div className="math-section-body">{children}</div>
    </div>
  );
}

/**
 * Bindings — three accent-bordered cards, each with a key, the GL constant
 * name in monospace, and a one-word "what does this mean" subtitle so the
 * panel reads at a glance ("smooth", "tile forever", etc.) without needing
 * to recall the semantics of GL_LINEAR vs GL_NEAREST.
 */
function TextureBindings({
  texName,
  texSize,
  filter,
  wrap,
}: {
  texName: string;
  texSize: string;
  filter: 'NEAREST' | 'LINEAR';
  wrap: 'REPEAT' | 'CLAMP_TO_EDGE';
}) {
  return (
    <div className="tx-bindings">
      <div className="tx-binding-card tex">
        <span className="tx-binding-key">Texture</span>
        <strong className="tx-binding-val">{texName}</strong>
        <code className="tx-binding-meta">{texSize}</code>
      </div>
      <div className="tx-binding-card filter">
        <span className="tx-binding-key">Filter</span>
        <strong className="tx-binding-val">
          {filter === 'NEAREST' ? 'GL_NEAREST' : 'GL_LINEAR'}
        </strong>
        <code className="tx-binding-meta">
          {filter === 'NEAREST' ? 'pixelated' : 'smooth'}
        </code>
      </div>
      <div className="tx-binding-card wrap">
        <span className="tx-binding-key">Wrap</span>
        <strong className="tx-binding-val">
          {wrap === 'CLAMP_TO_EDGE' ? 'GL_CLAMP_TO_EDGE' : 'GL_REPEAT'}
        </strong>
        <code className="tx-binding-meta">
          {wrap === 'CLAMP_TO_EDGE' ? 'stretch edges' : 'tile forever'}
        </code>
      </div>
    </div>
  );
}

/**
 * UV-space plot. The (u, v) plane is drawn as a 100×100 unit square with
 * the GL convention (origin at bottom-left, +v upward), points scattered
 * inside, and connecting polygon edges if there are 3+ vertices.
 */
function UVSpacePlot({ uvs }: { uvs: { u: number; v: number }[] }) {
  return (
    <div className="tx-uv-plot">
      <svg viewBox="-18 -10 138 130" className="tx-uv-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="tx-uv-grid" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="rgba(255,255,255,0.018)" />
            <path d="M 10 0 L 0 0 0 10" fill="none"
              stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#tx-uv-grid)" />
        <rect x="0" y="0" width="100" height="100"
          fill="none"
          stroke="rgba(96,165,250,0.55)"
          strokeWidth="0.8" />

        <text x="-2" y="103" textAnchor="end" className="tx-uv-axis" fontSize={7}>0</text>
        <text x="100" y="112" textAnchor="middle" className="tx-uv-axis" fontSize={7}>u → 1</text>
        <text x="-2" y="2" textAnchor="end" className="tx-uv-axis" fontSize={7}>1</text>
        <text x="-12" y="55" textAnchor="middle" className="tx-uv-axis" fontSize={7}
          style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>v</text>

        {uvs.length >= 3 && (
          <polygon
            points={uvs.map((uv) => `${uv.u * 100},${(1 - uv.v) * 100}`).join(' ')}
            fill="rgba(var(--accent-blue-rgb), 0.16)"
            stroke="var(--accent-blue-light)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        )}

        {uvs.map((uv, i) => (
          <g key={i}>
            <circle
              cx={uv.u * 100}
              cy={(1 - uv.v) * 100}
              r="2.6"
              fill="var(--accent-blue-light)"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth="0.8"
            />
            <text
              x={uv.u * 100 + 3.5}
              y={(1 - uv.v) * 100 - 3.5}
              className="tx-uv-pt-label" fontSize={7}
            >
              {i}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Sampling diagram.
 *
 * NEAREST — 3×3 texel grid with the centre highlighted to show the single
 * texel that wins regardless of where in its area the sample falls.
 *
 * LINEAR — 2×2 texel grid with a sample dot in the middle. The four
 * surrounding texels are shown as the contributors that get blended by
 * fractional distance; the alpha/beta weights live in the equation block.
 */
function SamplingDiagram({ filter }: { filter: 'NEAREST' | 'LINEAR' }) {
  if (filter === 'NEAREST') {
    return (
      <div className="tx-sampling nearest">
        <div className="tx-texel-grid grid-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={`tx-texel ${i === 4 ? 'picked' : ''}`}>
              {i === 4 && <span className="tx-texel-dot" aria-hidden />}
            </div>
          ))}
        </div>
        <div className="tx-sampling-foot">
          1 texel chosen — sharp, blocky scaling
        </div>
      </div>
    );
  }

  return (
    <div className="tx-sampling linear">
      <div className="tx-texel-grid grid-2">
        <div className="tx-texel weighted tl"><span>T[i,j+1]</span></div>
        <div className="tx-texel weighted tr"><span>T[i+1,j+1]</span></div>
        <div className="tx-texel weighted bl"><span>T[i,j]</span></div>
        <div className="tx-texel weighted br"><span>T[i+1,j]</span></div>
        <div className="tx-sample-marker" aria-hidden>
          <span className="tx-sample-dot" />
        </div>
      </div>
      <div className="tx-sampling-foot">
        4 texels blended by α, β — smooth gradient
      </div>
    </div>
  );
}

/**
 * Wrap-mode strip — three horizontal bands. The middle band is the
 * canonical [0,1] tile; left and right show what happens outside that
 * range. REPEAT shows the tile repeating, CLAMP_TO_EDGE shows the edge
 * colors stretched flat. The visual itself is the explanation.
 */
function WrapStrip({ wrap }: { wrap: 'REPEAT' | 'CLAMP_TO_EDGE' }) {
  return (
    <div className={`tx-wrap-strip mode-${wrap.toLowerCase()}`}>
      <div className="tx-wrap-band before" aria-hidden />
      <div className="tx-wrap-band core">
        <span className="tx-wrap-core-tag">[0, 1]</span>
      </div>
      <div className="tx-wrap-band after" aria-hidden />
      <div className="tx-wrap-foot">
        <span>u &lt; 0</span>
        <span>u &gt; 1</span>
      </div>
    </div>
  );
}

/**
 * Triangle UV diagram. Shows the geometric triangle in panel space with
 * each corner labeled by its (u, v) value, plus a single sample point
 * inside annotated with the barycentric blend formula. This is the visual
 * counterpart to the equation in the same section.
 */
function TriangleUVDiagram({ uvs }: { uvs: { u: number; v: number }[] }) {
  if (uvs.length < 3) return null;
  const [uv0, uv1, uv2] = uvs;
  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="tx-tri">
      <svg viewBox="0 0 240 175" className="tx-tri-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="tx-tri-grad" x1="50%" y1="10%" x2="50%" y2="95%">
            <stop offset="0%" stopColor="rgba(96,165,250,0.42)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0.08)" />
          </linearGradient>
        </defs>

        <polygon
          points="120,18 215,150 25,150"
          fill="url(#tx-tri-grad)"
          stroke="var(--accent-blue-light)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        <line x1="120" y1="18" x2="120" y2="105"
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" strokeDasharray="2 2" />
        <line x1="215" y1="150" x2="120" y2="105"
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" strokeDasharray="2 2" />
        <line x1="25" y1="150" x2="120" y2="105"
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" strokeDasharray="2 2" />

        <circle cx="120" cy="18" r="5" fill="var(--accent-blue-light)"
          stroke="rgba(0,0,0,0.55)" strokeWidth="1.2" />
        <circle cx="215" cy="150" r="5" fill="var(--accent-blue-light)"
          stroke="rgba(0,0,0,0.55)" strokeWidth="1.2" />
        <circle cx="25" cy="150" r="5" fill="var(--accent-blue-light)"
          stroke="rgba(0,0,0,0.55)" strokeWidth="1.2" />

        <text x="120" y="10" textAnchor="middle" className="tx-tri-corner" fontSize={10.5}>
          ({fmt(uv0.u)}, {fmt(uv0.v)})
        </text>
        <text x="232" y="169" textAnchor="end" className="tx-tri-corner" fontSize={10.5}>
          ({fmt(uv1.u)}, {fmt(uv1.v)})
        </text>
        <text x="8" y="169" textAnchor="start" className="tx-tri-corner" fontSize={10.5}>
          ({fmt(uv2.u)}, {fmt(uv2.v)})
        </text>

        <circle cx="120" cy="105" r="4" fill="white"
          stroke="var(--accent-blue-light)" strokeWidth="1.5" />
        <text x="120" y="125" textAnchor="middle" className="tx-tri-sample" fontSize={10.5}>
          λ₀C₀ + λ₁C₁ + λ₂C₂
        </text>
      </svg>
    </div>
  );
}

export default function TexturesMathContent() {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const getTextureById = useVamsStore((s) => s.getTextureById);

  const selected = objects.find((o) => o.id === selectedObjectId);

  if (!selected || !TEXTURABLE_TYPES.has(selected.type)) {
    return (
      <div className="empty-state">
        Select a fillable primitive — triangle, quad, or polygon — to see how
        its UV coordinates and sampling rules turn pixels into surface color.
      </div>
    );
  }

  if (!selected.texture || !selected.uvs) {
    return (
      <div className="empty-state">
        {selected.name} has no texture attached yet — apply one from the library
        to inspect its UV mapping and sampler equations.
      </div>
    );
  }

  const tex = getTextureById(selected.texture.textureId);
  const filter = selected.texture.filter;
  const wrap = selected.texture.wrap;

  return (
    <div className="textures-math">
      <Section title="Texture Bindings">
        <TextureBindings
          texName={tex?.name ?? '(missing)'}
          texSize={tex ? `${tex.width}×${tex.height}` : '—'}
          filter={filter}
          wrap={wrap}
        />
      </Section>

      <Section title="UV Table">
        <p className="explanation">
          Each vertex carries a <code>(u, v)</code> pair pointing into normalized
          texture space. <code>(0, 0)</code> is bottom-left; <code>(1, 1)</code> is top-right.
        </p>
        <UVSpacePlot uvs={selected.uvs} />
        <div className="tx-uv-table">
          <div className="tx-uv-table-head">
            <span>#</span><span>u</span><span>v</span>
          </div>
          {selected.uvs.map((uv, i) => (
            <div className="tx-uv-table-row" key={i}>
              <span>{i}</span>
              <span>{uv.u.toFixed(3)}</span>
              <span>{uv.v.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Filtering">
        <p className="explanation">
          When a fragment lands at <code>(u, v)</code>, the texture's width <strong>W</strong> and
          height <strong>H</strong> scale it into texel coordinates:
        </p>
        <pre className="tx-eq">x = u · W,    y = v · H</pre>
        <p className="explanation">
          {filter === 'NEAREST'
            ? 'Nearest-neighbour picks the single texel that contains (x, y):'
            : 'Linear sampling blends the four texels surrounding (x, y) by fractional distance:'}
        </p>
        {filter === 'NEAREST' ? (
          <pre className="tx-eq">color = T[ ⌊x⌋ , ⌊y⌋ ]</pre>
        ) : (
          <pre className="tx-eq">{`α = x − ⌊x⌋   β = y − ⌊y⌋
color = (1−α)(1−β) · T[i,j]
      +   α  (1−β) · T[i+1,j]
      + (1−α)  β   · T[i,j+1]
      +   α    β   · T[i+1,j+1]`}</pre>
        )}
        <SamplingDiagram filter={filter} />
      </Section>

      <Section title="Wrap Mode">
        <p className="explanation">
          When <code>(u, v)</code> drifts outside <code>[0, 1]</code>, the wrap mode decides
          which texel to read.
        </p>
        <WrapStrip wrap={wrap} />
        {wrap === 'REPEAT' ? (
          <pre className="tx-eq">{`u' = u − ⌊u⌋
v' = v − ⌊v⌋     (tile forever)`}</pre>
        ) : (
          <pre className="tx-eq">{`u' = clamp(u, 0, 1)
v' = clamp(v, 0, 1)   (stretch the edge)`}</pre>
        )}
      </Section>

      <Section title="Across the Triangle">
        <p className="explanation">
          Inside a triangle the per-vertex UVs are interpolated by barycentric
          weights <code>(λ₀, λ₁, λ₂)</code> summing to 1:
        </p>
        <pre className="tx-eq">{`u(p) = λ₀·u₀ + λ₁·u₁ + λ₂·u₂
v(p) = λ₀·v₀ + λ₁·v₁ + λ₂·v₂`}</pre>
        <TriangleUVDiagram uvs={selected.uvs} />
        <p className="explanation">
          That smoothly-varying <code>(u, v)</code> is what each fragment hands to the
          sampler — so the texture follows the geometry across the whole face.
        </p>
      </Section>
    </div>
  );
}