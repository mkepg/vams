import { ChevronLeft, ChevronRight, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/shared/ui/controls';
import { useLessonRunner } from '../model/useLessonRunner';
import MultipleChoiceWidget from './exercise-widgets/MultipleChoiceWidget';
import OrderListWidget from './exercise-widgets/OrderListWidget';
import './lesson-card.scss';

/** The lesson, shown at the top of the section column in Lesson mode. Runs the step engine; mount once. */
export default function LessonCard() {
  const runner = useLessonRunner();
  if (!runner.active || !runner.lesson || !runner.step) return null;
  const { lesson, step, stepIndex, stepCount, isLastStep, canAdvance } = runner;
  const stepKey = `${lesson.id}-${stepIndex}`;
  const waiting = !!step.waitForUser && !canAdvance;

  return (
    <section className="lesson-card" aria-label="Lesson">
      <div className="lesson-card__head">
        <span className="lesson-card__chip">{lesson.type === 'exercise' ? 'Exercise' : 'Demo'}</span>
        <span className="lesson-card__section">{lesson.section}</span>
        <Button variant="quiet" className="lesson-card__exit" icon={<X />} title="Exit lesson (Esc)" onClick={runner.exit}>
          Exit
        </Button>
      </div>
      <h2 className="lesson-card__title">{lesson.title}</h2>
      <div
        className="lesson-card__progress"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={1}
        aria-valuemax={stepCount}
        aria-valuenow={stepIndex + 1}
      >
        {Array.from({ length: stepCount }, (_, i) => (
          <i key={i} className={i < stepIndex ? 'is-done' : i === stepIndex ? 'is-now' : undefined} />
        ))}
        <span className="lesson-card__count">{stepIndex + 1} / {stepCount}</span>
      </div>
      <p className="lesson-card__narration" aria-live="polite" key={stepKey}>{step.narration}</p>
      {step.exercise && (
        <div className="lesson-card__exercise" key={`ex-${stepKey}`}>
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
      <div className="lesson-card__nav">
        {waiting && <span className="lesson-card__waiting">Waiting for you</span>}
        <Button icon={<ChevronLeft />} title="Previous step (←)" disabled={stepIndex === 0} onClick={runner.back}>
          Back
        </Button>
        <Button
          variant="primary"
          icon={isLastStep ? <CheckCircle2 /> : <ChevronRight />}
          title={isLastStep ? 'Finish lesson' : 'Next step (→)'}
          disabled={!canAdvance}
          onClick={isLastStep ? runner.exit : runner.next}
        >
          {isLastStep ? 'Finish' : 'Next'}
        </Button>
      </div>
    </section>
  );
}
