import { useEffect, useId, useRef, useState } from 'react';
import type { JourneyStageId } from '@/core/inspector';
import type { ExplainRequest } from '@/core/store/types';
import type { SceneNode } from '@/core/types/scene';
import type { VertexJourney } from '../../model/vertex-journey';
import WorkingTable from './WorkingTable';
import { DEEPER_LABEL, StagePictures } from './stage-pictures';

interface JourneyTrackProps {
  journey: VertexJourney;
  open: JourneyStageId;
  node: SceneNode | undefined;
  onOpen: (stage: JourneyStageId) => void;
  /** A working row's GL call was chosen (Task 15). */
  onCall?: (request: ExplainRequest) => void;
}

/** Every stage is a row on a vertical line; exactly one is open with its working. */
export default function JourneyTrack({ journey, open, node, onOpen, onCall }: JourneyTrackProps) {
  const baseId = useId();
  const [deeperFor, setDeeperFor] = useState<JourneyStageId | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // Set only when the student opens a stage here; the effect below moves focus to its heading.
  const takeFocus = useRef(false);
  const choose = (id: JourneyStageId) => {
    takeFocus.current = true;
    onOpen(id);
  };
  useEffect(() => {
    if (!takeFocus.current) return;
    takeFocus.current = false;
    (listRef.current?.querySelector('.journey-open__title button') as HTMLElement | null)?.focus();
  }, [open]);
  const openIndex = journey.stages.findIndex((s) => s.id === open);
  const following = journey.subject.kind !== 'none';
  return (
    <ol className="journey-track" ref={listRef}>
      {journey.stages.map((stage, k) => {
        const done = k < openIndex;
        if (k !== openIndex) {
          return (
            <li key={stage.id} className={`journey-stage${done ? ' is-done' : ''}`}>
              <button type="button" className="journey-stage__row" aria-expanded="false" onClick={() => choose(stage.id)}>
                <span className="journey-stage__dot" aria-hidden="true" />
                <span className="journey-stage__name">{stage.title}</span>
                <span className="journey-stage__value">{stage.result ?? (following ? '—' : stage.sentence)}</span>
              </button>
            </li>
          );
        }
        const bodyId = `${baseId}-${stage.id}`;
        const prev = journey.stages[k - 1];
        const next = journey.stages[k + 1];
        const deeperLabel = node ? DEEPER_LABEL[stage.id] : undefined;
        const deeper = deeperFor === stage.id;
        return (
          <li key={stage.id} className="journey-stage is-open">
            <span className="journey-stage__dot" aria-hidden="true" />
            <div className="journey-open__head">
              <h3 className="journey-open__title">
                <button type="button" aria-expanded="true" aria-controls={bodyId}>{stage.title}</button>
              </h3>
              <span className="journey-open__section">{stage.section}</span>
            </div>
            <div id={bodyId}>
              <p className="journey-open__why">{stage.sentence}</p>
              {stage.result !== null && <WorkingTable rows={stage.rows} result={stage.result} onCall={onCall} wrapSteps={stage.id === 'stored'} />}
              <div className="journey-open__pictures">
                <StagePictures stage={stage} node={node} deeper={deeper} deeperId={`${bodyId}-deeper`} world={journey.stages[1]?.point ?? null} ndc={journey.stages[2]?.point ?? null} />
              </div>
              <div className="journey-open__foot">
                {deeperLabel ? (
                  <button
                    type="button"
                    className="journey-open__deeper"
                    aria-expanded={deeper}
                    aria-controls={`${bodyId}-deeper`}
                    onClick={() => setDeeperFor(deeper ? null : stage.id)}
                  >
                    {deeperLabel} <span aria-hidden="true">{deeper ? '‹' : '›'}</span>
                  </button>
                ) : (
                  <span />
                )}
                <span className="journey-open__nav">
                  {prev && (
                    <button type="button" className="journey-open__back" onClick={() => choose(prev.id)}><span aria-hidden="true">‹</span> {prev.title}</button>
                  )}
                  {next && (
                    <button type="button" className="journey-open__next" onClick={() => choose(next.id)}>{next.title} <span aria-hidden="true">›</span></button>
                  )}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
