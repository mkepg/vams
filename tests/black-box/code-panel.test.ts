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
import { addTriangle, addQuad, getState } from '../helpers/store';

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
