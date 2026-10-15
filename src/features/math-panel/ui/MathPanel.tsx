import './math-panel.scss';
import { useMemo } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import { journeyStageFor } from '@/core/inspector';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { vertexJourney } from '../model/vertex-journey';
import JourneyFollow from './journey/JourneyFollow';
import JourneyTrack from './journey/JourneyTrack';

interface MathPanelProps {
  /** Replaces the "Math & data" title, such as the column's switch. */
  headerLead?: ComponentChildren;
  /** Rendered at the end of the header. */
  headerTrail?: ComponentChildren;
  /** Run makes the journey inert; the lead and trail stay usable. */
  contentInert?: boolean;
}

/** The math pane: one vertex of the selected object, followed through the six pipeline stages. */
export default function MathPanel({ headerLead, headerTrail, contentInert = false }: MathPanelProps = {}) {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const journeyVertex = useVamsStore((s) => s.journeyVertex);
  const setJourneyVertex = useVamsStore((s) => s.setJourneyVertex);
  const setOverride = useVamsStore((s) => s.setJourneyStageOverride);
  const getAllTextures = useVamsStore((s) => s.getAllTextures);
  const uploaded = useVamsStore((s) => s.uploadedTextures);
  const open = useVamsStore(journeyStageFor);
  const canvas = useCanvasSize();

  const journey = useMemo(
    () => vertexJourney({ objects, viewportLimits, textures: getAllTextures() }, selectedObjectId, journeyVertex, canvas),
    // getAllTextures is stable; uploads change `uploaded`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [objects, viewportLimits, selectedObjectId, journeyVertex, canvas, uploaded],
  );
  const node = objects.find((o) => o.id === selectedObjectId);

  const step = (delta: 1 | -1) => {
    if (journey.subject.kind !== 'shape' || journey.subject.count === 0) return;
    const { vertex, count } = journey.subject;
    setJourneyVertex((vertex + delta + count) % count);
  };

  return (
    <div className="math-panel-container">
      <div className={headerLead ? 'math-header math-header--lead' : 'math-header'}>
        {headerLead ?? <span className="math-title">Math &amp; data</span>}
        {headerTrail && <span className="math-header__trail">{headerTrail}</span>}
      </div>
      <div className="journey" inert={contentInert || undefined}>
        <JourneyFollow subject={journey.subject} onStep={step} />
        <JourneyTrack journey={journey} open={open} node={node} onOpen={setOverride} />
      </div>
    </div>
  );
}
