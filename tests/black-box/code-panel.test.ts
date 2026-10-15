/**
 * BLACK-BOX TEST SUITE — BB-CODE
 * The code panel: folding that follows the selection, changed values, Find, the explanation strip and notes.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import CodeViewer, { lineSegments } from '@/shared/ui/code-viewer/CodeViewer';
import type { CodeRow } from '@/shared/ui/code-viewer/types';
import { useVamsStore } from '@/core/store';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { EditorPanel } from '@/widgets/layout/editor-column';
import { addPrimitive, addTriangle, addQuad, getState } from '../helpers/store';

describe('BB-CODE-01: The code panel state starts calm and is never saved', () => {
  it('opens no folds, explains nothing, shows notes and follows vertex 1', () => {
    const s = getState();
    expect(s.codeFoldsOpened).toEqual([]);
    expect(s.explainedLine).toBeNull();
    expect(s.codeNotes).toBe(true);
    expect(s.journeyVertex).toBe(0);
    s.toggleCodeFold('main');
    expect(getState().codeFoldsOpened).toEqual(['main']);
    getState().toggleCodeFold('main');
    expect(getState().codeFoldsOpened).toEqual([]);
    getState().setExplainedLine(12);
    getState().setCodeNotes(false);
    getState().setJourneyVertex(2);
    expect([getState().explainedLine, getState().codeNotes, getState().journeyVertex]).toEqual([12, false, 2]);
    const options = (useVamsStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => object } } }).persist.getOptions();
    const saved = Object.keys(options.partialize(getState()));
    for (const key of ['codeFoldsOpened', 'explainedLine', 'codeNotes', 'journeyVertex']) expect(saved).not.toContain(key);
  });
});

describe('BB-CODE-02: A new selection closes the old object\'s folds and strip and follows vertex 1', () => {
  const dirty = () => {
    getState().toggleCodeFold('main');
    getState().setExplainedLine(5);
    getState().setJourneyVertex(2);
  };
  const isReset = () => {
    const s = getState();
    return s.codeFoldsOpened.length === 0 && s.explainedLine === null && s.journeyVertex === 0;
  };

  it('resets on selectObject, on a new shape, on delete and on undo', () => {
    const tri = addTriangle();
    const quad = addQuad(0.5, 0.5, 0.2);
    getState().selectObject(tri.id);
    dirty();
    getState().selectObject(quad.id);
    expect(isReset()).toBe(true);
    dirty();
    getState().deleteObject(quad.id);
    expect(isReset()).toBe(true);
    getState().selectObject(tri.id);
    dirty();
    addTriangle(-0.5, -0.5, 0.2);
    expect(isReset()).toBe(true);
    dirty();
    getState().undo();
    expect(isReset()).toBe(true);
  });

  it('keeps them while the selection stays the same', () => {
    const tri = addTriangle();
    getState().selectObject(tri.id);
    dirty();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    getState().selectObject(tri.id);
    expect(getState().codeFoldsOpened).toEqual(['main']);
    expect(getState().explainedLine).toBe(5);
    expect(getState().journeyVertex).toBe(2);
  });
});


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
function key(target: EventTarget, k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const SMALL = ['int main(int argc, char** argv)', '{', '    glutInit(&argc, argv);', '    glutMainLoop();', '}'].join('\n');

describe('BB-CODE-03: A folded block shows its name, its real line number and its summary', () => {
  it('renders a fold button that opens on click, and a ▾ that closes a block opened by hand', async () => {
    const onToggleFold = vi.fn();
    const fold: CodeRow = { kind: 'fold', block: 'main', label: 'int main()', summary: 'Opens the window, registers the callbacks and starts GLUT.', start: 0, end: 4 };
    const host = mount(h(CodeViewer, { code: SMALL, rows: [fold], onToggleFold }));
    await settle();
    const button = host.querySelector('.code-fold') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.querySelector('.code-line__num')!.textContent).toBe('1');
    expect(button.querySelector('.code-fold__label')!.textContent).toBe('int main()');
    const tip = document.getElementById(button.getAttribute('aria-describedby')!)!;
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.textContent).toBe(fold.summary);
    button.click();
    expect(onToggleFold).toHaveBeenCalledWith('main');
    const open: CodeRow[] = [0, 1, 2, 3, 4].map((line) =>
      line === 0 ? { kind: 'line', line, closes: { block: 'main', label: 'int main()' } } : { kind: 'line', line });
    render(h(CodeViewer, { code: SMALL, rows: open, onToggleFold }), host);
    await settle();
    expect(host.querySelectorAll('.code-line')).toHaveLength(5);
    const close = host.querySelector('.code-fold-close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Fold int main()');
    close.click();
    expect(onToggleFold).toHaveBeenLastCalledWith('main');
    unmount(host);
  });
});

describe('BB-CODE-04: A changed value is marked by itself, and its fade restarts on the next edit', () => {
  it('wraps only the value, colours its line number, and replaces the mark when marksKey changes', async () => {
    const code = 'ObjectState state_T = { 0.4000f, -0.1700f, 15.0000f, 1.0000f, 1.0000f };';
    const start = code.indexOf('0.4000f');
    const marks = [{ line: 0, start, end: start + 7 }];
    const host = mount(h(CodeViewer, { code, marks, marksKey: 1 }));
    await settle();
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent).join('')).toBe('0.4000f');
    expect(host.querySelector('.code-line')!.classList.contains('is-changed')).toBe(true);
    const before = host.querySelector('.code-value');
    render(h(CodeViewer, { code, marks, marksKey: 2 }), host);
    await settle();
    expect(host.querySelector('.code-value')).not.toBe(before);
    expect(lineSegments('glEnd();', [{ start: 2, end: 5, cls: 'x' }]).map((s) => [s.text, s.cls])).toEqual([
      ['gl', 'tk-glfn'], ['End', 'tk-glfn x'], ['(', 'tk-punct'], [')', 'tk-punct'], [';', 'tk-punct'],
    ]);
    unmount(host);
  });
});

describe('BB-CODE-05: Find outlines matches and steps through them', () => {
  it('counts matches, moves with Enter and Shift+Enter, reports the current line, and clears on Escape', async () => {
    const onFindLine = vi.fn();
    const host = mount(h(CodeViewer, { code: SMALL, onFindLine }));
    await settle();
    const find = [...host.querySelectorAll('.code-word')].find((b) => b.textContent === 'Find') as HTMLButtonElement;
    find.click();
    await settle();
    const input = host.querySelector('.code-search input') as HTMLInputElement;
    typeInto(input, 'glut');
    await settle();
    expect(host.querySelector('.code-search__count')!.textContent).toBe('1/2');
    expect(host.querySelectorAll('.code-find')).toHaveLength(2);
    expect(host.querySelector('.code-find.is-current')!.closest('.code-line')!.getAttribute('data-line')).toBe('2');
    expect(onFindLine).toHaveBeenLastCalledWith(2);
    key(input, 'Enter');
    await settle();
    expect(host.querySelector('.code-search__count')!.textContent).toBe('2/2');
    expect(onFindLine).toHaveBeenLastCalledWith(3);
    key(input, 'Enter', { shiftKey: true });
    await settle();
    expect(onFindLine).toHaveBeenLastCalledWith(2);
    key(input, 'Escape');
    await settle();
    expect(host.querySelector('.code-search')).toBeNull();
    expect(onFindLine).toHaveBeenLastCalledWith(null);
    unmount(host);
  });
});

describe('BB-CODE-06: Copy copies the whole program, however much is folded', () => {
  it('writes the full code to the clipboard and says Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const host = mount(h(CodeViewer, { code: SMALL, rows: [{ kind: 'fold', block: 'main', label: 'int main()', summary: 's', start: 0, end: 4 }] }));
    await settle();
    const copy = [...host.querySelectorAll('.code-word')].find((b) => b.textContent === 'Copy') as HTMLButtonElement;
    copy.click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(SMALL);
    expect(copy.textContent).toBe('Copied');
    unmount(host);
  });
});

describe('BB-CODE-07: Run\'s fired branch has its own mark', () => {
  it('marks the fired lines and no others', async () => {
    const host = mount(h(CodeViewer, { code: SMALL, firedLines: [2, 3] }));
    await settle();
    expect([...host.querySelectorAll('.code-line.is-fired')].map((el) => el.getAttribute('data-line'))).toEqual(['2', '3']);
    unmount(host);
  });
});

describe('BB-CODE-08: The code uses two syntax colours and the new tokens', () => {
  it('colours only GL calls and comments, and defines the value, line-number and Run tokens in both themes', () => {
    const scss = readFileSync('src/shared/ui/code-viewer/code-viewer.scss', 'utf8').replace(/\r\n/g, '\n');
    const tokenRules = [...scss.matchAll(/\.tk-([a-z]+)\s*\{/g)].map((m) => m[1]).sort();
    expect(tokenRules).toEqual(['comment', 'glfn']);
    const tokens = readFileSync('src/shared/styles/_tokens.scss', 'utf8').replace(/\r\n/g, '\n');
    // Split on the rule, not the header comment that also names the selector.
    const [light, dark] = tokens.split("[data-theme='dark'] {");
    for (const name of ['--value:', '--value-wash:', '--run-fired:', '--run-fired-wash:', '--ink-dim:', '--line-number:', '--canvas-ring:']) {
      expect(light, name).toContain(name);
      expect(dark, name).toContain(name);
    }
    expect(tokens).not.toContain('--code-match-');
    expect(tokens).not.toContain('--code-changed-');
  });
});

/** The mocks' scene: Triangle, Square and Dot, with Triangle's state line first. */
function mockScene() {
  const dot = addPrimitive('POINTS', [{ x: 0.6, y: 0.6 }]);
  getState().updateObjectName(dot.id, 'Dot');
  const square = addQuad(-0.5, 0.5, 0.2);
  getState().updateObjectName(square.id, 'Square');
  const tri = addTriangle(0.3, -0.17, 0.5);
  getState().updateObjectName(tri.id, 'Triangle');
  getState().updateObjectTransform(tri.id, { rotate: 15 });
  return { tri, square, dot };
}
const currentProgram = () => {
  const s = getState();
  return generateCodeFromState(
    { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits, textures: s.getAllTextures() },
    { width: 800, height: 600 },
  );
};
const lineTexts = (host: HTMLElement) => [...host.querySelectorAll('.code-line .code-line__text')].map((el) => el.textContent ?? '');
const foldLabels = (host: HTMLElement) => [...host.querySelectorAll('.code-fold__label')].map((el) => el.textContent);

describe('BB-CODE-09: With a shape selected, its code is open and the rest of the program folds', () => {
  it('shows the selected draw function and state line, and folds the others to their names', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(lineTexts(host)).toContain('void draw_Triangle()');
    expect(lineTexts(host).some((t) => t.startsWith('ObjectState state_Triangle'))).toBe(true);
    expect(foldLabels(host)).toEqual(expect.arrayContaining(['#include …', 'void draw_Square()', 'void draw_Dot()', 'void display()', 'int main()', '2 more objects']));
    unmount(host);
  });
});

describe('BB-CODE-10: With nothing selected, every object\'s code is open', () => {
  it('opens all three draw functions and folds the boilerplate', async () => {
    mockScene();
    getState().selectObject(null);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    for (const name of ['Triangle', 'Square', 'Dot']) expect(lineTexts(host)).toContain(`void draw_${name}()`);
    expect(foldLabels(host)).toEqual(expect.arrayContaining(['void display()', 'void init()', 'int main()']));
    unmount(host);
  });
});

describe('BB-CODE-11: An edit marks only the value it changed, in Author mode', () => {
  it('marks the new X on the state line and colours that line number', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    await settle();
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent).join('')).toBe('0.4000f');
    const changed = host.querySelector('.code-line.is-changed .code-line__text')!.textContent!;
    expect(changed.startsWith('ObjectState state_Triangle')).toBe(true);
    unmount(host);
  });
});

describe('BB-CODE-12: A value that changes inside a fold opens it', () => {
  it('opens main() when the background colour changes, with the new value marked', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(foldLabels(host)).toContain('int main()');
    getState().setCanvasBackgroundColor('#ff0000');
    await settle();
    expect(foldLabels(host)).not.toContain('int main()');
    expect(lineTexts(host).some((t) => t.includes('glClearColor(1.00f, 0.00f, 0.00f'))).toBe(true);
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent)).toEqual(['1.00f']);
    unmount(host);
  });
});

describe('BB-CODE-13: A fold opened by hand stays open until the selection changes', () => {
  it('opens Square\'s draw function on click, folds it with ▾, and folds it again on a new selection', async () => {
    const { tri, square } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const squareFold = () => [...host.querySelectorAll('.code-fold')].find((b) => b.textContent?.includes('void draw_Square()')) as HTMLButtonElement;
    squareFold().click();
    await settle();
    expect(getState().codeFoldsOpened).toEqual(['draw:Square']);
    expect(lineTexts(host)).toContain('void draw_Square()');
    (host.querySelector('.code-fold-close[data-block="draw:Square"]') as HTMLButtonElement).click();
    await settle();
    expect(foldLabels(host)).toContain('void draw_Square()');
    squareFold().click();
    await settle();
    getState().selectObject(square.id);
    getState().selectObject(tri.id);
    await settle();
    expect(getState().codeFoldsOpened).toEqual([]);
    expect(foldLabels(host)).toContain('void draw_Square()');
    unmount(host);
  });
});

describe('BB-CODE-14: Only the student\'s edit is marked; a lesson\'s highlighted lines open their fold', () => {
  it('marks nothing when a lesson swaps the scene in, and opens the fold around a lesson highlight', async () => {
    mockScene();
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    useVamsStore.setState({ appMode: 'Lesson', activeLessonId: 'transforms-demo-1', objects: [] });
    await settle();
    expect(host.querySelectorAll('.code-value')).toHaveLength(0);
    const tri = addTriangle();
    getState().selectObject(tri.id);
    await settle();
    // A lesson step that highlights main()'s glutMainLoop line, as codeChangeFocus would.
    const mainLoop = currentProgram().split('\n').findIndex((l) => l.includes('glutMainLoop'));
    useVamsStore.setState({ changedCodeLines: [mainLoop] });
    await settle();
    expect(lineTexts(host).some((t) => t.includes('glutMainLoop'))).toBe(true);
    useVamsStore.setState({ appMode: 'Author', activeLessonId: null, changedCodeLines: [] });
    unmount(host);
  });
});

describe('BB-CODE-15: Sanitised names fold and mark like any other', () => {
  it('opens draw_My_Shape for an object named "My Shape"', async () => {
    const tri = addTriangle();
    getState().updateObjectName(tri.id, 'My Shape');
    addQuad(0.5, 0.5, 0.2);
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(lineTexts(host)).toContain('void draw_My_Shape()');
    expect(foldLabels(host)).toContain('void draw_QUADS_1()');
    unmount(host);
  });
});

describe('BB-CODE-16: Keyboard focus survives opening and closing a fold, and closing Find', () => {
  it('moves focus to the ▾ when a fold opens, back to its fold when ▾ closes, and to Find when Find closes', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const squareFold = () => host.querySelector('.code-fold[data-block="draw:Square"]') as HTMLButtonElement;
    squareFold().focus();
    squareFold().click();
    await settle();
    const close = host.querySelector('.code-fold-close[data-block="draw:Square"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    close.focus();
    close.click();
    await settle();
    expect(document.activeElement).toBe(squareFold());
    const findWord = () => [...host.querySelectorAll('.code-word')].find((b) => b.textContent === 'Find') as HTMLButtonElement;
    findWord().click();
    await settle();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const input = host.querySelector('.code-search input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    key(input, 'Escape');
    await settle();
    expect(document.activeElement).toBe(findWord());
    findWord().click();
    await settle();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const closeFind = host.querySelector('.code-search__close') as HTMLButtonElement;
    closeFind.focus();
    closeFind.click();
    await settle();
    expect(document.activeElement).toBe(findWord());
    unmount(host);
  });
});

describe('BB-CODE-17: Run scrolls the fired branch into view', () => {
  it('scrolls the code when a handler branch fires', async () => {
    const tri = addTriangle();
    getState().setCallbackHandler('keyboard', 'onKey');
    getState().addCallbackRule('keyboard', {
      id: 'r', objectId: tri.id, trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 0.1, dy: 0 },
    });
    const scrollTo = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof original;
    try {
      const host = mount(h(SceneCodePanel, { flashBranch: { handlerName: 'onKey', trigger: { kind: 'keyboard', key: 'd' }, seq: 1 } }));
      await settle();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      expect(host.querySelector('.code-line.is-fired')).not.toBeNull();
      expect(scrollTo).toHaveBeenCalled();
      unmount(host);
    } finally {
      HTMLElement.prototype.scrollTo = original;
    }
  });
});

describe('BB-CODE-18: A changed value opens only its own line; the neighbours stay folded', () => {
  it('shows Triangle\'s new X and folds Square and Dot into 2 more objects', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    await settle();
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent).join('')).toBe('0.4000f');
    expect(lineTexts(host).some((t) => t.startsWith('ObjectState state_Square'))).toBe(false);
    expect([...host.querySelectorAll('.code-fold__label')].map((el) => el.textContent)).toContain('2 more objects');
    unmount(host);
  });
});

const lineEl = (host: HTMLElement, starts: string) =>
  [...host.querySelectorAll('.code-line')].find((el) => el.querySelector('.code-line__text')!.textContent!.trim().startsWith(starts)) as HTMLElement;

describe('BB-CODE-19: Clicking a line explains it in the strip; Escape closes it', () => {
  it('shows the signature, the sentence and the student\'s values, in a polite live region', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(host.querySelector('.code-hint')!.textContent).toBe('Click any line to see what it does.');
    const translate = lineEl(host, 'glTranslatef(');
    expect(translate.getAttribute('role')).toBe('button');
    translate.click();
    await settle();
    expect(getState().explainedLine).toBe(Number(translate.getAttribute('data-line')));
    expect(translate.classList.contains('is-explained')).toBe(true);
    const strip = host.querySelector('section.code-strip')!;
    const live = host.querySelector('.code-live[aria-live="polite"]')!;
    expect(live.contains(strip)).toBe(true);
    expect(live.textContent).toContain('glTranslatef(x, y, z)');
    expect(host.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(strip.querySelector('.code-strip__sig')!.textContent).toBe('glTranslatef(x, y, z)');
    expect([...strip.querySelectorAll('.code-strip__values tbody tr')].map((tr) => tr.textContent)).toEqual([
      expect.stringContaining('state_Triangle.x'), expect.stringContaining('state_Triangle.y'),
    ]);
    expect(strip.textContent).toContain('0.40');
    expect(strip.textContent).toContain('Translate X');
    expect(host.querySelector('.code-hint')).toBeNull();
    key(translate, 'Escape');
    await settle();
    expect(host.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(host.querySelector('.code-live')!.childElementCount).toBe(0);
    expect(getState().explainedLine).toBeNull();
    expect(host.querySelector('section.code-strip')).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-20: The arrow keys move between explainable lines', () => {
  it('skips braces, blanks and comments, and explains the new line while the strip is open', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const translate = lineEl(host, 'glTranslatef(');
    translate.click();
    await settle();
    key(translate, 'ArrowDown');
    await settle();
    expect(document.activeElement).toBe(lineEl(host, 'glRotatef('));
    expect(getState().explainedLine).toBe(Number(lineEl(host, 'glRotatef(').getAttribute('data-line')));
    key(lineEl(host, 'glRotatef('), 'ArrowDown');
    key(lineEl(host, 'glScalef('), 'ArrowDown');
    await settle();
    expect(document.activeElement).toBe(lineEl(host, 'glShadeModel('));
    key(lineEl(host, 'glShadeModel('), 'ArrowUp');
    await settle();
    expect(document.activeElement).toBe(lineEl(host, 'glScalef('));
    const brace = [...host.querySelectorAll('.code-line')].find((el) => el.textContent!.trim().endsWith('{')) as HTMLElement;
    expect(brace.getAttribute('role')).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-21: Three notes sit under the key lines, and the changed value is amber', () => {
  it('notes move, turn and the shape rule; marks the new X; Notes hides them', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    await settle();
    const notes = [...host.querySelectorAll('.code-note')].map((el) => el.textContent!.trim());
    expect(notes).toEqual(['moves Triangle 0.40 right, 0.17 down', 'turns Triangle 15° anticlockwise', 'every 3 vertices make a triangle']);
    expect([...host.querySelectorAll('.code-note__value.is-changed')].map((el) => el.textContent)).toEqual(['0.40']);
    const toggle = [...host.querySelectorAll('.code-word')].find((b) => b.textContent === 'Notes') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    await settle();
    expect(getState().codeNotes).toBe(false);
    expect(host.querySelectorAll('.code-note')).toHaveLength(0);
    unmount(host);
  });
});

describe('BB-CODE-22: The strip links to the math and to the control', () => {
  it('opens Math on the line\'s stage, and reveals and outlines the control in its panel', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    lineEl(host, 'glTranslatef(').click();
    await settle();
    const links = [...host.querySelectorAll('.code-strip__link')] as HTMLButtonElement[];
    expect(links.map((a) => a.textContent)).toEqual(['See the math: Transformed', 'Open Translate X']);
    links[1].click();
    await settle();
    expect(getState().railPanel).toBe('scene');
    expect(getState().openGroups).toContain('transform');
    expect(getState().revealedGroup).toBe('transform');
    const panel = mount(h(EditorPanel, {}));
    await settle();
    expect(panel.querySelector('[data-group="transform"]')!.classList.contains('is-focus')).toBe(true);
    unmount(panel);
    links[0].click();
    await settle();
    expect(getState().codePane).toBe('math');
    expect(getState().journeyStageOverride).toBe('transformed');
    unmount(host);
  });
});

describe('BB-CODE-23: Explaining a folded line opens its fold; a new selection closes the strip', () => {
  it('opens main() for an explained line inside it, and closes the strip and the outline on a new selection', async () => {
    const { tri, square } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const main = currentProgram().split('\n').findIndex((l) => l.includes('glutMainLoop'));
    expect(lineTexts(host).some((t) => t.includes('glutMainLoop'))).toBe(false);
    getState().setExplainedLine(main);
    await settle();
    expect(lineTexts(host).some((t) => t.includes('glutMainLoop'))).toBe(true);
    expect(host.querySelector('.code-strip__sig')!.textContent).toBe('glutMainLoop()');
    getState().revealGroup('transform');
    expect(getState().revealedGroup).toBe('transform');
    getState().selectObject(square.id);
    await settle();
    expect(host.querySelector('section.code-strip')).toBeNull();
    expect(getState().revealedGroup).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-24: One explainable line is in the tab order, and aria-expanded follows the explained line', () => {
  it('moves the single tab stop to the explained line', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const stops = () => [...host.querySelectorAll('.code-line.is-explainable')].filter((el) => (el as HTMLElement).tabIndex === 0);
    const first = host.querySelector('.code-line.is-explainable') as HTMLElement;
    expect(stops()).toEqual([first]);
    const translate = lineEl(host, 'glTranslatef(');
    translate.click();
    await settle();
    expect(stops()).toEqual([translate]);
    const expanded = [...host.querySelectorAll('.code-line.is-explainable')].filter((el) => el.getAttribute('aria-expanded') === 'true');
    expect(expanded).toEqual([translate]);
    expect(host.querySelectorAll('.code-line[aria-controls]')).toHaveLength(1);
    expect(translate.getAttribute('aria-controls')).toBe(host.querySelector('section.code-strip')!.id);
    unmount(host);
  });
});

describe('BB-CODE-25: Enter and Space each open the strip', () => {
  it('explains the focused line from either key', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const translate = lineEl(host, 'glTranslatef(');
    key(translate, 'Enter');
    await settle();
    expect(getState().explainedLine).toBe(Number(translate.getAttribute('data-line')));
    getState().setExplainedLine(null);
    await settle();
    key(translate, ' ');
    await settle();
    expect(getState().explainedLine).toBe(Number(translate.getAttribute('data-line')));
    unmount(host);
  });
});

describe('BB-CODE-26: The close button closes the strip and focus returns to the line', () => {
  it('closes from the cross', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const translate = lineEl(host, 'glTranslatef(');
    translate.click();
    await settle();
    (host.querySelector('[aria-label="Close explanation"]') as HTMLButtonElement).click();
    await settle();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(host.querySelector('section.code-strip')).toBeNull();
    expect(document.activeElement).toBe(translate);
    unmount(host);
  });
});

describe('BB-CODE-27: The fold toggle never explains a line', () => {
  it('ignores a click and a key on the cross of an open block', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    (host.querySelector('.code-fold[data-block="draw:Square"]') as HTMLButtonElement).click();
    await settle();
    const close = host.querySelector('.code-fold-close[data-block="draw:Square"]') as HTMLButtonElement;
    expect(close.closest('.code-line')).toBeNull();
    key(close, 'Enter');
    key(close, ' ');
    key(close, 'ArrowDown');
    close.click();
    await settle();
    expect(getState().explainedLine).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-28: A revealed group is cleared by toggling a group and by changing section', () => {
  it('clears revealedGroup on toggleGroup and setActiveSection', () => {
    getState().revealGroup('transform');
    getState().toggleGroup('transform');
    expect(getState().revealedGroup).toBeNull();
    getState().revealGroup('appearance');
    getState().toggleGroup('vertices');
    expect(getState().revealedGroup).toBeNull();
    getState().revealGroup('transform');
    const other = getState().activeSection === 'Textures' ? 'Pipeline' : 'Textures';
    getState().setActiveSection(other);
    expect(getState().revealedGroup).toBeNull();
  });
});

describe('BB-CODE-29: A revealed group is outlined in Author mode only', () => {
  it('draws no outline in a lesson', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    useVamsStore.setState({ appMode: 'Lesson' });
    getState().revealGroup('transform');
    const panel = mount(h(EditorPanel, {}));
    await settle();
    expect(panel.querySelector('[data-group="transform"]')!.classList.contains('is-focus')).toBe(false);
    unmount(panel);
  });
});

describe('BB-CODE-30: revealGroup shows the panel the group lives in', () => {
  it('routes object groups to Scene, callbacks to Callbacks and the rest to Settings', () => {
    getState().revealGroup('callbacks');
    expect(getState().railPanel).toBe('callbacks');
    getState().revealGroup('background');
    expect(getState().railPanel).toBe('settings');
    getState().revealGroup('texture');
    expect(getState().railPanel).toBe('scene');
    expect(getState().railHidden).toBe(false);
  });
});

describe('BB-CODE-31: The strip closes when the program gains lines, and stays for a value edit', () => {
  it('closes on an added object and keeps the new values after an edit', async () => {
    const { tri, dot } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    lineEl(host, 'glTranslatef(').click();
    await settle();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    await settle();
    expect(host.querySelector('section.code-strip')).not.toBeNull();
    expect(host.querySelector('section.code-strip')!.textContent).toContain('0.40');
    useVamsStore.setState({ objects: [...getState().objects, { ...dot, id: 'extra', name: 'Extra' }] });
    await settle();
    expect(getState().explainedLine).toBeNull();
    expect(host.querySelector('section.code-strip')).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-32: The hint needs an explainable line, and the live region is always mounted', () => {
  it('shows no hint when nothing is explainable and keeps an empty live region', async () => {
    const host = mount(h(CodeViewer, { code: SMALL, explainable: new Set<number>() }));
    await settle();
    expect(host.querySelector('.code-hint')).toBeNull();
    expect(host.querySelector('.code-live[aria-live="polite"]')!.childElementCount).toBe(0);
    unmount(host);
  });
});
