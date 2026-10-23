import type {
  CallbackRule, GlutCallbackKind, MouseButton, MouseState, RuleAction, RuleActionType,
  RuleCallbackKind, RuleTrigger, SceneNode, SpecialKey,
} from '@/core/types/scene';
import { KEYBOARD_KEYS, MOUSE_BUTTONS, MOUSE_STATES, SPECIAL_KEYS, actionAllowed } from '@/core/callbacks/callbacks-model';

export interface CallbackDef {
  kind: GlutCallbackKind;
  glutFn: string;
  label: string;
  description: string;
  defaultName: string;
}

export const CALLBACK_DEFS: readonly CallbackDef[] = [
  { kind: 'keyboard', glutFn: 'glutKeyboardFunc', label: 'Keyboard', description: 'Fires on key press.', defaultName: 'onKey' },
  { kind: 'special', glutFn: 'glutSpecialFunc', label: 'Special keys', description: 'Fires on arrow keys.', defaultName: 'onSpecial' },
  { kind: 'mouse', glutFn: 'glutMouseFunc', label: 'Mouse', description: 'Fires on button down/up.', defaultName: 'onMouse' },
  { kind: 'motion', glutFn: 'glutMotionFunc', label: 'Motion', description: 'Fires while dragging.', defaultName: 'onMotion' },
  { kind: 'reshape', glutFn: 'glutReshapeFunc', label: 'Reshape', description: 'Fires on window resize.', defaultName: 'onReshape' },
  { kind: 'idle', glutFn: 'glutIdleFunc', label: 'Idle', description: 'Fires every frame when idle.', defaultName: 'onIdle' },
];

export const invalidNameMessage = (defaultName: string) =>
  `Use a C++ name VAMS doesn't already use, like ${defaultName}.`;

const ARROWS: Record<SpecialKey, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const ARROW_WORDS: Record<SpecialKey, string> = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };
const BUTTON_WORDS: Record<MouseButton, string> = { left: 'Left', middle: 'Middle', right: 'Right' };
const MOUSE_ORDER: Array<[MouseButton, MouseState]> = [
  ['left', 'down'], ['left', 'up'], ['right', 'down'], ['right', 'up'], ['middle', 'down'], ['middle', 'up'],
];

export const keyName = (key: string) => (key === ' ' ? 'Space' : key.toUpperCase());
const n2 = (v: number) => v.toFixed(2);

export function triggerChip(t: RuleTrigger): string {
  switch (t.kind) {
    case 'keyboard': return keyName(t.key);
    case 'special': return ARROWS[t.key];
    case 'mouse': return `${BUTTON_WORDS[t.button]} ${t.state}`;
    case 'motion': return 'Drag';
    case 'idle': return 'Frame';
  }
}

export function triggerPhrase(t: RuleTrigger): string {
  switch (t.kind) {
    case 'keyboard': return `when ${keyName(t.key)} is pressed`;
    case 'special': return `when ${ARROWS[t.key]} is pressed`;
    case 'mouse': return `when the ${t.button} button goes ${t.state}`;
    case 'motion': return 'on each drag movement';
    case 'idle': return 'every frame';
  }
}

export function actionSentence(a: RuleAction, name: string): string {
  switch (a.type) {
    case 'translate': return `Translate ${name} (${n2(a.dx)}, ${n2(a.dy)})`;
    case 'rotate': return `Rotate ${name} ${a.degrees}°`;
    case 'scale': return `Scale ${name} (${n2(a.sx)}, ${n2(a.sy)})`;
    case 'moveToPointer': return `Move ${name} to the pointer`;
    case 'reset': return `Reset ${name}`;
    case 'setColor': return `Colour ${name} ${a.color}`;
    case 'visibility': return `${a.mode === 'show' ? 'Show' : a.mode === 'hide' ? 'Hide' : 'Toggle'} ${name}`;
  }
}

export function actionPhrase(a: RuleAction, name: string): string {
  switch (a.type) {
    case 'translate': return `translate ${name} by ${n2(a.dx)}, ${n2(a.dy)}`;
    case 'rotate': return `rotate ${name} by ${a.degrees}°`;
    case 'scale': return `scale ${name} by ${n2(a.sx)}, ${n2(a.sy)}`;
    case 'moveToPointer': return `move ${name} to the pointer`;
    case 'reset': return `reset ${name}`;
    case 'setColor': return `colour ${name} ${a.color}`;
    case 'visibility': return `${a.mode} ${name}`;
  }
}

export const ruleLabel = (rule: CallbackRule, name: string) =>
  `Rule: ${triggerPhrase(rule.trigger)}, ${actionPhrase(rule.action, name)}. Edit`;

export const ACTION_LABELS: Record<RuleActionType, string> = {
  translate: 'Translate', rotate: 'Rotate', scale: 'Scale', moveToPointer: 'Move to pointer',
  reset: 'Reset', setColor: 'Set colour', visibility: 'Visibility',
};

export const actionTypesFor = (kind: RuleCallbackKind): RuleActionType[] =>
  (Object.keys(ACTION_LABELS) as RuleActionType[]).filter((type) => actionAllowed(kind, type));

/** Move to pointer needs a top-level object; Set colour needs something that draws. */
export function eligibleTargets(type: RuleActionType, objects: SceneNode[]): SceneNode[] {
  if (type === 'moveToPointer') return objects.filter((o) => !o.parentId);
  if (type === 'setColor') return objects.filter((o) => o.type !== 'GROUP');
  return objects;
}

/** The Do menu: the callback's actions that have at least one object to act on. */
export const availableActionTypes = (kind: RuleCallbackKind, objects: SceneNode[]): RuleActionType[] =>
  actionTypesFor(kind).filter((type) => eligibleTargets(type, objects).length > 0);

/**
 * The Object menu: the action's eligible objects, plus the rule's own target when it has stopped
 * being eligible (grouped after Move to pointer chose it), so the menu shows what the rule and its code use.
 */
export function targetOptions(rule: CallbackRule, objects: SceneNode[]): SceneNode[] {
  const targets = eligibleTargets(rule.action.type, objects);
  if (targets.some((o) => o.id === rule.objectId)) return targets;
  const own = objects.find((o) => o.id === rule.objectId);
  return own ? [own, ...targets] : targets;
}

export function defaultAction(type: RuleActionType, kind: RuleCallbackKind, target?: SceneNode): RuleAction {
  switch (type) {
    case 'translate': return { type, dx: 0.1, dy: 0 };
    case 'rotate': return { type, degrees: kind === 'idle' ? 1 : 15 };
    case 'scale': return { type, sx: 1.1, sy: 1.1 };
    case 'moveToPointer': return { type };
    case 'reset': return { type };
    case 'setColor': return { type, color: (target?.vertices[0]?.color ?? '#ffffff').toLowerCase() };
    case 'visibility': return { type, mode: 'toggle' };
  }
}

export function triggerValue(t: RuleTrigger): string {
  switch (t.kind) {
    case 'keyboard': return t.key;
    case 'special': return t.key;
    case 'mouse': return `${t.button}-${t.state}`;
    default: return t.kind;
  }
}

export function triggerOptions(kind: RuleCallbackKind): RuleTrigger[] {
  switch (kind) {
    case 'keyboard': return KEYBOARD_KEYS.map((key) => ({ kind, key }));
    case 'special': return SPECIAL_KEYS.map((key) => ({ kind, key }));
    case 'mouse': return MOUSE_BUTTONS.flatMap((button) => MOUSE_STATES.map((state) => ({ kind, button, state })));
    case 'motion': return [{ kind: 'motion' }];
    case 'idle': return [{ kind: 'idle' }];
  }
}

export function triggerFromValue(kind: RuleCallbackKind, value: string): RuleTrigger {
  return triggerOptions(kind).find((t) => triggerValue(t) === value) ?? triggerOptions(kind)[0];
}

export function triggerOptionLabel(t: RuleTrigger): string {
  switch (t.kind) {
    case 'keyboard': return keyName(t.key);
    case 'special': return `${ARROWS[t.key]} ${ARROW_WORDS[t.key]}`;
    case 'mouse': return `${BUTTON_WORDS[t.button]} button ${t.state}`;
    case 'motion': return 'Drag';
    case 'idle': return 'Every frame';
  }
}

/** The first trigger not yet used: teaching order first (D A W S, → ← ↑ ↓, left down first), then the rest. */
export function nextTrigger(kind: RuleCallbackKind, rules: CallbackRule[]): RuleTrigger {
  const used = new Set(rules.map((r) => triggerValue(r.trigger)));
  const preferred: RuleTrigger[] =
    kind === 'keyboard' ? ['d', 'a', 'w', 's'].map((key) => ({ kind, key }))
      : kind === 'special' ? (['right', 'left', 'up', 'down'] as SpecialKey[]).map((key) => ({ kind, key }))
        : kind === 'mouse' ? MOUSE_ORDER.map(([button, state]) => ({ kind, button, state }))
          : triggerOptions(kind);
  return [...preferred, ...triggerOptions(kind)].find((t) => !used.has(triggerValue(t))) ?? preferred[0];
}

/** A new rule for the first top-level object, or null when the scene is empty. */
export function newRule(kind: RuleCallbackKind, rules: CallbackRule[], objects: SceneNode[], id: string): CallbackRule | null {
  const target = objects.find((o) => !o.parentId);
  if (!target) return null;
  const type: RuleActionType = kind === 'idle' ? 'rotate' : 'translate';
  return { id, objectId: target.id, trigger: nextTrigger(kind, rules), action: defaultAction(type, kind, target) };
}
