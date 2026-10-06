import { Square, ChevronLeft, ChevronRight, CheckCircle2, GraduationCap, PlayCircle } from 'lucide-react';
import { useLessonRunner } from '../model/useLessonRunner';
import MultipleChoiceWidget from './exercise-widgets/MultipleChoiceWidget';
import OrderListWidget from './exercise-widgets/OrderListWidget';
import './lesson-bar.scss';

export default function LessonBar() {
  const runner = useLessonRunner();
  if (!runner.active || !runner.lesson || !runner.step) return null;
  const { lesson, step, stepIndex: currentStepIndex, isLastStep, canAdvance } = runner;
  const progressPercent = ((currentStepIndex + 1) / lesson.steps.length) * 100;
  const lessonTypeIcon = lesson.type === 'exercise' ? <GraduationCap size={14} /> : <PlayCircle size={14} />;
  const activeLessonId = lesson.id;

  return (
    <div
      className={`lesson-bar ${step.exercise ? 'has-exercise' : ''}`}
      style={{ '--progress': `${progressPercent}%` } as React.CSSProperties}
      role="region"
      aria-label="Lesson navigation"
    >
      {step.exercise && (
        <div className="lesson-exercise-area" key={`${activeLessonId}-${currentStepIndex}`}>
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

      <div className="lesson-bar-main">
        <div className="lesson-info">
          <span className="lesson-type-chip">
            {lessonTypeIcon}
            <span>{lesson.type === 'exercise' ? 'Exercise' : 'Demo'}</span>
          </span>
          <span className="lesson-title" title={lesson.title}>
            {lesson.title}
          </span>
        </div>

        <div className="lesson-narration">
          <p key={`${activeLessonId}-${currentStepIndex}`}>{step.narration}</p>
          <span className="step-counter">
            Step <strong>{currentStepIndex + 1}</strong> of {lesson.steps.length}
          </span>
        </div>

        <div className="lesson-controls">
          <button className="control-btn exit" onClick={runner.exit} title="Exit lesson (Esc)">
            <Square size={13} />
            <span>Exit</span>
          </button>
          <button
            className="control-btn"
            onClick={runner.back}
            disabled={currentStepIndex === 0}
            title="Previous step (←)"
          >
            <ChevronLeft size={15} />
            <span>Back</span>
          </button>
          <button
            className={`control-btn primary ${canAdvance ? 'ready' : ''}`}
            onClick={isLastStep ? runner.exit : runner.next}
            disabled={!canAdvance}
            title={isLastStep ? 'Finish lesson' : 'Next step (→)'}
          >
            {isLastStep ? <CheckCircle2 size={15} /> : <ChevronRight size={15} />}
            <span>{isLastStep ? 'Finish' : 'Next'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
