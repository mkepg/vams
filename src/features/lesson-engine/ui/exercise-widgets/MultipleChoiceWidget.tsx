import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import './exercise-widgets.scss';

export type VisualArtifactType = 
  | 'vertex-specification' 
  | 'vertex-processing' 
  | 'primitive-assembly' 
  | 'clipping' 
  | 'rasterization' 
  | 'fragment-processing' 
  | 'per-sample-operations';

interface Props {
  prompt: string;
  visualArtifact?: VisualArtifactType;
  options: { id: string; label: string }[];
  selectedId: string | null;
  correctId: string;
  onSelect: (id: string) => void;
}

const VisualArtifactRenderer = ({ type }: { type: VisualArtifactType }) => {
  if (!type) return null;

  return (
    <div className="artifact-display">
      {type === 'vertex-specification' && (
        <svg viewBox="0 0 120 80" className="artifact-svg" aria-label="Vertex Specification Artifact">
          <rect x="10" y="25" width="55" height="30" rx="4" fill="rgba(255,255,255, 0.05)" stroke="var(--border-highlight)" strokeWidth="1" />
          <text x="15" y="40" fill="var(--text-main)" fontSize="7" fontFamily="monospace">glVertex2f(</text>
          <text x="25" y="50" fill="var(--accent-blue-light)" fontSize="7" fontFamily="monospace">x, y</text>
          <text x="45" y="50" fill="var(--text-main)" fontSize="7" fontFamily="monospace">)</text>
          <path d="M 70 40 L 85 40 M 80 35 L 85 40 L 80 45" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
          <circle cx="100" cy="40" r="5" fill="var(--accent-blue-light)" />
          <circle cx="100" cy="40" r="8" fill="none" stroke="var(--accent-blue-light)" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      )}

      {type === 'vertex-processing' && (
        <svg viewBox="0 0 120 80" className="artifact-svg" aria-label="Vertex Processing Artifact">
          <defs>
            <pattern id="grid-vp" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-vp)" />
          <polygon points="25,55 45,25 65,55" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 2" />
          <path d="M 45,40 Q 60,30 75,45 M 70,41 L 75,45 L 71,49" fill="none" stroke="var(--accent-blue-light)" strokeWidth="1.5" />
          <polygon points="65,65 95,45 105,75" fill="rgba(var(--accent-blue-rgb), 0.3)" stroke="var(--accent-blue-light)" strokeWidth="1.5" />
        </svg>
      )}

      {type === 'primitive-assembly' && (
        <svg viewBox="0 0 120 80" className="artifact-svg" aria-label="Primitive Assembly Artifact">
          <circle cx="20" cy="20" r="3" fill="var(--accent-blue-light)" />
          <circle cx="10" cy="60" r="3" fill="var(--accent-blue-light)" />
          <circle cx="45" cy="45" r="3" fill="var(--accent-blue-light)" />
          <path d="M 55 40 L 70 40 M 65 35 L 70 40 L 65 45" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
          <polygon points="95,20 85,60 120,45" fill="rgba(var(--accent-blue-rgb), 0.2)" stroke="var(--accent-blue-light)" strokeWidth="1.5" />
          <circle cx="95" cy="20" r="3" fill="white" />
          <circle cx="85" cy="60" r="3" fill="white" />
          <circle cx="120" cy="45" r="3" fill="white" />
        </svg>
      )}

      {type === 'clipping' && (
        <svg viewBox="0 0 120 80" className="artifact-svg" aria-label="Clipping Artifact">
          <rect x="35" y="15" width="50" height="50" fill="rgba(var(--accent-blue-rgb), 0.05)" stroke="var(--accent-blue-light)" strokeWidth="1" strokeDasharray="4 2" />
          <clipPath id="clip-viewport">
            <rect x="35" y="15" width="50" height="50" />
          </clipPath>
          <polygon points="20,40 60,10 80,70" fill="rgba(var(--accent-red-rgb), 0.2)" stroke="var(--accent-red-light)" strokeWidth="1" strokeDasharray="2 2" />
          <polygon points="20,40 60,10 80,70" fill="rgba(var(--accent-blue-rgb), 0.5)" stroke="var(--accent-blue-light)" strokeWidth="1.5" clipPath="url(#clip-viewport)" />
        </svg>
      )}

      {type === 'rasterization' && (
        <svg viewBox="0 0 120 80" className="artifact-svg" aria-label="Rasterization Artifact">
          <defs>
            <pattern id="grid-rast" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-rast)" />
          <g transform="translate(10, 10)">
            <line x1="10" y1="50" x2="80" y2="10" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2 2" />
            <path d="M10,50 h12 v-7 h12 v-7 h12 v-7 h12 v-7 h12 v-7 h10" fill="none" stroke="var(--accent-blue-light)" strokeWidth="8" strokeLinecap="square" />
          </g>
        </svg>
      )}

      {type === 'fragment-processing' && (
        <svg viewBox="0 0 120 80" className="artifact-svg" aria-label="Fragment Processing Artifact">
          <defs>
            <linearGradient id="frag-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
          <polygon points="30,65 60,15 90,65" fill="url(#frag-grad)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <circle cx="70" cy="40" r="12" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="2 2"/>
          <line x1="78" y1="48" x2="95" y2="60" stroke="white" strokeWidth="1.5" />
          <rect x="95" y="55" width="16" height="16" fill="#5eead4" stroke="white" strokeWidth="1.5" rx="2" />
        </svg>
      )}

      {type === 'per-sample-operations' && (
        <svg viewBox="0 0 120 80" className="artifact-svg" aria-label="Per-Sample Operations Artifact">
          <polygon points="70,15 95,55 45,55" fill="rgba(var(--accent-red-rgb), 0.6)" stroke="var(--accent-red-light)" strokeWidth="1.5" />
          <rect x="25" y="30" width="55" height="40" fill="rgba(var(--accent-blue-rgb), 0.9)" stroke="var(--accent-blue-light)" strokeWidth="1.5" />
          <path d="M 57 40 L 67 50 M 67 40 L 57 50" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <text x="52" y="64" textAnchor="middle" fill="white" fontSize="7" fontFamily="monospace">Discard</text>
        </svg>
      )}
    </div>
  );
};

export default function MultipleChoiceWidget({
  prompt, options, selectedId, correctId, onSelect, visualArtifact
}: Props) {

  // Derive randomized options securely during render using a pure, seeded PRNG
  const randomizedOptions = useMemo(() => {
    const arr = [...options];
    
    // Create a simple deterministic seed based on the prompt text
    let h = 0;
    for (let i = 0; i < prompt.length; i++) {
      h = (Math.imul(31, h) + prompt.charCodeAt(i)) | 0;
    }
    
    const rng = () => {
      h = (h * 1664525 + 1013904223) | 0;
      return ((h >>> 0) % 1000) / 1000;
    };

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [prompt, options]);

  return (
    <div className="exercise-widget mc-widget">
      {visualArtifact && <VisualArtifactRenderer type={visualArtifact} />}
      <div className="widget-prompt">{prompt}</div>
      <div className="mc-options">
        {randomizedOptions.map((opt) => {
          const isSelected = selectedId === opt.id;
          const isCorrect = isSelected && opt.id === correctId;
          const isWrong = isSelected && opt.id !== correctId;

          return (
            <button
              key={opt.id}
              type="button"
              className={`mc-option ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
              onClick={() => onSelect(opt.id)}
            >
              <span className="opt-label">{opt.label}</span>
              {isCorrect && <Check size={14} className="opt-icon correct" />}
              {isWrong && <X size={14} className="opt-icon wrong" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}