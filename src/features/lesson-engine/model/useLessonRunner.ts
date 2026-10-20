import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useVamsStore } from '@/core/store';
import type { Lesson, LessonStep } from '@/core/types/lesson';
import { resolveFocus } from '@/core/inspector';
import { getLessonById } from './lesson-registry';
import { markLessonComplete, markLessonSkipped, recordLessonLeft } from './progress';
import { canSkip as stepCanSkip, waitsForStudent } from './step-rules';
import { focusStyleFor } from './guidance';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { resolveChangedLines } from '@/features/code-generation/model/code-diff';

const DEFAULT_LESSON_VIEWPORT = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

const ARROW_KEY_OWNERS = [
  '[role="menu"]', '[role="menuitem"]', '[role="radiogroup"]', '[role="tree"]',
  '[role="slider"]', '[role="dialog"]', '[role="alertdialog"]', '[role="spinbutton"]',
].join(', ');
const ESCAPE_KEY_OWNERS = '[role="menu"], [role="dialog"], [role="alertdialog"]';

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

export function useLessonRunner(): LessonRunner {
  const {
    appMode,
    activeLessonId,
    currentStepIndex,
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

  /* ------------------------------------------------------------------ */
  /*  Step execution + change-highlight diff.                            */
  /*                                                                    */
  /*  We snapshot the generated code immediately before and after the   */
  /*  step's action mutates state, run a line-level diff, and write the */
  /*  result into `changedCodeLines`. SceneCodePanel reads that and     */
  /*  passes it to CodeViewer, which draws the change highlight + auto- */
  /*  scrolls vertically to the topmost change.                         */
  /*                                                                    */
  /*  Both snapshots use the SAME canvas size, so window-size-only      */
  /*  differences (the `glutInitWindowSize` line) never show up as a    */
  /*  spurious change.                                                  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!lesson || !activeLessonId) return;

    const stepKey = `${activeLessonId}-${currentStepIndex}`;
    if (lastExecutedStepRef.current === stepKey) return;

    const sameLessonAsBefore = lastExecutedStepRef.current?.startsWith(`${activeLessonId}-`);
    const isForwardOne =
      sameLessonAsBefore && currentStepIndex === lastStepIndexRef.current + 1;

    const store = useVamsStore.getState();
    store.startBatch();

    const cs = canvasSizeRef.current;
    const currentStep = lesson.steps[currentStepIndex];

    const snapshotCode = () => {
      const s = useVamsStore.getState();
      return generateCodeFromState(
        {
          objects: s.objects,
          canvasBackgroundColor: s.canvasBackgroundColor,
          callbacks: s.callbacks,
          viewportLimits: s.viewportLimits,
        },
        cs,
      );
    };

    let preCode = '';
    let postCode = '';

    if (isForwardOne) {
      preCode = snapshotCode();

      if (currentStep.action) currentStep.action(useVamsStore.getState());

      postCode = snapshotCode();

      const focus = effectiveFocus(lesson, currentStep);
      store.setLessonFocusPanel(focus);
      store.setJourneyStageOverride(currentStep.mathStage ?? null);
      selectForFocus(focus);
      store.setDmaDriverStep(currentStep.dmaStep ?? null);
    } else {
      // Non-linear navigation (Back, lesson-start, jump): rebuild from scratch.
      // Reset every piece of pedagogically-relevant state so step replay starts
      // from a clean baseline — including viewportLimits, which Stage 4 lessons
      // mutate.
      resetLessonScene();
      // The rebuilt scene is not the student's edit: the code panel marks none of its values.
      store.markSceneSwap();

      // Replay every step BEFORE the current one to recreate the pre-state.
      for (let i = 0; i < currentStepIndex; i++) {
        const pastStep = lesson.steps[i];
        if (pastStep.action) pastStep.action(useVamsStore.getState());
      }

      // Snapshot pre-state (= state at the end of step N-1, or empty if N=0).
      preCode = snapshotCode();

      // Now run step N's action and snapshot post-state.
      if (currentStep.action) currentStep.action(useVamsStore.getState());
      postCode = snapshotCode();

      const focus = effectiveFocus(lesson, currentStep);
      store.setLessonFocusPanel(focus);
      store.setJourneyStageOverride(currentStep.mathStage ?? null);
      selectForFocus(focus);
      store.setDmaDriverStep(currentStep.dmaStep ?? null);
    }

    const changed = resolveChangedLines(preCode, postCode, currentStep.codeChangeFocus);
    store.setChangedCodeLines(changed);
    // A step about the math shows Math; one about the code, or one that changed it, shows Code.
    const pane = currentStep.pane ?? (changed.length > 0 ? 'code' : null);
    if (pane) {
      store.setCodePane(pane);
      store.setCodeHidden(false);
    }

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

  const canAdvance = !!step && (!waitsForStudent(step) || isStepSuccess);
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
    lastExecutedStepRef.current = null;
    lastStepIndexRef.current = -1;
  }, [clearLessonState, setAppMode]);

  /** Exit or Esc mid-lesson: remember the place, then return the student's scene. */
  const handleExit = useCallback(() => {
    if (activeLessonId) recordLessonLeft(activeLessonId, currentStepIndex);
    leave();
  }, [activeLessonId, currentStepIndex, leave]);

  /** The last step passed: the lesson is complete, or skipped when Skip was used in this run. */
  const handleFinish = useCallback(() => {
    if (activeLessonId) (skipped ? markLessonSkipped : markLessonComplete)(activeLessonId);
    leave();
  }, [activeLessonId, skipped, leave]);

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
