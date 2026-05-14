/**
 * ALGORITHM VALIDATION — Algorithm 2: Deterministic Code Generation
 * Maps to manuscript Section 3.10.3.
 *
 * Validation strategy:
 *  - SOURCE-LEVEL correctness:
 *      correct nesting of glPushMatrix/glPopMatrix
 *      correct ordering of transform operations
 *      correct glut*Func registration
 *      identical output strings across multiple executions of the same state
 *  - VISUAL-LEVEL correctness:
 *      `g++` compile + visual diff against the V.A.M.S. on-screen scene.
 *      → DEFERRED to the manual compile harness — see
 *      `tests/reports/manual-compile-procedure.md` for the procedure that
 *      produces values for "correctness rate", "precision", and "detection
 *      rate" as defined in 3.13.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { addPrimitive, addTriangle, addQuad, getState } from '../helpers/store';
import type { PrimitiveType } from '@/core/types/scene';

const CANVAS = { width: 800, height: 600 };
const gen = () => {
  const s = getState();
  return generateCodeFromState(
    {
      objects: s.objects,
      canvasBackgroundColor: s.canvasBackgroundColor,
      callbacks: s.callbacks,
      viewportLimits: s.viewportLimits,
      textures: s.uploadedTextures,
    },
    CANVAS,
  );
};

interface ScenarioResult {
  scenario: string;
  matchesPushPop: boolean;
  transformsOrdered: boolean;
  callbacksRegistered: boolean;
  deterministic: boolean;
}

const results: ScenarioResult[] = [];
afterAll(() => {
  try {
    mkdirSync('./tests/reports', { recursive: true });
    writeFileSync(
      './tests/reports/algorithm-2-results.json',
      JSON.stringify(
        {
          sourceLevel: results,
          summary: {
            scenarios: results.length,
            correctnessRate:
              results.filter(
                (r) =>
                  r.matchesPushPop &&
                  r.transformsOrdered &&
                  r.callbacksRegistered &&
                  r.deterministic,
              ).length / Math.max(1, results.length),
          },
          visualLevel: 'See tests/reports/manual-compile-procedure.md',
        },
        null,
        2,
      ),
    );
  } catch { /* noop */ }
});

function checkScenario(label: string): ScenarioResult {
  const code1 = gen();
  const code2 = gen();
  const code3 = gen();

  const opens  = (code1.match(/glPushMatrix\(\)/g) ?? []).length;
  const closes = (code1.match(/glPopMatrix\(\)/g) ?? []).length;
  const matchesPushPop = opens === closes;

  // Inspect a single object draw block for T-R-S order.
  const draw = code1.match(/glTranslatef[\s\S]+?glScalef/);
  const transformsOrdered = draw !== null &&
    draw[0].indexOf('glTranslatef') <
    draw[0].indexOf('glRotatef') &&
    draw[0].indexOf('glRotatef') <
    draw[0].indexOf('glScalef');

  // Every registered callback must produce a corresponding glut*Func() call.
  const callbacks = getState().callbacks;
  const expected: Array<{ key: string; funcCall: string }> = [];
  if (callbacks.keyboard) expected.push({ key: callbacks.keyboard, funcCall: 'glutKeyboardFunc' });
  if (callbacks.mouse) expected.push({ key: callbacks.mouse, funcCall: 'glutMouseFunc' });
  if (callbacks.motion) expected.push({ key: callbacks.motion, funcCall: 'glutMotionFunc' });
  if (callbacks.reshape) expected.push({ key: callbacks.reshape, funcCall: 'glutReshapeFunc' });
  const callbacksRegistered = expected.every(
    (e) => code1.includes(e.funcCall) && code1.includes(e.key),
  );

  // Determinism: three executions, same state, byte-equal output.
  const deterministic = code1 === code2 && code2 === code3;

  const r: ScenarioResult = {
    scenario: label,
    matchesPushPop,
    transformsOrdered,
    callbacksRegistered,
    deterministic,
  };
  results.push(r);
  return r;
}

describe('ALG-2-01: Push/Pop pairs are balanced for every scenario', () => {
  const SCENARIOS: PrimitiveType[] = [
    'POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP',
    'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN',
    'QUADS', 'QUAD_STRIP', 'POLYGON',
  ];
  it.each(SCENARIOS)('balanced push/pop for %s', (type) => {
    addPrimitive(type, [
      { x: -0.1, y: -0.1 }, { x: 0.1, y: -0.1 }, { x: 0.0, y: 0.1 },
    ]);
    const r = checkScenario(`single-${type}`);
    expect(r.matchesPushPop).toBe(true);
    expect(r.deterministic).toBe(true);
  });
});

describe('ALG-2-02: Transform ordering is T → R → S in the emitted draw body', () => {
  it('translate appears before rotate which appears before scale', () => {
    addTriangle();
    const r = checkScenario('single-tri-with-transform');
    expect(r.transformsOrdered).toBe(true);
  });
});

describe('ALG-2-03: glut*Func() calls are emitted for every registered callback', () => {
  it('registering all four user callbacks emits all four glut*Func() calls', () => {
    addTriangle();
    getState().setCallbackHandler('keyboard', 'onKey');
    getState().setCallbackHandler('mouse', 'onMouse');
    getState().setCallbackHandler('motion', 'onDrag');
    getState().setCallbackHandler('reshape', 'onReshape');
    const r = checkScenario('all-callbacks-registered');
    expect(r.callbacksRegistered).toBe(true);
  });
});

describe('ALG-2-04: Determinism on a complex multi-object scene', () => {
  it('three back-to-back generations produce byte-identical strings', () => {
    addTriangle(0.1, 0.0, 0.05);
    addQuad(-0.2, 0.0, 0.05);
    getState().setCallbackHandler('keyboard', 'foo');
    const r = checkScenario('mixed-scene');
    expect(r.deterministic).toBe(true);
  });
});
