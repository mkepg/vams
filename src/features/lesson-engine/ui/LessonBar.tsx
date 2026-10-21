import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleCheck,
  CircleHelp,
  Lightbulb,
  X,
} from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';
import { useLessonRunner } from '../model/useLessonRunner';
import { goalLabelParts, waitsForStudent } from '../model/step-rules';
import MultipleChoiceWidget from './exercise-widgets/MultipleChoiceWidget';
import OrderListWidget from './exercise-widgets/OrderListWidget';
import CodeBlankWidget from './exercise-widgets/CodeBlankWidget';
import './lesson-bar.scss';

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
  const requestExplain = useVamsStore((s) => s.requestExplain);
  const lessonId = runner.active ? runner.lesson?.id ?? null : null;
  const stepKey = lessonId ? `${lessonId}:${runner.stepIndex}` : null;

  // Folding is per lesson, and a new step always unfolds so its narration is never missed.
  const [folded, setFolded] = useState(false);
  const [foldedFor, setFoldedFor] = useState(stepKey);
  if (stepKey !== foldedFor) {
    setFoldedFor(stepKey);
    if (folded) setFolded(false);
  }

  // Help is per step too: a new step starts with Stuck? closed and no hint showing.
  const [stuck, setStuck] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [helpFor, setHelpFor] = useState(stepKey);
  // A help control that is pressed may be replaced (Stuck? by its links, the last Show by Skip,
  // Skip by a lit Next), so focus moves to whatever now stands in its place.
  const refocusHelp = useRef<'help' | 'next' | null>(null);
  const helpRef = useRef<HTMLSpanElement>(null);
  if (stepKey !== helpFor) {
    setHelpFor(stepKey);
    if (stuck) setStuck(false);
    if (hintsShown) setHintsShown(0);
  }
  // A focus hand-off still waiting when the step changes belongs to the old step.
  useLayoutEffect(() => {
    refocusHelp.current = null;
  }, [stepKey]);
  useLayoutEffect(() => {
    const target = refocusHelp.current;
    if (!target) return;
    const bar = titleRef.current?.closest('.lesson-bar');
    const next = bar?.querySelector<HTMLButtonElement>('.lesson-bar__next:not(:disabled)');
    // Skip's solve lands through the store; wait for the render that lights Next.
    if (target === 'next' && !next) return;
    refocusHelp.current = null;
    const link = target === 'help' ? helpRef.current?.querySelector<HTMLButtonElement>('button') : null;
    (link ?? next ?? titleRef.current)?.focus();
  });

  // Starting a lesson from the Learn drawer closes the drawer, which drops focus to the page or
  // back to the Learn button. Hand it to the lesson title; never take it from elsewhere.
  useEffect(() => {
    if (!lessonId) return;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected || active.closest('.learn-trigger')) titleRef.current?.focus();
  }, [lessonId]);

  // Next sits in the strip when folded and in the nav row when unfolded, so it remounts when a new
  // step unfolds the bar. Pressing it on the strip hands focus to the unfolded bar's Next.
  const refocusNext = useRef(false);
  useLayoutEffect(() => {
    if (!refocusNext.current) return;
    refocusNext.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const bar = titleRef.current?.closest('.lesson-bar');
    const button = bar?.querySelector<HTMLButtonElement>('.lesson-bar__next:not(:disabled)');
    (button ?? titleRef.current)?.focus();
  }, [stepKey]);

  // The narrow layout's drawer needs the bar's height to keep its last items clear of the bar.
  // The editor publishes it as --lesson-bar-height while the bar shows.
  useEffect(() => {
    const bar = titleRef.current?.closest<HTMLElement>('.lesson-bar');
    const editor = bar?.closest<HTMLElement>('.editor');
    if (!bar || !editor) return;
    const publish = () => editor.style.setProperty('--lesson-bar-height', `${Math.round(bar.getBoundingClientRect().height)}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return () => editor.style.removeProperty('--lesson-bar-height');
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      editor.style.removeProperty('--lesson-bar-height');
    };
  }, [folded, lessonId]);

  if (!runner.active || !runner.lesson || !runner.step) return null;
  const { lesson, step, stepIndex, stepCount, isLastStep, canAdvance } = runner;
  const width = `${((stepIndex + 1) / stepCount) * 100}%`;
  // The last step names the next lesson in the section; a section's last lesson, or one outside the course, reads Finish.
  const nextLabel = !isLastStep ? 'Next' : runner.nextLesson?.title ?? 'Finish';
  const nextTitle = !isLastStep
    ? 'Next step (→)'
    : runner.nextLesson
      ? `Next lesson: ${runner.nextLesson.title}`
      : 'Finish lesson';

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
      icon={<ChevronRight />}
      iconAfter
      title={nextTitle}
      disabled={!canAdvance}
      onClick={() => {
        refocusNext.current = folded;
        (isLastStep ? runner.finish : runner.next)();
      }}
    >
      {nextLabel}
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
  const goals = runner.goals && runner.goals.length > 0 ? runner.goals : null;
  const hints = step.hints ?? [];
  const moreHints = hintsShown < hints.length;
  // Stuck? is for a waiting step that has something to offer, and only until the step passes.
  const showHelp = waitsForStudent(step) && !done && (moreHints || runner.canSkip);
  const hint = !done && hintsShown > 0 ? hints[Math.min(hintsShown, hints.length) - 1] : null;
  // On a goals step the goals are the task, and on a fill-in step the blanks are: the line appears only once the step is done.
  const showTask = goals || step.exercise?.kind === 'code' ? done : !!(step.successCheck || step.exercise || step.task);

  const predict = step.predict ?? null;
  const picked = predict && runner.predictAnswer ? predict.options.find((o) => o.id === runner.predictAnswer) ?? null : null;
  const pickedRight = !!picked && picked.id === predict?.correctId;

  const help = showHelp && (
    <span className="lesson-bar__stuck" ref={helpRef}>
      {!stuck ? (
        <button
          type="button"
          key="stuck"
          className="lesson-bar__stuck-open"
          onClick={() => {
            refocusHelp.current = 'help';
            setStuck(true);
          }}
        >
          <CircleHelp size={14} strokeWidth={1.75} aria-hidden="true" />
          Stuck?
        </button>
      ) : (
        <>
          {moreHints && (
            <button
              type="button"
              key="hint"
              className="lesson-bar__link"
              onClick={() => {
                refocusHelp.current = 'help';
                setHintsShown(hintsShown + 1);
              }}
            >
              {hintsShown > 0 ? 'Show another hint' : 'Show a hint'}
            </button>
          )}
          {moreHints && runner.canSkip && <span key="sep" className="lesson-bar__link-sep" aria-hidden="true">·</span>}
          {runner.canSkip && (
            <button
              type="button"
              key="skip"
              className="lesson-bar__link"
              onClick={() => {
                refocusHelp.current = 'next';
                runner.skip();
              }}
            >
              Skip this step
            </button>
          )}
        </>
      )}
    </span>
  );

  return (
    <section className="lesson-bar" aria-label="Lesson">
      {progress}
      {meta}
      <p className="lesson-bar__narration" aria-live="polite">{step.narration}</p>
      {predict && !picked && (
        <div className="lesson-bar__choices" role="group" aria-label="Your prediction">
          {predict.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="lesson-bar__choice"
              onClick={() => {
                // The answers give way to the verdict, so focus moves on to the lit Next.
                refocusHelp.current = 'next';
                runner.pick(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {/* Mounted for the whole of a predict step, before the pick, so the verdict is announced.
          It lays out no box of its own. */}
      {predict && (
        <div className="lesson-bar__verdict-live" aria-live="polite">
          {picked && (
            <p className="lesson-bar__verdict">
              <span className={pickedRight ? 'lesson-bar__pick' : 'lesson-bar__pick is-wrong'}>
                {pickedRight ? (
                  <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                )}
                {picked.label}
                <span className="sr-only">{pickedRight ? ', correct' : ', incorrect'}</span>
              </span>
              <span>{picked.why}</span>
            </p>
          )}
        </div>
      )}
      {step.recap && (
        <>
          <ul className="lesson-bar__learned">
            {step.recap.points.map((point, i) => (
              <li key={i}>
                <Check size={13} strokeWidth={1.75} aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="lesson-bar__calls">
            You used
            {step.recap.calls.map((call) => (
              <button
                key={call}
                type="button"
                className="lesson-bar__call"
                title={`Show ${call} in the code`}
                onClick={() => requestExplain(call)}
              >
                {call}
              </button>
            ))}
          </p>
        </>
      )}
      {step.exercise && (
        <div className="lesson-bar__exercise" key={`ex-${lesson.id}-${stepIndex}`}>
          {step.exercise.kind === 'multiple-choice' && (
            <MultipleChoiceWidget
              prompt={step.exercise.prompt}
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
          {step.exercise.kind === 'code' && (
            <CodeBlankWidget
              template={step.exercise.template}
              wrong={step.exercise.blanks.map((blank) => blank.wrong)}
              values={runner.codeAnswers}
              verdicts={runner.codeVerdicts}
              onChange={runner.setCodeAnswer}
            />
          )}
        </div>
      )}
      {goals && (
        <ul className="lesson-bar__goals" aria-label="Goals">
          {goals.map((goal, i) => (
            <li key={i} className={goal.met ? 'lesson-bar__goal is-met' : 'lesson-bar__goal'}>
              {goal.met ? (
                <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Circle size={14} strokeWidth={1.75} aria-hidden="true" />
              )}
              <span className="lesson-bar__goal-label">
                {goalLabelParts(goal.label).map((part, j) =>
                  part.num ? <span key={j} className="lesson-bar__num">{part.text}</span> : part.text,
                )}
              </span>
              {goal.met && <span className="sr-only">, met</span>}
            </li>
          ))}
        </ul>
      )}
      {/* Mounted for the whole of a step with hints, before any shows, so a hint that appears or
          changes is announced. It lays out no box of its own. */}
      {hints.length > 0 && (
        <div className="lesson-bar__hint-live" aria-live="polite">
          {hint && (
            <p className="lesson-bar__hint">
              <Lightbulb size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{hint}</span>
              <span className="lesson-bar__hint-count">{Math.min(hintsShown, hints.length)} of {hints.length}</span>
            </p>
          )}
        </div>
      )}
      {showTask && (
        <p className={done ? 'lesson-bar__task is-done' : 'lesson-bar__task'}>
          <span className="lesson-bar__dot" aria-hidden="true" />
          {done ? (step.task ? `Done · ${step.task}` : 'Done') : step.task ?? 'Waiting for you'}
        </p>
      )}
      <div className="lesson-bar__nav">
        {help}
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
