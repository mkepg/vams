import { useVamsStore } from '@/core/store';

const STAGE_NOTES: Record<number, { title: string; note: string }> = {
  0: { title: 'Vertex Specification', note: 'Vertices come from your code as raw (x, y) pairs with optional color.' },
  1: { title: 'Vertex Processing', note: 'Each vertex is multiplied by the model and projection matrices.' },
  2: { title: 'Primitive Assembly', note: 'Vertices are stitched into shapes — points, lines, or triangles.' },
  3: { title: 'Clipping', note: 'Anything outside the visible rectangle is removed.' },
  4: { title: 'Rasterization', note: 'Smooth shapes turn into a grid of fragments — potential pixels.' },
  5: { title: 'Fragment Processing', note: 'Each fragment is given its final color.' },
  6: { title: 'Per-Sample Operations', note: 'Final tests decide which fragments make it onto the screen.' },
};

export default function PipelineMathContent() {
  const cursor = useVamsStore((s) => s.cursorWorld);
  const activeStage = useVamsStore((s) => s.activePipelineStage);
  const pipelineMode = useVamsStore((s) => s.pipelineMode);

  // Removed the useEffect that was overwriting the user's coordinate tracker settings

  return (
    <div className="pipeline-math">
      <Section title="Cursor (NDC)">
        {cursor ? (
          <div className="ndc-readout">
            <div className="coord-pair">
              <span className="axis x">x</span>
              <span className="value">{cursor.x.toFixed(3)}</span>
            </div>
            <div className="coord-pair">
              <span className="axis y">y</span>
              <span className="value">{cursor.y.toFixed(3)}</span>
            </div>
          </div>
        ) : (
          <div className="hint">Move your cursor over the canvas to see live coordinates.</div>
        )}
      </Section>

      {pipelineMode === 'Diagram' && (
        <>
          {activeStage !== null && STAGE_NOTES[activeStage] ? (
            <Section title={STAGE_NOTES[activeStage].title}>
              <p className="explanation">{STAGE_NOTES[activeStage].note}</p>
              <div className="hint">Stage {activeStage + 1} of 7</div>
            </Section>
          ) : (
            <div className="empty-state">
              Click any stage in the diagram to see what happens inside it.
            </div>
          )}
        </>
      )}

      <Section title="Vector vs Raster">
        <p className="explanation">
          <strong>Vector</strong> shapes are described by points and equations — they
          stay sharp at any zoom.
        </p>
        <p className="explanation">
          <strong>Raster</strong> shapes are made of square fragments — what your screen
          actually displays.
        </p>
        <div className="hint">The pipeline's job is to turn vector input into raster output.</div>
      </Section>
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