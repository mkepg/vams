/**
 * BLACK-BOX TEST SUITE — BB-CB
 * Functional callbacks: the rule model, the store actions and the generated handler code.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { locateHandlerBranch } from '@/features/code-generation/model/locate-branch';
import { useVamsStore } from '@/core/store';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import {
  emptyCallbacks, isCallbackValid, isValidHandlerName, MAX_RULES, sanitizeCallbacks,
} from '@/core/callbacks/callbacks-model';
import type { CallbackRule } from '@/core/types/scene';
import {
  CALLBACK_DEFS, actionSentence, availableActionTypes, invalidNameMessage, newRule, targetOptions, triggerChip, triggerPhrase,
} from '@/features/callbacks/model/rule-copy';
import { RUN_HINT, RUN_SURFACE_LABEL, RUN_POPOVER_COPY, RUN_EMPTY_REASON, RUN_NO_CALLBACK_REASON, RUN_OPEN_CALLBACKS } from '@/features/callbacks/ui/RunOverlay';
import { HELP_TOPICS } from '@/features/help/model/help-content';
import { PRIMITIVES_LESSONS } from '@/features/lesson-engine/model/primitives-lessons';
import { addTriangle, addQuad, addPrimitive, getState } from '../helpers/store';

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
      'windowToWorld', '_vams_idle', 'draw_Tri', 'state_y', 'initial_z', 'switch', 'class',
      'viewMinX', 'viewMaxY', 'vbo_x', 'tex_y']) {
      expect(isValidHandlerName(bad)).toBe(false);
    }
    for (const good of ['onKey', '_handler', 'onMouse2', 'animate_x']) expect(isValidHandlerName(good)).toBe(true);
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

const CANVAS = { width: 800, height: 600 };
const gen = () => {
  const s = getState();
  return generateCodeFromState(
    { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits },
    CANVAS,
  );
};
const FIXTURE = resolve(__dirname, '../fixtures/no-callbacks-program.cpp');

/** Immediate, vertex-array and VBO objects, a stippled line, text and a group. */
function buildRichScene() {
  const tri = addTriangle(0.1, 0.0, 0.2);
  const quad = addQuad(-0.4, 0.2, 0.15);
  getState().updateRenderingMode(quad.id, 'VBO');
  const fan = addPrimitive('TRIANGLE_FAN', [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }, { x: 0.6, y: 0.7 }]);
  getState().updateRenderingMode(fan.id, 'VERTEX_ARRAY');
  const line = addPrimitive('LINE_STRIP', [{ x: -0.8, y: -0.8 }, { x: -0.5, y: -0.6 }]);
  getState().updateLineStipple(line.id, { factor: 2, pattern: 0x00ff });
  getState().addTextObject('Hi', -0.2, -0.5);
  getState().createGroup([tri.id, fan.id]);
  return { tri, quad, fan, line };
}

describe('BB-CB-12: A scene with no callbacks generates the same program as before', () => {
  it('matches the stored fixture', () => {
    buildRichScene();
    const code = gen();
    if (process.env.WRITE_CALLBACK_FIXTURE === '1') writeFileSync(FIXTURE, code);
    // A missing fixture fails here: the guarantee must never pass against a file it just wrote.
    expect(existsSync(FIXTURE)).toBe(true);
    expect(code).toBe(readFileSync(FIXTURE, 'utf8').replace(/\r\n/g, '\n'));
  });
});

const add = (kind: Parameters<ReturnType<typeof getState>['addCallbackRule']>[0], r: CallbackRule) =>
  getState().addCallbackRule(kind, r);
const body = (code: string, name: string) => {
  const lines = code.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`void ${name}(`));
  const end = lines.indexOf('}', start);
  return lines.slice(start, end + 1).join('\n');
};

describe('BB-CB-1: Each registered callback is emitted and registered in table order', () => {
  it('emits six handlers with their signatures and registrations', () => {
    addTriangle();
    const names = { keyboard: 'onKey', special: 'onSpecial', mouse: 'onMouse', motion: 'onMotion', reshape: 'onReshape', idle: 'onIdle' } as const;
    (Object.keys(names) as (keyof typeof names)[]).forEach((k) => getState().setCallbackHandler(k, names[k]));
    const code = gen();
    expect(code).toContain('void onKey(unsigned char key, int x, int y)');
    expect(code).toContain('void onSpecial(int key, int x, int y)');
    expect(code).toContain('void onMouse(int button, int state, int x, int y)');
    expect(code).toContain('void onMotion(int x, int y)');
    expect(code).toContain('void onReshape(int width, int height)');
    expect(code).toContain('void onIdle()');
    const regs = code.split('\n').filter((l) => /^ {4}glut(Keyboard|Special|Mouse|Motion|Reshape)Func\(/.test(l)).map((l) => l.trim());
    expect(regs).toEqual([
      'glutKeyboardFunc(onKey);', 'glutSpecialFunc(onSpecial);', 'glutMouseFunc(onMouse);',
      'glutMotionFunc(onMotion);', 'glutReshapeFunc(onReshape);',
    ]);
    expect(code).toContain('    glutIdleFunc(_vams_idle);');
    expect(code).toContain('// Special keys callback: glutSpecialFunc');
  });
});

describe('BB-CB-2: A callback with no rules says so', () => {
  it('generates the "No rules yet" body', () => {
    getState().setCallbackHandler('keyboard', 'onKey');
    expect(body(gen(), 'onKey')).toBe([
      'void onKey(unsigned char key, int x, int y)', '{',
      '    // No rules yet: add them in the Callbacks panel', '    glutPostRedisplay();', '}',
    ].join('\n'));
  });
});

describe('BB-CB-3 / BB-CB-4: Keyboard rules become cases, grouped by key in order', () => {
  it('emits both letter cases, a Space case, and one branch per key', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'a', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 } });
    add('keyboard', { id: 'b', objectId: t.id, trigger: { kind: 'keyboard', key: ' ' }, action: { type: 'rotate', degrees: 15 } });
    add('keyboard', { id: 'c', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'rotate', degrees: 5 } });
    expect(body(gen(), 'onKey')).toBe([
      'void onKey(unsigned char key, int x, int y)', '{',
      '    switch (key) {',
      "    case 'd':", "    case 'D':",
      '        state_Tri.x += 0.10f;', '        state_Tri.y += 0.00f;', '        state_Tri.rotation += 5.00f;',
      '        break;',
      "    case ' ':",
      '        state_Tri.rotation += 15.00f;',
      '        break;',
      '    }',
      '    glutPostRedisplay();', '}',
    ].join('\n'));
  });
});

describe('BB-CB-5: Special keys rules use GLUT_KEY_* cases', () => {
  it('emits case GLUT_KEY_RIGHT', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('special', 'onSpecial');
    add('special', { id: 's', objectId: t.id, trigger: { kind: 'special', key: 'right' }, action: { type: 'translate', dx: 0.1, dy: 0 } });
    expect(body(gen(), 'onSpecial')).toContain('    case GLUT_KEY_RIGHT:\n        state_Tri.x += 0.10f;');
  });
});

describe('BB-CB-6: Mouse rules and Move to pointer', () => {
  it('emits the button/state branch, windowToWorld, the view globals and glOrtho from them', () => {
    const q = addQuad();
    getState().updateObjectName(q.id, 'Square');
    getState().setCallbackHandler('mouse', 'onMouse');
    add('mouse', { id: 'm', objectId: q.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } });
    const code = gen();
    expect(body(code, 'onMouse')).toBe([
      'void onMouse(int button, int state, int x, int y)', '{',
      '    if (button == GLUT_LEFT_BUTTON && state == GLUT_DOWN) {',
      '        float wx, wy;', '        windowToWorld(x, y, &wx, &wy);',
      '        state_Square.x = wx;', '        state_Square.y = wy;',
      '    }',
      '    glutPostRedisplay();', '}',
    ].join('\n'));
    expect(code).toContain('float viewMinX = -1.0000f, viewMaxX = 1.0000f, viewMinY = -1.0000f, viewMaxY = 1.0000f;');
    expect(code).toContain('    glOrtho(viewMinX, viewMaxX, viewMinY, viewMaxY, -1.0, 1.0);');
    expect(code).toContain('void windowToWorld(int x, int y, float* wx, float* wy)');
    expect(code.indexOf('void windowToWorld(')).toBeLessThan(code.indexOf('void onMouse('));
  });
});

describe('BB-CB-7: Each action generates its lines', () => {
  it('matches the spec table', async () => {
    const { actionLines } = await import('@/features/code-generation/model/generator/handlers');
    expect(actionLines({ type: 'translate', dx: -0.1, dy: 0.25 }, 'T', '')).toEqual(['state_T.x += -0.10f;', 'state_T.y += 0.25f;']);
    expect(actionLines({ type: 'rotate', degrees: 15 }, 'T', '')).toEqual(['state_T.rotation += 15.00f;']);
    expect(actionLines({ type: 'scale', sx: 1.1, sy: 0.9 }, 'T', '')).toEqual(['state_T.scaleX *= 1.10f;', 'state_T.scaleY *= 0.90f;']);
    expect(actionLines({ type: 'moveToPointer' }, 'T', '')).toEqual(['state_T.x = wx;', 'state_T.y = wy;']);
    expect(actionLines({ type: 'reset' }, 'T', '')).toEqual(['state_T = initial_T;']);
    expect(actionLines({ type: 'setColor', color: '#ff8000' }, 'T', '')).toEqual([
      'state_T.r = 1.00f;', 'state_T.g = 0.50f;', 'state_T.b = 0.00f;', 'state_T.useColor = true;',
    ]);
    expect(actionLines({ type: 'visibility', mode: 'show' }, 'T', '')).toEqual(['state_T.visible = true;']);
    expect(actionLines({ type: 'visibility', mode: 'hide' }, 'T', '')).toEqual(['state_T.visible = false;']);
    expect(actionLines({ type: 'visibility', mode: 'toggle' }, 'T', '')).toEqual(['state_T.visible = !state_T.visible;']);
  });
});

describe('BB-CB-8: Colour or visibility rules extend ObjectState', () => {
  it('adds the fields and initializers only when needed', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    expect(gen()).not.toContain('bool visible;');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'v', objectId: t.id, trigger: { kind: 'keyboard', key: 'h' }, action: { type: 'visibility', mode: 'toggle' } });
    const code = gen();
    expect(code).toContain('    float r, g, b;\n    bool useColor;\n    bool visible;\n};');
    expect(code).toMatch(/ObjectState state_Tri = \{ [^}]*, 0\.0f, 0\.0f, 0\.0f, false, true \};/);
  });
});

describe('BB-CB-9: Visibility wraps the draw call; colour guards the colour lines', () => {
  it('guards immediate-mode colours and the VBO colour array', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    const q = addQuad();
    getState().updateObjectName(q.id, 'Box');
    getState().updateRenderingMode(q.id, 'VBO');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'c1', objectId: t.id, trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#ff0000' } });
    add('keyboard', { id: 'c2', objectId: q.id, trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#00ff00' } });
    add('keyboard', { id: 'v', objectId: t.id, trigger: { kind: 'keyboard', key: 'h' }, action: { type: 'visibility', mode: 'hide' } });
    const code = gen();
    expect(code).toContain('    if (state_Tri.visible) draw_Tri();');
    expect(code).toMatch(/ {8}if \(!state_Tri\.useColor\) glColor3f\(/);
    expect(code).toContain('    if (state_Tri.useColor) glColor3f(state_Tri.r, state_Tri.g, state_Tri.b);\n    glBegin(');
    expect(code).toContain('    if (state_Box.useColor) glColor3f(state_Box.r, state_Box.g, state_Box.b);\n    else glEnableClientState(GL_COLOR_ARRAY);');
  });
});

describe('BB-CB-10: Reset adds initial_<name>', () => {
  it('declares the initial state and assigns it', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'r', objectId: t.id, trigger: { kind: 'keyboard', key: 'r' }, action: { type: 'reset' } });
    const code = gen();
    expect(code).toMatch(/const ObjectState initial_Tri = \{ /);
    expect(code).toContain('        state_Tri = initial_Tri;');
  });
});

describe('BB-CB-11: Reshape bodies', () => {
  it('Stretch sets the viewport only', () => {
    getState().setCallbackHandler('reshape', 'onReshape');
    getState().setReshapeMode('stretch');
    expect(body(gen(), 'onReshape')).toBe([
      'void onReshape(int width, int height)', '{',
      '    // Stretch: the viewing volume fills the window, whatever its shape',
      '    glViewport(0, 0, width, height);', '    glutPostRedisplay();', '}',
    ].join('\n'));
  });

  it('Keep proportions recomputes the view from the saved viewing volume', () => {
    useVamsStore.setState({ viewportLimits: { minX: -2, maxX: 2, minY: -1, maxY: 1 } });
    getState().setCallbackHandler('reshape', 'onReshape');
    const code = gen();
    expect(body(code, 'onReshape')).toBe([
      'void onReshape(int width, int height)', '{',
      "    // Keep proportions: widen the viewing volume to match the window's shape",
      '    glViewport(0, 0, width, height);',
      '    float aspect = (float)width / (float)(height > 0 ? height : 1);',
      '    float cx = 0.0000f, cy = 0.0000f;',
      '    float halfW = 2.0000f, halfH = 1.0000f;',
      '    if (aspect >= halfW / halfH) halfW = halfH * aspect;',
      '    else halfH = halfW / aspect;',
      '    viewMinX = cx - halfW;', '    viewMaxX = cx + halfW;',
      '    viewMinY = cy - halfH;', '    viewMaxY = cy + halfH;',
      '    glutPostRedisplay();', '}',
    ].join('\n'));
    expect(code).toContain('float viewMinX = -2.0000f, viewMaxX = 2.0000f, viewMinY = -1.0000f, viewMaxY = 1.0000f;');
  });
});

describe('BB-CB-13b: Invalid, reserved or duplicate names are left out of the code', () => {
  it('omits the handler and its registration', () => {
    getState().setCallbackHandler('keyboard', 'display');
    getState().setCallbackHandler('motion', 'onInput');
    getState().setCallbackHandler('reshape', 'onInput');
    const code = gen();
    expect(code).not.toContain('glutKeyboardFunc');
    expect(code).toContain('glutMotionFunc(onInput);');
    expect(code).not.toContain('glutReshapeFunc');
  });

  it('leaves out rules whose target is hidden in the editor', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'a', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 } });
    getState().toggleObjectVisibility(t.id);
    expect(body(gen(), 'onKey')).not.toContain('translate_');
    expect(body(gen(), 'onKey')).not.toContain('case ');
  });
});

describe('BB-CB-16: locateHandlerBranch finds the lines that ran', () => {
  it('finds a key case, a special case, a mouse branch, and whole handlers', () => {
    const t = addTriangle();
    getState().updateObjectName(t.id, 'Tri');
    getState().setCallbackHandler('keyboard', 'onKey');
    getState().setCallbackHandler('special', 'onSpecial');
    getState().setCallbackHandler('mouse', 'onMouse');
    getState().setCallbackHandler('motion', 'onMotion');
    getState().setCallbackHandler('reshape', 'onReshape');
    add('keyboard', { id: 'k', objectId: t.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'rotate', degrees: 15 } });
    add('special', { id: 's', objectId: t.id, trigger: { kind: 'special', key: 'up' }, action: { type: 'rotate', degrees: 15 } });
    add('mouse', { id: 'm', objectId: t.id, trigger: { kind: 'mouse', button: 'right', state: 'up' }, action: { type: 'reset' } });
    const code = gen();
    const lines = code.split('\n');
    const pick = (nums: number[]) => nums.map((n) => lines[n]);
    expect(pick(locateHandlerBranch(code, 'onKey', { kind: 'keyboard', key: 'd' }))).toEqual([
      "    case 'd':", "    case 'D':", '        state_Tri.rotation += 15.00f;', '        break;',
    ]);
    expect(pick(locateHandlerBranch(code, 'onSpecial', { kind: 'special', key: 'up' }))[0]).toBe('    case GLUT_KEY_UP:');
    expect(pick(locateHandlerBranch(code, 'onMouse', { kind: 'mouse', button: 'right', state: 'up' }))).toEqual([
      '    if (button == GLUT_RIGHT_BUTTON && state == GLUT_UP) {', '        state_Tri = initial_Tri;', '    }',
    ]);
    const motion = pick(locateHandlerBranch(code, 'onMotion', { kind: 'motion' }));
    expect(motion[0]).toBe('void onMotion(int x, int y)');
    expect(motion.at(-1)).toBe('}');
    expect(pick(locateHandlerBranch(code, 'onReshape', null))[0]).toBe('void onReshape(int width, int height)');
    expect(locateHandlerBranch(code, 'nothing', null)).toEqual([]);
  });
});

describe('BB-CB-17: No banned word in callbacks copy, help, narration or generated comments', () => {
  it('scans every string', () => {
    const banned = /coming soon|not yet|not supported|unsupported|future|deferred|\b3d\b|lighting/i;
    const t = addTriangle();
    const copy = [
      JSON.stringify(CALLBACK_DEFS), RUN_HINT, RUN_SURFACE_LABEL, RUN_EMPTY_REASON, RUN_NO_CALLBACK_REASON, RUN_OPEN_CALLBACKS, JSON.stringify(RUN_POPOVER_COPY), invalidNameMessage('onKey'),
      triggerChip({ kind: 'idle' }), triggerPhrase({ kind: 'motion' }), actionSentence({ type: 'reset' }, 'T'),
      JSON.stringify(HELP_TOPICS.filter((topic) => topic.id === 'callbacks' || topic.id === 'canvas-basics')),
      JSON.stringify(['primitives-demo-5', 'primitives-exercise-5', 'primitives-exercise-6'].map((id) => PRIMITIVES_LESSONS[id].steps.map((s) => s.narration))),
    ];
    (['keyboard', 'special', 'mouse', 'motion', 'idle'] as const).forEach((k) => getState().setCallbackHandler(k, `h_${k}`));
    getState().setCallbackHandler('reshape', 'onReshape');
    const comments = (code: string) => code.split('\n').filter((l) => l.trim().startsWith('//')).join('\n');
    copy.push(comments(gen()));
    getState().setReshapeMode('stretch');
    getState().addCallbackRule('mouse', { id: 'p', objectId: t.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } });
    copy.push(comments(gen()));
    for (const text of copy) expect(text).not.toMatch(banned);
  });
});

describe('BB-CB-18: A new rule takes the first trigger no rule uses yet', () => {
  it('after D, A, W and S it offers another key, and repeats only when every trigger is taken', () => {
    const t = addTriangle();
    const keys = (...ks: string[]) => ks.map((key) => rule(t.id, { trigger: { kind: 'keyboard', key } }));
    expect(newRule('keyboard', keys('d', 'a', 'w', 's'), getState().objects, 'n')!.trigger).toEqual({ kind: 'keyboard', key: 'b' });
    expect(newRule('keyboard', keys('d'), getState().objects, 'n')!.trigger).toEqual({ kind: 'keyboard', key: 'a' });
    const arrows = (['right', 'left', 'up', 'down'] as const).map((key) => rule(t.id, { trigger: { kind: 'special', key } }));
    expect(newRule('special', arrows, getState().objects, 'n')!.trigger).toEqual({ kind: 'special', key: 'right' });
  });
});

describe('BB-CB-19: A callback whose rules all act on hidden objects says so', () => {
  it('names the hidden objects instead of "No rules yet"', () => {
    const t = addTriangle();
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', rule(t.id));
    getState().toggleObjectVisibility(t.id);
    const handler = body(gen(), 'onKey');
    expect(handler).not.toContain('No rules yet');
    expect(handler).toContain('    // Its rules act on hidden objects, which the program does not draw');
    expect(handler).toContain('    glutPostRedisplay();');
  });
});

describe('BB-CB-20: Handler names that clash with the program\'s libraries are refused', () => {
  it('refuses library functions, macros and GL-style names, and keeps ordinary names', () => {
    for (const name of ['rand', 'abort', 'clock', 'sin', 'exit', 'near', 'far', 'min', 'max', 'GL_KEY', 'GLUT_DOWN', 'GLU_X', 'GLEW_OK', 'glClear', 'glutInit', 'gluOrtho2D', 'glewInit', 'glVertex2f']) {
      expect(isValidHandlerName(name), name).toBe(false);
    }
    for (const name of ['onKey', 'glow', 'global', 'gluey', 'nearby', 'randomise', 'onRand']) {
      expect(isValidHandlerName(name), name).toBe(true);
    }
  });
});

describe('BB-CB-21: The store keeps rule keys and numbers valid', () => {
  it('lower-cases keys, refuses keys outside the list, and turns non-finite numbers into defaults', () => {
    const t = addTriangle();
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', rule(t.id, { id: 'up', trigger: { kind: 'keyboard', key: 'D' } }));
    expect(getState().callbacks.keyboard.rules[0].trigger).toEqual({ kind: 'keyboard', key: 'd' });
    add('keyboard', rule(t.id, { id: 'bad', trigger: { kind: 'keyboard', key: '!' } }));
    expect(getState().callbacks.keyboard.rules.map((r) => r.id)).toEqual(['up']);
    getState().updateCallbackRule('keyboard', 'up', { trigger: { kind: 'keyboard', key: 'A' } });
    expect(getState().callbacks.keyboard.rules[0].trigger).toEqual({ kind: 'keyboard', key: 'a' });
    getState().updateCallbackRule('keyboard', 'up', { trigger: { kind: 'keyboard', key: 'ab' } });
    expect(getState().callbacks.keyboard.rules[0].trigger).toEqual({ kind: 'keyboard', key: 'a' });
    getState().updateCallbackRule('keyboard', 'up', { action: { type: 'translate', dx: Number.NaN, dy: Infinity } });
    expect(getState().callbacks.keyboard.rules[0].action).toEqual({ type: 'translate', dx: 0, dy: 0 });
    getState().updateCallbackRule('keyboard', 'up', { action: { type: 'scale', sx: Number.NaN, sy: 2 } });
    expect(getState().callbacks.keyboard.rules[0].action).toEqual({ type: 'scale', sx: 1, sy: 2 });
    getState().updateCallbackRule('keyboard', 'up', { action: { type: 'rotate', degrees: -Infinity } });
    expect(getState().callbacks.keyboard.rules[0].action).toEqual({ type: 'rotate', degrees: 0 });
    expect(gen()).not.toContain('NaN');
  });
});

describe('BB-CB-22: Rules loaded from a file get unique ids', () => {
  it('replaces repeated and missing ids', () => {
    const raw = {
      keyboard: {
        handlerName: 'onKey',
        rules: [
          { id: 'x', objectId: 'o', trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'reset' } },
          { id: 'x', objectId: 'o', trigger: { kind: 'keyboard', key: 'a' }, action: { type: 'reset' } },
          { objectId: 'o', trigger: { kind: 'keyboard', key: 'w' }, action: { type: 'reset' } },
          { id: 'rule-keyboard-3', objectId: 'o', trigger: { kind: 'keyboard', key: 's' }, action: { type: 'reset' } },
          { objectId: 'o', trigger: { kind: 'keyboard', key: 'q' }, action: { type: 'reset' } },
        ],
      },
    };
    const ids = sanitizeCallbacks(raw, new Set(['o'])).keyboard.rules.map((r) => r.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids[0]).toBe('x');
  });
});

describe('BB-CB-23: The Do and Object menus match the scene', () => {
  it('leaves out actions with no target, and keeps a target that is no longer eligible', () => {
    const a = addTriangle();
    const b = addQuad(0.5, 0.5, 0.1);
    const groupOnly = [{ ...a, id: 'g', type: 'GROUP' as const, parentId: null }];
    expect(availableActionTypes('keyboard', groupOnly)).not.toContain('setColor');
    expect(availableActionTypes('keyboard', groupOnly)).toContain('translate');
    expect(availableActionTypes('mouse', getState().objects)).toContain('moveToPointer');
    expect(availableActionTypes('keyboard', getState().objects)).toContain('setColor');
    getState().createGroup([a.id, b.id]);
    const objects = getState().objects;
    const pointer = { id: 'p', objectId: a.id, trigger: { kind: 'mouse', button: 'left', state: 'down' }, action: { type: 'moveToPointer' } } as CallbackRule;
    const options = targetOptions(pointer, objects);
    expect(options.map((o) => o.id)).toContain(a.id);
    expect(options.map((o) => o.id)).not.toContain(b.id);
  });
});

describe('BB-CB-24: A rule can be edited and removed, and undo brings each change back', () => {
  it('replaces the action in place, removes the rule, and ignores an unknown id', () => {
    // Each change is its own undo step: keep them further apart than the history's throttle.
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => (now += 10_000));
    const t = addTriangle();
    getState().setCallbackHandler('keyboard', 'onKey');
    getState().addCallbackRule('keyboard', rule(t.id, { id: 'move' }));
    getState().updateCallbackRule('keyboard', 'move', { action: { type: 'rotate', degrees: 15 } });
    expect(getState().callbacks.keyboard.rules).toEqual([expect.objectContaining({ id: 'move', action: { type: 'rotate', degrees: 15 } })]);
    getState().undo();
    expect(getState().callbacks.keyboard.rules[0].action).toEqual({ type: 'translate', dx: 0.1, dy: 0 });
    getState().redo();
    getState().removeCallbackRule('keyboard', 'move');
    expect(getState().callbacks.keyboard.rules).toEqual([]);
    getState().undo();
    expect(getState().callbacks.keyboard.rules.map((r) => r.id)).toEqual(['move']);
    const past = getState().past.length;
    getState().removeCallbackRule('keyboard', 'nope');
    getState().updateCallbackRule('keyboard', 'nope', { action: { type: 'rotate', degrees: 1 } });
    expect(getState().past.length).toBe(past);
    clock.mockRestore();
  });
});

describe("BB-CB-25: Text, vertex arrays and a group's children take Set colour and Show/hide too", () => {
  it("guards the text colour, the vertex-array colour array, and a grouped child's draw call", () => {
    getState().addTextObject('Hi', 0, 0);
    getState().updateObjectName(getState().objects[0].id, 'Label');
    const label = getState().objects[0];
    const va = addQuad(0.5, 0.5, 0.1);
    getState().updateObjectName(va.id, 'Arr');
    getState().updateRenderingMode(va.id, 'VERTEX_ARRAY');
    const a = addTriangle(-0.5, 0, 0.1);
    getState().updateObjectName(a.id, 'Kid');
    const b = addTriangle(-0.3, 0, 0.1);
    getState().createGroup([a.id, b.id]);
    getState().setCallbackHandler('keyboard', 'onKey');
    add('keyboard', { id: 'c1', objectId: label.id, trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#ff0000' } });
    add('keyboard', { id: 'c2', objectId: va.id, trigger: { kind: 'keyboard', key: 'c' }, action: { type: 'setColor', color: '#00ff00' } });
    add('keyboard', { id: 'v1', objectId: label.id, trigger: { kind: 'keyboard', key: 'h' }, action: { type: 'visibility', mode: 'hide' } });
    add('keyboard', { id: 'v2', objectId: a.id, trigger: { kind: 'keyboard', key: 'h' }, action: { type: 'visibility', mode: 'show' } });
    const code = gen();
    expect(code).toMatch(/ {8}if \(!state_Label\.useColor\) glColor3f\(/);
    expect(code).toContain('        if (state_Label.useColor) glColor3f(state_Label.r, state_Label.g, state_Label.b);\n');
    expect(code).toContain('    if (state_Arr.useColor) glColor3f(state_Arr.r, state_Arr.g, state_Arr.b);\n    else glEnableClientState(GL_COLOR_ARRAY);');
    expect(code).toContain('    if (state_Label.visible) {\n');
    expect(code).toContain('    if (state_Kid.visible) draw_Kid();');
  });
});
