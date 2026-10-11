/**
 * WHITE-BOX TEST SUITE — WB-CB
 * The Run runtime against the generated C++ (run through tests/helpers/mini-cpp).
 */
import { describe, it, expect } from 'vitest';
import type { RuleAction } from '@/core/types/scene';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { actionLines } from '@/features/code-generation/model/generator/handlers';
import { generateIdleBody } from '@/features/code-generation/model/generator/idle';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { locateHandlerBranch } from '@/features/code-generation/model/locate-branch';
import {
  applyAction, createRunState, dispatch, keepProportionsView, stepAnimations, type RunObjectState,
} from '@/features/callbacks/model/runtime';
import { MiniCpp } from '../helpers/mini-cpp';
import { addTriangle, getState } from '../helpers/store';

const base: RunObjectState = { x: 0.2, y: -0.1, rotation: 30, scaleX: 1.5, scaleY: 0.5, r: 0, g: 0, b: 0, useColor: false, visible: true };
const initial: RunObjectState = { ...base, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

describe('WB-CB-1: Each action changes the state as its C++ line does', () => {
  const actions: RuleAction[] = [
    { type: 'translate', dx: 0.1, dy: -0.25 }, { type: 'rotate', degrees: 15 }, { type: 'scale', sx: 1.1, sy: 0.9 },
    { type: 'moveToPointer' }, { type: 'reset' }, { type: 'setColor', color: '#ff8000' },
    { type: 'visibility', mode: 'show' }, { type: 'visibility', mode: 'hide' }, { type: 'visibility', mode: 'toggle' },
  ];
  it.each(actions)('$type', (action) => {
    const cpp = new MiniCpp();
    cpp.vars.set('state_T', { ...base });
    cpp.vars.set('initial_T', { ...initial });
    cpp.vars.set('wx', 0.4);
    cpp.vars.set('wy', 0.6);
    cpp.run(actionLines(action, 'T', ''));
    const runtime = applyAction({ ...base }, action, initial, { x: 0.4, y: 0.6 });
    const expected = cpp.vars.get('state_T') as Record<string, number | boolean>;
    for (const field of Object.keys(base) as (keyof RunObjectState)[]) {
      if (typeof expected[field] === 'number') expect(runtime[field]).toBeCloseTo(expected[field] as number, 6);
      else expect(runtime[field]).toBe(expected[field]);
    }
  });
});

describe('WB-CB-2: Keyboard dispatch matches either case', () => {
  it('moves on d and D, ignores other keys', () => {
    const t = addTriangle();
    const cbs = emptyCallbacks();
    cbs.keyboard = { handlerName: 'onKey', rules: [{ id: 'r', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 } }] };
    let state = createRunState(getState().objects, getState().viewportLimits, { width: 800, height: 600 });
    const x0 = state.objects[t.id].x;
    state = dispatch(state, cbs, { type: 'key', key: 'D', x: 0, y: 0 }).state;
    state = dispatch(state, cbs, { type: 'key', key: 'd', x: 0, y: 0 }).state;
    const other = dispatch(state, cbs, { type: 'key', key: 'q', x: 0, y: 0 });
    expect(other.state).toBe(state);
    expect(other.call).toBe("onKey('q', 0, 0)");
    expect(state.objects[t.id].x).toBeCloseTo(x0 + 0.2, 6);
  });
});

describe('WB-CB-3: Mouse dispatch converts pixels with the windowToWorld formula', () => {
  it('flips y and matches button and state', () => {
    const t = addTriangle();
    const cbs = emptyCallbacks();
    cbs.mouse = { handlerName: 'onMouse', rules: [{ id: 'r', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } }] };
    let state = createRunState(getState().objects, { minX: -1, maxX: 1, minY: -1, maxY: 1 }, { width: 800, height: 600 });
    const up = dispatch(state, cbs, { type: 'mouse', button: 'left', state: 'up', x: 600, y: 150 });
    expect(up.state).toBe(state);
    const down = dispatch(state, cbs, { type: 'mouse', button: 'left', state: 'down', x: 600, y: 150 });
    state = down.state;
    expect(state.objects[t.id].x).toBeCloseTo(0.5, 6);
    expect(state.objects[t.id].y).toBeCloseTo(0.5, 6);
    expect(down.call).toBe('onMouse(GLUT_LEFT_BUTTON, GLUT_DOWN, 600, 150)');
  });
});

describe('WB-CB-4: Keep proportions matches the generated reshape body', () => {
  it.each([[1200, 400], [300, 900], [500, 500]])('%i x %i', (width, height) => {
    useVamsStateForReshape();
    const code = generateCodeFromState(
      { objects: getState().objects, canvasBackgroundColor: '#000000', callbacks: getState().callbacks, viewportLimits: getState().viewportLimits },
      { width: 800, height: 600 },
    );
    const lines = code.split('\n');
    const bodyLines = locateHandlerBranch(code, 'onReshape', null).map((n) => lines[n]).slice(2, -1);
    const cpp = new MiniCpp();
    cpp.vars.set('width', width);
    cpp.vars.set('height', height);
    ['viewMinX', 'viewMaxX', 'viewMinY', 'viewMaxY'].forEach((n) => cpp.vars.set(n, 0));
    cpp.run(bodyLines);
    const view = keepProportionsView(getState().viewportLimits, width, height);
    expect(view.minX).toBeCloseTo(cpp.vars.get('viewMinX') as number, 6);
    expect(view.maxX).toBeCloseTo(cpp.vars.get('viewMaxX') as number, 6);
    expect(view.minY).toBeCloseTo(cpp.vars.get('viewMinY') as number, 6);
    expect(view.maxY).toBeCloseTo(cpp.vars.get('viewMaxY') as number, 6);
  });
});

function useVamsStateForReshape() {
  getState().setViewportLimits({ minX: -2, maxX: 3, minY: -1, maxY: 1.5 });
  getState().setCallbackHandler('reshape', 'onReshape');
}

describe('WB-CB-5: stepAnimations matches the generated animator over 120 frames', () => {
  it.each(['rotate', 'pulse', 'slide', 'orbit'] as const)('%s', (motion) => {
    const t = addTriangle(0.2, 0.1, 0.1);
    getState().updateObjectName(t.id, 'T');
    getState().setObjectAnimation(t.id, { motion, speed: 1.5 });
    const obj = getState().objects.find((o) => o.id === t.id)!;
    const cpp = new MiniCpp();
    cpp.vars.set('state_T', { x: obj.transform.translateX, y: obj.transform.translateY, rotation: obj.transform.rotate, scaleX: obj.transform.scaleX, scaleY: obj.transform.scaleY });
    let state = createRunState(getState().objects, getState().viewportLimits, { width: 800, height: 600 });
    const lines = generateIdleBody(motion, 'T', 1.5).lines;
    for (let frame = 0; frame < 120; frame++) {
      cpp.run(lines);
      state = stepAnimations(state, getState().objects);
    }
    const expected = cpp.vars.get('state_T') as Record<string, number>;
    for (const field of ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const) {
      expect(state.objects[t.id][field]).toBeCloseTo(expected[field], 5);
    }
  });
});

describe('WB-CB-6: A Slide animation overrides a Translate rule on x, as the program does', () => {
  it('loses the key translation on the next frame', () => {
    const t = addTriangle(0.2, 0, 0.1);
    getState().setObjectAnimation(t.id, { motion: 'slide', speed: 1 });
    const cbs = emptyCallbacks();
    cbs.keyboard = { handlerName: 'onKey', rules: [{ id: 'r', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.5, dy: 0 } }] };
    let state = createRunState(getState().objects, getState().viewportLimits, { width: 800, height: 600 });
    state = stepAnimations(state, getState().objects);
    const baseX = state.statics[t.id].baseX!;
    state = dispatch(state, cbs, { type: 'key', key: 'd', x: 0, y: 0 }).state;
    state = stepAnimations(state, getState().objects);
    expect(state.objects[t.id].x).toBeCloseTo(baseX + 0.5 * Math.sin(2 * 0.03), 6);
  });
});

describe('WB-CB-7: dispatch gating and reshape', () => {
  const WIN = { width: 800, height: 600 };
  const key = (objectId: string) => ({ id: 'r', objectId, trigger: { kind: 'keyboard' as const, key: 'd' }, action: { type: 'translate' as const, dx: 0.1, dy: 0 } });

  it.each(['main', 'draw_x'])('applies no rules for the invalid name %s', (name) => {
    const t = addTriangle();
    const cbs = emptyCallbacks();
    cbs.keyboard = { handlerName: name, rules: [key(t.id)] };
    const state = createRunState(getState().objects, getState().viewportLimits, WIN);
    const result = dispatch(state, cbs, { type: 'key', key: 'd', x: 0, y: 0 });
    expect(result.state).toBe(state);
    expect(result.call).toBeNull();
    expect(result.kind).toBeNull();
    expect(result.handlerName).toBeNull();
  });

  it('applies no rules for a name an earlier callback already uses', () => {
    const t = addTriangle();
    const cbs = emptyCallbacks();
    cbs.mouse = { handlerName: 'onInput', rules: [] };
    cbs.motion = { handlerName: 'onInput', rules: [{ id: 'r', objectId: t.id, trigger: { kind: 'motion' }, action: { type: 'moveToPointer' } }] };
    const state = createRunState(getState().objects, getState().viewportLimits, WIN);
    const result = dispatch(state, cbs, { type: 'motion', x: 100, y: 100 });
    expect(result.state).toBe(state);
    expect(result.call).toBeNull();
    expect(result.kind).toBeNull();
    expect(result.handlerName).toBeNull();
  });

  it('skips an object hidden in the editor', () => {
    const t = addTriangle();
    getState().toggleObjectVisibility(t.id);
    const cbs = emptyCallbacks();
    cbs.keyboard = { handlerName: 'onKey', rules: [key(t.id)] };
    const state = createRunState(getState().objects, getState().viewportLimits, WIN);
    expect(state.objects[t.id]).toBeUndefined();
    expect(dispatch(state, cbs, { type: 'key', key: 'd', x: 0, y: 0 }).state).toBe(state);
  });

  it('skips a child of a hidden group', () => {
    const a = addTriangle();
    const b = addTriangle(0.5, 0.5);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().toggleObjectVisibility(group.id);
    const cbs = emptyCallbacks();
    cbs.keyboard = { handlerName: 'onKey', rules: [key(a.id)] };
    const state = createRunState(getState().objects, getState().viewportLimits, WIN);
    expect(state.objects[a.id]).toBeUndefined();
    expect(dispatch(state, cbs, { type: 'key', key: 'd', x: 0, y: 0 }).state).toBe(state);
  });

  describe('reshape', () => {
    const limits = { minX: -2, maxX: 3, minY: -1, maxY: 1.5 };

    it('Keep proportions sets window and view, and the pointer follows the new view', () => {
      const t = addTriangle();
      const cbs = emptyCallbacks();
      cbs.reshape = { handlerName: 'onReshape', resize: 'keep' };
      cbs.mouse = { handlerName: 'onMouse', rules: [{ id: 'r', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } }] };
      let state = createRunState(getState().objects, limits, WIN);
      const result = dispatch(state, cbs, { type: 'reshape', width: 1200, height: 400 });
      state = result.state;
      expect(state.window).toEqual({ width: 1200, height: 400 });
      expect(state.view).toEqual(keepProportionsView(limits, 1200, 400));
      expect(result.call).toBe('onReshape(1200, 400)');
      state = dispatch(state, cbs, { type: 'mouse', button: 'left', state: 'down', x: 1200, y: 0 }).state;
      expect(state.objects[t.id].x).toBeCloseTo(state.view.maxX, 6);
    });

    it('Stretch keeps the saved limits', () => {
      const cbs = emptyCallbacks();
      cbs.reshape = { handlerName: 'onReshape', resize: 'stretch' };
      const state = createRunState(getState().objects, limits, WIN);
      const result = dispatch(state, cbs, { type: 'reshape', width: 1200, height: 400 });
      expect(result.state.window).toEqual({ width: 1200, height: 400 });
      expect(result.state.view).toEqual(limits);
    });

    it('with no reshape handler the window still updates and the call is null', () => {
      const state = createRunState(getState().objects, limits, WIN);
      const result = dispatch(state, emptyCallbacks(), { type: 'reshape', width: 1200, height: 400 });
      expect(result.state.window).toEqual({ width: 1200, height: 400 });
      expect(result.state.view).toEqual(limits);
      expect(result.call).toBeNull();
    });
  });
});
