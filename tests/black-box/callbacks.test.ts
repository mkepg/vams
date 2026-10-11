/**
 * BLACK-BOX TEST SUITE — BB-CB
 * Functional callbacks: the rule model, the store actions and the generated handler code.
 */
import { describe, it, expect } from 'vitest';
import {
  emptyCallbacks, isCallbackValid, isValidHandlerName, MAX_RULES,
} from '@/core/callbacks/callbacks-model';
import type { CallbackRule } from '@/core/types/scene';
import { addTriangle, addQuad, getState } from '../helpers/store';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rule = (objectId: string, over: Partial<CallbackRule> = {}): CallbackRule => ({
  id: `r-${Math.random()}`,
  objectId,
  trigger: { kind: 'keyboard', key: 'd' },
  action: { type: 'translate', dx: 0.1, dy: 0 },
  ...over,
});

describe('BB-CB-13: Handler names that would not compile are flagged', () => {
  it('rejects non-identifiers, reserved names, reserved prefixes and C++ keywords', () => {
    for (const bad of ['', '1abc', 'on key', 'main', 'display', 'draw', 'init', 'update_buffers',
      'windowToWorld', '_vams_idle', 'draw_Tri', 'animate_x', 'state_y', 'initial_z', 'switch', 'class']) {
      expect(isValidHandlerName(bad)).toBe(false);
    }
    for (const good of ['onKey', '_handler', 'onMouse2']) expect(isValidHandlerName(good)).toBe(true);
  });

  it('flags a name already used by an earlier callback, and leaves it out of getRegisteredCallbacks', () => {
    getState().setCallbackHandler('motion', 'onInput');
    getState().setCallbackHandler('reshape', 'onInput');
    const cbs = getState().callbacks;
    expect(isCallbackValid(cbs, 'motion')).toBe(true);
    expect(isCallbackValid(cbs, 'reshape')).toBe(false);
    expect(getState().getRegisteredCallbacks()).toEqual([{ kind: 'motion', handlerName: 'onInput' }]);
  });
});

describe('BB-CB-14: Deleting an object removes its rules; undo restores both', () => {
  it('prunes rules on delete and undo brings the object and the rules back', async () => {
    const tri = addTriangle();
    await wait(60);
    getState().setCallbackHandler('keyboard', 'onKey');
    await wait(60);
    getState().addCallbackRule('keyboard', rule(tri.id));
    await wait(60);
    getState().deleteObject(tri.id);
    expect(getState().callbacks.keyboard.rules).toEqual([]);
    getState().undo();
    expect(getState().objects.some((o) => o.id === tri.id)).toBe(true);
    expect(getState().callbacks.keyboard.rules).toHaveLength(1);
  });

  it('deleteGroup prunes rules on the group and its children', async () => {
    const a = addTriangle();
    const b = addQuad(0.4, 0, 0.1);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().setCallbackHandler('keyboard', 'onKey');
    getState().addCallbackRule('keyboard', rule(a.id));
    getState().addCallbackRule('keyboard', rule(group.id, { trigger: { kind: 'keyboard', key: 'a' } }));
    await wait(60);
    getState().deleteGroup(group.id);
    expect(getState().callbacks.keyboard.rules).toEqual([]);
  });

  it('ungroup drops a rule on the group, keeps rules on the children, and undo restores the group rule', async () => {
    const a = addTriangle();
    const b = addQuad(0.4, 0, 0.1);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().setCallbackHandler('keyboard', 'onKey');
    getState().addCallbackRule('keyboard', rule(a.id, { id: 'child' }));
    getState().addCallbackRule('keyboard', rule(group.id, { id: 'grp', trigger: { kind: 'keyboard', key: 'a' } }));
    await wait(60);
    getState().ungroup(group.id);
    expect(getState().callbacks.keyboard.rules.map((r) => r.id)).toEqual(['child']);
    getState().undo();
    expect(getState().callbacks.keyboard.rules.map((r) => r.id)).toEqual(['child', 'grp']);
  });

  it('undo restores a cleared callback', async () => {
    getState().setCallbackHandler('mouse', 'onMouse');
    await wait(60);
    getState().clearCallback('mouse');
    expect(getState().callbacks.mouse.handlerName).toBe('');
    getState().undo();
    expect(getState().callbacks.mouse.handlerName).toBe('onMouse');
  });
});

describe('BB-CB-15: The store refuses rules that do not fit their callback', () => {
  it('ignores a 9th rule', () => {
    const tri = addTriangle();
    for (let i = 0; i < MAX_RULES + 1; i++) {
      getState().addCallbackRule('keyboard', rule(tri.id, { id: `k${i}` }));
    }
    expect(getState().callbacks.keyboard.rules).toHaveLength(MAX_RULES);
  });

  it('ignores a trigger of another kind and Move to pointer on a key', () => {
    const tri = addTriangle();
    getState().addCallbackRule('keyboard', rule(tri.id, { trigger: { kind: 'special', key: 'left' } }));
    getState().addCallbackRule('keyboard', rule(tri.id, { action: { type: 'moveToPointer' } }));
    expect(getState().callbacks.keyboard.rules).toEqual([]);
  });

  it('clamps values to the limits', () => {
    const tri = addTriangle();
    getState().addCallbackRule('idle', rule(tri.id, { trigger: { kind: 'idle' }, action: { type: 'scale', sx: 50, sy: 0 } }));
    expect(getState().callbacks.idle.rules[0].action).toEqual({ type: 'scale', sx: 10, sy: 0.1 });
  });

  it('starts empty with Keep proportions for Reshape', () => {
    expect(emptyCallbacks().reshape).toEqual({ handlerName: '', resize: 'keep' });
  });
});
