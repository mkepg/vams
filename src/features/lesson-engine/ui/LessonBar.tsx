import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { PipelineMode } from '@/core/store/types';
import { Button, SegmentedControl } from '@/shared/ui/controls';
import { useLessonRunner } from '../model/useLessonRunner';
import MultipleChoiceWidget from './exercise-widgets/MultipleChoiceWidget';
import OrderListWidget from './exercise-widgets/OrderListWidget';
import './lesson-bar.scss';

const PIPELINE_MODES: { value: PipelineMode; label: string }[] = [
  { value: 'Diagram', label: 'Diagram' },
  { value: 'RasterVector', label: 'Raster vs vector' },
  { value: 'Playground', label: 'Playground' },
];

/** The lesson, along the bottom of the canvas. Mount once; it renders only in Lesson mode. */
export default function LessonBar() {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');

  // Leaving a lesson removes the bar and its focused Exit button. When that drops focus to the
  // page, hand it to the Learn button; never take it from elsewhere.
  const wasInLesson = useRef(inLesson);
  useLayoutEffect(() => {
    const left = wasInLesson.current && !inLesson;
    wasInLesson.current = inLesson;
    if (!left) return;
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) return;
    document.querySelector<HTMLElement>('.learn-trigger')?.focus();
  }, [inLesson]);

  return inLesson ? <LessonBarBody /> : null;
}

/** Runs the step engine; mounted only during a lesson. */
function LessonBarBody() {
  const runner = useLessonRunner();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pipelineLesson = useVamsStore((s) => s.activeSection === 'Pipeline');
  const pipelineMode = useVamsStore((s) => s.pipelineMode);
  const setPipelineMode = useVamsStore((s) => s.setPipelineMode);
  const focusPanelId = useVamsStore((s) => s.lessonFocusPanel);
  const lessonId = runner.active ? runner.lesson?.id ?? null : null;
  const stepKey = lessonId ? `${lessonId}:${runner.stepIndex}` : null;

  // Folding is per lesson, and a new step always unfolds so its narration is never missed.
  const [folded, setFolded] = useState(false);
  const [foldedFor, setFoldedFor] = useState(stepKey);
  if (stepKey !== foldedFor) {
    setFoldedFor(stepKey);
    if (folded) setFolded(false);
  }

  // Starting a lesson from the Learn drawer closes the drawer, which drops focus to the page or
  // back to the Learn button. Hand it to the lesson title; never take it from elsewhere.
  useEffect(() => {
    if (!lessonId) return;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected || active.closest('.learn-trigger')) titleRef.current?.focus();
  }, [lessonId]);

  if (!runner.active || !runner.lesson || !runner.step) return null;
  const { lesson, step, stepIndex, stepCount, isLastStep, canAdvance } = runner;
  const width = `${((stepIndex + 1) / stepCount) * 100}%`;

  const progress = (
    <div
      className="lesson-bar__progress"
      role="progressbar"
      aria-label="Lesson progress"
      aria-valuemin={1}
      aria-valuemax={stepCount}
      aria-valuenow={stepIndex + 1}
    >
      <i style={{ width }} />
    </div>
  );
  const next = (
    <Button
      variant="primary"
      className="lesson-bar__next"
      icon={isLastStep ? <CheckCircle2 /> : <ChevronRight />}
      title={isLastStep ? 'Finish lesson' : 'Next step (→)'}
      disabled={!canAdvance}
      onClick={isLastStep ? runner.finish : runner.next}
    >
      {isLastStep ? 'Finish' : 'Next'}
    </Button>
  );
  const meta = (
    <div className="lesson-bar__meta">
      <h2 ref={titleRef} className="lesson-bar__title" tabIndex={-1}>{lesson.title}</h2>
      <span className="lesson-bar__sep" aria-hidden="true">·</span>
      <span className="lesson-bar__step">Step {stepIndex + 1} of {stepCount}</span>
      <span className="lesson-bar__tools">
        <Button
          variant="quiet"
          iconOnly
          className="lesson-bar__tool"
          label={folded ? 'Unfold lesson' : 'Fold lesson'}
          icon={folded ? <ChevronUp /> : <ChevronDown />}
          onClick={() => setFolded(!folded)}
        />
        {!folded && (
          <Button variant="quiet" iconOnly className="lesson-bar__tool" label="Exit lesson (Esc)" icon={<X />} onClick={runner.exit} />
        )}
      </span>
      {folded && next}
    </div>
  );

  if (folded) {
    return (
      <section className="lesson-bar is-folded" aria-label="Lesson">
        {progress}
        {meta}
      </section>
    );
  }

  const done = canAdvance;
  return (
    <section className="lesson-bar" aria-label="Lesson">
      {progress}
      {meta}
      <p className="lesson-bar__narration" aria-live="polite">{step.narration}</p>
      {pipelineLesson && (
        <div
          className={focusPanelId === 'pipeline-mode-controls' ? 'lesson-bar__modes is-lesson-focus' : 'lesson-bar__modes'}
          data-panel-id="pipeline-mode-controls"
        >
          <SegmentedControl label="Viewport mode" options={PIPELINE_MODES} value={pipelineMode} onChange={setPipelineMode} />
        </div>
      )}
      {step.exercise && (
        <div className="lesson-bar__exercise" key={`ex-${lesson.id}-${stepIndex}`}>
          {step.exercise.kind === 'multiple-choice' && (
            <MultipleChoiceWidget
              prompt={step.exercise.prompt}
              visualArtifact={step.exercise.visualArtifact}
              options={step.exercise.options}
              selectedId={runner.mcAnswer}
              correctId={step.exercise.correctId}
              onSelect={runner.setMcAnswer}
            />
          )}
          {step.exercise.kind === 'ordered-list' && runner.orderAnswer && (
            <OrderListWidget
              prompt={step.exercise.prompt}
              items={step.exercise.items}
              order={runner.orderAnswer}
              correctOrder={step.exercise.correctOrder}
              onChange={runner.setOrderAnswer}
            />
          )}
        </div>
      )}
      {step.waitForUser && (
        <p className={done ? 'lesson-bar__task is-done' : 'lesson-bar__task'}>
          <span className="lesson-bar__dot" aria-hidden="true" />
          {done ? (step.task ? `Done · ${step.task}` : 'Done') : step.task ?? 'Waiting for you'}
        </p>
      )}
      <div className="lesson-bar__nav">
        <Button
          variant="quiet"
          className="lesson-bar__back"
          icon={<ChevronLeft />}
          title="Previous step (←)"
          disabled={stepIndex === 0}
          onClick={runner.back}
        >
          Back
        </Button>
        {next}
      </div>
    </section>
  );
}
