import './pipeline-mode-controls.scss';
import { useRef } from 'react';
import { LayoutTemplate, MonitorPlay, Component } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import type { PipelineMode } from '@/core/store/types';

const MODES: { id: PipelineMode; label: string; icon: typeof Component }[] = [
  { id: 'Playground', label: 'Coordinate Playground', icon: Component },
  { id: 'Diagram', label: 'Pipeline Diagram', icon: LayoutTemplate },
  { id: 'RasterVector', label: 'Raster vs. Vector', icon: MonitorPlay },
];

export default function PipelineModeControls() {
  const pipelineMode = useVamsStore(s => s.pipelineMode);
  const setPipelineMode = useVamsStore(s => s.setPipelineMode);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const current = Math.max(0, MODES.findIndex((m) => m.id === pipelineMode));
  const choose = (index: number) => {
    const next = (index + MODES.length) % MODES.length;
    setPipelineMode(MODES[next].id);
    refs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        choose(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        choose(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        choose(0);
        break;
      case 'End':
        event.preventDefault();
        choose(MODES.length - 1);
        break;
    }
  };

  return (
    <CollapsibleSection panelId="pipeline-mode-controls" title="Viewport Mode" icon={<MonitorPlay size={14} />} defaultOpen={true}>
      <div className="mode-controls-grid" role="radiogroup" aria-label="Viewport mode" onKeyDown={onKeyDown}>
        {MODES.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={pipelineMode === id}
            tabIndex={index === current ? 0 : -1}
            className={`mode-btn ${pipelineMode === id ? 'active' : ''}`}
            onClick={() => setPipelineMode(id)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </CollapsibleSection>
  );
}
