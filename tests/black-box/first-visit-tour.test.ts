/**
 * BLACK-BOX TEST SUITE — BB-TOUR
 * The first-visit tour: its steps and checks, the tour state, Make it spin, and the spotlight and callout.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import { TOUR_STEP_COUNT } from '@/core/store/tour-slice';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { TOUR_STEPS, builtTriangle, type TourCaptionContext } from '@/features/first-visit-tour/model/steps';
import { SPIN_HANDLER, makeItSpin, spinTarget } from '@/features/first-visit-tour/model/spin';
import { COURSE, LESSON_CATALOG, courseOrder, firstLessonToStudy } from '@/features/lesson-engine/model/catalog';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import { addPrimitive, addQuad, addTriangle, getState } from '../helpers/store';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mount(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}
const step = (id: string) => TOUR_STEPS.find((s) => s.id === id)!;
const noRun = { startedThisStep: false, running: false };
const ctx = (spun = false): TourCaptionContext => ({
  state: getState(),
  baseline: getState().tourStepBaseline,
  codeName: (name) => name,
  spun,
});
/** Moves the running tour to step `index`. */
const goTo = (index: number) => {
  for (let i = getState().tourStep ?? index; i < index; i++) getState().nextTourStep();
};

describe('BB-TOUR-01: Six steps, in the order VAMS teaches, pointing at regions the editor marks', () => {
  it('lists Build, Read, Change, Understand, Run and Learn with their regions', () => {
    expect(TOUR_STEPS.map((s) => s.title)).toEqual(['Build', 'Read', 'Change', 'Understand', 'Run', 'Learn']);
    expect(TOUR_STEPS).toHaveLength(TOUR_STEP_COUNT);
    expect(TOUR_STEPS.map((s) => s.anchors)).toEqual([
      ['rail-add', 'panel', 'canvas'],
      ['code-column'],
      ['panel', 'code-column'],
      ['code-switch', 'code-column'],
      ['run'],
      ['learn'],
    ]);
    expect(TOUR_STEPS.map((s) => s.drawer)).toEqual([true, false, true, false, false, false]);
  });

  it('finds every anchor on a real element in the editor source', () => {
    const files = (readdirSync('src', { recursive: true }) as string[]).filter((f) => f.endsWith('.tsx'));
    const lines = files
      .flatMap((f) => readFileSync(join('src', f), 'utf8').split('\n'))
      .filter((line) => line.includes('data-tour-anchor'));
    for (const id of new Set(TOUR_STEPS.flatMap((s) => s.anchors))) {
      expect(lines.some((line) => line.includes(`"${id}"`) || line.includes(`'${id}'`)), id).toBe(true);
    }
  });
});

describe('BB-TOUR-02: Starting, moving through and ending the tour', () => {
  it('opens the panel and the code column on Code, starts on Add and gives the rail back at the end', () => {
    useVamsStore.setState({ railPanel: 'settings', railHidden: true, codeHidden: true, codePane: 'math', codeChangedUnseen: true });
    getState().startTour();
    let s = getState();
    expect(s.tourStep).toBe(0);
    expect([s.railPanel, s.railHidden, s.codeHidden, s.codePane, s.codeChangedUnseen]).toEqual(['add', false, false, 'code', false]);
    expect(s.railBeforeTour).toBe('settings');
    getState().endTour();
    s = getState();
    expect([s.tourStep, s.railPanel, s.railBeforeTour, s.tourStepBaseline]).toEqual([null, 'settings', null, null]);
  });

  it('does not start during a lesson', () => {
    useVamsStore.setState({ appMode: 'Lesson' });
    getState().startTour();
    expect(getState().tourStep).toBeNull();
    useVamsStore.setState({ appMode: 'Author' });
  });

  it('stops at both ends, and Next and Back cancel a half-placed shape', () => {
    getState().startTour();
    getState().prevTourStep();
    expect(getState().tourStep).toBe(0);
    getState().startCustomShape('TRIANGLES', 3, 3);
    getState().addPendingVertex(0, 0);
    getState().nextTourStep();
    let s = getState();
    expect(s.tourStep).toBe(1);
    expect([s.interactionMode, s.pendingShapeType, s.pendingVertices]).toEqual(['SELECT', null, []]);
    getState().startCustomShape('QUADS', 4, 4);
    getState().prevTourStep();
    s = getState();
    expect(s.tourStep).toBe(0);
    expect(s.interactionMode).toBe('SELECT');
    for (let i = 0; i < 10; i++) getState().nextTourStep();
    expect(getState().tourStep).toBe(TOUR_STEP_COUNT - 1);
    getState().endTour();
  });

  it('changes nothing in the scene when the student only presses Next', () => {
    addTriangle();
    getState().selectObject(null);
    const { objects, callbacks, past } = getState();
    getState().startTour();
    for (let i = 0; i < TOUR_STEP_COUNT; i++) getState().nextTourStep();
    getState().endTour();
    const s = getState();
    expect(s.objects).toBe(objects);
    expect(s.callbacks).toBe(callbacks);
    expect(s.past.length).toBe(past.length);
  });

  it('opens Scene on the Change step with the triangle built in step 1, or keeps a selection', () => {
    addQuad();
    getState().selectObject(null);
    getState().startTour();
    const triangle = addTriangle();
    getState().selectObject(null);
    goTo(2);
    let s = getState();
    expect(s.railPanel).toBe('scene');
    expect(s.selectedObjectId).toBe(triangle.id);
    expect(s.tourStepBaseline).toMatchObject({ objectId: triangle.id, translateX: triangle.transform.translateX });
    getState().prevTourStep();
    const quad = getState().objects.find((o) => o.type === 'QUADS')!;
    getState().selectObject(quad.id);
    getState().nextTourStep();
    s = getState();
    expect(s.selectedObjectId).toBe(quad.id);
    expect(s.tourStepBaseline!.objectId).toBe(quad.id);
    getState().endTour();
  });
});

describe('BB-TOUR-03: Each step’s check and caption', () => {
  it('Build passes only for a finished triangle made during the step', () => {
    addTriangle();
    getState().startTour();
    const done = () => step('build').done!(getState(), getState().tourStepBaseline, noRun);
    expect(done()).toBe(false);
    addQuad();
    addPrimitive('LINES', [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }]);
    expect(done()).toBe(false);
    getState().startCustomShape('TRIANGLES', 3, 3);
    for (const [x, y] of [[0, 0], [0.5, 0], [0, 0.5]]) getState().addPendingVertex(x, y);
    expect(done()).toBe(false);
    getState().addCustomObject('TRIANGLES', getState().pendingVertices);
    expect(done()).toBe(true);
    expect(builtTriangle(getState(), getState().tourStepBaseline)!.id).toBe(getState().objects[0].id);
    getState().endTour();
  });

  it('Change passes once the watched object’s X differs from where it started', () => {
    const triangle = addTriangle();
    getState().startTour();
    goTo(2);
    const done = () => step('change').done!(getState(), getState().tourStepBaseline, noRun);
    expect(done()).toBe(false);
    getState().updateObjectTransform(triangle.id, { translateX: triangle.transform.translateX + 0.25 });
    expect(done()).toBe(true);
    getState().updateObjectTransform(triangle.id, { translateX: triangle.transform.translateX });
    expect(done()).toBe(false);
    getState().endTour();
  });

  it('Understand passes when Math shows, and Run when a run started in the step has stopped', () => {
    getState().startTour();
    goTo(3);
    expect(step('understand').done!(getState(), getState().tourStepBaseline, noRun)).toBe(false);
    getState().setCodePane('math');
    expect(step('understand').done!(getState(), getState().tourStepBaseline, noRun)).toBe(true);
    const run = step('run').done!;
    expect(run(getState(), null, { startedThisStep: false, running: false })).toBe(false);
    expect(run(getState(), null, { startedThisStep: true, running: true })).toBe(false);
    expect(run(getState(), null, { startedThisStep: true, running: false })).toBe(true);
    expect(step('read').done).toBeUndefined();
    expect(step('learn').done).toBeUndefined();
    getState().endTour();
  });

  it('captions name the shape and fall back when there is none', () => {
    getState().startTour();
    expect(step('read').caption(ctx())).toBe('Every shape you make becomes real OpenGL code.');
    goTo(2);
    expect(step('change').caption(ctx())).toBe('Selecting an object opens its settings.');
    expect(step('change').tryIt!(ctx())).toBeNull();
    getState().endTour();

    const triangle = addTriangle();
    getState().startTour();
    expect(step('build').caption(ctx())).toBe('The rail switches what this panel shows. **Add** is where you build.');
    expect(step('build').tryIt!(ctx())).toBe('Pick **Triangles**, click three points on the canvas, then press **Enter**.');
    expect(step('read').caption(ctx())).toBe(
      `Every shape you make becomes real OpenGL code. Your triangle is drawn by \`draw_${triangle.name}()\`.`,
    );
    goTo(2);
    expect(step('change').caption(ctx())).toBe('Selecting an object opens its settings. Change **X** and watch the code.');
    expect(step('change').tryIt!(ctx())).toBe('Change the selected object’s **Translate X**.');
    expect(step('understand').tryIt!(ctx())).toBe('Click **Math**.');
    expect(step('run').caption(ctx(true))).toContain('Your Idle callback stays in **Callbacks**.');
    expect(step('run').caption(ctx(false))).not.toContain('Idle callback');
    expect(step('learn').caption(ctx())).toBe('**Learn** opens the course: five sections of demos and exercises.');
    getState().endTour();
  });
});

describe('BB-TOUR-04: Make it spin registers an Idle rule through the Callbacks actions', () => {
  it('names the handler onIdle and adds one rotate rule on the selected object, as one undo step', () => {
    const triangle = addTriangle();
    addQuad();
    getState().selectObject(triangle.id);
    useVamsStore.setState({ past: [], future: [] });
    expect(makeItSpin(getState())).toBe(triangle.id);
    const idle = getState().callbacks.idle;
    expect(idle.handlerName).toBe(SPIN_HANDLER);
    expect(idle.rules).toEqual([
      { id: expect.any(String), objectId: triangle.id, trigger: { kind: 'idle' }, action: { type: 'rotate', degrees: 2 } },
    ]);
    expect(getState().past).toHaveLength(1);
    getState().undo();
    expect(getState().callbacks.idle).toEqual(emptyCallbacks().idle);
  });

  it('keeps a valid Idle handler, falls back to the first drawn shape, and does nothing without one', () => {
    expect(spinTarget(getState())).toBeNull();
    expect(makeItSpin(getState())).toBeNull();
    expect(getState().callbacks).toEqual(emptyCallbacks());
    const quad = addQuad();
    getState().selectObject(null);
    getState().setCallbackHandler('idle', 'tick');
    expect(spinTarget(getState())!.id).toBe(quad.id);
    makeItSpin(getState());
    expect(getState().callbacks.idle.handlerName).toBe('tick');
    expect(getState().callbacks.idle.rules[0].objectId).toBe(quad.id);
  });
});

describe('BB-TOUR-05: Start learning picks the next lesson in course order', () => {
  it('orders the course by section, demos before exercises', () => {
    const order = courseOrder();
    expect(order).toHaveLength(LESSON_CATALOG.length);
    expect([...new Set(order.map((l) => l.section))]).toEqual(COURSE.map((c) => c.section));
    for (const { section } of COURSE) {
      const types = order.filter((l) => l.section === section).map((l) => l.type);
      expect(types).toEqual([...types].sort());
    }
  });

  it('picks the first lesson not completed, or the first lesson once all are done', () => {
    const ids = courseOrder().map((l) => l.id);
    expect(firstLessonToStudy([])).toBe(ids[0]);
    expect(firstLessonToStudy([ids[0], ids[1]])).toBe(ids[2]);
    expect(firstLessonToStudy([ids[1]])).toBe(ids[0]);
    expect(firstLessonToStudy(ids)).toBe(ids[0]);
  });
});

describe('BB-TOUR-06: Undo and redo never leave a step done', () => {
  it('undoing the Build triangle makes the step undone, and redo makes it done again', () => {
    getState().startTour();
    useVamsStore.setState({ past: [], future: [] });
    addTriangle();
    const done = () => step('build').done!(getState(), getState().tourStepBaseline, noRun);
    expect(done()).toBe(true);
    getState().undo();
    expect(done()).toBe(false);
    getState().redo();
    expect(done()).toBe(true);
    getState().endTour();
  });

  it('undoing X back to its starting value in the Change step does not count', () => {
    const triangle = addTriangle();
    getState().startTour();
    goTo(2);
    useVamsStore.setState({ past: [], future: [] });
    getState().pushToHistory();
    getState().updateObjectTransform(triangle.id, { translateX: triangle.transform.translateX + 0.3 });
    const done = () => step('change').done!(getState(), getState().tourStepBaseline, noRun);
    expect(done()).toBe(true);
    getState().undo();
    expect(done()).toBe(false);
    getState().endTour();
  });
});

describe('BB-TOUR-07: During the tour the code flashes the lines an edit changes', () => {
  it('marks the ObjectState line when X changes, and nothing outside the tour', async () => {
    const triangle = addTriangle();
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().updateObjectTransform(triangle.id, { translateX: 0.4 });
    await settle();
    expect(host.querySelectorAll('.code-line.changed')).toHaveLength(0);
    getState().startTour();
    await settle();
    getState().updateObjectTransform(triangle.id, { translateX: 0.7 });
    await settle();
    const changed = [...host.querySelectorAll('.code-line.changed')].map((el) => el.textContent ?? '');
    expect(changed.some((line) => line.includes('ObjectState state_'))).toBe(true);
    expect(changed.some((line) => line.includes('glTranslatef'))).toBe(false);
    getState().endTour();
    await settle();
    expect(host.querySelectorAll('.code-line.changed')).toHaveLength(0);
    unmount(host);
  });
});
