import './math-panel.scss';
import { useId } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import { mathTabFor } from '@/core/inspector';
import PipelineMathContent from './PipelineMathContent';
import PrimitivesMathContent from './PrimitivesMathContent';
import BuffersMathContent from './BuffersMathContent';
import TransformsMathContent from './TransformsMathContent';
import TexturesMathContent from './TexturesMathContent';

const TABS: { section: CurriculumSection; content: () => ComponentChildren }[] = [
  { section: 'Pipeline', content: () => <PipelineMathContent /> },
  { section: 'Primitives', content: () => <PrimitivesMathContent /> },
  { section: 'Buffers', content: () => <BuffersMathContent /> },
  { section: 'Transforms', content: () => <TransformsMathContent /> },
  { section: 'Textures', content: () => <TexturesMathContent /> },
];

export default function MathPanel() {
  const tab = useVamsStore(mathTabFor);
  const setMathTabOverride = useVamsStore((s) => s.setMathTabOverride);
  const baseId = useId();
  const index = TABS.findIndex((t) => t.section === tab);

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    let next = step === undefined ? -1 : (index + step + TABS.length) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setMathTabOverride(TABS[next].section);
    requestAnimationFrame(() => document.getElementById(`${baseId}-tab-${next}`)?.focus());
  };

  return (
    <div className="math-panel-container">
      <div className="math-header">
        <span className="math-title">Math &amp; data</span>
        <div className="math-tabs" role="tablist" aria-label="Math by section" onKeyDown={onKeyDown}>
          {TABS.map((t, i) => (
            <button
              key={t.section}
              id={`${baseId}-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-controls={`${baseId}-panel`}
              tabIndex={i === index ? 0 : -1}
              className="math-tab"
              onClick={() => setMathTabOverride(t.section)}
            >
              {t.section}
            </button>
          ))}
        </div>
      </div>
      <div className="math-content" id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${index}`}>
        {TABS[index].content()}
      </div>
    </div>
  );
}
