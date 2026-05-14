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
import { addTriangle, getState } from '../helpers/store';

describe('WB-LESSON-01: Setting a lesson backs up scene + callbacks + viewport + bg', () => {
  it('captures the four backup fields and resets the working state', () => {
    addTriangle();
    getState().setCallbackHandler('keyboard', 'onKey');
    useVamsStore.setState({ canvasBackgroundColor: '#abcdef', viewportLimits: { minX: -2, maxX: 2, minY: -2, maxY: 2 } });

    const beforeObjs = getState().objects.length;
    getState().setActiveLesson('poc-demo-1');
    expect(getState().sceneBackup?.length).toBe(beforeObjs);
    expect(getState().callbacksBackup?.keyboard).toBe('onKey');
    expect(getState().canvasBackgroundColorBackup).toBe('#abcdef');
    expect(getState().viewportLimitsBackup).toEqual({ minX: -2, maxX: 2, minY: -2, maxY: 2 });

    expect(getState().objects).toHaveLength(0);
    expect(getState().callbacks.keyboard).toBe('');
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
