import type {
  CallbacksState, GlutCallbackKind, MouseButton, MouseState, RuleAction, RuleCallbackKind,
  RuleTrigger, SceneNode, SpecialKey, ViewportLimits,
} from '@/core/types/scene';
import { isCallbackValid, programObjects } from '@/core/callbacks/callbacks-model';

/**
 * The Run runtime: pure functions over a temporary copy of each object's program state. Every
 * action changes this copy exactly as its generated C++ line changes `state_<name>`
 * (WB-CB-1 checks each one), and nothing here touches the store.
 */
export interface RunObjectState {
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  r: number; g: number; b: number; useColor: boolean; visible: boolean;
}
export interface RunView { minX: number; maxX: number; minY: number; maxY: number }
export interface RunState {
  objects: Record<string, RunObjectState>;
  initial: Record<string, RunObjectState>;
  limits: RunView;
  view: RunView;
  window: { width: number; height: number };
}
export type RunEvent =
  | { type: 'key'; key: string; x: number; y: number }
  | { type: 'special'; key: SpecialKey; x: number; y: number }
  | { type: 'mouse'; button: MouseButton; state: MouseState; x: number; y: number }
  | { type: 'motion'; x: number; y: number }
  | { type: 'reshape'; width: number; height: number }
  | { type: 'idle' };
export interface DispatchResult {
  state: RunState;
  /** The handler GLUT called, or null when no valid handler exists (and always for idle). */
  kind: GlutCallbackKind | null;
  handlerName: string | null;
  /** The call as GLUT would make it, for the readout. */
  call: string | null;
  /** The first matched rule's trigger, or null. */
  matched: RuleTrigger | null;
}

const q = (v: number, decimals: number) => Number(v.toFixed(decimals));
const unit = (hex: string, i: number) => q(parseInt(hex.slice(i, i + 2), 16) / 255, 2);
const EVENT_KIND: Record<RunEvent['type'], GlutCallbackKind> = {
  key: 'keyboard', special: 'special', mouse: 'mouse', motion: 'motion', reshape: 'reshape', idle: 'idle',
};
const SPECIAL_ARG: Record<SpecialKey, string> = { up: 'GLUT_KEY_UP', down: 'GLUT_KEY_DOWN', left: 'GLUT_KEY_LEFT', right: 'GLUT_KEY_RIGHT' };
const BUTTON_ARG: Record<MouseButton, string> = { left: 'GLUT_LEFT_BUTTON', middle: 'GLUT_MIDDLE_BUTTON', right: 'GLUT_RIGHT_BUTTON' };
const STATE_ARG: Record<MouseState, string> = { down: 'GLUT_DOWN', up: 'GLUT_UP' };

export function createRunState(objects: SceneNode[], limits: ViewportLimits, window: { width: number; height: number }): RunState {
  const states: Record<string, RunObjectState> = {};
  const initial: Record<string, RunObjectState> = {};
  for (const o of programObjects(objects)) {
    const t = o.transform;
    const s: RunObjectState = {
      x: t.translateX, y: t.translateY, rotation: t.rotate, scaleX: t.scaleX, scaleY: t.scaleY,
      r: 0, g: 0, b: 0, useColor: false, visible: true,
    };
    states[o.id] = s;
    initial[o.id] = { ...s };
  }
  return { objects: states, initial, limits: { ...limits }, view: { ...limits }, window: { ...window } };
}

export function applyAction(
  s: RunObjectState, action: RuleAction, initial: RunObjectState, pointer: { x: number; y: number } | null,
): RunObjectState {
  switch (action.type) {
    case 'translate': return { ...s, x: s.x + q(action.dx, 2), y: s.y + q(action.dy, 2) };
    case 'rotate': return { ...s, rotation: s.rotation + q(action.degrees, 2) };
    case 'scale': return { ...s, scaleX: s.scaleX * q(action.sx, 2), scaleY: s.scaleY * q(action.sy, 2) };
    case 'moveToPointer': return pointer ? { ...s, x: pointer.x, y: pointer.y } : s;
    case 'reset': return { ...initial };
    case 'setColor': return { ...s, r: unit(action.color, 1), g: unit(action.color, 3), b: unit(action.color, 5), useColor: true };
    case 'visibility':
      return { ...s, visible: action.mode === 'show' ? true : action.mode === 'hide' ? false : !s.visible };
  }
}

/** The generated windowToWorld: GLUT's origin is top-left, world y points up. */
export function windowToWorld(view: RunView, window: { width: number; height: number }, x: number, y: number) {
  const w = window.width > 0 ? window.width : 1;
  const h = window.height > 0 ? window.height : 1;
  return { x: view.minX + ((view.maxX - view.minX) * x) / w, y: view.maxY - ((view.maxY - view.minY) * y) / h };
}

/** The generated Keep proportions reshape body. */
export function keepProportionsView(limits: RunView, width: number, height: number): RunView {
  const aspect = width / (height > 0 ? height : 1);
  const cx = q((limits.minX + limits.maxX) / 2, 4);
  const cy = q((limits.minY + limits.maxY) / 2, 4);
  let halfW = q((limits.maxX - limits.minX) / 2, 4);
  let halfH = q((limits.maxY - limits.minY) / 2, 4);
  if (aspect >= halfW / halfH) halfW = halfH * aspect;
  else halfH = halfW / aspect;
  return { minX: cx - halfW, maxX: cx + halfW, minY: cy - halfH, maxY: cy + halfH };
}

function matches(trigger: RuleTrigger, event: RunEvent): boolean {
  switch (event.type) {
    case 'key': return trigger.kind === 'keyboard' && trigger.key === event.key.toLowerCase();
    case 'special': return trigger.kind === 'special' && trigger.key === event.key;
    case 'mouse': return trigger.kind === 'mouse' && trigger.button === event.button && trigger.state === event.state;
    case 'motion': return trigger.kind === 'motion';
    case 'idle': return trigger.kind === 'idle';
    default: return false;
  }
}

function callText(name: string, event: RunEvent): string | null {
  switch (event.type) {
    case 'key': return `${name}('${event.key}', ${event.x}, ${event.y})`;
    case 'special': return `${name}(${SPECIAL_ARG[event.key]}, ${event.x}, ${event.y})`;
    case 'mouse': return `${name}(${BUTTON_ARG[event.button]}, ${STATE_ARG[event.state]}, ${event.x}, ${event.y})`;
    case 'motion': return `${name}(${event.x}, ${event.y})`;
    case 'reshape': return `${name}(${event.width}, ${event.height})`;
    case 'idle': return null;
  }
}

const NONE = (state: RunState): DispatchResult => ({ state, kind: null, handlerName: null, call: null, matched: null });

export function dispatch(state: RunState, callbacks: CallbacksState, event: RunEvent): DispatchResult {
  const kind = EVENT_KIND[event.type];
  const valid = isCallbackValid(callbacks, kind);
  const name = callbacks[kind].handlerName.trim();
  if (event.type === 'reshape') {
    const keep = valid && callbacks.reshape.resize === 'keep';
    const next: RunState = {
      ...state,
      window: { width: event.width, height: event.height },
      view: keep ? keepProportionsView(state.limits, event.width, event.height) : { ...state.limits },
    };
    return valid ? { state: next, kind, handlerName: name, call: callText(name, event), matched: null } : NONE(next);
  }
  if (!valid) return NONE(state);
  const rules = callbacks[kind as RuleCallbackKind].rules.filter((r) => matches(r.trigger, event) && state.objects[r.objectId]);
  const pointer = event.type === 'mouse' || event.type === 'motion'
    ? windowToWorld(state.view, state.window, event.x, event.y)
    : null;
  let next = state;
  if (rules.length > 0) {
    const objects = { ...state.objects };
    for (const r of rules) objects[r.objectId] = applyAction(objects[r.objectId], r.action, state.initial[r.objectId], pointer);
    next = { ...state, objects };
  }
  return { state: next, kind, handlerName: name, call: callText(name, event), matched: rules[0]?.trigger ?? null };
}

export function runStateColor(o: RunObjectState): string {
  return '#' + [o.r, o.g, o.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
