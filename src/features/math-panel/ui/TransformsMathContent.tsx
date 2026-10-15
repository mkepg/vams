import type { SceneNode, TransformState, ViewportLimits } from '@/core/types/scene';

export function buildMatrix4(t: TransformState): number[][] {
  const rad = (t.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return [
    [t.scaleX * cos, -t.scaleY * sin, 0, t.translateX],
    [t.scaleX * sin,  t.scaleY * cos, 0, t.translateY],
    [0,               0,              1, 0],
    [0,               0,              0, 1],
  ];
}

export function getAncestorChain(objectId: string, objects: SceneNode[]): SceneNode[] {
  const chain: SceneNode[] = [];
  const byId = new Map(objects.map((o) => [o.id, o]));

  let current: SceneNode | undefined = byId.get(objectId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return chain;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="math-section">
      <h4 className="math-section-title">{title}</h4>
      <div className="math-section-body">{children}</div>
    </div>
  );
}

export function Matrix4({ m }: { m: number[][] }) {
  return (
    <div className="tm-matrix-container">
      <div className="tm-matrix" role="img" aria-label="4 by 4 transform matrix">
        <span className="tm-bracket left" aria-hidden />
        <div className="tm-matrix-inner">
          {m.map((row, ri) => (
            <div key={ri} className="tm-matrix-row">
              {row.map((val, ci) => {
                const isZero = val === 0;
                const isOne = val === 1;
                const isDiag = ri === ci;
                return (
                  <span
                    key={ci}
                    className={`tm-cell ${isDiag ? 'diag' : ''} ${isZero ? 'zero' : ''} ${isOne && isDiag ? 'identity' : ''}`}
                  >
                    {isZero ? '0' : isOne ? '1' : val.toFixed(2)}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <span className="tm-bracket right" aria-hidden />
      </div>
    </div>
  );
}

export function TRSCompositionTrace({ t }: { t: TransformState }) {
  return (
    <div className="tm-composition" aria-label="Transform composition order">
      <div className="tm-comp-step">
        <span className="tm-comp-label">T</span>
        <code className="tm-comp-args">
          {t.translateX.toFixed(2)}, {t.translateY.toFixed(2)}
        </code>
      </div>
      <span className="tm-comp-op" aria-hidden>·</span>
      <div className="tm-comp-step">
        <span className="tm-comp-label">R</span>
        <code className="tm-comp-args">{t.rotate.toFixed(1)}°</code>
      </div>
      <span className="tm-comp-op" aria-hidden>·</span>
      <div className="tm-comp-step">
        <span className="tm-comp-label">S</span>
        <code className="tm-comp-args">
          {t.scaleX.toFixed(2)}, {t.scaleY.toFixed(2)}
        </code>
      </div>
      <span className="tm-comp-op" aria-hidden>=</span>
      <div className="tm-comp-step result">
        <span className="tm-comp-label">M</span>
      </div>
    </div>
  );
}

export function MatrixStack({ chain }: { chain: SceneNode[] }) {
  return (
    <div className="tm-stack" aria-label="Matrix stack from bottom to top">
      {/* Base Identity Frame */}
      <div className="tm-stack-frame base">
        <span className="tm-stack-glyph" aria-hidden>I</span>
        <div className="tm-stack-body">
          <span className="tm-stack-name">Identity</span>
          <span className="tm-stack-note">glLoadIdentity()</span>
        </div>
      </div>

      {chain.map((node, i) => {
        const isLast = i === chain.length - 1;
        return (
          <div
            key={node.id}
            className={`tm-stack-frame ${isLast ? 'current' : 'ancestor'}`}
          >
            <span className="tm-stack-glyph" aria-hidden>{i + 1}</span>
            <div className="tm-stack-body">
              <span className="tm-stack-name" title={node.name}>{node.name}</span>
              <span className="tm-stack-note">
                {isLast ? 'current draw frame' : 'glPushMatrix · ancestor'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OrthoMapping({ limits }: { limits: ViewportLimits }) {
  const w = limits.maxX - limits.minX;
  const h = limits.maxY - limits.minY;

  return (
    <div className="tm-ortho">
      <div className="tm-ortho-eq-group">
        <div className="tm-ortho-eq">
          <span className="tm-ortho-tag">X</span>
          <code>
            x<sub>ndc</sub> = 2 · (x − <strong>{limits.minX.toFixed(2)}</strong>) / <strong>{w.toFixed(2)}</strong> − 1
          </code>
        </div>
        <div className="tm-ortho-eq">
          <span className="tm-ortho-tag">Y</span>
          <code>
            y<sub>ndc</sub> = 2 · (y − <strong>{limits.minY.toFixed(2)}</strong>) / <strong>{h.toFixed(2)}</strong> − 1
          </code>
        </div>
      </div>
      <div className="tm-ortho-bounds">
        <div className="tm-bd-item">
          <span className="tm-bd-tag">left</span>
          <code>{limits.minX.toFixed(2)}</code>
        </div>
        <div className="tm-bd-item">
          <span className="tm-bd-tag">right</span>
          <code>{limits.maxX.toFixed(2)}</code>
        </div>
        <div className="tm-bd-item">
          <span className="tm-bd-tag">bottom</span>
          <code>{limits.minY.toFixed(2)}</code>
        </div>
        <div className="tm-bd-item">
          <span className="tm-bd-tag">top</span>
          <code>{limits.maxY.toFixed(2)}</code>
        </div>
      </div>
    </div>
  );
}

/** A titled card, as the old Transforms tab drew them. */
export function TransformsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Section title={title}>{children}</Section>;
}
