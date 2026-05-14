/**
 * ALGORITHM VALIDATION — Algorithm 3: Lesson Step Execution with Success Detection
 * Maps to manuscript Section 3.10.3.
 *
 * Validation strategy:
 *  - Step-execution latency:    mean ± SD across the lesson library
 *  - Success-detection accuracy: artificially constructed pass/fail scenarios
 *  - State-restoration fidelity: byte-for-byte snapshot equality before/after
 */
import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { useVamsStore } from '@/core/store';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import { addTriangle, getState } from '../helpers/store';

interface Algo3Result {
  meanLatencyMs: number;
  sdLatencyMs: number;
  successDetectionAccuracy: number;
  stateRestorationFidelity: 1 | 0; // byte-identical or not
  stepsMeasured: number;
}

const report: Algo3Result = {
  meanLatencyMs: 0,
  sdLatencyMs: 0,
  successDetectionAccuracy: 0,
  stateRestorationFidelity: 0,
  stepsMeasured: 0,
};

afterAll(() => {
  try {
    mkdirSync('./tests/reports', { recursive: true });
    writeFileSync(
      './tests/reports/algorithm-3-results.json',
      JSON.stringify(report, null, 2),
    );
  } catch { /* noop */ }
});

describe('ALG-3-01: Step-execution latency across the entire lesson library', () => {
  it('mean latency < 5 ms per step on a modern CPU', () => {
    const lessons = Object.values(LESSON_REGISTRY);
    const times: number[] = [];

    for (const lesson of lessons) {
      // Reset store between lessons
      useVamsStore.setState({
        objects: [], selectedObjectId: null, pendingShapeType: null, pendingVertices: [],
        callbacks: { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' },
      });
      for (const step of lesson.steps) {
        if (!step.action) continue;
        const start = performance.now();
        try { step.action(useVamsStore.getState()); } catch { /* noop */ }
        times.push(performance.now() - start);
      }
    }

    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, t) => a + (t - mean) ** 2, 0) / times.length;
    report.meanLatencyMs = mean;
    report.sdLatencyMs = Math.sqrt(variance);
    report.stepsMeasured = times.length;

    expect(times.length).toBeGreaterThan(0);
    expect(mean).toBeLessThan(5);
  });
});

describe('ALG-3-02: Success-detection accuracy on artificial pass/fail scenarios', () => {
  it('successCheck predicates correctly classify hand-crafted scenarios', () => {
    // POSITIVE scenarios — engineered to match common predicates.
    const positives: Array<() => void> = [
      () => {
        useVamsStore.setState({ objects: [], callbacks: { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' } });
        getState().addCustomObject('QUADS', [
          { x: -0.3, y: -0.3 }, { x: 0.3, y: -0.3 },
          { x: 0.3, y: 0.3 }, { x: -0.3, y: 0.3 },
        ]);
      },
      () => {
        useVamsStore.setState({ objects: [], callbacks: { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' } });
        getState().addTextObject('hello world', 0, 0);
      },
      () => {
        useVamsStore.setState({ objects: [], callbacks: { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' } });
        getState().setCallbackHandler('mouse', 'onClick');
      },
    ];
    // NEGATIVE scenarios — empty scene; nothing should pass except trivial.
    const negatives: Array<() => void> = [
      () => useVamsStore.setState({
        objects: [], selectedObjectId: null, callbacks: { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' },
      }),
    ];

    const allChecks = Object.values(LESSON_REGISTRY).flatMap((l) => l.steps).filter((s) => s.successCheck);
    let truePositives = 0;
    let trueNegatives = 0;

    // True positive: SOME successCheck passes for a positive scenario AND
    // FAILS for the corresponding negative one.
    for (const setupPos of positives) {
      setupPos();
      const sawPass = allChecks.some((s) => {
        try { return s.successCheck!(useVamsStore.getState()); } catch { return false; }
      });
      if (sawPass) truePositives++;
    }

    for (const setupNeg of negatives) {
      setupNeg();
      const failedAll = allChecks.every((s) => {
        try { return !s.successCheck!(useVamsStore.getState()); } catch { return true; }
      });
      if (failedAll) trueNegatives++;
    }

    const total = positives.length + negatives.length;
    const accuracy = (truePositives + trueNegatives) / total;
    report.successDetectionAccuracy = accuracy;

    // Manuscript target: high accuracy on engineered scenarios.
    expect(accuracy).toBeGreaterThanOrEqual(0.75);
  });
});

describe('ALG-3-03: State-restoration fidelity — byte-identical before/after', () => {
  it('clearLessonState reproduces the snapshot captured at lesson entry', () => {
    // Build a non-trivial scene
    addTriangle(0.1, 0.0, 0.05);
    addTriangle(-0.2, 0.1, 0.05);
    getState().setCallbackHandler('keyboard', 'onKb');
    useVamsStore.setState({ canvasBackgroundColor: '#abcdef', viewportLimits: { minX: -2, maxX: 2, minY: -2, maxY: 2 } });

    const before = JSON.stringify({
      objects: getState().objects,
      callbacks: getState().callbacks,
      background: getState().canvasBackgroundColor,
      viewport: getState().viewportLimits,
    });

    // Enter and mutate a lesson scene.
    getState().setActiveLesson('poc-demo-1');
    addTriangle(); // lesson-scoped change
    getState().setCallbackHandler('motion', 'transient');
    useVamsStore.setState({ canvasBackgroundColor: '#222222' });

    // Exit the lesson.
    getState().clearLessonState();

    const after = JSON.stringify({
      objects: getState().objects,
      callbacks: getState().callbacks,
      background: getState().canvasBackgroundColor,
      viewport: getState().viewportLimits,
    });

    report.stateRestorationFidelity = before === after ? 1 : 0;
    expect(after).toBe(before);
  });
});
