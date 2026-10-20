/**
 * WHITE-BOX TEST SUITE — WB-LESSON
 * Maps to Table 13, row 4: Lesson Engine internals
 *
 * Test focus:
 *  - Step-advance logic (forward-by-one vs full re-play)
 *  - Condition checking coverage for successCheck
 *  - Integration with batch mode
 *  - clearLessonState properly restores scene, callbacks, viewport, textures, background
 *  - Faulty lesson data is handled gracefully
 */
import { describe, it, expect } from 'vitest';
import { useVamsStore } from '@/core/store';
import { LESSON_REGISTRY, getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import { waitsForStudent, canSkip, goalLabelParts } from '@/features/lesson-engine/model/step-rules';
import type { LessonStep } from '@/core/types/lesson';
import { templateParts, checkBlank, formatBlankNumber } from '@/features/lesson-engine/model/code-blanks';
import { addTriangle, getState } from '../helpers/store';

describe('WB-LESSON-01: Setting a lesson backs up scene + callbacks + viewport + bg', () => {
  it('captures the four backup fields and resets the working state', () => {
    addTriangle();
    getState().setCallbackHandler('keyboard', 'onKey');
    useVamsStore.setState({ canvasBackgroundColor: '#abcdef', viewportLimits: { minX: -2, maxX: 2, minY: -2, maxY: 2 } });

    const beforeObjs = getState().objects.length;
    getState().setActiveLesson('poc-demo-1');
    expect(getState().sceneBackup?.length).toBe(beforeObjs);
    expect(getState().callbacksBackup?.keyboard.handlerName).toBe('onKey');
    expect(getState().canvasBackgroundColorBackup).toBe('#abcdef');
    expect(getState().viewportLimitsBackup).toEqual({ minX: -2, maxX: 2, minY: -2, maxY: 2 });

    expect(getState().objects).toHaveLength(0);
    expect(getState().callbacks.keyboard.handlerName).toBe('');
    expect(getState().canvasBackgroundColor).toBe('#000000');
  });
});

describe('WB-LESSON-02: clearLessonState restores every backed-up field byte-for-byte', () => {
  it('the four backup slots are mirrored back onto the live store', () => {
    addTriangle();
    addTriangle(0.3, 0.0, 0.05);
    getState().setCallbackHandler('mouse', 'onClick');
    useVamsStore.setState({ canvasBackgroundColor: '#abcdef' });

    const expectedObjs = JSON.stringify(getState().objects);
    const expectedCbs = JSON.stringify(getState().callbacks);
    const expectedBg = getState().canvasBackgroundColor;

    getState().setActiveLesson('poc-demo-1');
    // Mutate the lesson scene
    addTriangle();
    getState().setCallbackHandler('motion', 'mid-lesson');
    useVamsStore.setState({ canvasBackgroundColor: '#111111' });

    getState().clearLessonState();

    expect(JSON.stringify(getState().objects)).toBe(expectedObjs);
    expect(JSON.stringify(getState().callbacks)).toBe(expectedCbs);
    expect(getState().canvasBackgroundColor).toBe(expectedBg);
    expect(getState().sceneBackup).toBeNull();
    expect(getState().callbacksBackup).toBeNull();
    expect(getState().canvasBackgroundColorBackup).toBeNull();
    expect(getState().viewportLimitsBackup).toBeNull();
  });
});

describe('WB-LESSON-03: setActiveLesson is idempotent when an entry lesson is already active', () => {
  it('a second call with a non-null id does NOT clobber sceneBackup', () => {
    addTriangle();
    const originalLen = getState().objects.length;
    getState().setActiveLesson('poc-demo-1');
    const backupAfterFirst = getState().sceneBackup;
    getState().setActiveLesson('primitives-demo-1');
    // Still the same backup, not overwritten with the now-empty lesson scene.
    expect(getState().sceneBackup).toBe(backupAfterFirst);
    expect(backupAfterFirst?.length).toBe(originalLen);
  });
});

describe('WB-LESSON-04: Lesson step actions interoperate with batch mode', () => {
  it('actions running inside startBatch do not multiply history entries', () => {
    const lesson = getLessonById('poc-demo-1');
    if (!lesson) return;
    getState().setActiveLesson('poc-demo-1');
    getState().clearHistory();
    const beforeLen = getState().past.length;

    getState().startBatch();
    for (const step of lesson.steps) {
      if (step.action) step.action(useVamsStore.getState());
    }
    getState().endBatch();

    expect(getState().past.length).toBe(beforeLen);
  });
});

describe('WB-LESSON-05: Faulty lesson data is tolerated', () => {
  it('unknown lesson id resolves to undefined', () => {
    expect(getLessonById('does-not-exist')).toBeUndefined();
  });

  it('setActiveLesson with an unknown id still mutates the active id field', () => {
    expect(() => getState().setActiveLesson('ghost-lesson')).not.toThrow();
    // After backing up (empty objects), the id is recorded — entries that
    // reach setActiveLesson are user-driven via the registry UI, so the slice
    // does not gatekeep on registry membership.
    expect(getState().activeLessonId).toBe('ghost-lesson');
  });
});

describe('WB-LESSON-06: Every successCheck reads only from VamsState', () => {
  it('does not throw across the entire registry', () => {
    let errors = 0;
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      for (const step of lesson.steps) {
        if (!step.successCheck) continue;
        try { step.successCheck(useVamsStore.getState()); }
        catch { errors++; }
      }
    }
    expect(errors).toBe(0);
  });
});

const mcq: LessonStep['exercise'] = {
  kind: 'multiple-choice',
  prompt: 'p',
  options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
  correctId: 'a',
};

describe('WB-LESSON-07: waitsForStudent', () => {
  it('is false for a pacing step with only waitForUser', () => {
    expect(waitsForStudent({ narration: 'x', waitForUser: true })).toBe(false);
  });

  it('is true for a successCheck, goals or an exercise', () => {
    expect(waitsForStudent({ narration: 'x', successCheck: () => true })).toBe(true);
    expect(waitsForStudent({ narration: 'x', goals: [{ label: 'a', check: () => true }] })).toBe(true);
    expect(waitsForStudent({ narration: 'x', exercise: mcq })).toBe(true);
  });

  it('is false for an empty goals list', () => {
    expect(waitsForStudent({ narration: 'x', goals: [] })).toBe(false);
  });
});

describe('WB-LESSON-08: canSkip', () => {
  it('is true for a waiting step with solve, and for one with an exercise', () => {
    expect(canSkip({ narration: 'x', successCheck: () => true, solve: () => {} })).toBe(true);
    expect(canSkip({ narration: 'x', exercise: mcq })).toBe(true);
  });

  it('is false for a waiting step with neither', () => {
    expect(canSkip({ narration: 'x', successCheck: () => true })).toBe(false);
  });

  it('is false for a step that does not wait, even with solve', () => {
    expect(canSkip({ narration: 'x', solve: () => {} })).toBe(false);
  });
});

describe('WB-LESSON-09: goalLabelParts', () => {
  it('splits out a coordinate group', () => {
    expect(goalLabelParts('At (0.5, 0.2)')).toEqual([
      { text: 'At ', num: false },
      { text: '(0.5, 0.2)', num: true },
    ]);
  });

  it('keeps the degree sign with the number', () => {
    expect(goalLabelParts('Turned 45°')).toEqual([
      { text: 'Turned ', num: false },
      { text: '45°', num: true },
    ]);
  });

  it('leaves a label without numbers whole', () => {
    expect(goalLabelParts('Red')).toEqual([{ text: 'Red', num: false }]);
  });

  it('keeps a true minus inside the number part', () => {
    expect(goalLabelParts('Width −0.5')).toEqual([
      { text: 'Width ', num: false },
      { text: '−0.5', num: true },
    ]);
  });
});

describe('WB-LESSON-10: templateParts splits a code line at its blanks', () => {
  it('splits text and blank numbers', () => {
    expect(templateParts('glTranslatef({0}, {1}, 0.0f);')).toEqual(['glTranslatef(', 0, ', ', 1, ', 0.0f);']);
  });

  it('gives one string for a template with no blanks', () => {
    expect(templateParts('glFlush();')).toEqual(['glFlush();']);
  });

  it('gives two numbers for two adjacent blanks', () => {
    expect(templateParts('{0}{1}')).toEqual([0, 1]);
  });
});

describe('WB-LESSON-11: checkBlank judges typed numbers and names', () => {
  it.each(['0.5', '.5', '0.50', '0.5f', '0.505', ' 0.5 '])('accepts %j for 0.5', (typed) => {
    expect(checkBlank(typed, 0.5)).toBe('right');
  });

  it.each(['0.52', '0.', '-', '0.5ff', '0..5', 'abc'])('rejects %j for 0.5', (typed) => {
    expect(checkBlank(typed, 0.5)).toBe('wrong');
  });

  it.each(['', '   '])('calls %j empty', (typed) => {
    expect(checkBlank(typed, 0.5)).toBe('empty');
  });

  it('accepts a negative answer', () => {
    expect(checkBlank('-0.25', -0.25)).toBe('right');
  });

  it('compares a name exactly after trimming', () => {
    expect(checkBlank('GL_TRIANGLES', 'GL_TRIANGLES')).toBe('right');
    expect(checkBlank(' GL_TRIANGLES ', 'GL_TRIANGLES')).toBe('right');
    expect(checkBlank('gl_triangles', 'GL_TRIANGLES')).toBe('wrong');
    expect(checkBlank('GL_TRIANGLE', 'GL_TRIANGLES')).toBe('wrong');
  });
});

describe('WB-LESSON-12: formatBlankNumber writes what a student would type', () => {
  it.each([
    [0.5, '0.5'],
    [-0.25, '-0.25'],
    [45, '45'],
    [0.12345, '0.1235'],
  ])('formats %s as %s', (n, text) => {
    expect(formatBlankNumber(n)).toBe(text);
  });
});
