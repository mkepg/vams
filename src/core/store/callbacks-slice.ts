import type { StateCreator } from 'zustand';
import type { VamsState, CallbacksSlice } from '@/core/store/types';
import {
  CALLBACK_KINDS, MAX_RULES, actionAllowed, clampAction, emptyCallbacks, isCallbackValid, sanitizeTrigger, withRuleCallback,
} from '@/core/callbacks/callbacks-model';

export const createCallbacksSlice: StateCreator<VamsState, [], [], CallbacksSlice> = (set, get) => ({
  callbacks: emptyCallbacks(),

  setCallbackHandler: (kind, handlerName) => {
    get().pushToHistory();
    set((state) => ({
      callbacks: { ...state.callbacks, [kind]: { ...state.callbacks[kind], handlerName } } as VamsState['callbacks'],
    }));
  },

  // Off removes the callback: its name, its rules and its resize choice.
  clearCallback: (kind) => {
    get().pushToHistory();
    set((state) => ({
      callbacks: { ...state.callbacks, [kind]: emptyCallbacks()[kind] } as VamsState['callbacks'],
    }));
  },

  addCallbackRule: (kind, rule) => {
    const current = get().callbacks[kind];
    if (current.rules.length >= MAX_RULES) return;
    // The same checks a project file gets: a key the generator can emit, lower-cased.
    const trigger = sanitizeTrigger(rule.trigger, kind);
    if (!trigger || !actionAllowed(kind, rule.action.type)) return;
    get().pushToHistory();
    set((state) => ({
      callbacks: withRuleCallback(state.callbacks, kind, {
        ...state.callbacks[kind],
        rules: [...state.callbacks[kind].rules, { ...rule, trigger, action: clampAction(rule.action) }],
      }),
    }));
  },

  updateCallbackRule: (kind, ruleId, patch, recordHistory = true) => {
    const existing = get().callbacks[kind].rules.find((r) => r.id === ruleId);
    if (!existing) return;
    const trigger = sanitizeTrigger(patch.trigger ?? existing.trigger, kind);
    const next = { ...existing, ...patch, trigger: trigger ?? existing.trigger };
    if (!trigger || !actionAllowed(kind, next.action.type)) return;
    if (recordHistory) get().pushToHistory();
    set((state) => ({
      callbacks: withRuleCallback(state.callbacks, kind, {
        ...state.callbacks[kind],
        rules: state.callbacks[kind].rules.map((r) => (r.id === ruleId ? { ...next, action: clampAction(next.action) } : r)),
      }),
    }));
  },

  removeCallbackRule: (kind, ruleId) => {
    if (!get().callbacks[kind].rules.some((r) => r.id === ruleId)) return;
    get().pushToHistory();
    set((state) => ({
      callbacks: withRuleCallback(state.callbacks, kind, {
        ...state.callbacks[kind],
        rules: state.callbacks[kind].rules.filter((r) => r.id !== ruleId),
      }),
    }));
  },

  setReshapeMode: (mode) => {
    if (get().callbacks.reshape.resize === mode) return;
    get().pushToHistory();
    set((state) => ({ callbacks: { ...state.callbacks, reshape: { ...state.callbacks.reshape, resize: mode } } }));
  },

  getRegisteredCallbacks: () => {
    const cb = get().callbacks;
    return CALLBACK_KINDS
      .filter((k) => isCallbackValid(cb, k))
      .map((k) => ({ kind: k, handlerName: cb[k].handlerName.trim() }));
  },
});
