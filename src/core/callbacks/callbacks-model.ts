import type {
  CallbackRule, CallbacksState, GlutCallbackKind, MouseButton, MouseState,
  RuleAction, RuleActionType, RuleCallback, RuleCallbackKind, RuleTrigger, SceneNode, SpecialKey,
} from '@/core/types/scene';
import { CPP_KEYWORDS } from './cpp-keywords';

/** Table order: the panel, the generated handlers and main()'s registrations all follow it. */
export const CALLBACK_KINDS: readonly GlutCallbackKind[] = ['keyboard', 'special', 'mouse', 'motion', 'reshape', 'idle'];
export const RULE_KINDS: readonly RuleCallbackKind[] = ['keyboard', 'special', 'mouse', 'motion', 'idle'];
export const MAX_RULES = 8;
export const KEYBOARD_KEYS: readonly string[] = [...'abcdefghijklmnopqrstuvwxyz0123456789', ' '];
export const SPECIAL_KEYS: readonly SpecialKey[] = ['up', 'down', 'left', 'right'];
export const MOUSE_BUTTONS: readonly MouseButton[] = ['left', 'middle', 'right'];
export const MOUSE_STATES: readonly MouseState[] = ['down', 'up'];

export function emptyCallbacks(): CallbacksState {
  const ruleCallback = (): RuleCallback => ({ handlerName: '', rules: [] });
  return {
    keyboard: ruleCallback(),
    special: ruleCallback(),
    mouse: ruleCallback(),
    motion: ruleCallback(),
    reshape: { handlerName: '', resize: 'keep' },
    idle: ruleCallback(),
  };
}

export function newRuleId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  return 'rule-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'main', 'init', 'display', 'draw', 'update_buffers', 'windowToWorld', '_vams_idle',
]);
const RESERVED_PREFIXES = ['draw_', 'animate_', 'state_', 'initial_'];

/** A C++ identifier that the generated program does not already use. */
export function isValidHandlerName(name: string): boolean {
  const n = name.trim();
  if (!IDENTIFIER.test(n)) return false;
  if (RESERVED_NAMES.has(n) || CPP_KEYWORDS.has(n)) return false;
  return !RESERVED_PREFIXES.some((prefix) => n.startsWith(prefix));
}

export const isRegistered = (cb: { handlerName: string }): boolean => cb.handlerName.trim().length > 0;

/** Valid, and not already taken by an earlier callback in table order. */
export function isCallbackValid(callbacks: CallbacksState, kind: GlutCallbackKind): boolean {
  const name = callbacks[kind].handlerName.trim();
  if (!isValidHandlerName(name)) return false;
  const index = CALLBACK_KINDS.indexOf(kind);
  return !CALLBACK_KINDS.slice(0, index).some((k) => callbacks[k].handlerName.trim() === name);
}

export function hasCallbackContent(callbacks: CallbacksState): boolean {
  return CALLBACK_KINDS.some((k) => isRegistered(callbacks[k]))
    || RULE_KINDS.some((k) => callbacks[k].rules.length > 0);
}

export const actionAllowed = (kind: RuleCallbackKind, type: RuleActionType): boolean =>
  type !== 'moveToPointer' || kind === 'mouse' || kind === 'motion';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const toDecimals = (v: number, decimals: number) => Number(v.toFixed(decimals));
const HEX = /^#[0-9a-f]{6}$/i;

export function clampAction(action: RuleAction): RuleAction {
  switch (action.type) {
    case 'translate':
      return { type: 'translate', dx: toDecimals(clamp(action.dx, -10, 10), 2), dy: toDecimals(clamp(action.dy, -10, 10), 2) };
    case 'rotate':
      return { type: 'rotate', degrees: toDecimals(clamp(action.degrees, -360, 360), 0) };
    case 'scale':
      return { type: 'scale', sx: toDecimals(clamp(action.sx, 0.1, 10), 2), sy: toDecimals(clamp(action.sy, 0.1, 10), 2) };
    case 'setColor':
      return { type: 'setColor', color: HEX.test(action.color) ? action.color.toLowerCase() : '#ffffff' };
    default:
      return action;
  }
}

export function withRuleCallback(callbacks: CallbacksState, kind: RuleCallbackKind, next: RuleCallback): CallbacksState {
  return { ...callbacks, [kind]: next } as CallbacksState;
}

/** Drops rules whose object is gone. Returns the same object when nothing changed. */
export function pruneCallbackRules(callbacks: CallbacksState, liveIds: ReadonlySet<string>): CallbacksState {
  let next = callbacks;
  for (const kind of RULE_KINDS) {
    const rules = callbacks[kind].rules.filter((r) => liveIds.has(r.objectId));
    if (rules.length !== callbacks[kind].rules.length) next = withRuleCallback(next, kind, { ...callbacks[kind], rules });
  }
  return next;
}

/** The objects the generated program draws: visible, with every ancestor visible. */
export function programObjects(objects: SceneNode[]): SceneNode[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const hidden = (o: SceneNode): boolean => {
    if (!o.visible) return true;
    const parent = o.parentId ? byId.get(o.parentId) : undefined;
    return parent ? hidden(parent) : false;
  };
  return objects.filter((o) => !hidden(o));
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function sanitizeTrigger(raw: unknown, kind: RuleCallbackKind): RuleTrigger | null {
  if (!isRecord(raw) || raw.kind !== kind) return null;
  switch (kind) {
    case 'keyboard': {
      const key = typeof raw.key === 'string' ? raw.key.toLowerCase() : '';
      return KEYBOARD_KEYS.includes(key) ? { kind, key } : null;
    }
    case 'special':
      return SPECIAL_KEYS.includes(raw.key as SpecialKey) ? { kind, key: raw.key as SpecialKey } : null;
    case 'mouse':
      return MOUSE_BUTTONS.includes(raw.button as MouseButton) && MOUSE_STATES.includes(raw.state as MouseState)
        ? { kind, button: raw.button as MouseButton, state: raw.state as MouseState }
        : null;
    case 'motion':
      return { kind: 'motion' };
    case 'idle':
      return { kind: 'idle' };
  }
}

function sanitizeAction(raw: unknown, kind: RuleCallbackKind): RuleAction | null {
  if (!isRecord(raw)) return null;
  let action: RuleAction;
  switch (raw.type) {
    case 'translate': action = { type: 'translate', dx: num(raw.dx, 0), dy: num(raw.dy, 0) }; break;
    case 'rotate': action = { type: 'rotate', degrees: num(raw.degrees, 0) }; break;
    case 'scale': action = { type: 'scale', sx: num(raw.sx, 1), sy: num(raw.sy, 1) }; break;
    case 'moveToPointer': action = { type: 'moveToPointer' }; break;
    case 'reset': action = { type: 'reset' }; break;
    case 'setColor':
      if (typeof raw.color !== 'string' || !HEX.test(raw.color)) return null;
      action = { type: 'setColor', color: raw.color };
      break;
    case 'visibility':
      if (raw.mode !== 'show' && raw.mode !== 'hide' && raw.mode !== 'toggle') return null;
      action = { type: 'visibility', mode: raw.mode };
      break;
    default:
      return null;
  }
  return actionAllowed(kind, action.type) ? clampAction(action) : null;
}

function sanitizeRule(raw: unknown, kind: RuleCallbackKind, index: number): CallbackRule | null {
  if (!isRecord(raw) || typeof raw.objectId !== 'string') return null;
  const trigger = sanitizeTrigger(raw.trigger, kind);
  const action = sanitizeAction(raw.action, kind);
  if (!trigger || !action) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `rule-${kind}-${index}`;
  return { id, objectId: raw.objectId, trigger, action };
}

/**
 * Project files: the schema 9 shape, or schema 8's handler name per kind. Old reshape stubs only
 * set the viewport, which is Stretch. Rules must point at an object in `liveIds`.
 */
export function sanitizeCallbacks(raw: unknown, liveIds: ReadonlySet<string>): CallbacksState {
  const out = emptyCallbacks();
  if (!isRecord(raw)) return out;
  for (const kind of RULE_KINDS) {
    const v = raw[kind];
    if (typeof v === 'string') {
      out[kind] = { handlerName: v, rules: [] };
    } else if (isRecord(v)) {
      const rules = Array.isArray(v.rules)
        ? v.rules
            .map((r, i) => sanitizeRule(r, kind, i))
            .filter((r): r is CallbackRule => r !== null && liveIds.has(r.objectId))
            .slice(0, MAX_RULES)
        : [];
      out[kind] = { handlerName: typeof v.handlerName === 'string' ? v.handlerName : '', rules };
    }
  }
  const reshape = raw.reshape;
  if (typeof reshape === 'string') {
    out.reshape = { handlerName: reshape, resize: 'stretch' };
  } else if (isRecord(reshape)) {
    out.reshape = {
      handlerName: typeof reshape.handlerName === 'string' ? reshape.handlerName : '',
      resize: reshape.resize === 'stretch' ? 'stretch' : 'keep',
    };
  }
  return out;
}

/** Browser storage version 7 kept a handler name per kind. */
export function migrateLegacyCallbacks(raw: unknown): CallbacksState {
  return sanitizeCallbacks(raw, new Set());
}
