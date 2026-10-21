import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import './exercise-widgets.scss';

interface Props {
  prompt: string;
  options: { id: string; label: string }[];
  selectedId: string | null;
  correctId: string;
  onSelect: (id: string) => void;
}

export default function MultipleChoiceWidget({
  prompt, options, selectedId, correctId, onSelect
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
      <div className="widget-prompt">{prompt}</div>
      <div className="mc-options">
        {randomizedOptions.map((opt, index) => {
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
              <span className="opt-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
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