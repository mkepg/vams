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

interface MathPanelProps {
  /** Replaces the "Math & data" title, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header's first line. */
  headerTrail?: ComponentChildren;
  /** Run makes the tabs and content inert; the lead and trail stay usable. */
  contentInert?: boolean;
}

export default function MathPanel({ headerLead, headerTrail, contentInert = false }: MathPanelProps = {}) {
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
      <div className={headerLead ? 'math-header math-header--lead' : 'math-header'}>
        {headerLead ?? <span className="math-title">Math &amp; data</span>}
        {headerTrail && <span className="math-header__trail">{headerTrail}</span>}
        <div className="math-tabs" role="tablist" aria-label="Math by section" onKeyDown={onKeyDown} inert={contentInert || undefined}>
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
      <div
        className="math-content"
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${index}`}
        inert={contentInert || undefined}
      >
        {TABS[index].content()}
      </div>
    </div>
  );
}
