import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useVamsStore } from '@/core/store';
import type { Lesson, LessonStep } from '@/core/types/lesson';
import { resolveFocus } from '@/core/inspector';
import { getLessonById } from './lesson-registry';
import { isSectionEnd, nextInCourse } from './catalog';
import { markLessonComplete, markLessonSkipped, recordLessonLeft } from './progress';
import { canSkip as stepCanSkip, waitsForStudent } from './step-rules';
import { focusStyleFor } from './guidance';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { resolveChangedLines } from '@/features/code-generation/model/code-diff';

interface PredictAnswers {
  lessonId: string | null;
  byStep: Record<number, string>;
}
const NO_ANSWERS: Record<number, string> = {};

const DEFAULT_LESSON_VIEWPORT = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

const ARROW_KEY_OWNERS = [
  '[role="menu"]', '[role="menuitem"]', '[role="radiogroup"]', '[role="tree"]',
  '[role="slider"]', '[role="dialog"]', '[role="alertdialog"]', '[role="spinbutton"]',
].join(', ');
const ESCAPE_KEY_OWNERS = '[role="menu"], [role="dialog"], [role="alertdialog"]';

/** Leaves the editor for the course map. An object, so a test can stand in for the page load. */
export const courseMap = {
  go(href: string): void {
    window.location.assign(href);
  },
};

export interface LessonRunner {
  /** True when appMode is Lesson and a lesson and step exist. */
  active: boolean;
  lesson: Lesson | null;
  step: LessonStep | null;
  stepIndex: number;
  stepCount: number;
  isLastStep: boolean;
  canAdvance: boolean;
  /** The step's goals, each with whether the scene meets it now; null when the step has none. */
  goals: { label: string; met: boolean }[] | null;
  /** The step can be solved for the student and has not passed yet. */
  canSkip: boolean;
  /** Solves the step (one undo step) or fills in the right answer. Never advances. */
  skip: () => void;
  /** Skip was used in this run of the lesson; Finish records the lesson as skipped. */
  skipped: boolean;
  /** The next lesson in the course, in the same section, which the last step's button names and starts. */
  nextLesson: { id: string; title: string } | null;
  /** The lesson is its section's last: Finish then opens the course map at the section. */
  finishGoesToMap: boolean;
  /** The answer picked on this predict step in this run, or null before a pick. */
  predictAnswer: string | null;
  /** Records the predict step's answer and runs its action, as a step forward would. Once per step. */
  pick: (optionId: string) => void;
  mcAnswer: string | null;
  setMcAnswer: (id: string | null) => void;
  orderAnswer: string[] | null;
  setOrderAnswer: (order: string[]) => void;
  next: () => void;
  back: () => void;
  exit: () => void;
  finish: () => void;
}

/** The step's focus target, or none for a section's last exercise. */
function effectiveFocus(lesson: Lesson, step: LessonStep): string | null {
  return focusStyleFor(lesson) === 'none' ? null : step.focusPanel ?? null;
}

/** A per-object focus needs an object: pick the newest when nothing is selected. */
function selectForFocus(panelId: string | null) {
  const s = useVamsStore.getState();
  if (!panelId || s.selectedObjectId || s.objects.length === 0) return;
  if (resolveFocus(panelId, false)?.area !== 'object') return;
  s.selectObject(s.objects[0].id);
}

/** The clean scene a lesson replays its steps on: Back, a jump and the lesson's start rebuild from it. */
export function resetLessonScene(): void {
  useVamsStore.setState({
    objects: [],
    callbacks: emptyCallbacks(),
    canvasBackgroundColor: '#000000',
    viewportLimits: { ...DEFAULT_LESSON_VIEWPORT },
    selectedObjectId: null,
    interactionMode: 'SELECT',
  });
}

/**
 * Rebuilds the scene a student finds on reaching step `index`, before its action runs: every
 * earlier step's action, then its solve when it has one, which stands in for the student's own work.
 * The step's own solve never runs here.
 */
export function replayStepsBefore(lesson: Lesson, index: number): void {
  for (let i = 0; i < index; i++) {
    const pastStep = lesson.steps[i];
    pastStep.action?.(useVamsStore.getState());
    pastStep.solve?.(useVamsStore.getState());
  }
}

/**
 * Shows a step: runs its action (when `runAction`) between two snapshots of the generated code,
 * marks the lines it changed, sets the step's focus, journey stage and pointer diagram step, and
 * opens the pane it is about. Both snapshots use the same canvas size, so a window-size-only
 * difference (the `glutInitWindowSize` line) never shows as a change. Call inside a batch.
 */
function showStep(lesson: Lesson, step: LessonStep, canvasSize: { width: number; height: number }, runAction: boolean): void {
  const store = useVamsStore.getState();
  const snapshotCode = () => {
    const s = useVamsStore.getState();
    return generateCodeFromState(
      {
        objects: s.objects,
        canvasBackgroundColor: s.canvasBackgroundColor,
        callbacks: s.callbacks,
        viewportLimits: s.viewportLimits,
      },
      canvasSize,
    );
  };

  const preCode = snapshotCode();
  if (runAction) step.action?.(useVamsStore.getState());
  const postCode = snapshotCode();

  const focus = effectiveFocus(lesson, step);
  store.setLessonFocusPanel(focus);
  store.setJourneyStageOverride(step.mathStage ?? null);
  selectForFocus(focus);
  store.setDmaDriverStep(step.dmaStep ?? null);

  const changed = resolveChangedLines(preCode, postCode, step.codeChangeFocus);
  store.setChangedCodeLines(changed);
  // A step about the math shows Math; one about the code, or one that changed it, shows Code.
  const pane = step.pane ?? (changed.length > 0 ? 'code' : null);
  if (pane) {
    store.setCodePane(pane);
    store.setCodeHidden(false);
  }
}

export function useLessonRunner(): LessonRunner {
  const {
    appMode,
    activeLessonId,
    currentStepIndex,
    setActiveLesson,
    setCurrentStep,
    setAppMode,
    clearLessonState,
  } = useVamsStore();

  const [sessionSeed, setSessionSeed] = useState(0);
  const objects = useVamsStore((s) => s.objects);
  const callbacks = useVamsStore((s) => s.callbacks); // listen for callback changes
  const viewportLimits = useVamsStore((s) => s.viewportLimits); // ortho changes affect successChecks too

  const lastExecutedStepRef = useRef<string | null>(null);
  const lastStepIndexRef = useRef<number>(-1);

  const [mcAnswer, setMcAnswer] = useState<string | null>(null);
  const [orderAnswer, setOrderAnswer] = useState<string[] | null>(null);

  // A run is skipped once Skip is used in it, whatever happens after; a new lesson starts a new run.
  const [skipped, setSkipped] = useState(false);
  const [skippedFor, setSkippedFor] = useState(activeLessonId);
  if (skippedFor !== activeLessonId) {
    setSkippedFor(activeLessonId);
    if (skipped) setSkipped(false);
  }

  /* ------------------------------------------------------------------ */
  /*  Canvas size — kept in a ref so the step-execution effect always   */
  /*  reads the latest value without needing it in its dependency array */
  /*  (which would re-fire the action on every window resize).          */
  /* ------------------------------------------------------------------ */
  const canvasSize = useCanvasSize();
  const canvasSizeRef = useRef(canvasSize);
  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  useEffect(() => {
    if (activeLessonId) {
      setSessionSeed(Math.random());
    }
  }, [activeLessonId]);

  const lesson = useMemo(() => {
    if (!activeLessonId) return null;
    const baseLesson = getLessonById(activeLessonId);
    if (!baseLesson) return null;

    if (baseLesson.shuffleRange) {
      const [start, end] = baseLesson.shuffleRange;
      const cloned = { ...baseLesson, steps: [...baseLesson.steps] };
      const range = cloned.steps.slice(start, end + 1);

      let h = Math.floor(sessionSeed * 1000000);
      const rng = () => {
        h = (h * 1664525 + 1013904223) | 0;
        return ((h >>> 0) % 1000) / 1000;
      };

      for (let i = range.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [range[i], range[j]] = [range[j], range[i]];
      }
      cloned.steps.splice(start, range.length, ...range);
      return cloned;
    }

    return baseLesson;
  }, [activeLessonId, sessionSeed]);

  const step = lesson?.steps[currentStepIndex];

  useEffect(() => {
    setMcAnswer(null);
    if (step?.exercise?.kind === 'ordered-list') {
      const expected = step.exercise.correctOrder;
      const arr = [...step.exercise.items].map((i) => i.id);
      let hasAnyCorrect = true;
      while (hasAnyCorrect) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        hasAnyCorrect = arr.some((val, index) => val === expected[index]);
      }
      setOrderAnswer(arr);
    } else {
      setOrderAnswer(null);
    }
  }, [activeLessonId, currentStepIndex, step]);

  // Predict answers for this run of the lesson, by step index. Any change of lesson starts a new
  // run. The ref is what the step effect reads, so a rebuild knows whether the step's action ran.
  const [answers, setAnswers] = useState<PredictAnswers>(() => ({ lessonId: activeLessonId, byStep: {} }));
  if (answers.lessonId !== activeLessonId) setAnswers({ lessonId: activeLessonId, byStep: {} });
  const answersRef = useRef(answers);
  const runAnswers = answers.lessonId === activeLessonId ? answers.byStep : NO_ANSWERS;

  /*
   * Step execution. On a step forward the step's action runs on the scene as it stands; on any
   * other move (Back, a jump, the lesson's start) the scene is rebuilt from scratch first. Either
   * way the step is then shown through showStep. A predict step's action waits for an answer.
   */
  useEffect(() => {
    if (!lesson || !activeLessonId) return;

    const stepKey = `${activeLessonId}-${currentStepIndex}`;
    if (lastExecutedStepRef.current === stepKey) return;

    const sameLessonAsBefore = lastExecutedStepRef.current?.startsWith(`${activeLessonId}-`);
    const isForwardOne =
      sameLessonAsBefore && currentStepIndex === lastStepIndexRef.current + 1;

    if (!sameLessonAsBefore) answersRef.current = { lessonId: activeLessonId, byStep: {} };

    const store = useVamsStore.getState();
    store.startBatch();

    if (!isForwardOne) {
      // Reset every piece of pedagogically-relevant state so step replay starts from a clean
      // baseline, including viewportLimits, which Stage 4 lessons mutate.
      resetLessonScene();
      // The rebuilt scene is not the student's edit: the code panel marks none of its values.
      store.markSceneSwap();
      // Replay every step BEFORE the current one, solved, to recreate the pre-state.
      replayStepsBefore(lesson, currentStepIndex);
    }

    const currentStep = lesson.steps[currentStepIndex];
    const saved = answersRef.current;
    const answered = saved.lessonId === activeLessonId && currentStepIndex in saved.byStep;
    showStep(lesson, currentStep, canvasSizeRef.current, !currentStep.predict || answered);

    store.endBatch();
    lastExecutedStepRef.current = stepKey;
    lastStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex, activeLessonId, lesson]);

  // Every goal is checked against the whole state on every change, as one string of 1s and 0s,
  // so a change re-renders only when a goal flips.
  const goalBits = useVamsStore((s) => step?.goals?.map((g) => (g.check(s) ? '1' : '0')).join('') ?? '');
  const goals = useMemo(
    () => step?.goals?.map((g, i) => ({ label: g.label, met: goalBits[i] === '1' })) ?? null,
    [step, goalBits],
  );

  const isStepSuccess = useMemo(() => {
    if (!step) return false;
    if (goalBits.includes('0')) return false;

    if (step.exercise) {
      if (step.exercise.kind === 'multiple-choice') {
        if (mcAnswer !== step.exercise.correctId) return false;
      } else if (step.exercise.kind === 'ordered-list') {
        if (!orderAnswer) return false;
        const expected = step.exercise.correctOrder;
        if (orderAnswer.length !== expected.length) return false;
        for (let i = 0; i < expected.length; i++) {
          if (orderAnswer[i] !== expected[i]) return false;
        }
      }
    }

    if (step.successCheck) {
      void objects;
      void callbacks;
      void viewportLimits;
      return step.successCheck(useVamsStore.getState());
    }

    return true;
  }, [step, goalBits, mcAnswer, orderAnswer, objects, callbacks, viewportLimits]);

  const predictAnswer = runAnswers[currentStepIndex] ?? null;
  // A prediction never gates on being right, only on being made.
  const canAdvance =
    !!step && (!waitsForStudent(step) || isStepSuccess) && (!step.predict || predictAnswer !== null);
  const canSkip = !!step && stepCanSkip(step) && !isStepSuccess;

  const handleSkip = useCallback(() => {
    if (!step || !canSkip) return;
    if (step.solve) {
      const store = useVamsStore.getState();
      store.pushToHistory();
      store.startBatch();
      try {
        step.solve(useVamsStore.getState());
      } finally {
        useVamsStore.getState().endBatch();
      }
    }
    const ex = step.exercise;
    if (ex?.kind === 'multiple-choice') setMcAnswer(ex.correctId);
    else if (ex?.kind === 'ordered-list') setOrderAnswer([...ex.correctOrder]);
    setSkipped(true);
  }, [step, canSkip]);

  const handlePick = useCallback(
    (optionId: string) => {
      if (!lesson || !activeLessonId || !step?.predict || predictAnswer !== null) return;
      if (!step.predict.options.some((o) => o.id === optionId)) return;
      const prev = answersRef.current.lessonId === activeLessonId ? answersRef.current.byStep : NO_ANSWERS;
      const next = { lessonId: activeLessonId, byStep: { ...prev, [currentStepIndex]: optionId } };
      answersRef.current = next;
      setAnswers(next);
      const store = useVamsStore.getState();
      store.startBatch();
      try {
        showStep(lesson, step, canvasSizeRef.current, true);
      } finally {
        useVamsStore.getState().endBatch();
      }
    },
    [lesson, activeLessonId, step, predictAnswer, currentStepIndex],
  );

  const handleNext = useCallback(() => {
    if (lesson && currentStepIndex < lesson.steps.length - 1) {
      setCurrentStep(currentStepIndex + 1);
    }
  }, [lesson, currentStepIndex, setCurrentStep]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) setCurrentStep(currentStepIndex - 1);
  }, [currentStepIndex, setCurrentStep]);

  const leave = useCallback(() => {
    clearLessonState();
    setAppMode('Author');
    setSkipped(false);
    answersRef.current = { lessonId: null, byStep: {} };
    setAnswers(answersRef.current);
    lastExecutedStepRef.current = null;
    lastStepIndexRef.current = -1;
  }, [clearLessonState, setAppMode]);

  /** Exit or Esc mid-lesson: remember the place, then return the student's scene. */
  const handleExit = useCallback(() => {
    if (activeLessonId) recordLessonLeft(activeLessonId, currentStepIndex);
    leave();
  }, [activeLessonId, currentStepIndex, leave]);

  const nextLesson = useMemo(() => {
    const entry = activeLessonId ? nextInCourse(activeLessonId) : null;
    return entry ? { id: entry.id, title: entry.title } : null;
  }, [activeLessonId]);
  const finishGoesToMap = !nextLesson && !!activeLessonId && isSectionEnd(activeLessonId);

  /**
   * The last step passed: the lesson is complete, or skipped when Skip was used in this run. Then the
   * next lesson in the section starts, keeping the student's backed-up scene for when they leave; a
   * section's last lesson opens the course map; a lesson outside the course ends in the editor.
   */
  const handleFinish = useCallback(() => {
    if (activeLessonId) (skipped ? markLessonSkipped : markLessonComplete)(activeLessonId);
    if (nextLesson) {
      // A lesson is active, so the store keeps its backups instead of taking new ones.
      setActiveLesson(nextLesson.id);
      setCurrentStep(0);
      return;
    }
    const section = lesson?.section ?? null;
    leave();
    if (finishGoesToMap && section) courseMap.go(`/learn#${section.toLowerCase()}`);
  }, [activeLessonId, skipped, nextLesson, finishGoesToMap, lesson, setActiveLesson, setCurrentStep, leave]);

  useEffect(() => {
    if (appMode !== 'Lesson' || !lesson || !step) return;

    const onKey = (e: KeyboardEvent) => {
      // A control that handled the key (a radiogroup, a menu, a dialog, a field) owns it.
      if (e.defaultPrevented) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
        // Arrow keys inside a composite widget move within that widget, never the lesson.
        if (e.key !== 'Escape' && target.closest(ARROW_KEY_OWNERS)) return;
        // Menus and dialogs close themselves on Esc.
        if (e.key === 'Escape' && target.closest(ESCAPE_KEY_OWNERS)) return;
      }

      if (e.key === 'ArrowRight') {
        if (canAdvance) handleNext();
      } else if (e.key === 'ArrowLeft') {
        handleBack();
      } else if (e.key === 'Escape') {
        handleExit();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appMode, lesson, step, canAdvance, handleNext, handleBack, handleExit]);

  const active = appMode === 'Lesson' && !!lesson && !!step;
  const stepCount = lesson?.steps.length ?? 0;
  return {
    active,
    lesson: active ? lesson : null,
    step: active ? step ?? null : null,
    stepIndex: currentStepIndex,
    stepCount,
    isLastStep: active && currentStepIndex === stepCount - 1,
    canAdvance: active && canAdvance,
    goals: active ? goals : null,
    canSkip: active && canSkip,
    skip: handleSkip,
    skipped,
    nextLesson: active ? nextLesson : null,
    finishGoesToMap: active && finishGoesToMap,
    predictAnswer: active ? predictAnswer : null,
    pick: handlePick,
    mcAnswer,
    setMcAnswer,
    orderAnswer,
    setOrderAnswer,
    next: handleNext,
    back: handleBack,
    exit: handleExit,
    finish: handleFinish,
  };
}
