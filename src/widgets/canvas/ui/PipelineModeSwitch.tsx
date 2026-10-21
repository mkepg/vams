import { useVamsStore } from '@/core/store';
import type { PipelineMode } from '@/core/store/types';
import { SegmentedControl } from '@/shared/ui/controls';

const PIPELINE_MODES: { value: PipelineMode; label: string }[] = [
  { value: 'Diagram', label: 'Diagram' },
  { value: 'RasterVector', label: 'Raster vs vector' },
  { value: 'Playground', label: 'Playground' },
];

/** Chooses what the Pipeline section draws on the canvas: an illustration, or the scene itself. */
export default function PipelineModeSwitch() {
  const pipelineMode = useVamsStore((s) => s.pipelineMode);
  const setPipelineMode = useVamsStore((s) => s.setPipelineMode);
  const focused = useVamsStore((s) => s.lessonFocusPanel === 'pipeline-mode-controls');
  return (
    <div
      className={focused ? 'pipeline-mode-switch is-lesson-focus' : 'pipeline-mode-switch'}
      data-panel-id="pipeline-mode-controls"
    >
      <SegmentedControl label="Viewport mode" options={PIPELINE_MODES} value={pipelineMode} onChange={setPipelineMode} />
    </div>
  );
}
