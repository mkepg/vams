// src/features/math-panel/ui/BuffersMathContent.tsx
import { useEffect, useMemo, useState, useRef } from 'react';
import { Pause, Play, RotateCcw, ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { sanitizeName } from '@/shared/lib/sanitize-name';
import { deduplicate, hasTexture, vertexKey } from '@/entities/scene/model/vertex-dedup';
import type {
  BufferUpdateMethod,
  BufferUsage,
  RenderingMode,
  SceneNode,
} from '@/core/types/scene';

const BYTES_POS   = 8;
const BYTES_COLOR = 12;
const BYTES_UV    = 8;
const BYTES_INDEX = 4;

/** Bytes one vertex takes: its position and colour, and its UV when the shape is textured. */
const bytesPerVertex = (o: SceneNode) => BYTES_POS + BYTES_COLOR + (hasTexture(o) ? BYTES_UV : 0);

function isPrimitive(o: SceneNode): boolean {
  return o.type !== 'GROUP' && o.type !== 'TEXT';
}

/** Vertices in the shape, and how many are different, by the same test indexed drawing uses. */
function dedupCount(o: SceneNode): { unique: number; total: number } {
  const textured = hasTexture(o);
  const keys = new Set(o.vertices.map((v, i) => vertexKey(v, textured ? o.uvs![i] : null)));
  return { unique: keys.size, total: o.vertices.length };
}

const GL_PRIM: Record<string, string> = {
  POINTS: 'GL_POINTS',
  LINES: 'GL_LINES',
  LINE_STRIP: 'GL_LINE_STRIP',
  LINE_LOOP: 'GL_LINE_LOOP',
  TRIANGLES: 'GL_TRIANGLES',
  TRIANGLE_STRIP: 'GL_TRIANGLE_STRIP',
  TRIANGLE_FAN: 'GL_TRIANGLE_FAN',
  QUADS: 'GL_QUADS',
  QUAD_STRIP: 'GL_QUAD_STRIP',
  POLYGON: 'GL_POLYGON',
};

function Section({ title, children, isFocused }: { title: string; children: React.ReactNode; isFocused?: boolean }) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused) {
      const timer = setTimeout(() => {
        const el = sectionRef.current;
        if (el) {
          const scrollParent = el.closest('.journey') as HTMLElement;
          if (scrollParent) {
            const parentRect = scrollParent.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();

            // The exact scroll position to align the tops
            const exactTop = scrollParent.scrollTop + (elRect.top - parentRect.top);

            // Ideal position to perfectly center the element
            let targetTop = exactTop - (parentRect.height / 2) + (elRect.height / 2);

            // If centering pushes the top out of view (because it's too tall),
            // cap the scroll so it aligns to the top with a comfortable 16px padding
            const topWithPadding = exactTop - 16;
            if (targetTop > topWithPadding) {
              targetTop = topWithPadding;
            }

            scrollParent.scrollTo({ top: targetTop, behavior: 'smooth' });
          } else {
            // Fallback for native scrolling
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  return (
    <div ref={sectionRef} className={`math-section ${isFocused ? 'lesson-focused' : ''}`}>
      <h4 className="math-section-title">{title}</h4>
      <div className="math-section-body">{children}</div>
    </div>
  );
}

function describeDrawCall(
  obj: SceneNode,
  mode: RenderingMode,
): { headline: string; sub: string | null } {
  const prim = GL_PRIM[obj.type] ?? 'GL_*';
  const { unique, total } = dedupCount(obj);

  if (mode === 'IMMEDIATE') {
    return {
      headline: `glBegin(${prim}) … glEnd()`,
      sub: `${total} glVertex2f calls per frame`,
    };
  }

  if (obj.useIndexed) {
    const indexCount = total;
    const vertCount = unique;
    if (mode === 'VERTEX_ARRAY') {
      return {
        headline: `glDrawElements(${prim}, ${indexCount}, GL_UNSIGNED_INT, indices_*)`,
        sub: `${vertCount} unique vertices · ${indexCount} indices`,
      };
    }
    return {
      headline: `glDrawElements(${prim}, ${indexCount}, GL_UNSIGNED_INT, 0)`,
      sub: `${vertCount} unique vertices · ${indexCount} indices · bound EBO`,
    };
  }

  if (mode === 'VERTEX_ARRAY') {
    return {
      headline: `glDrawArrays(${prim}, 0, ${total})`,
      sub: 'data sourced from a client-side array',
    };
  }

  return {
    headline: `glDrawArrays(${prim}, 0, ${total})`,
    sub: 'data sourced from a bound VBO',
  };
}

function CurrentDrawCall({ obj, mode }: { obj: SceneNode; mode: RenderingMode }) {
  const { headline, sub } = describeDrawCall(obj, mode);

  return (
    <div className="bm-current-call">
      <div className="bm-current-call-row">
        <Pin size={11} className="bm-current-call-pin" aria-hidden />
        <span className="bm-current-call-label">draws as</span>
        <code className="bm-current-call-code">{headline}</code>
      </div>
      {sub && <div className="bm-current-call-sub">{sub}</div>}
    </div>
  );
}

function MemoryFootprint({ obj }: { obj: SceneNode }) {
  const { total } = dedupCount(obj);
  const perVertex = bytesPerVertex(obj);
  const totalBytes = total * perVertex;
  const parts = `position (${BYTES_POS} B) + colour (${BYTES_COLOR} B)${hasTexture(obj) ? ` + UV (${BYTES_UV} B)` : ''}`;

  return (
    <div className="bm-footprint">
      <div className="bm-footprint-stat">
        <span className="bm-stat-num">{total}</span>
        <span className="bm-stat-label">vertices</span>
      </div>
      <span className="bm-stat-op">×</span>
      <div className="bm-footprint-stat" title={parts}>
        <span className="bm-stat-num">{perVertex} B</span>
        <span className="bm-stat-label">per vertex</span>
      </div>
      <span className="bm-stat-op">=</span>
      <div className="bm-footprint-stat result">
        <span className="bm-stat-num">{totalBytes} B</span>
        <span className="bm-stat-label">total</span>
      </div>
    </div>
  );
}

function MemoryComparison({ obj }: { obj: SceneNode }) {
  const { unique, total } = dedupCount(obj);
  const perVertex = bytesPerVertex(obj);
  const arrayBytes = total * perVertex;
  const indexedBytes = unique * perVertex + total * BYTES_INDEX;
  const savings = arrayBytes - indexedBytes;
  const positive = savings > 0;

  return (
    <div className="bm-memory">
      <div className="bm-memory-row">
        <div className="bm-memory-cell">
          <span className="bm-memory-name">Without indexing</span>
          <span className="bm-memory-api">glDrawArrays</span>
        </div>
        <code className="bm-memory-val">{arrayBytes} B</code>
        <span className="bm-memory-sub">{total} verts × {perVertex} B</span>
      </div>

      <div className="bm-memory-row">
        <div className="bm-memory-cell">
          <span className="bm-memory-name">With indexing</span>
          <span className="bm-memory-api">glDrawElements</span>
        </div>
        <code className="bm-memory-val">{indexedBytes} B</code>
        <span className="bm-memory-sub">
          {unique} unique × {perVertex} B + {total} idx × {BYTES_INDEX} B
        </span>
      </div>

      <div className={`bm-memory-delta ${positive ? 'win' : 'tie'}`}>
        {positive
          ? `Saves ${savings} B (${Math.round((savings / arrayBytes) * 100)}%) by deduplicating`
          : 'No savings — every vertex is unique.'}
      </div>
    </div>
  );
}

/** One array the program declares for a shape: its name, the letters of each vertex's block, and the bytes per vertex. */
interface ArrayRow {
  name: string;
  cells: string[];
  kind: 'pos' | 'col' | 'uv';
}

const MAX_BLOCKS = 4;

/** Which of `count` blocks to draw: all of them, or the first few, a gap and the last. */
function blockPlan(count: number): Array<{ idx: number; ellipsis?: boolean }> {
  const truncated = count > MAX_BLOCKS;
  const blocks: Array<{ idx: number; ellipsis?: boolean }> = [];
  for (let i = 0; i < (truncated ? MAX_BLOCKS - 1 : count); i++) blocks.push({ idx: i });
  if (truncated) {
    blocks.push({ idx: -1, ellipsis: true });
    blocks.push({ idx: count - 1 });
  }
  return blocks;
}

const gapBlock = (i: number) => (
  <div key={`gap-${i}`} className="bm-vblock ellipsis" aria-hidden>
    <span className="bm-vblock-idx">…</span>
  </div>
);

/**
 * The separate arrays the generated code declares, one block per vertex in each. With indexed drawing
 * the code keeps each different vertex once and adds an indices array, as the generator does.
 */
function SeparateArrays({ obj }: { obj: SceneNode }) {
  const safe = sanitizeName(obj.name);
  const dedup = deduplicate(obj);
  const count = dedup ? dedup.uniqueVerts.length : obj.vertices.length;
  const rows: ArrayRow[] = [
    { name: `verts_${safe}`, cells: ['x', 'y'], kind: 'pos' },
    { name: `colors_${safe}`, cells: ['r', 'g', 'b'], kind: 'col' },
  ];
  if (hasTexture(obj)) rows.push({ name: `uvs_${safe}`, cells: ['u', 'v'], kind: 'uv' });
  const blocks = blockPlan(count);

  return (
    <div className="bm-arrays">
      {rows.map((r) => (
        <div key={r.name} className="bm-array">
          <div className="bm-array-head">
            <code className="bm-array-name">{r.name}</code>
            <span className="bm-array-size">{count} × {r.cells.length * 4} B</span>
          </div>
          <div className="bm-array-row">
            {blocks.map((b, i) =>
              b.ellipsis ? (
                gapBlock(i)
              ) : (
                <div key={`v-${b.idx}`} className="bm-vblock">
                  <span className="bm-vblock-idx">V{b.idx + 1}</span>
                  <div className="bm-vblock-cells">
                    {r.cells.map((c) => (
                      <span key={c} className={`bm-cell ${r.kind}`}>{c}</span>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
      {dedup && (
        <div className="bm-array">
          <div className="bm-array-head">
            <code className="bm-array-name">indices_{safe}</code>
            <span className="bm-array-size">{dedup.indices.length} × {BYTES_INDEX} B</span>
          </div>
          <div className="bm-array-row">
            {blockPlan(dedup.indices.length).map((b, i) =>
              b.ellipsis ? (
                gapBlock(i)
              ) : (
                <div key={`i-${b.idx}`} className="bm-vblock" title={`Draws V${dedup.indices[b.idx] + 1}`}>
                  <span className="bm-vblock-idx">{b.idx + 1}</span>
                  <div className="bm-vblock-cells">
                    <span className="bm-cell idx">{dedup.indices[b.idx]}</span>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface FlowProfile {
  transfers: number[];
  legend: string;
  severity: 'high' | 'mid' | 'low';
}

function flowProfile(mode: RenderingMode, usage: BufferUsage): FlowProfile {
  if (mode === 'IMMEDIATE') {
    return {
      transfers: [1, 2, 3, 4, 5, 6, 7, 8],
      legend: 'Vertex data is re-issued on every frame, vertex by vertex.',
      severity: 'high',
    };
  }
  if (mode === 'VERTEX_ARRAY') {
    return {
      transfers: [1, 2, 3, 4, 5, 6, 7, 8],
      legend: 'One batched send per frame — better than immediate, but still continuous traffic.',
      severity: 'high',
    };
  }
  if (usage === 'STATIC') {
    return {
      transfers: [1],
      legend: 'Sent once on init. The GPU keeps the data for every subsequent frame.',
      severity: 'low',
    };
  }
  if (usage === 'DYNAMIC') {
    return {
      transfers: [1, 4, 7],
      legend: 'Sent at init and whenever the data changes — sparse traffic afterwards.',
      severity: 'mid',
    };
  }
  return {
    transfers: [1, 2, 3, 4, 5, 6, 7, 8],
    legend: 'Re-sent every frame — fast on the GPU side but heavy for short-lived data.',
    severity: 'high',
  };
}

function BufferFlow({ profile }: { profile: FlowProfile }) {
  const frames = 8;
  const transferSet = useMemo(() => new Set(profile.transfers), [profile.transfers]);

  return (
    <div className={`bm-flow severity-${profile.severity}`}>
      <div className="bm-flow-row">
        <span className="bm-flow-axis">CPU</span>
        <div className="bm-flow-track">
          {Array.from({ length: frames }).map((_, i) => (
            <div
              key={i}
              className={`bm-flow-cell ${transferSet.has(i + 1) ? 'send' : ''}`}
              title={`Frame ${i + 1}${transferSet.has(i + 1) ? ' — upload' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="bm-flow-arrows">
        <span className="bm-flow-axis-blank" />
        <div className="bm-flow-arrows-track">
          {Array.from({ length: frames }).map((_, i) => (
            <span key={i} className={`bm-flow-arrow ${transferSet.has(i + 1) ? 'on' : ''}`}>↓</span>
          ))}
        </div>
      </div>
      <div className="bm-flow-row">
        <span className="bm-flow-axis">GPU</span>
        <div className="bm-flow-track">
          {Array.from({ length: frames }).map((_, i) => (
            <div key={i} className="bm-flow-cell gpu" />
          ))}
        </div>
      </div>
      <div className="bm-flow-foot">
        <span className="bm-flow-frames">8 frames →</span>
        <span className="bm-flow-legend">{profile.legend}</span>
      </div>
    </div>
  );
}

interface MapStep {
  code: string;
  caption: string;
  mapped: boolean;
  cursor: number | null;
  written: number[];
}

const BUFFER_CELLS = 8;
const MAP_STEPS: MapStep[] = [
  {
    code: 'glBindBuffer(GL_ARRAY_BUFFER, vbo);',
    caption: 'Bind the VBO. Now subsequent buffer operations target this object.',
    mapped: false,
    cursor: null,
    written: [],
  },
  {
    code: 'float* ptr = (float*)\n  glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY);',
    caption: 'Map the buffer. The driver hands back a pointer to GPU memory you can write to directly — no upload, no copy.',
    mapped: true,
    cursor: 0,
    written: [],
  },
  {
    code: 'ptr[0] = 0.5f;',
    caption: 'Write through the pointer. The first slot is updated in place.',
    mapped: true,
    cursor: 1,
    written: [0],
  },
  {
    code: 'ptr[1] = 0.7f;',
    caption: 'Advance and write again. C pointer arithmetic moves the cursor forward; each write modifies GPU memory directly.',
    mapped: true,
    cursor: 2,
    written: [0, 1],
  },
  {
    code: 'ptr[2] = -0.3f;\nptr[3] = 0.2f;',
    caption: 'Continue writing only the cells that need to change. Untouched cells keep their previous values — no full re-upload required.',
    mapped: true,
    cursor: 4,
    written: [0, 1, 2, 3],
  },
  {
    code: 'glUnmapBuffer(GL_ARRAY_BUFFER);',
    caption: 'Unmap to commit. The pointer becomes invalid; the driver finalizes the writes and the buffer is ready for the next draw call.',
    mapped: false,
    cursor: null,
    written: [0, 1, 2, 3],
  },
];

export const DMA_TOTAL_STEPS = MAP_STEPS.length;

interface MapBufferDiagramProps {
  drivenStep?: number | null;
}

function MapBufferDiagram({ drivenStep }: MapBufferDiagramProps) {
  const [internalStepIdx, setInternalStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const isDriven = typeof drivenStep === 'number';
  const stepIdx = isDriven
    ? Math.max(0, Math.min(MAP_STEPS.length - 1, drivenStep!))
    : internalStepIdx;

  const step = MAP_STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === MAP_STEPS.length - 1;

  // React pattern to adjust state during render instead of inside an Effect
  if (playing && (isDriven || isLast)) {
    setPlaying(false);
  }

  useEffect(() => {
    // We already adjust `playing` during render above, so we only
    // care if we are actively playing and not at the end.
    if (isDriven || !playing || isLast) return;

    const t = window.setTimeout(
      () => setInternalStepIdx((i) => Math.min(i + 1, MAP_STEPS.length - 1)),
      1600,
    );
    return () => window.clearTimeout(t);
  }, [playing, isLast, isDriven]);

  const writtenSet = useMemo(() => new Set(step.written), [step.written]);

  return (
    <div className="bm-dma">
      {/* Interactive Diagram */}
      <div className="bm-dma-stage" data-mapped={step.mapped ? 'true' : 'false'}>
        <div className="bm-dma-pointer-row">
          <span className={`bm-dma-pointer-label ${step.mapped ? 'live' : 'dead'}`}>
            {step.mapped ? 'ptr →' : 'ptr (invalid)'}
          </span>
          <div className="bm-dma-track">
            {Array.from({ length: BUFFER_CELLS }).map((_, i) => {
              const isCursor = step.cursor === i;
              const isPastEnd = step.cursor === BUFFER_CELLS && i === BUFFER_CELLS - 1;
              return (
                <div key={i} className="bm-dma-caret-slot">
                  {(isCursor || (isPastEnd && step.mapped)) && (
                    <span
                      className="bm-dma-caret"
                      style={{
                        transform:
                          step.cursor === BUFFER_CELLS
                            ? 'translateX(50%)'
                            : 'translateX(0)',
                      }}
                    >
                      ▼
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bm-dma-buffer-row">
          <span className="bm-dma-buffer-label">VBO</span>
          <div className="bm-dma-track">
            {Array.from({ length: BUFFER_CELLS }).map((_, i) => {
              const written = writtenSet.has(i);
              const atCursor = step.mapped && step.cursor === i;
              return (
                <div
                  key={i}
                  className={`bm-dma-cell ${written ? 'written' : ''} ${atCursor ? 'at-cursor' : ''}`}
                  title={`Cell ${i}${written ? ' (written)' : ''}`}
                >
                  <span className="bm-dma-cell-idx">{i}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bm-dma-state-row">
          <span className={`bm-dma-state ${step.mapped ? 'mapped' : 'unmapped'}`}>
            <span className="bm-dma-state-dot" />
            {step.mapped ? 'mapped' : 'unmapped'}
          </span>
          <span className="bm-dma-step-counter">
            Step <strong>{stepIdx + 1}</strong> / {MAP_STEPS.length}
          </span>
        </div>
      </div>

      {/* Code Callout */}
      <div className="bm-dma-callout">
        <pre className="bm-dma-code">{step.code}</pre>
        <p className="bm-dma-caption">{step.caption}</p>
      </div>

      {/* Controls */}
      {isDriven ? (
        <div className="bm-dma-driven-badge" role="status">
          <span className="bm-dma-driven-dot" />
          Driven by lesson
        </div>
      ) : (
        <div className="bm-dma-controls">
          <button
            type="button"
            className="bm-dma-ctrl"
            onClick={() => { setPlaying(false); setInternalStepIdx(0); }}
            title="Reset"
          >
            <RotateCcw size={11} />
          </button>

          <button
            type="button"
            className="bm-dma-ctrl"
            onClick={() => {
              setPlaying(false);
              setInternalStepIdx((i) => Math.max(0, i - 1));
            }}
            disabled={isFirst}
            title="Previous step"
          >
            <ChevronLeft size={12} />
          </button>

          <button
            type="button"
            className="bm-dma-ctrl primary"
            onClick={() => {
              if (isLast) {
                setInternalStepIdx(0);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={11} /> : <Play size={11} />}
            <span>{isLast && !playing ? 'Replay' : playing ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            className="bm-dma-ctrl"
            onClick={() => {
              setPlaying(false);
              setInternalStepIdx((i) => Math.min(MAP_STEPS.length - 1, i + 1));
            }}
            disabled={isLast}
            title="Next step"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Mapping diagram, contextualized.
 *
 * Shows up only when the selected object is in VBO + DYNAMIC + MAP_BUFFER —
 * i.e. when the *generated code* actually demonstrates mapping. When a
 * lesson drives the diagram via dmaDriverStep, the lesson always wins.
 *
 * Why the gating: previously this section was always visible regardless of
 * scene state, which made it feel like a disconnected curiosity. Now it
 * earns its space — switching the update method in the buffers panel makes
 * this appear and the corresponding code block in the panel light up at
 * the same time.
 */
function MappingSection({
  mode,
  usage,
  updateMethod,
  drivenStep,
}: {
  mode: RenderingMode;
  usage: BufferUsage;
  updateMethod: BufferUpdateMethod;
  drivenStep: number | null;
}) {
  const isFocused = drivenStep !== null;
  const matches =
    mode === 'VBO' && usage === 'DYNAMIC' && updateMethod === 'MAP_BUFFER';

  // Don't render at all unless the scene actually demonstrates mapping or a
  // lesson is explicitly driving the diagram.
  if (!matches && drivenStep === null) return null;

  return (
    <Section title="Mapping the Buffer" isFocused={isFocused}>
      <p className="explanation">
        <code>glMapBuffer</code> hands you a pointer into GPU memory.
        {drivenStep === null && ' Step through to watch where the pointer lands and which cells get rewritten.'}
      </p>
      <MapBufferDiagram drivenStep={drivenStep} />
    </Section>
  );
}

export default function BuffersMathContent() {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const dmaDriverStep = useVamsStore((s) => s.dmaDriverStep);

  const selected = objects.find((o) => o.id === selectedObjectId);

  // Lesson-driven diagram with no selection: render only the mapping section
  // so demos can run from a clean state without forcing the user to pre-select
  // an object first.
  if (!selected) {
    if (dmaDriverStep !== null) {
      return (
        <div className="primitives-math buffers-math">
          <MappingSection
            mode="VBO"
            usage="DYNAMIC"
            updateMethod="MAP_BUFFER"
            drivenStep={dmaDriverStep}
          />
        </div>
      );
    }
    return (
      <div className="empty-state">
        Select a primitive to inspect its memory footprint and GPU upload pattern.
      </div>
    );
  }

  if (!isPrimitive(selected)) {
    return (
      <div className="empty-state">
        Buffer math applies to drawing primitives only.
      </div>
    );
  }

  const mode: RenderingMode = selected.renderingMode ?? 'IMMEDIATE';
  const usage: BufferUsage = selected.bufferUsage ?? 'STATIC';
  const updateMethod: BufferUpdateMethod = selected.updateMethod ?? 'BUFFER_SUB_DATA';
  const profile = flowProfile(mode, usage);

  return (
    <div className="primitives-math buffers-math">
      {/* Current Output Code */}
      <CurrentDrawCall obj={selected} mode={mode} />

      <Section title="Memory Footprint">
        <MemoryFootprint obj={selected} />
      </Section>

      {selected.vertices.length >= 2 && (
        <Section title="Array vs Indexed">
          <MemoryComparison obj={selected} />
        </Section>
      )}

      {/* Immediate mode sends each vertex by glVertex2f, so the code declares no arrays. */}
      {mode !== 'IMMEDIATE' && (
        <Section title="Layout: Separate Arrays">
          <p className="explanation">
            In Vertex Array and VBO modes your program keeps one array per attribute. Positions,
            colours and UVs each have their own array, and glVertexPointer, glColorPointer and
            glTexCoordPointer each point at one.
            {selected.useIndexed &&
              ` With indexed drawing each different vertex is stored once, and indices_${sanitizeName(selected.name)} lists the vertex glDrawElements draws at each corner, in order.`}
          </p>
          <SeparateArrays obj={selected} />
        </Section>
      )}

      <Section title={
        mode === 'IMMEDIATE'    ? 'CPU → GPU Traffic — Immediate'    :
        mode === 'VERTEX_ARRAY' ? 'CPU → GPU Traffic — Vertex Array' :
                                  `CPU → GPU Traffic — VBO · ${usage}`
      }>
        <BufferFlow profile={profile} />
      </Section>

      <MappingSection
        mode={mode}
        usage={usage}
        updateMethod={updateMethod}
        drivenStep={dmaDriverStep}
      />
    </div>
  );
}
