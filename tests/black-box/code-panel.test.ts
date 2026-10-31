/**
 * BLACK-BOX TEST SUITE — BB-CODE
 * The code panel: folding that follows the selection, changed values, Find, the explanation strip and notes.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { EditorView, type BlockInfo } from '@codemirror/view';
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import type { CodeRow } from '@/shared/ui/code-viewer/types';
import { REVEAL_PADDING, revealTop, scrollBehavior } from '@/shared/ui/code-viewer/reveal-scroll';
import { tokenizeLine } from '@/shared/ui/code-viewer/tokenize';
import { glNameRanges } from '@/shared/ui/code-editor';
import { useVamsStore } from '@/core/store';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { EditorPanel } from '@/widgets/layout/editor-column';
import CodeMathColumn from '@/widgets/layout/code-math-column';
import LessonBar from '@/features/lesson-engine/ui/LessonBar';
import { loadProjectData } from '@/features/scene-library';
import { buildProjectFile } from '@/entities/project/model/project-io';
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

/** The code's editor view, for what the markup cannot say: which line an element is, and the cursor. */
const viewOf = (host: HTMLElement) => EditorView.findFromDOM(host.querySelector('[data-testid="code-view"] .cm-editor') as HTMLElement)!;
const contentOf = (host: HTMLElement) => host.querySelector('[data-testid="code-view"] .cm-content') as HTMLElement;
/** The line an element of the code shows, counted from 0. */
const lineOf = (host: HTMLElement, el: Element) => {
  const view = viewOf(host);
  return view.state.doc.lineAt(view.posAtDOM(el)).number - 1;
};
const cursorLine = (host: HTMLElement) => {
  const view = viewOf(host);
  return view.state.doc.lineAt(view.state.selection.main.head).number - 1;
};
const textOf = (host: HTMLElement, el: Element) => viewOf(host).state.doc.line(lineOf(host, el) + 1).text;
const putCursor = (host: HTMLElement, line: number) => {
  const view = viewOf(host);
  view.dispatch({ selection: { anchor: view.state.doc.line(line + 1).from } });
};
/** The line numbers drawn beside the code, top to bottom. */
const numbersShown = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('.cm-lineNumbers .cm-gutterElement')].filter((el) => el.style.visibility !== 'hidden').map((el) => el.textContent);

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
    expect(host.querySelectorAll('.cm-line')).toHaveLength(5);
    const close = host.querySelector(".code-fold-toggle") as HTMLButtonElement;
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
    expect(host.querySelector('.cm-line')!.classList.contains('is-changed')).toBe(true);
    expect(host.querySelector('.cm-lineNumbers .cm-gutterElement.is-changed')!.textContent).toBe('1');
    const before = host.querySelector('.code-value');
    render(h(CodeViewer, { code, marks, marksKey: 2 }), host);
    await settle();
    expect(host.querySelector('.code-value')).not.toBe(before);
    // A mark can cover part of a GL name; the name keeps its colour on both sides of the mark's edge.
    render(h(CodeViewer, { code: 'glEnd();', marks: [{ line: 0, start: 2, end: 5 }], marksKey: 3 }), host);
    await settle();
    expect([...host.querySelectorAll('.code-value')].map((el) => el.textContent).join('')).toBe('End');
    expect([...host.querySelectorAll('.tk-glfn')].map((el) => el.textContent).join('')).toBe('glEnd');
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
    expect(lineOf(host, host.querySelector('.code-find.is-current')!.closest('.cm-line')!)).toBe(2);
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
    expect([...host.querySelectorAll('.cm-line.is-fired')].map((el) => lineOf(host, el))).toEqual([2, 3]);
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
/** The drawn lines' text, top to bottom, read from the document so a line's ▾ is not part of it. */
const lineTexts = (host: HTMLElement) => [...host.querySelectorAll('.cm-line')].map((el) => textOf(host, el));
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
    const changed = textOf(host, host.querySelector('.cm-line.is-changed')!);
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
    (host.querySelector('.code-fold-toggle[data-block="draw:Square"]') as HTMLButtonElement).click();
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
    const close = host.querySelector('.code-fold-toggle[data-block="draw:Square"]') as HTMLButtonElement;
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
      expect(host.querySelector('.cm-line.is-fired')).not.toBeNull();
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

/** The panel's live regions, leaving out CodeMirror's announcer, which stays empty because nothing here announces. */
const liveRegions = (host: HTMLElement) => host.querySelectorAll('[aria-live]:not(.cm-announced)');
const lineEl = (host: HTMLElement, starts: string) =>
  [...host.querySelectorAll('.cm-line')].find((el) => textOf(host, el).trim().startsWith(starts)) as HTMLElement;

describe('BB-CODE-19: Clicking a line explains it in the strip; Escape closes it', () => {
  it('shows the signature, the sentence and the student\'s values, in a polite live region', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(host.querySelector('.code-hint')!.textContent).toBe('Click any line to see what it does.');
    const translate = lineEl(host, 'glTranslatef(');
    expect(translate.classList.contains('is-explainable')).toBe(true);
    const line = lineOf(host, translate);
    translate.click();
    await settle();
    expect(getState().explainedLine).toBe(line);
    expect(lineEl(host, 'glTranslatef(').classList.contains('is-explained')).toBe(true);
    const strip = host.querySelector('section.code-strip')!;
    const live = host.querySelector('.code-live[aria-live="polite"]')!;
    expect(live.contains(strip)).toBe(true);
    expect(live.textContent).toContain('glTranslatef(x, y, z)');
    expect(liveRegions(host)).toHaveLength(1);
    expect(strip.querySelector('.code-strip__sig')!.textContent).toBe('glTranslatef(x, y, z)');
    expect([...strip.querySelectorAll('.code-strip__values tbody tr')].map((tr) => tr.textContent)).toEqual([
      expect.stringContaining('state_Triangle.x'), expect.stringContaining('state_Triangle.y'),
    ]);
    expect(strip.textContent).toContain('0.40');
    expect(strip.textContent).toContain('Translate X');
    expect(host.querySelector('.code-hint')).toBeNull();
    key(contentOf(host), 'Escape');
    await settle();
    expect(liveRegions(host)).toHaveLength(1);
    expect(host.querySelector('.code-live')!.childElementCount).toBe(0);
    expect(getState().explainedLine).toBeNull();
    expect(host.querySelector('section.code-strip')).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-20: The arrow keys move the cursor line by line, and the open strip follows it', () => {
  it('explains each explainable line the cursor lands on, and keeps the last one over blanks and comments', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const at = (starts: string) => lineOf(host, lineEl(host, starts));
    const translate = at('glTranslatef(');
    lineEl(host, 'glTranslatef(').click();
    await settle();
    const content = contentOf(host);
    content.focus();
    expect(document.activeElement).toBe(content);
    expect(cursorLine(host)).toBe(translate);
    const press = async (k: string) => {
      key(content, k);
      await settle();
    };
    await press('ArrowDown');
    expect(cursorLine(host)).toBe(at('glRotatef('));
    expect(getState().explainedLine).toBe(at('glRotatef('));
    await press('ArrowDown');
    expect(getState().explainedLine).toBe(at('glScalef('));
    // A blank line, then the comment above the render calls: the strip stays on glScalef.
    const scale = at('glScalef(');
    await press('ArrowDown');
    expect(cursorLine(host)).toBe(scale + 1);
    expect(lineTexts(host).find((_, i, all) => all[i - 1]?.trim().startsWith('glScalef('))!.trim()).toBe('');
    expect(getState().explainedLine).toBe(scale);
    await press('ArrowDown');
    expect(cursorLine(host)).toBe(scale + 2);
    expect(getState().explainedLine).toBe(scale);
    await press('ArrowDown');
    expect(cursorLine(host)).toBe(at('glShadeModel('));
    expect(getState().explainedLine).toBe(at('glShadeModel('));
    await press('ArrowUp');
    expect(cursorLine(host)).toBe(at('glShadeModel(') - 1);
    expect(getState().explainedLine).toBe(at('glShadeModel('));
    const brace = [...host.querySelectorAll('.cm-line')].find((el) => el.textContent!.trim().endsWith('{')) as HTMLElement;
    expect(brace.classList.contains('is-explainable')).toBe(false);
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

describe('BB-CODE-24: The code is one tab stop, and it names the strip while the strip is open', () => {
  it('leaves no line focusable by itself, and sets aria-controls on the code only while a line is explained', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const content = contentOf(host);
    expect(content.getAttribute('contenteditable')).toBe('true');
    expect(content.getAttribute('aria-label')).toBe('Generated C++ code');
    expect(content.getAttribute('aria-readonly')).toBe('true');
    expect(content.getAttribute('aria-describedby')).toBe(host.querySelector('.code-hint')!.id);
    expect(host.querySelectorAll('.cm-line[tabindex], .cm-line[role], .cm-line[aria-expanded]')).toHaveLength(0);
    expect(content.hasAttribute('aria-controls')).toBe(false);
    lineEl(host, 'glTranslatef(').click();
    await settle();
    expect(host.querySelectorAll('[aria-controls]')).toHaveLength(1);
    expect(content.getAttribute('aria-controls')).toBe(host.querySelector('section.code-strip')!.id);
    expect(content.hasAttribute('aria-describedby')).toBe(false);
    key(content, 'Escape');
    await settle();
    expect(content.hasAttribute('aria-controls')).toBe(false);
    unmount(host);
  });
});

describe('BB-CODE-25: Enter and Space each explain the cursor\'s line', () => {
  it('explains the line under the cursor from either key, and nothing on a line that has no explanation', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const content = contentOf(host);
    const translate = lineOf(host, lineEl(host, 'glTranslatef('));
    putCursor(host, translate);
    expect(key(content, 'Enter').defaultPrevented).toBe(true);
    await settle();
    expect(getState().explainedLine).toBe(translate);
    getState().setExplainedLine(null);
    await settle();
    key(content, ' ');
    await settle();
    expect(getState().explainedLine).toBe(translate);
    getState().setExplainedLine(null);
    await settle();
    putCursor(host, lineOf(host, [...host.querySelectorAll('.cm-line')].find((el) => el.textContent!.trim() === '{')!));
    key(content, 'Enter');
    await settle();
    expect(getState().explainedLine).toBeNull();
    unmount(host);
  });
});

describe('BB-CODE-26: The close button closes the strip and focus returns to the code, on the line', () => {
  it('closes from the cross', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const translate = lineOf(host, lineEl(host, 'glTranslatef('));
    lineEl(host, 'glTranslatef(').click();
    await settle();
    putCursor(host, 0);
    (host.querySelector('[aria-label="Close explanation"]') as HTMLButtonElement).click();
    await settle();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(host.querySelector('section.code-strip')).toBeNull();
    expect(document.activeElement).toBe(contentOf(host));
    expect(cursorLine(host)).toBe(translate);
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
    const close = host.querySelector('.code-fold-toggle[data-block="draw:Square"]') as HTMLButtonElement;
    // The ▾ sits at the start of the line it folds, yet pressing it never explains that line.
    expect(close.closest('.cm-line')).not.toBeNull();
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

describe('BB-CODE-33: A lesson starting, Back, and opening a scene mark no values; a forward step does', () => {
  const buttonNamed = (host: HTMLElement, text: string) =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
  const marked = (host: HTMLElement) => [...host.querySelectorAll('.code-value')].map((el) => el.textContent);

  it('marks nothing at lesson start and after Back, and marks the translate a forward step changes', async () => {
    mockScene();
    const host = mount(h('div', {}, h(LessonBar, {}), h(SceneCodePanel, {})));
    await settle();
    useVamsStore.setState({ activeSection: 'Transforms' });
    getState().setActiveLesson('transforms-demo-1');
    getState().setAppMode('Lesson');
    await settle();
    expect(marked(host)).toEqual([]);
    // Step 4 asks first; its move to x 0.5 runs once an answer is picked.
    for (let i = 0; i < 3; i++) {
      buttonNamed(host, 'Next').click();
      await settle();
    }
    buttonNamed(host, 'They stay the same').click();
    await settle();
    expect(marked(host)).toEqual(['0.5000f']);
    buttonNamed(host, 'Next').click();
    await settle();
    buttonNamed(host, 'Back').click();
    await settle();
    expect(marked(host)).toEqual([]);
    getState().clearLessonState();
    getState().setAppMode('Author');
    await settle();
    expect(marked(host)).toEqual([]);
    unmount(host);
  });

  it('marks nothing when a saved scene is opened', async () => {
    mockScene();
    const data = buildProjectFile(getState()).data;
    useVamsStore.setState({ objects: [], selectedObjectId: null });
    addTriangle(-0.5, -0.5, 0.2);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    loadProjectData(data);
    await settle();
    expect(lineTexts(host)).toContain('void draw_Triangle()');
    expect(marked(host)).toEqual([]);
    const options = (useVamsStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => object } } }).persist.getOptions();
    expect(Object.keys(options.partialize(getState()))).not.toContain('sceneSwapSeq');
    unmount(host);
  });
});

describe('BB-CODE-34: See the math selects the line\'s object first, as Open does', () => {
  it('selects Triangle from its glTranslatef line with nothing selected, and the journey works its vertex', async () => {
    const { tri } = mockScene();
    getState().selectObject(null);
    useVamsStore.setState({ codePane: 'code', codeHidden: false });
    const host = mount(h(CodeMathColumn, {}));
    await settle();
    lineEl(host, 'glTranslatef(state_Triangle').click();
    await settle();
    const see = [...host.querySelectorAll('.code-strip__link')].find((a) => a.textContent === 'See the math: Transformed') as HTMLButtonElement;
    see.click();
    await settle();
    expect(getState().selectedObjectId).toBe(tri.id);
    expect(getState().codePane).toBe('math');
    expect(getState().journeyStageOverride).toBe('transformed');
    expect(host.querySelector('table.journey-work')).not.toBeNull();
    unmount(host);
  });
});

const toggleOf = (host: HTMLElement, block: string) =>
  host.querySelector(`.code-fold[data-block="${block}"], .code-fold-toggle[data-block="${block}"]`) as HTMLButtonElement;

describe('BB-CODE-35: An unfolded block folds back with a ▾ in the column the ▸ was in, and focus stays on it', () => {
  it('replaces the ▸ with a ▾ in the fold column, folds on click and keeps the focus on the toggle', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    const folded = toggleOf(host, 'draw:Square');
    expect(folded.classList.contains('code-fold')).toBe(true);
    expect(folded.querySelector('.code-fold__arrow')!.textContent).toBe('▸');
    expect(folded.querySelector('.code-fold__arrow')!.classList.contains('code-line__fold')).toBe(true);
    folded.focus();
    folded.click();
    await settle();
    const open = toggleOf(host, 'draw:Square');
    expect(open.classList.contains('code-fold-toggle')).toBe(true);
    expect(open.textContent).toBe('▾');
    expect(document.activeElement).toBe(open);
    // The ▾ opens its block's first line, ahead of the text, and never sits among the line numbers.
    const line = open.closest('.cm-line')!;
    expect(textOf(host, line)).toBe('void draw_Square()');
    // Nothing comes before the ▾ but the empty image a browser may get beside an inline widget for its cursor.
    const ahead = [...line.childNodes].slice(0, [...line.childNodes].indexOf(open));
    expect(line.contains(open)).toBe(true);
    expect(ahead.every((n) => n instanceof Element && n.matches('img.cm-widgetBuffer'))).toBe(true);
    expect(open.closest('.cm-gutters')).toBeNull();
    open.click();
    await settle();
    expect(getState().codeFoldsOpened).toEqual([]);
    expect(foldLabels(host)).toContain('void draw_Square()');
    expect(document.activeElement).toBe(toggleOf(host, 'draw:Square'));
    unmount(host);
  });
});

describe('BB-CODE-36: A block the selection opened folds with one click, and the fold resets on a new selection', () => {
  it('folds the selected draw function, records it as closed by hand and starts fresh on the next selection', async () => {
    const { tri, square } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    expect(foldLabels(host)).not.toContain('void draw_Triangle()');
    toggleOf(host, 'draw:Triangle').click();
    await settle();
    expect(getState().codeFoldsClosed).toEqual(['draw:Triangle']);
    expect(getState().codeFoldsOpened).toEqual([]);
    expect(foldLabels(host)).toContain('void draw_Triangle()');
    toggleOf(host, 'draw:Triangle').click();
    await settle();
    expect(getState().codeFoldsClosed).toEqual([]);
    expect(foldLabels(host)).not.toContain('void draw_Triangle()');
    toggleOf(host, 'draw:Triangle').click();
    await settle();
    getState().selectObject(square.id);
    getState().selectObject(tri.id);
    await settle();
    expect(getState().codeFoldsClosed).toEqual([]);
    expect(foldLabels(host)).not.toContain('void draw_Triangle()');
    const options = (useVamsStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => object } } }).persist.getOptions();
    expect(Object.keys(options.partialize(getState()))).not.toContain('codeFoldsClosed');
    unmount(host);
  });
});

describe('BB-CODE-37: Folding a block that holds a forced line keeps that line, and the focus stays on a toggle', () => {
  it('returns main to its changed line plus its more rows, with a hand-opened block folding too', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    getState().setCanvasBackgroundColor('#ff0000');
    await settle();
    expect(lineTexts(host).some((t) => t.includes('glClearColor(1.00f, 0.00f, 0.00f'))).toBe(true);
    getState().toggleCodeFold('main');
    await settle();
    const handOpen = toggleOf(host, 'main');
    handOpen.focus();
    handOpen.click();
    await settle();
    expect(getState().codeFoldsClosed).toEqual(['main']);
    expect(getState().codeFoldsOpened).toEqual([]);
    expect(lineTexts(host).some((t) => t.includes('glClearColor(1.00f, 0.00f, 0.00f'))).toBe(true);
    expect(host.querySelector('.code-fold-row--more .code-fold[data-block="main"]')).not.toBeNull();
    expect(document.activeElement).toBe(toggleOf(host, 'main'));
    expect(document.activeElement).not.toBe(document.body);
    unmount(host);
  });
});

describe('BB-CODE-38: A three-digit line number is never covered by the toggle', () => {
  it('keeps the ▾ in the fold column of its own line, beside the number, with a fold column on every row', async () => {
    const code = Array.from({ length: 120 }, (_, i) => `line_${i};`).join('\n');
    const rows: CodeRow[] = [
      { kind: 'line', line: 99, closes: { block: 'b', label: 'void b()' } },
      { kind: 'line', line: 100 },
      { kind: 'fold', block: 'c', label: 'void c()', summary: 'c', start: 101, end: 110 },
    ];
    const host = mount(h(CodeViewer, { code, rows }));
    await settle();
    const toggle = host.querySelector('.code-fold-toggle') as HTMLButtonElement;
    // Lines 100 and 101 are drawn; the fold row carries its own 102.
    expect(numbersShown(host)).toEqual(['100', '101']);
    expect(host.querySelector('.code-fold .code-line__num')!.textContent).toBe('102');
    expect(toggle.closest('.cm-gutters')).toBeNull();
    expect(lineOf(host, toggle.closest('.cm-line')!)).toBe(99);
    expect(host.querySelector('.code-fold .code-line__fold')).not.toBeNull();
    const css = readFileSync('src/shared/ui/code-viewer/code-viewer.scss', 'utf8');
    expect(css).not.toContain('code-fold-close');
    expect(css).not.toContain('code-gutter');
    // Every line reaches back under its number and keeps the fold column after it, and the ▾ fills that column.
    expect(css).toMatch(/\.cm-line\s*{[^}]*margin-left:\s*calc\(-1 \* #\{\$num-col\}\);[^}]*padding-left:\s*calc\(#\{\$num-col\} \+ #\{\$fold-col\}\)/);
    expect(css).toMatch(/\.code-fold-toggle\s*{[^}]*left:\s*\$num-col;[^}]*width:\s*\$fold-col/);
    // The number column has one width, set in the editor's theme, which the lines and fold rows read.
    expect(css).toMatch(/\$num-col:\s*var\(--code-number-col\);/);
    expect(css).toMatch(/\.code-fold-row\s*{[^}]*margin-left:\s*calc\(-1 \* #\{\$num-col\}\)/);
    const theme = readFileSync('src/shared/ui/code-editor/extensions.ts', 'utf8');
    expect(theme).toMatch(/'--code-number-col': '44px'/);
    expect(theme).toMatch(/minWidth: 'var\(--code-number-col\)'/);
    unmount(host);
  });
});

describe('BB-CODE-39: Each toggle is a button with aria-expanded and a label that names its block', () => {
  it('reads Unfold when folded and Fold when open, and leaves Enter and Space to the native button', async () => {
    const onToggleFold = vi.fn();
    const fold: CodeRow = { kind: 'fold', block: 'main', label: 'int main()', summary: 's', start: 0, end: 4 };
    const host = mount(h(CodeViewer, { code: SMALL, rows: [fold], onToggleFold }));
    await settle();
    const folded = host.querySelector('.code-fold') as HTMLButtonElement;
    expect(folded.tagName).toBe('BUTTON');
    expect(folded.getAttribute('aria-expanded')).toBe('false');
    expect(folded.getAttribute('aria-label')).toBe('Unfold int main()');
    const open: CodeRow[] = [0, 1].map((line) => (line === 0 ? { kind: 'line', line, closes: { block: 'main', label: 'int main()' } } : { kind: 'line', line }));
    render(h(CodeViewer, { code: SMALL, rows: open, onToggleFold }), host);
    await settle();
    const toggle = host.querySelector('.code-fold-toggle') as HTMLButtonElement;
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Fold int main()');
    expect(key(toggle, 'Enter').defaultPrevented).toBe(false);
    expect(key(toggle, ' ').defaultPrevented).toBe(false);
    unmount(host);
  });
});

describe('BB-CODE-40: A long scroll jumps, so a flash is still lit when its line arrives', () => {
  it('glides within two screens, jumps beyond them, and never glides with reduced motion', () => {
    expect(scrollBehavior(0, 800, 400, false)).toBe('smooth');
    expect(scrollBehavior(0, 801, 400, false)).toBe('auto');
    expect(scrollBehavior(5000, 100, 400, false)).toBe('auto');
    expect(scrollBehavior(0, 100, 400, true)).toBe('auto');
  });

  it('centres lines that fit and puts taller ones at the top, below a little room', () => {
    expect(revealTop(1000, 40, 400)).toBe(1000 - 200 + 20);
    expect(revealTop(1000, 300, 400)).toBe(1000 - REVEAL_PADDING);
    expect(revealTop(10, 20, 400)).toBe(0);
  });
});

describe('BB-CODE-41: Choosing an object scrolls the code to its draw function', () => {
  /**
   * Lays the code out as 20 px rows in a 200 px window, so happy-dom can tell what is on screen.
   * Each drawn line and each fold row is one row, in the order the view shows them.
   */
  function layOut(host: HTMLElement) {
    const view = viewOf(host);
    const rows = () => [...view.contentDOM.querySelectorAll('.cm-line, .code-fold-row')];
    view.lineBlockAt = (pos: number) => {
      const { node } = view.domAtPos(pos);
      const el = (node.nodeType === 1 ? (node as Element) : node.parentElement!).closest('.cm-line, .code-fold-row');
      const top = rows().indexOf(el!) * 20;
      return { top, height: 20, bottom: top + 20 } as BlockInfo;
    };
    let top = 0;
    Object.defineProperty(view.scrollDOM, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => { top = v; } });
    Object.defineProperty(view.scrollDOM, 'clientHeight', { configurable: true, get: () => 200 });
  }
  const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  const scrollable = (host: HTMLElement) => viewOf(host).scrollDOM;
  /** Where a row's top sits in the scroller: its place in the rows, below the code's top padding. */
  const rowTop = (host: HTMLElement, el: Element) =>
    [...contentOf(host).querySelectorAll('.cm-line, .code-fold-row')].indexOf(el) * 20 + viewOf(host).documentPadding.top;

  it('brings an off-screen draw_ function to the top, and leaves one already on screen alone', async () => {
    const { tri } = mockScene();
    getState().selectObject(null);
    const scrollTo = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof original;
    try {
      const host = mount(h(SceneCodePanel, {}));
      await settle();
      layOut(host);
      const scroller = scrollable(host);
      // The student has scrolled far down, past every draw_ function.
      scroller.scrollTop = 4000;
      getState().selectObject(tri.id);
      await settle();
      await frame();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      const signature = [...host.querySelectorAll('.cm-line')].find((el) => el.textContent?.includes('void draw_Triangle()'))!;
      expect(scrollTo.mock.calls[0][0].top).toBe(rowTop(host, signature) - REVEAL_PADDING);
      // Once the code shows draw_Triangle(), choosing Triangle again moves nothing.
      scrollTo.mockClear();
      scroller.scrollTop = rowTop(host, signature);
      getState().selectObject(null);
      await settle();
      getState().selectObject(tri.id);
      await settle();
      await frame();
      expect(scrollTo).not.toHaveBeenCalled();
      unmount(host);
    } finally {
      HTMLElement.prototype.scrollTo = original;
    }
  });

  /** Mounts the panel with scrollTo spied on and the code laid out; `run` gets the host and the spy. */
  async function withPanel(run: (host: HTMLElement, scrollTo: ReturnType<typeof vi.fn>) => Promise<void>) {
    const scrollTo = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof original;
    const host = mount(h(SceneCodePanel, {}));
    try {
      await settle();
      layOut(host);
      await frame();
      await run(host, scrollTo);
    } finally {
      unmount(host);
      HTMLElement.prototype.scrollTo = original;
    }
  }
  /** Where the follow puts the first line containing `text`. */
  const followTop = (host: HTMLElement, text: string) =>
    rowTop(host, [...host.querySelectorAll('.cm-line')].find((el) => el.textContent?.includes(text))!) - REVEAL_PADDING;

  it('stays put when an edit, not a new selection, changes the code', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    await withPanel(async (host, scrollTo) => {
      scrollable(host).scrollTop = 4000;
      scrollTo.mockClear();
      getState().updateObjectTransform(tri.id, { translateX: 0.55 });
      await settle();
      await frame();
      const target = followTop(host, 'void draw_Triangle()');
      expect(scrollTo.mock.calls.every(([o]) => o.top !== target)).toBe(true);
    });
  });

  it('still follows the next selection after an edit left its changed values marked', async () => {
    const { tri, square } = mockScene();
    getState().selectObject(square.id);
    await withPanel(async (host, scrollTo) => {
      getState().updateObjectTransform(square.id, { translateX: -0.4 });
      await settle();
      await frame();
      scrollable(host).scrollTop = 4000;
      scrollTo.mockClear();
      getState().selectObject(tri.id);
      await settle();
      await frame();
      await settle();
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: followTop(host, 'void draw_Triangle()') }));
    });
  });

  it('judges what is on screen by the code the student saw, before folds above them changed', async () => {
    const { tri, square } = mockScene();
    getState().selectObject(tri.id);
    await withPanel(async (host, scrollTo) => {
      // The window ends just above Square's fold row, so the student cannot see Square.
      const squareRow = host.querySelector('.code-fold[data-block="draw:Square"]')!.closest('.code-fold-row')!;
      scrollable(host).scrollTop = rowTop(host, squareRow) - 200;
      scrollTo.mockClear();
      // Choosing Square folds Triangle's function above the window. The lines below it move up, and
      // Square's would land in the window before the editor puts the code back under the student.
      getState().selectObject(square.id);
      await settle();
      await frame();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo.mock.calls[0][0].top).toBe(followTop(host, 'void draw_Square()'));
    });
  });

  it('follows a group, which draw() draws inline', async () => {
    const { tri, square } = mockScene();
    getState().createGroup([tri.id, square.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().selectObject(null);
    await withPanel(async (host, scrollTo) => {
      scrollable(host).scrollTop = 4000;
      scrollTo.mockClear();
      getState().selectObject(group.id);
      await settle();
      await frame();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo.mock.calls[0][0].top).toBe(followTop(host, `// ${group.name}`));
    });
  });
});

describe('BB-CODE-42: The editor colours GL calls exactly where the tokenizer does', () => {
  it('marks the same GL and GLUT names on every line of a generated program, and none in a comment', () => {
    mockScene();
    const covered = (line: string) => glNameRanges(line).map((r) => line.slice(r.from, r.to));
    const program = currentProgram().split('\n');
    expect(program.length).toBeGreaterThan(50);
    for (const line of program) {
      expect(covered(line), line).toEqual(tokenizeLine(line).filter((t) => t.k === 'glfn').map((t) => t.t));
    }
    expect(covered('glBegin(GL_TRIANGLES); // glEnd')).toEqual(['glBegin']);
    expect(covered('    glutSwapBuffers();')).toEqual(['glutSwapBuffers']);
  });
});

describe('BB-CODE-43: The code panel never takes an edit', () => {
  it('drops a typed change, a deletion and a paste, and keeps the program as generated', async () => {
    const host = mount(h(CodeViewer, { code: SMALL }));
    await settle();
    const view = viewOf(host);
    view.dispatch({ changes: { from: 0, insert: 'x' }, userEvent: 'input.type' });
    view.dispatch({ changes: { from: 0, to: 3 }, userEvent: 'delete.backward' });
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'glEnd();' } });
    contentOf(host).dispatchEvent(paste);
    await settle();
    expect(view.state.doc.toString()).toBe(SMALL);
    expect(lineTexts(host)).toEqual(SMALL.split('\n'));
    expect(contentOf(host).getAttribute('aria-readonly')).toBe('true');
    // A tap on a phone or tablet opens no on-screen keyboard.
    expect(contentOf(host).getAttribute('inputmode')).toBe('none');
    unmount(host);
  });
});

describe('BB-CODE-44: Folding never leaves the cursor in hidden code', () => {
  // A comment above main(), so a line stays drawn when main() folds.
  const CODE = ['// The window', ...SMALL.split('\n')].join('\n');
  const open: CodeRow[] = [0, 1, 2, 3, 4, 5].map((line) =>
    line === 1 ? { kind: 'line', line, closes: { block: 'main', label: 'int main()' } } : { kind: 'line', line });
  const folded: CodeRow[] = [{ kind: 'line', line: 0 }, { kind: 'fold', block: 'main', label: 'int main()', summary: 's', start: 1, end: 5 }];
  const explainable = new Set([3, 4]);

  it('opens a fold from its button without moving the cursor', async () => {
    const onToggleFold = vi.fn();
    const host = mount(h(CodeViewer, { code: CODE, rows: folded, onToggleFold, explainable }));
    await settle();
    const before = viewOf(host).state.selection.main.head;
    (host.querySelector('.code-fold') as HTMLButtonElement).click();
    await settle();
    expect(onToggleFold).toHaveBeenCalledWith('main');
    expect(viewOf(host).state.selection.main.head).toBe(before);
    render(h(CodeViewer, { code: CODE, rows: open, onToggleFold, explainable }), host);
    await settle();
    expect(viewOf(host).state.selection.main.head).toBe(before);
    expect(cursorLine(host)).toBe(0);
    unmount(host);
  });

  it('moves a cursor out of a block that folds, and Enter explains nothing hidden', async () => {
    const onExplain = vi.fn();
    const host = mount(h(CodeViewer, { code: CODE, rows: open, explainable, onExplain }));
    await settle();
    putCursor(host, 3);
    render(h(CodeViewer, { code: CODE, rows: folded, explainable, onExplain }), host);
    await settle();
    expect(cursorLine(host)).toBeLessThanOrEqual(1);
    key(contentOf(host), 'Enter');
    // Even a cursor put straight into the folded lines explains nothing.
    putCursor(host, 4);
    key(contentOf(host), 'Enter');
    key(contentOf(host), ' ');
    await settle();
    expect(onExplain).not.toHaveBeenCalled();
    unmount(host);
  });
});

describe('BB-CODE-45: Every control in the code panel is reachable by a screen reader, after the code', () => {
  it('puts no focusable element under aria-hidden, and the ▾ after the code in the tab order', async () => {
    const { tri } = mockScene();
    getState().selectObject(tri.id);
    getState().toggleCodeFold('draw:Square');
    const host = mount(h(SceneCodePanel, {}));
    await settle();
    lineEl(host, 'glTranslatef(').click();
    await settle();
    const focusable = [...host.querySelectorAll('button, input, a[href], [tabindex], [contenteditable="true"]')];
    expect(focusable.some((el) => el.classList.contains('code-fold-toggle'))).toBe(true);
    expect(focusable.some((el) => el.classList.contains('code-fold'))).toBe(true);
    expect(focusable.filter((el) => el.closest('[aria-hidden="true"]'))).toEqual([]);
    const content = contentOf(host);
    for (const toggle of host.querySelectorAll('.code-fold-toggle, .code-fold')) expect(content.contains(toggle)).toBe(true);
    unmount(host);
  });
});

describe('BB-CODE-46: A click with the strip open explains the line once', () => {
  it('leaves a pointer\'s cursor move to the click, and still follows the arrow keys', async () => {
    const onExplain = vi.fn();
    const host = mount(h(CodeViewer, { code: SMALL, explainable: new Set([2, 3]), explainedLine: 2, onExplain }));
    await settle();
    const view = viewOf(host);
    // A real click: the pointer moves the cursor, then the click lands on the line.
    view.dispatch({ selection: { anchor: view.state.doc.line(4).from }, userEvent: 'select.pointer' });
    lineEl(host, 'glutMainLoop').click();
    await settle();
    expect(onExplain.mock.calls).toEqual([[3]]);
    onExplain.mockClear();
    putCursor(host, 2);
    key(contentOf(host), 'ArrowDown');
    await settle();
    expect(onExplain.mock.calls).toEqual([[3]]);
    unmount(host);
  });
});
