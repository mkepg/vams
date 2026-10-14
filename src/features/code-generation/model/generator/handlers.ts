import type {
  CallbackRule, CallbacksState, GlutCallbackKind, MouseButton, MouseState, ResizeMode,
  RuleAction, RuleCallbackKind, RuleTrigger, SceneNode, SpecialKey, ViewportLimits,
} from '@/core/types/scene';
import { CALLBACK_KINDS, RULE_KINDS, isCallbackValid } from '@/core/callbacks/callbacks-model';
import { sanitizeName } from './utils';

/**
 * GLUT callback generation from the rules students build in the Callbacks panel. Each rule
 * becomes plain lines that change the target's `state_<name>`; display() then draws the new
 * state. The Run runtime (features/callbacks) applies the same rules the same way.
 */
export interface CallbackPlan {
  /** Valid registered callbacks, in table order. */
  registered: Array<{ kind: GlutCallbackKind; handlerName: string }>;
  /** Rules per kind whose target is in the program, in list order. */
  rules: Record<RuleCallbackKind, CallbackRule[]>;
  resize: ResizeMode;
  colorIds: ReadonlySet<string>;
  visibilityIds: ReadonlySet<string>;
  resetIds: ReadonlySet<string>;
  needsPointer: boolean;
  needsView: boolean;
  extendedState: boolean;
  /** Object id → sanitized C++ name, for the program's objects. */
  names: ReadonlyMap<string, string>;
}

export const GLUT_FUNCS: Record<GlutCallbackKind, string> = {
  keyboard: 'glutKeyboardFunc', special: 'glutSpecialFunc', mouse: 'glutMouseFunc',
  motion: 'glutMotionFunc', reshape: 'glutReshapeFunc', idle: 'glutIdleFunc',
};
const LABELS: Record<GlutCallbackKind, string> = {
  keyboard: 'Keyboard', special: 'Special keys', mouse: 'Mouse', motion: 'Motion', reshape: 'Reshape', idle: 'Idle',
};
const SIGNATURES: Record<GlutCallbackKind, string> = {
  keyboard: '(unsigned char key, int x, int y)', special: '(int key, int x, int y)',
  mouse: '(int button, int state, int x, int y)', motion: '(int x, int y)',
  reshape: '(int width, int height)', idle: '()',
};
export const SPECIAL_LABELS: Record<SpecialKey, string> = {
  up: 'GLUT_KEY_UP', down: 'GLUT_KEY_DOWN', left: 'GLUT_KEY_LEFT', right: 'GLUT_KEY_RIGHT',
};
export const BUTTON_LABELS: Record<MouseButton, string> = {
  left: 'GLUT_LEFT_BUTTON', middle: 'GLUT_MIDDLE_BUTTON', right: 'GLUT_RIGHT_BUTTON',
};
export const STATE_LABELS: Record<MouseState, string> = { down: 'GLUT_DOWN', up: 'GLUT_UP' };

const DEFAULT_LIMITS: ViewportLimits = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const f2 = (n: number) => `${n.toFixed(2)}f`;
const f4 = (n: number) => `${n.toFixed(4)}f`;

export function planCallbacks(callbacks: CallbacksState, programObjects: SceneNode[]): CallbackPlan {
  const names = new Map(programObjects.map((o) => [o.id, sanitizeName(o.name)]));
  const registered = CALLBACK_KINDS
    .filter((k) => isCallbackValid(callbacks, k))
    .map((k) => ({ kind: k, handlerName: callbacks[k].handlerName.trim() }));
  const on = new Set(registered.map((r) => r.kind));
  const rules = {} as Record<RuleCallbackKind, CallbackRule[]>;
  for (const k of RULE_KINDS) rules[k] = on.has(k) ? callbacks[k].rules.filter((r) => names.has(r.objectId)) : [];
  const all = RULE_KINDS.flatMap((k) => rules[k]);
  const idsFor = (type: RuleAction['type']) => new Set(all.filter((r) => r.action.type === type).map((r) => r.objectId));
  const colorIds = idsFor('setColor');
  const visibilityIds = idsFor('visibility');
  const resetIds = idsFor('reset');
  const needsPointer = all.some((r) => r.action.type === 'moveToPointer');
  const resize = callbacks.reshape.resize;
  return {
    registered, rules, resize, colorIds, visibilityIds, resetIds, needsPointer,
    needsView: needsPointer || (on.has('reshape') && resize === 'keep'),
    extendedState: colorIds.size > 0 || visibilityIds.size > 0,
    names,
  };
}

export function actionLines(action: RuleAction, name: string, indent: string): string[] {
  const s = `state_${name}`;
  switch (action.type) {
    case 'translate': return [`${indent}${s}.x += ${f2(action.dx)};`, `${indent}${s}.y += ${f2(action.dy)};`];
    case 'rotate': return [`${indent}${s}.rotation += ${f2(action.degrees)};`];
    case 'scale': return [`${indent}${s}.scaleX *= ${f2(action.sx)};`, `${indent}${s}.scaleY *= ${f2(action.sy)};`];
    case 'moveToPointer': return [`${indent}${s}.x = wx;`, `${indent}${s}.y = wy;`];
    case 'reset': return [`${indent}${s} = initial_${name};`];
    case 'setColor': {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(action.color.slice(i, i + 2), 16) / 255);
      return [`${indent}${s}.r = ${f2(r)};`, `${indent}${s}.g = ${f2(g)};`, `${indent}${s}.b = ${f2(b)};`, `${indent}${s}.useColor = true;`];
    }
    case 'visibility': {
      const value = action.mode === 'show' ? 'true' : action.mode === 'hide' ? 'false' : `!${s}.visible`;
      return [`${indent}${s}.visible = ${value};`];
    }
  }
}

const triggerKey = (t: RuleTrigger): string =>
  t.kind === 'keyboard' || t.kind === 'special' ? `${t.kind}:${t.key}`
    : t.kind === 'mouse' ? `mouse:${t.button}:${t.state}` : t.kind;

/** Group rules by trigger, in the order each trigger first appears. */
function groupByTrigger(rules: CallbackRule[]): Array<{ trigger: RuleTrigger; rules: CallbackRule[] }> {
  const groups = new Map<string, { trigger: RuleTrigger; rules: CallbackRule[] }>();
  for (const r of rules) {
    const key = triggerKey(r.trigger);
    const group = groups.get(key) ?? { trigger: r.trigger, rules: [] };
    group.rules.push(r);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const usesPointer = (rules: CallbackRule[]) => rules.some((r) => r.action.type === 'moveToPointer');
const pointerLines = (indent: string) => [`${indent}float wx, wy;`, `${indent}windowToWorld(x, y, &wx, &wy);`];
const keyLabels = (key: string) => (/[a-z]/.test(key) ? [`'${key}'`, `'${key.toUpperCase()}'`] : [`'${key}'`]);

function ruleLines(rules: CallbackRule[], plan: CallbackPlan, indent: string): string[] {
  return rules.flatMap((r) => actionLines(r.action, plan.names.get(r.objectId)!, indent));
}

function reshapeBody(resize: ResizeMode, limits: ViewportLimits): string[] {
  if (resize === 'stretch') {
    return [
      '    // Stretch: the viewing volume fills the window, whatever its shape',
      '    glViewport(0, 0, width, height);',
      '    glutPostRedisplay();',
    ];
  }
  const cx = (limits.minX + limits.maxX) / 2;
  const cy = (limits.minY + limits.maxY) / 2;
  const halfW = (limits.maxX - limits.minX) / 2;
  const halfH = (limits.maxY - limits.minY) / 2;
  return [
    "    // Keep proportions: widen the viewing volume to match the window's shape",
    '    glViewport(0, 0, width, height);',
    '    float aspect = (float)width / (float)(height > 0 ? height : 1);',
    `    float cx = ${f4(cx)}, cy = ${f4(cy)};`,
    `    float halfW = ${f4(halfW)}, halfH = ${f4(halfH)};`,
    '    if (aspect >= halfW / halfH) halfW = halfH * aspect;',
    '    else halfH = halfW / aspect;',
    '    viewMinX = cx - halfW;',
    '    viewMaxX = cx + halfW;',
    '    viewMinY = cy - halfH;',
    '    viewMaxY = cy + halfH;',
    '    glutPostRedisplay();',
  ];
}

function handlerBody(kind: GlutCallbackKind, plan: CallbackPlan, limits: ViewportLimits): string[] {
  if (kind === 'reshape') return reshapeBody(plan.resize, limits);
  const rules = plan.rules[kind];
  if (rules.length === 0) return ['    // No rules yet: add them in the Callbacks panel', '    glutPostRedisplay();'];
  const out: string[] = [];
  if (kind === 'keyboard' || kind === 'special') {
    out.push('    switch (key) {');
    for (const group of groupByTrigger(rules)) {
      const t = group.trigger as { kind: 'keyboard'; key: string } | { kind: 'special'; key: SpecialKey };
      const labels = t.kind === 'keyboard' ? keyLabels(t.key) : [SPECIAL_LABELS[t.key]];
      labels.forEach((label) => out.push(`    case ${label}:`));
      out.push(...ruleLines(group.rules, plan, '        '), '        break;');
    }
    out.push('    }');
  } else if (kind === 'mouse') {
    for (const group of groupByTrigger(rules)) {
      const t = group.trigger as { kind: 'mouse'; button: MouseButton; state: MouseState };
      out.push(`    if (button == ${BUTTON_LABELS[t.button]} && state == ${STATE_LABELS[t.state]}) {`);
      if (usesPointer(group.rules)) out.push(...pointerLines('        '));
      out.push(...ruleLines(group.rules, plan, '        '), '    }');
    }
  } else {
    if (usesPointer(rules)) out.push(...pointerLines('    '));
    out.push(...ruleLines(rules, plan, '    '));
  }
  out.push('    glutPostRedisplay();');
  return out;
}

export function generateHandlers(plan: CallbackPlan, limits: ViewportLimits = DEFAULT_LIMITS): string {
  return plan.registered
    .map(({ kind, handlerName }) =>
      `// ${LABELS[kind]} callback: ${GLUT_FUNCS[kind]}\n`
      + `void ${handlerName}${SIGNATURES[kind]}\n{\n${handlerBody(kind, plan, limits).join('\n')}\n}\n\n`)
    .join('');
}

/** main()'s registrations. Idle is registered through _vams_idle. */
export function generateRegistrations(plan: CallbackPlan): string {
  return plan.registered
    .filter((r) => r.kind !== 'idle')
    .map((r) => `    ${GLUT_FUNCS[r.kind]}(${r.handlerName});\n`)
    .join('');
}

export function generateViewGlobals(plan: CallbackPlan, limits: ViewportLimits = DEFAULT_LIMITS): string {
  if (!plan.needsView) return '';
  return `// --- View (the glOrtho bounds, updated by the reshape callback) ---\n`
    + `float viewMinX = ${f4(limits.minX)}, viewMaxX = ${f4(limits.maxX)}, viewMinY = ${f4(limits.minY)}, viewMaxY = ${f4(limits.maxY)};\n\n`;
}

export function generateWindowToWorld(plan: CallbackPlan): string {
  if (!plan.needsPointer) return '';
  return [
    "// Convert a window pixel (GLUT's origin is top-left) to world coordinates",
    'void windowToWorld(int x, int y, float* wx, float* wy)',
    '{',
    '    int w = glutGet(GLUT_WINDOW_WIDTH);',
    '    int h = glutGet(GLUT_WINDOW_HEIGHT);',
    '    *wx = viewMinX + (viewMaxX - viewMinX) * x / (float)(w > 0 ? w : 1);',
    '    *wy = viewMaxY - (viewMaxY - viewMinY) * y / (float)(h > 0 ? h : 1);',
    '}',
    '',
    '',
  ].join('\n');
}
