import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { demoSubject } from '../model/pipeline-subject';
import type { StageIndex } from '../model/stage-lines';
import StageFigure from './StageFigure';
import './pedagogical-views.scss';

/** Room left round the drawing, in CSS px. */
const MARGIN = 12;
/** The frame's growth round the viewing volume, as a share of it. */
const FRAME_MARGIN = 0.04;
/** The drawing's width before the stage has been measured. */
const FALLBACK = 360;

/**
 * A "Which Stage?" question's picture: one stage of the demo triangle, as large as the canvas stage allows,
 * square and centred. It carries no name, sentence or program line; naming the stage is the question.
 */
export default function QuizFigure({ stage }: { stage: StageIndex }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FALLBACK);
  const subject = useMemo(() => demoSubject(), []);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const side = Math.floor(Math.min(el.clientWidth, el.clientHeight)) - 2 * MARGIN;
      if (side > 0) setSize(side);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} className="quiz-figure">
      <StageFigure stage={stage} subject={subject} size={size} animate={false} margin={FRAME_MARGIN} />
    </div>
  );
}
