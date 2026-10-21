import { useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useVamsStore } from '@/core/store';
import { JOURNEY_STAGE_TITLES } from '@/core/inspector/journey-stage';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { outlineCode } from '@/features/code-generation/model/code-outline';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { pipelineSubject } from '../model/pipeline-subject';
import { STAGES, stageProgramLine, type StageIndex } from '../model/stage-lines';
import { INTRO, stageSentence } from '../model/stage-copy';
import StageFigure from './StageFigure';
import './pedagogical-views.scss';

const LAST = (STAGES.length - 1) as StageIndex;

/**
 * The pipeline as a strip of seven small drawings of the student's shape, over one large drawing of the
 * chosen stage with its sentence, the line from the program that does it, and a link to the same stage in Math.
 */
export default function PipelineDiagram() {
  const stage = useVamsStore((s) => s.activePipelineStage) as StageIndex | null;
  const setActivePipelineStage = useVamsStore((s) => s.setActivePipelineStage);
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const canvasBackgroundColor = useVamsStore((s) => s.canvasBackgroundColor);
  const callbacks = useVamsStore((s) => s.callbacks);
  const getAllTextures = useVamsStore((s) => s.getAllTextures);
  const requestExplain = useVamsStore((s) => s.requestExplain);
  const selectObject = useVamsStore((s) => s.selectObject);
  const setJourneyStageOverride = useVamsStore((s) => s.setJourneyStageOverride);
  const setCodePane = useVamsStore((s) => s.setCodePane);
  const canvasSize = useCanvasSize();
  // Re-render on uploads:
  useVamsStore((s) => s.uploadedTextures);

  const subject = useMemo(
    () => pipelineSubject({ objects, selectedObjectId, viewportLimits, canvasBackgroundColor }),
    [objects, selectedObjectId, viewportLimits, canvasBackgroundColor],
  );
  // The same program the code panel shows, so the line found here is the line found there.
  const outline = useMemo(
    () =>
      outlineCode(
        generateCodeFromState({ objects, canvasBackgroundColor, callbacks, viewportLimits, textures: getAllTextures() }, canvasSize),
      ),
    [objects, canvasBackgroundColor, callbacks, viewportLimits, getAllTextures, canvasSize],
  );
  const line = stage === null ? null : stageProgramLine(stage, outline, subject);

  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const choose = (next: StageIndex) => {
    setActivePipelineStage(next);
    buttons.current[next]?.focus();
  };
  const onStripKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    if (e.key === 'ArrowRight') choose(stage === null ? 0 : (Math.min(LAST, stage + 1) as StageIndex));
    else choose(stage === null ? LAST : (Math.max(0, stage - 1) as StageIndex));
  };

  const openMath = (i: StageIndex) => {
    if (subject.node && selectedObjectId !== subject.node.id) selectObject(subject.node.id);
    setJourneyStageOverride(STAGES[i].math);
    setCodePane('math');
  };

  return (
    <div className="pedagogical-overlay pipeline-diagram">
      <div className="pipeline-diagram__sheet">
        <div className="pipeline-strip" role="group" aria-label="Pipeline stages" onKeyDown={onStripKey}>
          {STAGES.map((st, i) => (
            <button
              key={st.short}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              className={`pipeline-strip__stage${stage === i ? ' is-chosen' : ''}`}
              aria-pressed={stage === i}
              title={st.title}
              onClick={() => setActivePipelineStage(i)}
            >
              <StageFigure stage={i as StageIndex} subject={subject} size={62} animate={false} />
              <span className="pipeline-strip__number">{i + 1}</span>
              <span className="pipeline-strip__name">{st.short}</span>
            </button>
          ))}
        </div>

        <div className="pipeline-focus">
          <div className="pipeline-focus__figure">
            <StageFigure stage={stage ?? LAST} subject={subject} size={270} animate={stage !== null} />
          </div>
          <div className="pipeline-focus__text" aria-live="polite">
            {stage === null ? (
              <>
                <h2 className="pipeline-focus__title">{INTRO.title}</h2>
                <p className="pipeline-focus__sentence">{INTRO.text}</p>
              </>
            ) : (
              <>
                <p className="pipeline-focus__kicker">
                  Stage {stage + 1} of {STAGES.length}
                </p>
                <h2 className="pipeline-focus__title">{STAGES[stage].title}</h2>
                <p className="pipeline-focus__sentence">{stageSentence(stage, subject, canvasSize)}</p>
                {line && (
                  <>
                    <p className="pipeline-focus__label">In your program</p>
                    <button
                      type="button"
                      className="pipeline-focus__line"
                      title="Show this line in the code"
                      onClick={() => requestExplain(line.request)}
                    >
                      <span className="pipeline-focus__line-number">{line.line + 1}</span>
                      <code>{line.text}</code>
                    </button>
                  </>
                )}
                <button type="button" className="pipeline-focus__math" onClick={() => openMath(stage)}>
                  See it in Math: {JOURNEY_STAGE_TITLES[STAGES[stage].math]} ›
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
