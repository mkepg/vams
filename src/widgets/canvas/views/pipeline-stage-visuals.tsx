import type { FC } from 'react';

/**
 * Lightweight SVG diagrams for each pipeline stage.
 * Intentionally simple and diagrammatic — never decorative.
 * Each visual reinforces the *concept* (points → matrix → triangle → clip → grid → shade → buffer).
 */

type Kind =
  | 'input'
  | 'process'
  | 'assembly'
  | 'clip'
  | 'raster'
  | 'fragment'
  | 'output';

interface Props {
  kind: Kind;
}

const W = 180;
const H = 120;

const StageVisual: FC<Props> = ({ kind }) => {
  switch (kind) {
    case 'input':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="stage-svg">
          {/* three loose vertices */}
          <circle cx="50" cy="40" r="5" className="v-dot" />
          <circle cx="130" cy="55" r="5" className="v-dot" />
          <circle cx="90" cy="90" r="5" className="v-dot" />
          <text x="50" y="30" className="v-label" fontSize={12.5}>V0</text>
          <text x="130" y="45" className="v-label" fontSize={12.5}>V1</text>
          <text x="90" y="107" className="v-label" fontSize={12.5}>V2</text>
        </svg>
      );
    case 'process':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="stage-svg">
          <rect x="20" y="40" width="40" height="40" rx="3" className="v-frame" />
          <text x="40" y="65" className="v-label center" fontSize={12.5}>V</text>
          <text x="80" y="65" className="v-op" fontSize={14}>×</text>
          <rect x="95" y="40" width="40" height="40" rx="3" className="v-frame accent" />
          <text x="115" y="59" className="v-label center" fontSize={12.5}>M</text>
          <text x="115" y="75" className="v-sub center" fontSize={12}>4×4</text>
          <text x="155" y="65" className="v-op" fontSize={14}>=</text>
        </svg>
      );
    case 'assembly':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="stage-svg">
          <polygon
            points="50,30 140,50 90,95"
            className="v-tri"
          />
          <circle cx="50" cy="30" r="4" className="v-dot solid" />
          <circle cx="140" cy="50" r="4" className="v-dot solid" />
          <circle cx="90" cy="95" r="4" className="v-dot solid" />
        </svg>
      );
    case 'clip':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="stage-svg">
          <rect x="30" y="25" width="120" height="70" className="v-frame dashed" />
          <polygon points="70,10 130,40 95,60" className="v-tri muted" />
          <polygon points="70,55 110,75 80,90" className="v-tri" />
          <line x1="30" y1="25" x2="150" y2="25" className="v-edge" />
        </svg>
      );
    case 'raster':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="stage-svg">
          {/* grid */}
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={`gx${i}`}
              x1={30 + i * 15}
              y1="20"
              x2={30 + i * 15}
              y2="100"
              className="v-grid"
            />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={`gy${i}`}
              x1="30"
              y1={20 + i * 13}
              x2="150"
              y2={20 + i * 13}
              className="v-grid"
            />
          ))}
          {/* filled fragments approximating a triangle */}
          {[
            [60, 33], [75, 33],
            [60, 46], [75, 46], [90, 46],
            [60, 59], [75, 59], [90, 59], [105, 59],
            [60, 72], [75, 72], [90, 72], [105, 72], [120, 72],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="15" height="13" className="v-frag" />
          ))}
        </svg>
      );
    case 'fragment':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="stage-svg">
          <rect x="30" y="30" width="30" height="30" className="v-frag pale" />
          <rect x="62" y="30" width="30" height="30" className="v-frag mid" />
          <rect x="94" y="30" width="30" height="30" className="v-frag strong" />
          <rect x="30" y="62" width="30" height="30" className="v-frag mid" />
          <rect x="62" y="62" width="30" height="30" className="v-frag strong" />
          <rect x="94" y="62" width="30" height="30" className="v-frag intense" />
          <text x="132" y="66" className="v-label" fontSize={12.5}>RGBA</text>
          <text x="77" y="110" className="v-sub center" fontSize={12}>per fragment</text>
        </svg>
      );
    case 'output':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="stage-svg">
          <rect x="14" y="25" width="152" height="70" className="v-frame accent" />
          <rect x="22" y="33" width="136" height="54" className="v-buffer" />
          <text x="90" y="59" className="v-label center" fontSize={12.5}>Framebuffer</text>
          <text x="90" y="76" className="v-sub center" fontSize={12}>write-to-screen</text>
        </svg>
      );
    default:
      return null;
  }
};

export default StageVisual;
