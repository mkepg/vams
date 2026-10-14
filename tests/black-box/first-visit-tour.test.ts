/**
 * BLACK-BOX TEST SUITE — BB-TOUR
 * The first-visit tour: its steps and checks, the tour state, Make it spin, and the spotlight and callout.
 */
import { describe, it, expect, vi } from 'vitest';
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
import FirstVisitTour, { TOUR_ADVANCE_MS, type TourRun } from '@/features/first-visit-tour';
import { placeCallout } from '@/features/first-visit-tour/model/geometry';
import { runController } from '@/features/callbacks/model/run-controller';
import { startLesson } from '@/features/lesson-engine/model/start-lesson';
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

const ANCHORS = ['rail-add', 'panel', 'canvas', 'code-column', 'code-switch', 'run', 'learn'];

/** A stand-in for the editor: one element per anchor, plus a button elsewhere and one already inert. */
function fakeEditor() {
  const root = document.createElement('div');
  for (const id of ANCHORS) {
    const el = document.createElement('button');
    el.setAttribute('data-tour-anchor', id);
    el.textContent = id;
    root.appendChild(el);
  }
  const elsewhere = document.createElement('button');
  elsewhere.id = 'elsewhere';
  root.appendChild(elsewhere);
  const wasInert = document.createElement('div');
  wasInert.id = 'was-inert';
  wasInert.setAttribute('inert', '');
  root.appendChild(wasInert);
  document.body.appendChild(root);
  return root;
}

function fakeRun() {
  let snapshot = { running: false };
  const listeners = new Set<() => void>();
  const publish = (running: boolean) => {
    snapshot = { running };
    listeners.forEach((listener) => listener());
  };
  return {
    start: vi.fn(() => {
      publish(true);
      return true;
    }),
    stop: vi.fn(() => publish(false)),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
}

function mountTour(run: TourRun = fakeRun(), startLearning = vi.fn()) {
  const host = mount(h(FirstVisitTour, { run, codeName: (name: string) => name, startLearning }));
  return { host, run, startLearning };
}
const callout = () => document.querySelector<HTMLElement>('.tour-callout');
const tourButton = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.tour-callout button')].find((b) => b.textContent?.trim() === name);
const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
/** With fake timers, lets renders and effects run. */
const flush = () => vi.advanceTimersByTimeAsync(40);

function mediaQuery(initial: boolean) {
  const real = window.matchMedia;
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return matches; },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  }));
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
    restore() {
      window.matchMedia = real;
    },
  };
}

describe('BB-TOUR-08: The callout shows the step and moves with its buttons and keys', () => {
  it('shows the step, the caption and the try-it line, and Back, Next and Skip work', async () => {
    const editor = fakeEditor();
    getState().startTour();
    const { host } = mountTour();
    await settle();
    const dialog = callout()!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('false');
    expect(dialog.querySelector('.tour-callout__step')!.textContent).toBe('Step 1 of 6');
    expect(dialog.querySelector('.tour-callout__caption strong')!.textContent).toBe('Add');
    expect(dialog.querySelector('.tour-callout__try')!.textContent).toContain('Pick Triangles');
    expect(dialog.querySelector('[aria-live="polite"]')!.textContent).toBe('Tour step 1 of 6: Build');
    expect(tourButton('Back')!.disabled).toBe(true);
    expect(document.activeElement).toBe(dialog);
    tourButton('Next')!.click();
    await settle();
    expect(getState().tourStep).toBe(1);
    expect(callout()!.querySelector('.tour-callout__step')!.textContent).toBe('Step 2 of 6');
    tourButton('Back')!.click();
    await settle();
    expect(getState().tourStep).toBe(0);
    tourButton('Skip tour')!.click();
    await settle();
    expect(getState().tourStep).toBeNull();
    expect(callout()).toBeNull();
    unmount(host);
    editor.remove();
  });

  it('goes forward with Right or Enter, back with Left, and ends with Esc', async () => {
    const editor = fakeEditor();
    getState().startTour();
    const { host } = mountTour();
    await settle();
    press('ArrowRight');
    expect(getState().tourStep).toBe(1);
    press('Enter');
    expect(getState().tourStep).toBe(2);
    press('ArrowLeft');
    expect(getState().tourStep).toBe(1);
    press('Escape');
    expect(getState().tourStep).toBeNull();
    unmount(host);
    editor.remove();
  });

  it('leaves keys to fields and arrow widgets, and Enter and Esc to a shape being placed', async () => {
    const editor = fakeEditor();
    const input = document.createElement('input');
    const group = document.createElement('div');
    group.setAttribute('role', 'radiogroup');
    const radio = document.createElement('button');
    group.appendChild(radio);
    editor.append(input, group);
    getState().startTour();
    const { host } = mountTour();
    await settle();
    press('ArrowRight', input);
    press('Escape', input);
    press('ArrowRight', radio);
    expect(getState().tourStep).toBe(0);
    getState().startCustomShape('TRIANGLES', 3, 3);
    press('Enter');
    press('Escape');
    expect(getState().tourStep).toBe(0);
    expect(getState().interactionMode).toBe('VERTEX_PLACE');
    press('ArrowRight');
    expect(getState().tourStep).toBe(1);
    expect(getState().interactionMode).toBe('SELECT');
    getState().endTour();
    unmount(host);
    editor.remove();
  });

  it('ends with Start learning and Explore on my own instead of Next', async () => {
    const editor = fakeEditor();
    getState().startTour();
    goTo(5);
    const { host } = mountTour();
    await settle();
    expect(tourButton('Next')).toBeUndefined();
    expect(tourButton('Skip tour')).toBeUndefined();
    expect(tourButton('Start learning')).toBeDefined();
    press('ArrowRight');
    expect(getState().tourStep).toBe(5);
    tourButton('Explore on my own')!.click();
    await settle();
    expect(getState().tourStep).toBeNull();
    unmount(host);
    editor.remove();
  });
});

describe('BB-TOUR-09: Doing a step moves the tour on by itself', () => {
  it('moves on a moment after the Build triangle is finished; an undo in that moment holds it', async () => {
    vi.useFakeTimers();
    const editor = fakeEditor();
    try {
      getState().startTour();
      const { host } = mountTour();
      await flush();
      useVamsStore.setState({ past: [], future: [] });
      addTriangle();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS / 2);
      getState().undo();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS);
      expect(getState().tourStep).toBe(0);
      getState().redo();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS - 100);
      expect(getState().tourStep).toBe(0);
      await vi.advanceTimersByTimeAsync(200);
      expect(getState().tourStep).toBe(1);
      getState().endTour();
      unmount(host);
    } finally {
      editor.remove();
      vi.useRealTimers();
    }
  });

  it('waits on a step that was already done when the student came Back to it', async () => {
    vi.useFakeTimers();
    const editor = fakeEditor();
    try {
      getState().startTour();
      goTo(3);
      const { host } = mountTour();
      await flush();
      getState().setCodePane('math');
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS + 100);
      expect(getState().tourStep).toBe(4);
      getState().prevTourStep();
      await flush();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS * 2);
      expect(getState().tourStep).toBe(3);
      getState().setCodePane('code');
      getState().setCodePane('math');
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS + 100);
      expect(getState().tourStep).toBe(4);
      getState().endTour();
      unmount(host);
    } finally {
      editor.remove();
      vi.useRealTimers();
    }
  });
});

describe('BB-TOUR-10: The Run step', () => {
  it('Make it spin starts Run without ending the tour, and the stopped run moves on to Learn', async () => {
    vi.useFakeTimers();
    const editor = fakeEditor();
    try {
      addTriangle();
      getState().startTour();
      goTo(4);
      const run = fakeRun();
      const { host } = mountTour(run);
      await flush();
      tourButton('Make it spin')!.click();
      await flush();
      expect(run.start).toHaveBeenCalledTimes(1);
      expect(getState().tourStep).toBe(4);
      expect(getState().callbacks.idle.rules).toHaveLength(1);
      expect(document.querySelector('.tour')!.classList.contains('is-lifted')).toBe(true);
      expect(document.querySelector('[inert]:not(#was-inert)')).toBeNull();
      expect(tourButton('Make it spin')).toBeUndefined();
      expect(callout()!.textContent).toContain('Your Idle callback stays in Callbacks.');
      run.stop();
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS + 100);
      expect(getState().tourStep).toBe(5);
      getState().endTour();
      unmount(host);
    } finally {
      editor.remove();
      vi.useRealTimers();
    }
  });

  it('counts a run that stopped because the scene changed', async () => {
    vi.useFakeTimers();
    const editor = fakeEditor();
    const run: TourRun = {
      start: () => runController.start({ loop: false }),
      stop: () => runController.stop(),
      subscribe: runController.subscribe,
      getSnapshot: runController.getSnapshot,
    };
    try {
      addTriangle();
      useVamsStore.setState({ past: [], future: [] });
      getState().startTour();
      goTo(4);
      const { host } = mountTour(run);
      await flush();
      tourButton('Make it spin')!.click();
      await flush();
      expect(runController.getSnapshot().running).toBe(true);
      getState().undo();
      expect(runController.getSnapshot().running).toBe(false);
      await vi.advanceTimersByTimeAsync(TOUR_ADVANCE_MS + 100);
      expect(getState().tourStep).toBe(5);
      getState().endTour();
      unmount(host);
    } finally {
      runController.stop();
      editor.remove();
      vi.useRealTimers();
    }
  });

  it('ends the tour when Run starts on any other step, and offers no spin without a shape', async () => {
    const editor = fakeEditor();
    getState().startTour();
    const run = fakeRun();
    let { host } = mountTour(run);
    await settle();
    run.start();
    await settle();
    expect(getState().tourStep).toBeNull();
    unmount(host);
    run.stop();
    getState().startTour();
    goTo(4);
    ({ host } = mountTour(run));
    await settle();
    expect(tourButton('Make it spin')).toBeUndefined();
    expect(callout()!.querySelector('.tour-callout__try')).toBeNull();
    getState().endTour();
    unmount(host);
    editor.remove();
  });
});

describe('BB-TOUR-11: Starting a lesson ends the tour', () => {
  it('cancels a half-placed shape and leaves the rail to the lesson', async () => {
    useVamsStore.setState({ railPanel: 'settings' });
    getState().startTour();
    getState().startCustomShape('TRIANGLES', 3, 3);
    getState().addPendingVertex(0, 0);
    expect(await startLesson('transforms-demo-1')).toBe(true);
    const s = getState();
    expect(s.tourStep).toBeNull();
    expect([s.interactionMode, s.pendingShapeType]).toEqual(['SELECT', null]);
    expect(s.railPanel).toBe('add');
    getState().setLessonFocusPanel('callbacks-panel');
    expect(getState().railPanel).toBe('callbacks');
    getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });
  });
});

describe('BB-TOUR-12: The tour hands over to the lessons', () => {
  it('Start learning asks the page for the next lesson and ends the tour', async () => {
    const editor = fakeEditor();
    getState().startTour();
    goTo(5);
    const { host, startLearning } = mountTour();
    await settle();
    tourButton('Start learning')!.click();
    await settle();
    expect(startLearning).toHaveBeenCalledTimes(1);
    expect(getState().tourStep).toBeNull();
    unmount(host);
    editor.remove();
  });

  it('opening the Learn drawer ends the tour', async () => {
    const editor = fakeEditor();
    getState().startTour();
    goTo(5);
    const { host } = mountTour();
    await settle();
    getState().setLearnOpen(true);
    await settle();
    expect(getState().tourStep).toBeNull();
    getState().setLearnOpen(false);
    unmount(host);
    editor.remove();
  });
});

describe('BB-TOUR-13: The spotlight', () => {
  it('makes everything but the step’s regions inert, and gives it all back at the end', async () => {
    const editor = fakeEditor();
    const anchor = (id: string) => editor.querySelector(`[data-tour-anchor="${id}"]`)!;
    getState().startTour();
    const { host } = mountTour();
    await settle();
    for (const id of ['rail-add', 'panel', 'canvas']) expect(anchor(id).hasAttribute('inert'), id).toBe(false);
    for (const id of ['code-column', 'run', 'learn']) expect(anchor(id).hasAttribute('inert'), id).toBe(true);
    expect(editor.querySelector('#elsewhere')!.hasAttribute('inert')).toBe(true);
    expect(callout()!.closest('[inert]')).toBeNull();
    expect(document.querySelectorAll('.tour__outline')).toHaveLength(3);
    getState().nextTourStep();
    await settle();
    expect(anchor('code-column').hasAttribute('inert')).toBe(false);
    expect(anchor('canvas').hasAttribute('inert')).toBe(true);
    expect(document.querySelectorAll('.tour__outline')).toHaveLength(1);
    getState().endTour();
    await settle();
    expect([...document.querySelectorAll('[inert]')].map((el) => el.id)).toEqual(['was-inert']);
    unmount(host);
    editor.remove();
  });

  it('takes focus on each step and gives it back when the tour ends', async () => {
    const editor = fakeEditor();
    const before = editor.querySelector<HTMLButtonElement>('#elsewhere')!;
    before.focus();
    getState().startTour();
    const { host } = mountTour();
    await settle();
    expect(document.activeElement).toBe(callout());
    getState().endTour();
    await settle();
    expect(document.activeElement).toBe(before);
    unmount(host);
    editor.remove();
  });

  it('opens the narrow-screen drawer for Build and Change only', async () => {
    const media = mediaQuery(true);
    const editor = fakeEditor();
    try {
      getState().startTour();
      const { host } = mountTour();
      await settle();
      const hidden = [getState().railHidden];
      for (let i = 1; i < 4; i++) {
        getState().nextTourStep();
        await settle();
        hidden.push(getState().railHidden);
      }
      expect(hidden).toEqual([false, true, false, true]);
      getState().endTour();
      unmount(host);
    } finally {
      editor.remove();
      media.restore();
    }
  });

  it('declares the scrim colour for both themes', () => {
    const scss = readFileSync('src/shared/styles/_tokens.scss', 'utf8');
    expect(scss.split('--tour-scrim: rgba(0, 0, 0, 0.55);').length - 1).toBe(2);
  });
});

describe('BB-TOUR-14: The callout sits beside the regions, never on them', () => {
  const viewport = { width: 1280, height: 800 };
  const size = { width: 320, height: 200 };

  it('takes the first side with room', () => {
    // The Build step at 1280 px: the Add pill, the panel and the canvas. The room is right of the canvas.
    const build = [
      { left: 0, top: 52, width: 64, height: 60 },
      { left: 64, top: 44, width: 272, height: 756 },
      { left: 336, top: 44, width: 520, height: 756 },
    ];
    expect(placeCallout(build, viewport, size)).toEqual({ left: 868, top: 44 });
    // The Read step: the code column on the right, so the callout goes to its left.
    expect(placeCallout([{ left: 820, top: 44, width: 460, height: 756 }], viewport, size)).toEqual({ left: 488, top: 44 });
  });

  it('covers the regions as little as it can when there is no room, and stays in the window', () => {
    expect(placeCallout([{ left: 0, top: 0, width: 1280, height: 800 }], viewport, size)).toEqual({ left: 948, top: 12 });
    expect(placeCallout([], viewport, size)).toEqual({ left: 480, top: 588 });
  });
});

describe('BB-TOUR-15: The spotlight follows a region that moves without resizing', () => {
  it('re-measures when a region’s transition ends', async () => {
    const editor = fakeEditor();
    const panel = editor.querySelector<HTMLElement>('[data-tour-anchor="panel"]')!;
    const rect = (left: number) => ({ left, top: 44, width: 272, height: 700, right: left + 272, bottom: 744, x: left, y: 44, toJSON: () => ({}) }) as DOMRect;
    panel.getBoundingClientRect = () => rect(-208);
    getState().startTour();
    const { host } = mountTour();
    await settle();
    const outline = () => document.querySelectorAll<HTMLElement>('.tour__outline')[1];
    expect(outline().style.left).toBe('-208px');
    panel.getBoundingClientRect = () => rect(64);
    panel.dispatchEvent(new Event('transitionend', { bubbles: true }));
    await settle();
    expect(outline().style.left).toBe('64px');
    getState().endTour();
    unmount(host);
    editor.remove();
  });
});

describe('BB-TOUR-16: Moving on cancels a shape the lesson or page left pending', () => {
  it('clears pendingShapeType on the next step even when the mode is already SELECT', () => {
    getState().startTour();
    useVamsStore.setState({ pendingShapeType: 'TRIANGLES', interactionMode: 'SELECT' });
    getState().nextTourStep();
    expect(getState().pendingShapeType).toBeNull();
    getState().endTour();
  });
});

describe('BB-TOUR-17: The spotlight follows the drawer when it opens without a transition', () => {
  it('re-measures when railHidden changes, with no transitionend', async () => {
    const editor = fakeEditor();
    const panel = editor.querySelector<HTMLElement>('[data-tour-anchor="panel"]')!;
    const rect = (left: number) => ({ left, top: 44, width: 272, height: 700, right: left + 272, bottom: 744, x: left, y: 44, toJSON: () => ({}) }) as DOMRect;
    // The panel sits offscreen while the rail is hidden and in place once it is open, with no transition between.
    panel.getBoundingClientRect = () => rect(getState().railHidden ? -208 : 64);
    getState().startTour();
    useVamsStore.setState({ railHidden: true });
    const { host } = mountTour();
    await settle();
    const outline = () => document.querySelectorAll<HTMLElement>('.tour__outline')[1];
    useVamsStore.setState({ railHidden: true });
    await settle();
    expect(outline().style.left).toBe('-208px');
    useVamsStore.setState({ railHidden: false });
    await settle();
    expect(outline().style.left).toBe('64px');
    getState().endTour();
    unmount(host);
    editor.remove();
  });
});
