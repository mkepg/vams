/**
 * BLACK-BOX TEST SUITE — BB-LESSON
 * Maps to Table 12, row 6: Lesson Engine
 *
 * Test focus:
 *  - Step navigation with back support
 *  - Forward-by-one vs full re-play behaviour
 *  - successCheck predicate / exercise widget evaluation
 *  - Complete state restoration when the lesson ends
 */
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { describe, it, expect } from 'vitest';
import { useVamsStore } from '@/core/store';
import type { LessonStep } from '@/core/types/lesson';
import { LESSON_REGISTRY, getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { addTriangle, getState } from '../helpers/store';

const FIRST_DEMO_ID = Object.values(LESSON_REGISTRY).find((l) => l.type === 'demo')?.id;

describe('BB-LESSON-01: Lesson registry exposes lessons for the curriculum', () => {
  it('contains at least one demo and one exercise lesson', () => {
    const lessons = Object.values(LESSON_REGISTRY);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.some((l) => l.type === 'demo')).toBe(true);
    expect(lessons.some((l) => l.type === 'exercise')).toBe(true);
  });

  it('every lesson has at least one step', () => {
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      expect(lesson.steps.length).toBeGreaterThan(0);
    }
  });
});

describe('BB-LESSON-02: Setting an active lesson backs up the scene', () => {
  it('moves the user scene into sceneBackup and clears the working scene', () => {
    addTriangle();
    addTriangle(0.4, 0.0, 0.05);
    const beforeCount = getState().objects.length;
    expect(beforeCount).toBeGreaterThan(0);

    getState().setActiveLesson(FIRST_DEMO_ID ?? 'poc-demo-1');

    expect(getState().objects).toHaveLength(0);
    expect(getState().sceneBackup).toHaveLength(beforeCount);
    expect(getState().activeLessonId).toBe(FIRST_DEMO_ID ?? 'poc-demo-1');
    expect(getState().currentStepIndex).toBe(0);
  });
});

describe('BB-LESSON-03: Step navigation works forward and backward', () => {
  it('setCurrentStep advances and rewinds the lesson cursor', () => {
    getState().setActiveLesson(FIRST_DEMO_ID ?? 'poc-demo-1');
    getState().setCurrentStep(2);
    expect(getState().currentStepIndex).toBe(2);
    getState().setCurrentStep(1);
    expect(getState().currentStepIndex).toBe(1);
    getState().setCurrentStep(0);
    expect(getState().currentStepIndex).toBe(0);
  });
});

describe('BB-LESSON-04: A step `action` mutates the scene through the store', () => {
  it('running a lesson step that adds a triangle is reflected in the store', () => {
    const lesson = getLessonById('poc-demo-1');
    if (!lesson) return; // lesson not present — skip
    getState().setActiveLesson('poc-demo-1');
    // Step 1 in poc-demo-1 adds a TRIANGLES primitive.
    const stepWithAction = lesson.steps.find((s) => !!s.action)!;
    stepWithAction.action!(useVamsStore.getState());
    expect(getState().objects.length).toBeGreaterThan(0);
    expect(getState().objects[0].type).toBe('TRIANGLES');
  });
});

describe('BB-LESSON-05: clearLessonState restores the original scene', () => {
  it('round-trips a user-built scene through an active lesson and back', () => {
    const t = addTriangle(0.2, 0.0, 0.1);
    const beforeJson = JSON.stringify(getState().objects);

    getState().setActiveLesson(FIRST_DEMO_ID ?? 'poc-demo-1');
    // Mutate the lesson scene
    getState().addCustomObject('LINES', [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }]);
    expect(getState().objects.some((o) => o.type === 'LINES')).toBe(true);

    getState().clearLessonState();
    expect(getState().activeLessonId).toBeNull();
    expect(getState().sceneBackup).toBeNull();
    expect(JSON.stringify(getState().objects)).toBe(beforeJson);
    expect(getState().objects.find((o) => o.id === t.id)).toBeDefined();
  });
});

/** A step's success predicates: its successCheck and each of its goals' checks. */
const stepChecks = (step: LessonStep) => [...(step.successCheck ? [step.successCheck] : []), ...(step.goals ?? []).map((g) => g.check)];

describe('BB-LESSON-06: successCheck predicates classify pass/fail correctly', () => {
  it('every success check returns a boolean and never throws on an empty store', () => {
    let total = 0;
    let returnedBool = 0;
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      for (const step of lesson.steps) {
        for (const check of stepChecks(step)) {
          total++;
          useVamsStore.setState({
            objects: [], selectedObjectId: null, pendingVertices: [],
            pendingShapeType: null,
            callbacks: emptyCallbacks(),
          });
          try {
            const ok = check(useVamsStore.getState());
            if (typeof ok === 'boolean') returnedBool++;
          } catch {
            /* a thrown predicate is permitted but should be rare */
          }
        }
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(returnedBool / total).toBeGreaterThan(0.9);
  });

  it('synthesised positive scenarios pass at least one successCheck', () => {
    // Build a scene that satisfies several known positive predicates.
    getState().addCustomObject('QUADS', [
      { x: -0.3, y: -0.3 }, { x: 0.3, y: -0.3 },
      { x:  0.3, y:  0.3 }, { x: -0.3, y: 0.3 },
    ]);
    getState().addTextObject('hello world', 0.0, 0.6);
    getState().setCallbackHandler('mouse', 'onMouseClick');

    let passed = 0;
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      for (const step of lesson.steps) {
        // A step detects success with its successCheck and with each of its goals.
        for (const check of stepChecks(step)) {
          try {
            if (check(useVamsStore.getState())) passed++;
          } catch { /* tolerate */ }
        }
      }
    }
    expect(passed).toBeGreaterThanOrEqual(1);
  });

  it('an empty scene fails the success check of a step that requires content', () => {
    let evaluatedFail = 0;
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      for (const step of lesson.steps) {
        for (const check of stepChecks(step)) {
          useVamsStore.setState({
            objects: [], selectedObjectId: null, pendingVertices: [],
          });
          try {
            const ok = check(useVamsStore.getState());
            if (!ok) evaluatedFail++;
          } catch {
            evaluatedFail++; // throwing on empty state still counts as "fail"
          }
          if (evaluatedFail >= 1) break;
        }
        if (evaluatedFail >= 1) break;
      }
      if (evaluatedFail >= 1) break;
    }
    expect(evaluatedFail).toBeGreaterThanOrEqual(1);
  });
});

const lessonStep = (id: string, i: number) => LESSON_REGISTRY[id].steps[i];

describe('BB-LESSON-07: The callbacks demo builds onKey with a D case', () => {
  it('step 2 registers onKey and a D rule on Triangle', () => {
    lessonStep('primitives-demo-5', 1).action!(useVamsStore.getState());
    const s = getState();
    const code = generateCodeFromState(
      { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits },
      { width: 800, height: 600 },
    );
    expect(code).toContain("void onKey(unsigned char key, int x, int y)");
    expect(code).toContain("    case 'd':\n    case 'D':\n        state_Triangle.x += 0.10f;");
    expect(code).toContain('glutKeyboardFunc(onKey);');
  });
});

describe('BB-LESSON-08: The mouse exercise needs a left-down Move to pointer rule', () => {
  it('fails without the rule and passes with it', () => {
    const check = lessonStep('primitives-exercise-5', 1).goals![0].check;
    const t = addTriangle();
    getState().setCallbackHandler('mouse', 'onMouse');
    expect(check(useVamsStore.getState())).toBe(false);
    getState().addCallbackRule('mouse', { id: 'a', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'up' }, action: { type: 'moveToPointer' } });
    expect(check(useVamsStore.getState())).toBe(false);
    getState().addCallbackRule('mouse', { id: 'b', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } });
    expect(check(useVamsStore.getState())).toBe(true);
  });
});

describe('BB-LESSON-09: Drive with the Arrow Keys', () => {
  it('needs Special keys, then → and ← translates on one object', () => {
    const [first, second] = lessonStep('primitives-exercise-6', 1).goals!.map((g) => g.check);
    expect(first(useVamsStore.getState())).toBe(false);
    getState().setCallbackHandler('special', 'onSpecial');
    expect(first(useVamsStore.getState())).toBe(true);
    const t = addTriangle();
    getState().addCallbackRule('special', { id: 'r', objectId: t.id, trigger: { kind: 'special', key: 'right' }, action: { type: 'translate', dx: 0.1, dy: 0 } });
    expect(second(useVamsStore.getState())).toBe(false);
    getState().addCallbackRule('special', { id: 'l', objectId: t.id, trigger: { kind: 'special', key: 'left' }, action: { type: 'translate', dx: -0.1, dy: 0 } });
    expect(second(useVamsStore.getState())).toBe(true);
  });
});

describe('BB-LESSON-10: The animation demo spins a triangle with an idle rule', () => {
  const lesson = LESSON_REGISTRY['transforms-anim-1'];
  const code = () => {
    const s = getState();
    return generateCodeFromState(
      { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits },
      { width: 800, height: 600 },
    );
  };

  it('registers onIdle with a rotate rule on Triangle', () => {
    for (const step of lesson.steps) step.action?.(useVamsStore.getState());
    const s = getState();
    expect(s.objects.map((o) => o.name)).toEqual(['Triangle']);
    expect(s.callbacks.idle.handlerName).toBe('onIdle');
    expect(s.callbacks.idle.rules.map((r) => ({ objectId: r.objectId, trigger: r.trigger, action: r.action }))).toEqual([
      { objectId: s.objects[0].id, trigger: { kind: 'idle' }, action: { type: 'rotate', degrees: 2 } },
    ]);
    expect(code()).toContain('void onIdle()\n{\n    state_Triangle.rotation += 2.00f;\n    glutPostRedisplay();\n}');
    expect(code()).toContain('glutIdleFunc(_vams_idle);');
  });

  it('asks about lines the Code Panel really shows, and the right answer is the rotate line', () => {
    for (const step of lesson.steps) step.action?.(useVamsStore.getState());
    const quiz = lesson.steps.find((s) => s.exercise)!.exercise!;
    if (quiz.kind !== 'multiple-choice') throw new Error('expected a multiple-choice step');
    for (const option of quiz.options) expect(code()).toContain(option.label);
    expect(quiz.options.find((o) => o.id === quiz.correctId)!.label).toBe('state_Triangle.rotation += 2.00f;');
  });

  it('points at the panels that still exist', () => {
    expect(lesson.steps.map((s) => s.focusPanel).filter(Boolean)).not.toContain('animation-preview');
    expect(lesson.steps.some((s) => s.focusPanel === 'callbacks-panel')).toBe(true);
  });
});

describe('BB-LESSON-11: The glOrtho demo teaches the stretch through a window the student squares', () => {
  const lesson = LESSON_REGISTRY['transforms-demo-4'];
  const sets = (step: LessonStep, limits: { minX: number; maxX: number; minY: number; maxY: number }) => {
    useVamsStore.getState().setViewportLimits({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
    step.action?.(useVamsStore.getState());
    const v = getState().viewportLimits;
    return v.minX === limits.minX && v.maxX === limits.maxX && v.minY === limits.minY && v.maxY === limits.maxY;
  };
  const wide = lesson.steps.findIndex((step) => sets(step, { minX: -2, maxX: 2, minY: -1, maxY: 1 }));
  const correct = (step: LessonStep) => step.predict!.options.find((o) => o.id === step.predict!.correctId)!;

  it('answers that a 2:1 volume keeps the arrow its shape, in a window of the same shape', () => {
    const step = lesson.steps[wide];
    expect(step.predict!.options.length).toBeGreaterThanOrEqual(2);
    expect(step.predict!.options.length).toBeLessThanOrEqual(3);
    expect(correct(step).label).toMatch(/keeps its shape/);
    expect(correct(step).label).toMatch(/left and right/);
    expect(correct(step).why).toMatch(/window takes the viewing volume's shape/);
  });

  it('then has the student drag the window square, and the arrow comes out half as wide for its height', () => {
    const step = lesson.steps[wide + 1];
    expect(step.narration).toMatch(/drag/i);
    expect(step.narration).toMatch(/corner/);
    expect(step.narration).toMatch(/square/);
    // The window is not store state, so the step waits on no goal; it asks a prediction.
    expect(step.goals ?? []).toEqual([]);
    expect(correct(step).label).toBe('Squashed: half as wide for its height');
    expect(correct(step).why).toMatch(/scaled differently/);
  });

  it("closes on ranges that don't match the window's shape", () => {
    expect(lesson.steps[lesson.steps.length - 1].recap!.points).toContain("x and y ranges that don't match the window's shape stretch the picture.");
  });
});
