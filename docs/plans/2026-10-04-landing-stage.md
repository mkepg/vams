# Landing Page and Stage Mode Implementation Plan

**Goal:** Turn the home page into the CS Expo talk: six new sections after the hero, a live vertex demo driven by the real code generator, and a stage mode for presenting it on a projector.

**Architecture:**
- Copy lives in a dependency-free content module. The SEO head reads the team from it.
- The demo is a pure model (`demo-code.ts`) wrapped by an SVG component.
- Stage mode is a feature slice: pure key and URL logic plus a hook. While stage mode is on, the hook sets `html.stage`.
- In stage mode the root font size follows the viewport height. Spacing tokens switch to rem, so every slide keeps its framing at any projector resolution.

**Tech Stack:** Preact 10 + preact-iso, TypeScript strict, SCSS, Vitest + happy-dom.

**Spec:** [docs/specs/2026-10-04-landing-stage-design.md](../specs/2026-10-04-landing-stage-design.md)

## Global Constraints

### Git and commits
- Branch: `feat/landing-stage`. Never commit to `main`.
- Before every commit, `npm run lint`, `npm run build` and `npm test` must all pass.
- Stage paths explicitly (no `git add -A` or `git add .`) and read `git diff --staged` before committing.
- Never stage `tests/reports/*.json` (restore them with `git checkout -- tests/reports`) or `.gitignore`.
- Commit subjects use Conventional Commits. Messages describe the engineering only, with no tool attribution or `Co-Authored-By` trailer.

### Tests
- Tests live in `tests/` in files ending `.test.ts`. No TSX in tests: use `h()` from `preact`.
- New tests use IDs `BB-HOME-NN` in `describe('BB-HOME-NN: …')` blocks, numbered as given in each task, with exactly one `it` per `describe`. Existing test IDs never change.

### Code you must not change
- Generated C++ output stays byte-for-byte identical. Nothing under `src/features/code-generation`, `src/core`, `src/entities` or `src/shared/engine` changes.
- The persisted store (`vams-storage`, version 7) does not change.

### Student-facing text
- Never use: "coming soon", "not yet", "future", "deferred", "unsupported", "not supported", "3D", "lighting".
- Section names are exactly `Pipeline | Primitives | Buffers | Transforms | Textures`.

### Imports and layers
- Imports use the `@/` alias, with one exception. `src/app/routes/route-meta.ts`, `src/app/seo/head.ts`, `src/app/seo/sitemap.ts` and `src/pages/home/model/content.ts` are loaded by `vite.config.ts`, so they use relative imports only and never reference `import.meta.env`. `content.ts` has no imports at all.
- Layering: pages → features → shared. No PixiJS module may be reachable from the `/` route's chunks.

### Browsers and styling
- Required layout must work in Chrome 99+, Firefox 101+ and Edge 121+.
- Do not rely on `:has()`, container queries, CSS nesting in emitted CSS, view transitions, scroll-driven animations, or `dvh`/`svh` units for anything required.
- All colours come from `src/shared/styles/_tokens.scss`. Any new token is added there with values for both themes.

### Accessibility
- WCAG 2.2 AA on everything touched.
- Text contrast ≥ 4.5:1. Large text and UI boundaries ≥ 3:1.
- A visible `:focus-visible` indicator using `--focus-ring`.
- Every control reachable by keyboard. No information conveyed by colour alone.
- `--accent-text` is for large text only (about 3.9:1 on vellum).

### Theme
- Theme values are exactly `vellum` (the default) and `blueprint`, stored under localStorage `vams-theme` and applied as `data-theme` on `<html>`. Stage mode follows the active theme.

### Lint
- The lint rule `react-hooks/set-state-in-effect` is an error. Use a justified `eslint-disable-next-line` only where a deliberate two-pass render needs it.

---

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `src/pages/home/model/demo-code.ts` | 1 | Demo scene, generator call, block extraction, pixel ↔ GL math, snapping |
| `src/features/stage-mode/model/stage-controller.ts` | 2 | Key → action mapping, index math, URL parsing, focus classification |
| `src/pages/home/model/content.ts` | 3 | All home-page copy and team data (no imports) |
| `src/app/seo/head.ts` | 3 | JSON-LD gains authors and contributor |
| `src/pages/home/ui/VertexDemo.tsx`, `vertex-demo.scss` | 4 | Interactive demo figure |
| `src/pages/home/ui/sections/*.tsx`, `sections.scss` | 5 | The seven sections and their styles |
| `src/pages/home/ui/HomePage.tsx`, `home.scss` | 5, 6 | Composition; hero styles |
| `src/widgets/site-footer/ui/SiteFooter.tsx`, `site-footer.scss` | 5 | Optional `actions` slot |
| `src/features/stage-mode/model/useStageMode.ts` | 6 | Stage state, keys, scrolling, URL, class |
| `src/features/stage-mode/ui/*`, `index.ts` | 6 | Indicator, Present button, public API |
| `src/pages/home/ui/home-stage.scss` | 6 | Stage layout |
| `index.html` | 6 | Early `stage` class |
| `tests/black-box/home-stage.test.ts` | 1–6 | BB-HOME-01…18 |

The test file is created in Task 1, and each later task appends its `describe` blocks to the end. Imports for later blocks sit just above their first use, the pattern `tests/black-box/site-shell.test.ts` already follows.

After all tasks, the suite count is 271 + 18 = **289**.

---

### Task 1: Demo code model

**Files:**
- Create: `src/pages/home/model/demo-code.ts`
- Create: `tests/black-box/home-stage.test.ts`

**Interfaces:**
- Consumes: `generateCodeFromState` from `@/features/code-generation/model/generate-from-state`; `SceneNode` from `@/core/types/scene`.
- Produces:
  - Types: `DemoVertex { x: number; y: number }`, `DemoTriangle` (a readonly 3-tuple of `DemoVertex`), `DemoCode { lines: string[]; vertexLineIndexes: [number, number, number] }`.
  - Constants: `INITIAL_TRIANGLE`, `DEMO_COLORS`, `GRID_STEP = 0.05`, `FALLBACK_CODE`.
  - Functions:
    - `snapToGrid(value): number`
    - `replaceVertex(tri, index, vertex): DemoTriangle`
    - `buildDemoScene(tri): SceneNode`
    - `generateDemoProgram(tri): string`
    - `extractDrawBlock(program): DemoCode | null`
    - `generateDemoCode(tri): DemoCode`
    - `pixelToGl(px, py, width, height): { x; y }`
    - `glToPixel(x, y, width, height): { px; py }`

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/home-stage.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-HOME
 * Landing page: the live vertex demo, stage mode, home content and structured data.
 */
import { describe, it, expect } from 'vitest';
import {
  INITIAL_TRIANGLE,
  FALLBACK_CODE,
  generateDemoCode,
  generateDemoProgram,
  extractDrawBlock,
  pixelToGl,
  glToPixel,
  snapToGrid,
  type DemoTriangle,
} from '@/pages/home/model/demo-code';

const BANNED = ['coming soon', 'not yet', 'future', 'deferred', 'unsupported', 'not supported', '3d', 'lighting'];

/** The block the editor's generator emits for the initial demo triangle (red, green, blue vertices). */
const INITIAL_BLOCK = [
  'glBegin(GL_TRIANGLES);',
  '    glColor3f(1.00f, 0.00f, 0.00f);',
  '    glVertex2f(-0.5000f, -0.5000f);',
  '    glColor3f(0.00f, 1.00f, 0.00f);',
  '    glVertex2f(0.5000f, -0.5000f);',
  '    glColor3f(0.00f, 0.00f, 1.00f);',
  '    glVertex2f(0.0000f, 0.5000f);',
  'glEnd();',
];

describe('BB-HOME-01: The demo shows the generator draw block for the initial triangle', () => {
  it('returns the glBegin…glEnd block and points at the three glVertex2f lines', () => {
    const code = generateDemoCode(INITIAL_TRIANGLE);
    expect(code.lines).toEqual(INITIAL_BLOCK);
    expect(code.vertexLineIndexes).toEqual([2, 4, 6]);
  });
});

describe('BB-HOME-02: The demo block is taken verbatim from the full generated program', () => {
  it('appears unchanged in the program and follows a moved vertex', () => {
    const moved: DemoTriangle = [{ x: 0.25, y: -0.75 }, INITIAL_TRIANGLE[1], INITIAL_TRIANGLE[2]];
    const program = generateDemoProgram(moved);
    const code = generateDemoCode(moved);
    expect(program).toContain(code.lines.map((line) => `    ${line}`).join('\n'));
    expect(code.lines[code.vertexLineIndexes[0]]).toBe('    glVertex2f(0.2500f, -0.7500f);');
  });
});

describe('BB-HOME-03: Pixel and GL coordinates convert both ways', () => {
  it('maps corners and the centre, and round-trips an arbitrary point', () => {
    expect(pixelToGl(0, 0, 300, 300)).toEqual({ x: -1, y: 1 });
    expect(pixelToGl(300, 300, 300, 300)).toEqual({ x: 1, y: -1 });
    expect(pixelToGl(150, 150, 300, 300)).toEqual({ x: 0, y: 0 });
    expect(glToPixel(0, 0.5, 300, 300)).toEqual({ px: 150, py: 75 });
    const p = glToPixel(-0.35, 0.8, 300, 300);
    const g = pixelToGl(p.px, p.py, 300, 300);
    expect(g.x).toBeCloseTo(-0.35, 10);
    expect(g.y).toBeCloseTo(0.8, 10);
  });
});

describe('BB-HOME-04: Dragged positions clamp to the view and snap to the grid', () => {
  it('clamps to [-1, 1], snaps to 0.05 and never returns negative zero', () => {
    expect(snapToGrid(1.3)).toBe(1);
    expect(snapToGrid(-2)).toBe(-1);
    expect(snapToGrid(0.123)).toBe(0.1);
    expect(snapToGrid(0.126)).toBe(0.15);
    expect(snapToGrid(-0.45 + 0.05)).toBe(-0.4);
    expect(Object.is(snapToGrid(-0.01), 0)).toBe(true);
  });
});

describe('BB-HOME-05: The demo falls back to a static block when extraction fails', () => {
  it('rejects programs without a complete block and keeps a fallback that matches the initial block', () => {
    expect(extractDrawBlock('int main() { return 0; }')).toBeNull();
    expect(extractDrawBlock('    glBegin(GL_TRIANGLES);\n')).toBeNull();
    expect(FALLBACK_CODE.lines).toEqual(INITIAL_BLOCK);
    expect(FALLBACK_CODE.vertexLineIndexes).toEqual([2, 4, 6]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: FAIL. The module `@/pages/home/model/demo-code` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/pages/home/model/demo-code.ts`:

```ts
import type { SceneNode } from '@/core/types/scene';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';

/**
 * The home page's live demo: one triangle run through the editor's own code generator.
 * Everything here is pure, so the page can prerender it and tests can check it.
 */
export interface DemoVertex {
  x: number;
  y: number;
}
export type DemoTriangle = readonly [DemoVertex, DemoVertex, DemoVertex];
export interface DemoCode {
  /** The glBegin…glEnd block, dedented so glBegin starts at column 0. */
  lines: string[];
  /** Indexes into `lines` of the glVertex2f call for each vertex, in vertex order. */
  vertexLineIndexes: [number, number, number];
}

export const GRID_STEP = 0.05;
export const DEMO_COLORS = ['#ff0000', '#00ff00', '#0000ff'] as const;
export const INITIAL_TRIANGLE: DemoTriangle = [
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
  { x: 0, y: 0.5 },
];

/** Shown only if the generator ever fails; it is the block for INITIAL_TRIANGLE. */
export const FALLBACK_CODE: DemoCode = {
  lines: [
    'glBegin(GL_TRIANGLES);',
    '    glColor3f(1.00f, 0.00f, 0.00f);',
    '    glVertex2f(-0.5000f, -0.5000f);',
    '    glColor3f(0.00f, 1.00f, 0.00f);',
    '    glVertex2f(0.5000f, -0.5000f);',
    '    glColor3f(0.00f, 0.00f, 1.00f);',
    '    glVertex2f(0.0000f, 0.5000f);',
    'glEnd();',
  ],
  vertexLineIndexes: [2, 4, 6],
};

const CANVAS_SIZE = { width: 800, height: 600 };
const NO_CALLBACKS = { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' };

/** Clamp to the default glOrtho range and snap to the demo grid, without float noise or -0. */
export function snapToGrid(value: number): number {
  const clamped = Math.min(1, Math.max(-1, value));
  const snapped = Math.round(clamped / GRID_STEP) * GRID_STEP;
  return Math.round(snapped * 100) / 100 || 0;
}

export function replaceVertex(tri: DemoTriangle, index: number, vertex: DemoVertex): DemoTriangle {
  return [
    index === 0 ? vertex : tri[0],
    index === 1 ? vertex : tri[1],
    index === 2 ? vertex : tri[2],
  ];
}

/** A one-object scene with the same defaults the editor gives a newly placed triangle. */
export function buildDemoScene(tri: DemoTriangle): SceneNode {
  return {
    id: 'demo-triangle',
    name: 'Triangle',
    type: 'TRIANGLES',
    visible: true,
    shading: 'SMOOTH',
    vertices: tri.map((v, i) => ({ id: `v${i}`, x: v.x, y: v.y, color: DEMO_COLORS[i] })),
    transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 },
    parentId: null,
    children: [],
    colorMode: 'FLOAT',
    lineStipple: null,
    renderingMode: 'IMMEDIATE',
    bufferUsage: 'STATIC',
    useIndexed: false,
    updateMethod: 'BUFFER_SUB_DATA',
    texture: null,
    uvs: null,
  };
}

export function generateDemoProgram(tri: DemoTriangle): string {
  return generateCodeFromState(
    { objects: [buildDemoScene(tri)], canvasBackgroundColor: '#000000', callbacks: NO_CALLBACKS },
    CANVAS_SIZE,
  );
}

export function extractDrawBlock(program: string): DemoCode | null {
  const all = program.split('\n');
  const start = all.findIndex((line) => line.trim().startsWith('glBegin('));
  if (start < 0) return null;
  const end = all.findIndex((line, i) => i > start && line.trim() === 'glEnd();');
  if (end < 0) return null;
  const block = all.slice(start, end + 1);
  const indent = block[0].length - block[0].trimStart().length;
  const lines = block.map((line) => line.slice(indent));
  const vertexLines = lines.flatMap((line, i) => (line.trim().startsWith('glVertex2f(') ? [i] : []));
  if (vertexLines.length !== 3) return null;
  return { lines, vertexLineIndexes: [vertexLines[0], vertexLines[1], vertexLines[2]] };
}

export function generateDemoCode(tri: DemoTriangle): DemoCode {
  try {
    return extractDrawBlock(generateDemoProgram(tri)) ?? FALLBACK_CODE;
  } catch {
    return FALLBACK_CODE;
  }
}

/** Pixel position in a width × height view to GL coordinates under glOrtho(-1, 1, -1, 1). */
export function pixelToGl(px: number, py: number, width: number, height: number) {
  return { x: (2 * px) / width - 1, y: 1 - (2 * py) / height };
}

export function glToPixel(x: number, y: number, width: number, height: number) {
  return { px: ((x + 1) / 2) * width, py: ((1 - y) / 2) * height };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/home/model/demo-code.ts tests/black-box/home-stage.test.ts
git diff --staged
git commit -m "feat(home): add the demo model that runs the code generator on one triangle"
```

Expected: 276 tests pass.

---

### Task 2: Stage controller logic

**Files:**
- Create: `src/features/stage-mode/model/stage-controller.ts`
- Modify: `tests/black-box/home-stage.test.ts` (append)

**Interfaces:**
- Produces:
  - Types:
    - `StageAction = 'next' | 'prev' | 'first' | 'last' | 'exit' | 'enter-app' | 'theme' | 'fullscreen' | 'enter-stage'`
    - `FocusKind = 'text' | 'vertex' | 'interactive' | 'none'`
    - `KeyInput { key; shiftKey; ctrlKey; altKey; metaKey }`
    - `KeyContext { active: boolean; atLast: boolean; focus: FocusKind }`
  - Functions:
    - `keyToAction(input, context): StageAction | null`
    - `clampIndex(i, count)`, `nextIndex(current, count)`, `prevIndex(current)`
    - `readStageFromUrl(search, hash, sectionIds): { active: boolean; index: number }`
    - `focusKind(el: Element | null): FocusKind`
- Vertex handles in Task 4 carry the attribute `data-vertex-handle`. `focusKind` keys on that attribute.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/home-stage.test.ts`:

```ts
import {
  keyToAction,
  nextIndex,
  prevIndex,
  clampIndex,
  readStageFromUrl,
  focusKind,
  type KeyContext,
} from '@/features/stage-mode/model/stage-controller';

type Mods = Partial<{ shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }>;
const key = (k: string, mods: Mods = {}) => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});
const MID: KeyContext = { active: true, atLast: false, focus: 'none' };

describe('BB-HOME-06: Stage keys step, jump, exit and toggle', () => {
  it('maps presenter and keyboard keys to stage actions mid-talk', () => {
    for (const k of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) expect(keyToAction(key(k), MID)).toBe('next');
    for (const k of ['ArrowLeft', 'ArrowUp', 'PageUp']) expect(keyToAction(key(k), MID)).toBe('prev');
    expect(keyToAction(key(' ', { shiftKey: true }), MID)).toBe('prev');
    expect(keyToAction(key('Home'), MID)).toBe('first');
    expect(keyToAction(key('End'), MID)).toBe('last');
    expect(keyToAction(key('Escape'), MID)).toBe('exit');
    expect(keyToAction(key('t'), MID)).toBe('theme');
    expect(keyToAction(key('T'), MID)).toBe('theme');
    expect(keyToAction(key('f'), MID)).toBe('fullscreen');
    expect(keyToAction(key('F'), MID)).toBe('fullscreen');
    expect(keyToAction(key('Enter'), MID)).toBeNull();
    expect(keyToAction(key('p'), MID)).toBeNull();
    expect(keyToAction(key('x'), MID)).toBeNull();
  });
});

describe('BB-HOME-07: Outside stage mode only P does anything', () => {
  it('enters on p or P and ignores every other key', () => {
    const off: KeyContext = { active: false, atLast: false, focus: 'none' };
    expect(keyToAction(key('p'), off)).toBe('enter-stage');
    expect(keyToAction(key('P'), off)).toBe('enter-stage');
    for (const k of ['ArrowRight', 'PageDown', ' ', 'Escape', 't', 'f', 'End']) expect(keyToAction(key(k), off)).toBeNull();
    expect(keyToAction(key('p'), { ...off, focus: 'text' })).toBeNull();
    expect(keyToAction(key('p', { ctrlKey: true }), off)).toBeNull();
  });
});

describe('BB-HOME-08: Keys yield to text fields, modifiers, vertex handles and controls', () => {
  it('ignores typing and shortcuts, and lets focused vertices and controls keep their keys', () => {
    for (const mods of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      expect(keyToAction(key('ArrowRight', mods), MID)).toBeNull();
    }
    expect(keyToAction(key('ArrowRight'), { ...MID, focus: 'text' })).toBeNull();
    expect(keyToAction(key('PageDown'), { ...MID, focus: 'text' })).toBeNull();
    const vertex: KeyContext = { ...MID, focus: 'vertex' };
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) expect(keyToAction(key(k), vertex)).toBeNull();
    expect(keyToAction(key('PageDown'), vertex)).toBe('next');
    expect(keyToAction(key(' '), vertex)).toBe('next');
    expect(keyToAction(key('PageUp'), vertex)).toBe('prev');
    const control: KeyContext = { ...MID, focus: 'interactive' };
    expect(keyToAction(key(' '), control)).toBeNull();
    expect(keyToAction(key('Enter'), { ...control, atLast: true })).toBeNull();
    expect(keyToAction(key('PageDown'), control)).toBe('next');
  });
});

describe('BB-HOME-09: Stepping past the last slide opens the editor', () => {
  it('turns forward keys and Enter into enter-app on the last slide', () => {
    const last: KeyContext = { active: true, atLast: true, focus: 'none' };
    for (const k of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) expect(keyToAction(key(k), last)).toBe('enter-app');
    expect(keyToAction(key('Enter'), last)).toBe('enter-app');
    expect(keyToAction(key('ArrowLeft'), last)).toBe('prev');
  });
});

describe('BB-HOME-10: Slide indexes clamp and the URL selects the starting slide', () => {
  it('clamps index math and reads ?stage plus the section hash', () => {
    expect(nextIndex(0, 7)).toBe(1);
    expect(nextIndex(6, 7)).toBe(6);
    expect(prevIndex(0)).toBe(0);
    expect(prevIndex(3)).toBe(2);
    expect(clampIndex(-3, 7)).toBe(0);
    expect(clampIndex(99, 7)).toBe(6);
    const ids = ['top', 'problem', 'views', 'curriculum'];
    expect(readStageFromUrl('?stage', '', ids)).toEqual({ active: true, index: 0 });
    expect(readStageFromUrl('?stage', '#curriculum', ids)).toEqual({ active: true, index: 3 });
    expect(readStageFromUrl('?stage=1&x=2', '#nope', ids)).toEqual({ active: true, index: 0 });
    expect(readStageFromUrl('', '#views', ids)).toEqual({ active: false, index: 2 });
    expect(readStageFromUrl('?stages', '', ids).active).toBe(false);
  });
});

describe('BB-HOME-11: Focused elements are classified for key handling', () => {
  it('recognises text fields, vertex handles, controls and everything else', () => {
    document.body.innerHTML =
      '<input id="i"><textarea id="t"></textarea><div id="ce" contenteditable="true"></div>' +
      '<a id="a" href="/x">x</a><button id="b">b</button>' +
      '<svg><g id="v" data-vertex-handle="" tabindex="0" role="button"></g></svg><p id="p">p</p>';
    const el = (id: string) => document.getElementById(id);
    expect(focusKind(null)).toBe('none');
    expect(focusKind(el('i'))).toBe('text');
    expect(focusKind(el('t'))).toBe('text');
    expect(focusKind(el('ce'))).toBe('text');
    expect(focusKind(el('a'))).toBe('interactive');
    expect(focusKind(el('b'))).toBe('interactive');
    expect(focusKind(el('v'))).toBe('vertex');
    expect(focusKind(el('p'))).toBe('none');
    expect(focusKind(document.body)).toBe('none');
    document.body.innerHTML = '';
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: FAIL. The module `@/features/stage-mode/model/stage-controller` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/features/stage-mode/model/stage-controller.ts`:

```ts
/**
 * Stage mode decisions as pure functions: which key does what, where the talk starts,
 * and when a key belongs to the focused element instead of the presenter.
 */
export type StageAction =
  | 'next'
  | 'prev'
  | 'first'
  | 'last'
  | 'exit'
  | 'enter-app'
  | 'theme'
  | 'fullscreen'
  | 'enter-stage';

export type FocusKind = 'text' | 'vertex' | 'interactive' | 'none';

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface KeyContext {
  /** Stage mode is on. */
  active: boolean;
  /** The current slide is the last one. */
  atLast: boolean;
  focus: FocusKind;
}

const ARROWS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']);

export function keyToAction(input: KeyInput, context: KeyContext): StageAction | null {
  if (input.ctrlKey || input.altKey || input.metaKey) return null;
  if (context.focus === 'text') return null;
  const { key } = input;

  if (!context.active) return key === 'p' || key === 'P' ? 'enter-stage' : null;

  // A focused vertex handle uses the arrows to move itself; clickers send PageUp/PageDown.
  if (context.focus === 'vertex' && ARROWS.has(key)) return null;

  let forward: boolean;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
      forward = true;
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      forward = false;
      break;
    case ' ':
      // Space activates a focused link or button; leave that to the browser.
      if (context.focus === 'interactive') return null;
      forward = !input.shiftKey;
      break;
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Escape':
      return 'exit';
    case 't':
    case 'T':
      return 'theme';
    case 'f':
    case 'F':
      return 'fullscreen';
    case 'Enter':
      return context.atLast && context.focus === 'none' ? 'enter-app' : null;
    default:
      return null;
  }
  if (!forward) return 'prev';
  return context.atLast ? 'enter-app' : 'next';
}

export function clampIndex(index: number, count: number): number {
  return Math.min(count - 1, Math.max(0, index));
}

export function nextIndex(current: number, count: number): number {
  return clampIndex(current + 1, count);
}

export function prevIndex(current: number): number {
  return Math.max(0, current - 1);
}

export function readStageFromUrl(search: string, hash: string, sectionIds: readonly string[]) {
  const active = new URLSearchParams(search).has('stage');
  const found = sectionIds.indexOf(hash.replace(/^#/, ''));
  return { active, index: found >= 0 ? found : 0 };
}

export function focusKind(el: Element | null): FocusKind {
  if (!el) return 'none';
  if (el.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return 'text';
  if (el.closest('[data-vertex-handle]')) return 'vertex';
  if (el.matches('a[href], button, [role="button"], summary')) return 'interactive';
  return 'none';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/stage-mode/model/stage-controller.ts tests/black-box/home-stage.test.ts
git diff --staged
git commit -m "feat(stage-mode): add key, index and URL logic for presenting the home page"
```

Expected: 282 tests pass.

---

### Task 3: Home content and structured data

**Files:**
- Create: `src/pages/home/model/content.ts`
- Modify: `src/app/seo/head.ts`
- Modify: `tests/black-box/home-stage.test.ts` (append)

**Interfaces:**
- Produces (all consumed by Tasks 5 and 6):
  - `SECTIONS: readonly HomeSection[]` with `{ id; label }`, in slide order: `top`, `problem`, `views`, `curriculum`, `under-the-hood`, `team`, `try`.
  - `PROBLEM { title; points: { term; text }[] }`
  - `VIEWS { title; subhead; caption }`
  - `CURRICULUM { title; sections: { name; summary; calls[] }[]; modes: { name; text }[] }`
  - `UNDER_THE_HOOD { title; blocks: { term; text }[]; stack: string[] }`
  - `TEAM { name; program; members: TeamMember[] }`, where `TeamMember` is `{ name; credit; role: 'member' | 'adviser' }`
  - `TRY_IT { title; cta; note; displayUrl }`
- `softwareApplicationJsonLd(siteUrl)` gains `author` (the members as `Person`) and `contributor` (the adviser as `Person`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/home-stage.test.ts`:

```ts
import { SECTIONS, PROBLEM, VIEWS, CURRICULUM, UNDER_THE_HOOD, TEAM, TRY_IT } from '@/pages/home/model/content';
import { DEFAULT_SITE_URL, findRouteMeta } from '@/app/routes/route-meta';
import { buildHead } from '@/app/seo/head';

describe('BB-HOME-12: Home content is complete and follows the copy rules', () => {
  it('orders the seven sections, names the five curriculum sections and avoids banned words', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['top', 'problem', 'views', 'curriculum', 'under-the-hood', 'team', 'try']);
    expect(CURRICULUM.sections.map((s) => s.name)).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
    expect(DEFAULT_SITE_URL).toBe(`https://${TRY_IT.displayUrl}`);
    const text = JSON.stringify({ SECTIONS, PROBLEM, VIEWS, CURRICULUM, UNDER_THE_HOOD, TEAM, TRY_IT }).toLowerCase();
    for (const word of BANNED) expect(text).not.toContain(word);
  });
});

describe('BB-HOME-13: The home page structured data credits the team', () => {
  it('lists the three members as authors and the adviser as contributor', () => {
    const elements = [...buildHead(findRouteMeta('/'), 'https://example.test').elements];
    const script = elements.find((e) => e.type === 'script' && e.props.type === 'application/ld+json');
    const jsonLd = JSON.parse(script!.props.children);
    expect(jsonLd.author).toEqual([
      { '@type': 'Person', name: 'Mikhael Edman P. Gomez' },
      { '@type': 'Person', name: 'Justine Jhigz D. Vizco' },
      { '@type': 'Person', name: 'Johann Patrick S. Taguiam' },
    ]);
    expect(jsonLd.contributor).toEqual({ '@type': 'Person', name: 'Elisa V. Malasaga' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: FAIL. The module `@/pages/home/model/content` cannot be resolved.

- [ ] **Step 3: Write the content module**

Create `src/pages/home/model/content.ts`:

```ts
/**
 * Copy and structured data for the home page. This module has no imports, because the SEO head
 * builder, which the Vite config loads, reads TEAM from it through a relative import.
 */
export interface HomeSection {
  id: string;
  /** Short name used in the section eyebrow and announced by the stage indicator. */
  label: string;
}

export const SECTIONS: readonly HomeSection[] = [
  { id: 'top', label: 'VAMS' },
  { id: 'problem', label: 'The problem' },
  { id: 'views', label: 'Three views' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'under-the-hood', label: 'Under the hood' },
  { id: 'team', label: 'Team' },
  { id: 'try', label: 'Try it' },
];

export const PROBLEM = {
  title: "OpenGL is taught as code you can't see.",
  points: [
    {
      term: 'Setup before shapes.',
      text: 'A compiler, a GLUT install and a build script stand between a student and their first triangle.',
    },
    {
      term: 'Cause and effect, delayed.',
      text: 'Every change means edit, compile, run, then work out which line did what.',
    },
    {
      term: 'The math stays hidden.',
      text: 'Coordinates, colour values and matrices are applied out of sight.',
    },
  ],
};

export const VIEWS = {
  title: 'One scene, three views.',
  subhead: 'Drag a vertex. The code and the math follow.',
  caption: "This is VAMS's own code generator, running on this page.",
};

export const CURRICULUM = {
  title: 'Five sections, one pipeline.',
  sections: [
    {
      name: 'Pipeline',
      summary: 'The rendering pipeline, rasterization, normalized device coordinates and the GLUT program structure.',
      calls: ['glutInit', 'glutDisplayFunc', 'glutMainLoop'],
    },
    {
      name: 'Primitives',
      summary: 'glBegin and glEnd primitives, colour, line styles, bitmap text and GLUT callbacks.',
      calls: ['glBegin', 'glColor3f', 'glLineStipple'],
    },
    {
      name: 'Buffers',
      summary: 'Immediate mode, vertex arrays and VBOs, side by side.',
      calls: ['glVertexPointer', 'glBufferData', 'glDrawElements'],
    },
    {
      name: 'Transforms',
      summary: 'Translate, rotate and scale, the matrix stack and glOrtho.',
      calls: ['glTranslatef', 'glRotatef', 'glPushMatrix'],
    },
    {
      name: 'Textures',
      summary: 'Texture objects, UV coordinates, filtering and wrapping.',
      calls: ['glBindTexture', 'glTexParameteri', 'glTexCoord2f'],
    },
  ],
  modes: [
    { name: 'Author', text: 'Build freely. The code follows every change.' },
    { name: 'Lesson', text: 'Guided steps and exercises that check your scene.' },
  ],
};

export const UNDER_THE_HOOD = {
  title: 'Built like the thing it teaches.',
  blocks: [
    {
      term: 'One-way data flow',
      text: 'Every action updates one store, and the canvas, code and math recompute from it. Views only read.',
    },
    {
      term: 'Code is a pure function of the scene',
      text: 'The same scene always produces byte-identical C++.',
    },
    {
      term: 'Verified',
      text: 'More than 270 automated tests, with the matrix math checked against an independent reference implementation.',
    },
  ],
  stack: ['Preact', 'TypeScript', 'Zustand + Immer', 'PixiJS 8', 'Vitest'],
};

export interface TeamMember {
  name: string;
  credit: string;
  role: 'member' | 'adviser';
}

export const TEAM: { name: string; program: string; members: readonly TeamMember[] } = {
  name: 'Panic@TheCisco',
  program: 'BS Computer Science, Software Engineering · FEU Institute of Technology',
  members: [
    { name: 'Mikhael Edman P. Gomez', credit: 'Primary Developer & Designer · Research & Documentation', role: 'member' },
    { name: 'Justine Jhigz D. Vizco', credit: 'Thesis Leader · Research, Documentation & QA', role: 'member' },
    { name: 'Johann Patrick S. Taguiam', credit: 'Research, Documentation & QA', role: 'member' },
    { name: 'Elisa V. Malasaga', credit: 'Thesis Adviser', role: 'adviser' },
  ],
};

export const TRY_IT = {
  title: 'Try it.',
  cta: 'Open the app',
  note: 'Runs in your desktop browser. Nothing to install.',
  /** Must match DEFAULT_SITE_URL in src/app/routes/route-meta.ts (checked by BB-HOME-12). */
  displayUrl: 'panic-vams.netlify.app',
};
```

- [ ] **Step 4: Add the team to the JSON-LD**

In `src/app/seo/head.ts`, add the import below the existing one:

```ts
import { TEAM } from '../../pages/home/model/content';
```

Replace `softwareApplicationJsonLd` with:

```ts
export function softwareApplicationJsonLd(siteUrl: string) {
  const person = (name: string) => ({ '@type': 'Person', name });
  const adviser = TEAM.members.find((member) => member.role === 'adviser');
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    alternateName: 'Visual Animation Modeling Simulator',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: absoluteUrl(siteUrl, '/'),
    description:
      'A GUI-only teaching simulator for OpenGL 1.5: build 2D scenes by hand and read the generated C++ code and the math behind it.',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: TEAM.members.filter((member) => member.role === 'member').map((member) => person(member.name)),
    ...(adviser ? { contributor: person(adviser.name) } : {}),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/home-stage.test.ts tests/black-box/site-shell.test.ts`
Expected: PASS. The suite still has 13 home tests, and BB-SITE-09 still passes.

- [ ] **Step 6: Run all checks and commit**

`npm run build` also proves the Vite config can still load `head.ts` through the new relative import.

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/home/model/content.ts src/app/seo/head.ts tests/black-box/home-stage.test.ts
git diff --staged
git commit -m "feat(home): add landing page copy and credit the team in structured data"
```

Expected: 284 tests pass.

---

### Task 4: Vertex demo component

**Files:**
- Create: `src/pages/home/ui/VertexDemo.tsx`
- Create: `src/pages/home/ui/vertex-demo.scss`
- Modify: `tests/black-box/home-stage.test.ts` (append)

**Interfaces:**
- Consumes:
  - From Task 1: `GRID_STEP`, `INITIAL_TRIANGLE`, `generateDemoCode`, `glToPixel`, `pixelToGl`, `replaceVertex`, `snapToGrid`, and the `DemoTriangle` / `DemoVertex` types.
  - From Task 3: `VIEWS.caption`.
- Produces: `export default function VertexDemo()`, a `<figure className="vertex-demo">`. Each handle is an SVG `<g data-vertex-handle tabIndex={0} role="button">`. The selected code line has the class `vertex-demo__line--selected`.

- [ ] **Step 1: Write the failing test**

Append to `tests/black-box/home-stage.test.ts`:

```ts
import { h, render } from 'preact';
import VertexDemo from '@/pages/home/ui/VertexDemo';

async function settle() {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('BB-HOME-14: Moving a vertex with the keyboard updates its label and code line', () => {
  it('steps by one grid unit, by four with Shift, and highlights the moved vertex line', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(VertexDemo, {}), host);
    await settle();
    const selectedLine = () => host.querySelector('.vertex-demo__line--selected')?.textContent;
    expect(selectedLine()).toBe('    glVertex2f(0.0000f, 0.5000f);');

    const handle = host.querySelectorAll('[data-vertex-handle]')[0];
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    expect(handle.getAttribute('aria-label')).toBe('Vertex 1 at x -0.45, y -0.50');
    expect(selectedLine()).toBe('    glVertex2f(-0.4500f, -0.5000f);');

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
    await settle();
    expect(selectedLine()).toBe('    glVertex2f(-0.4500f, -0.3000f);');

    render(null, host);
    host.remove();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: FAIL. The module `@/pages/home/ui/VertexDemo` cannot be resolved.

- [ ] **Step 3: Write the component**

Create `src/pages/home/ui/VertexDemo.tsx`:

```tsx
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { VIEWS } from '@/pages/home/model/content';
import {
  GRID_STEP,
  INITIAL_TRIANGLE,
  generateDemoCode,
  glToPixel,
  pixelToGl,
  replaceVertex,
  snapToGrid,
  type DemoTriangle,
  type DemoVertex,
} from '@/pages/home/model/demo-code';
import './vertex-demo.scss';

/** The drawing is VIEW × VIEW SVG units, framed by PAD units so handles at the edge stay whole. */
const VIEW = 300;
const PAD = 22;
const BOX = VIEW + PAD * 2;
const GRID_LINES = Array.from({ length: 21 }, (_, i) => -1 + i * 0.1);
const KEY_STEPS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

function formatPixel(n: number) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function vertexLabel(index: number, v: DemoVertex) {
  return `Vertex ${index + 1} at x ${v.x.toFixed(2)}, y ${v.y.toFixed(2)}`;
}

/** Colour the leading function name the same way the hero figure does. */
function renderCodeLine(line: string) {
  const match = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(.*)$/.exec(line);
  if (!match) return line;
  return (
    <>
      {match[1]}
      <span className="tok-fn">{match[2]}</span>
      {match[3]}
    </>
  );
}

export default function VertexDemo() {
  const [vertices, setVertices] = useState<DemoTriangle>(INITIAL_TRIANGLE);
  const [selected, setSelected] = useState(2);
  const code = useMemo(() => generateDemoCode(vertices), [vertices]);

  const rootRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const leaderRef = useRef<SVGPathElement>(null);
  const handleRefs = useRef<(SVGGElement | null)[]>([]);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dragRef = useRef<number | null>(null);

  function eventToVertex(e: PointerEvent): DemoVertex | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return null;
    // viewBox units equal drawing pixels, so the inverse screen matrix gives the drawing position directly.
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const gl = pixelToGl(point.x, point.y, VIEW, VIEW);
    return { x: snapToGrid(gl.x), y: snapToGrid(gl.y) };
  }

  function onHandlePointerDown(index: number, e: PointerEvent) {
    e.preventDefault();
    dragRef.current = index;
    setSelected(index);
    handleRefs.current[index]?.focus();
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    const index = dragRef.current;
    if (index === null) return;
    const next = eventToVertex(e);
    if (next) setVertices((prev) => replaceVertex(prev, index, next));
  }

  function endDrag(e: PointerEvent) {
    if (dragRef.current === null) return;
    dragRef.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  }

  function onHandleKeyDown(index: number, e: KeyboardEvent) {
    const step = KEY_STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const size = GRID_STEP * (e.shiftKey ? 4 : 1);
    setSelected(index);
    setVertices((prev) =>
      replaceVertex(prev, index, {
        x: snapToGrid(prev[index].x + step[0] * size),
        y: snapToGrid(prev[index].y + step[1] * size),
      }),
    );
  }

  // The leader runs from the selected vertex to its code line. It is drawn by writing the path
  // directly (no state), and it is left empty when the code sits below the drawing.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const path = leaderRef.current;
    if (!root || !path) return;
    const update = () => {
      const handle = handleRefs.current[selected]?.getBoundingClientRect();
      const line = lineRefs.current[code.vertexLineIndexes[selected]]?.getBoundingClientRect();
      const frame = root.getBoundingClientRect();
      if (!handle || !line || frame.width === 0) {
        path.setAttribute('d', '');
        return;
      }
      const x1 = handle.left + handle.width / 2 - frame.left;
      const y1 = handle.top + handle.height / 2 - frame.top;
      const x2 = line.left - frame.left - 8;
      const y2 = line.top + line.height / 2 - frame.top;
      if (x2 - x1 < 24) {
        path.setAttribute('d', '');
        return;
      }
      const bend = (x2 - x1) * 0.45;
      path.setAttribute('d', `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(root);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [selected, code]);

  const current = vertices[selected];
  const currentPx = glToPixel(current.x, current.y, VIEW, VIEW);
  const points = vertices
    .map((v) => {
      const p = glToPixel(v.x, v.y, VIEW, VIEW);
      return `${p.px},${p.py}`;
    })
    .join(' ');
  // Keep the coordinate tag inside the drawing: flip it right near the left edge, below near the top.
  const tagX = currentPx.px < 90 ? 12 : -82;
  const tagY = currentPx.py < 40 ? 14 : -34;

  return (
    <figure className="vertex-demo" ref={rootRef}>
      <div className="vertex-demo__grid">
        <div className="vertex-demo__part vertex-demo__part--canvas">
          <p className="vertex-demo__label">Canvas</p>
          <svg
            ref={svgRef}
            className="vertex-demo__svg"
            viewBox={`${-PAD} ${-PAD} ${BOX} ${BOX}`}
            role="group"
            aria-label="Triangle with three movable vertices"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <g aria-hidden="true">
              {GRID_LINES.map((t, i) => {
                const p = glToPixel(t, t, VIEW, VIEW);
                return (
                  <g key={i} className={i % 5 === 0 ? 'vertex-demo__gridline vertex-demo__gridline--major' : 'vertex-demo__gridline'}>
                    <line x1={p.px} y1={0} x2={p.px} y2={VIEW} />
                    <line x1={0} y1={p.py} x2={VIEW} y2={p.py} />
                  </g>
                );
              })}
              <g className="vertex-demo__axis">
                <line x1={VIEW / 2} y1={0} x2={VIEW / 2} y2={VIEW} />
                <line x1={0} y1={VIEW / 2} x2={VIEW} y2={VIEW / 2} />
              </g>
              <polygon className="vertex-demo__fill" points={points} />
              <polygon className="vertex-demo__edge" points={points} />
            </g>
            {vertices.map((v, i) => {
              const p = glToPixel(v.x, v.y, VIEW, VIEW);
              return (
                <g
                  key={i}
                  ref={(el) => {
                    handleRefs.current[i] = el;
                  }}
                  className="vertex-demo__handle"
                  data-vertex-handle=""
                  transform={`translate(${p.px} ${p.py})`}
                  tabIndex={0}
                  role="button"
                  aria-label={vertexLabel(i, v)}
                  aria-describedby="vertex-demo-hint"
                  aria-pressed={i === selected}
                  onPointerDown={(e) => onHandlePointerDown(i, e)}
                  onKeyDown={(e) => onHandleKeyDown(i, e)}
                  onFocus={() => setSelected(i)}
                >
                  <circle className="vertex-demo__hit" r={16} />
                  <circle className="vertex-demo__focus" r={13} />
                  {i === selected && <circle className="vertex-demo__ring" r={10} />}
                  <circle className={`vertex-demo__dot vertex-demo__dot--${i}`} r={6} />
                </g>
              );
            })}
            <g className="vertex-demo__tag" transform={`translate(${currentPx.px} ${currentPx.py})`} aria-hidden="true">
              <rect x={tagX} y={tagY} width={70} height={20} />
              <text x={tagX + 35} y={tagY + 14} text-anchor="middle">
                ({current.x.toFixed(2)}, {current.y.toFixed(2)})
              </text>
            </g>
          </svg>
          <p id="vertex-demo-hint" className="vertex-demo__hint">
            Drag a vertex, or focus one and use the arrow keys. Hold Shift for bigger steps.
          </p>
        </div>

        <div className="vertex-demo__part vertex-demo__part--code">
          <p className="vertex-demo__label" id="vertex-demo-code-label">Code</p>
          <pre className="vertex-demo__code" aria-labelledby="vertex-demo-code-label">
            <code>
              {code.lines.map((line, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  className={
                    i === code.vertexLineIndexes[selected] ? 'vertex-demo__line vertex-demo__line--selected' : 'vertex-demo__line'
                  }
                >
                  {renderCodeLine(line)}
                </span>
              ))}
            </code>
          </pre>
        </div>

        <div className="vertex-demo__part vertex-demo__part--math">
          <p className="vertex-demo__label">Math</p>
          <dl className="vertex-demo__math">
            <div>
              <dt>Vertex</dt>
              <dd>{selected + 1} of 3</dd>
            </div>
            <div>
              <dt>Pixel</dt>
              <dd>
                ({formatPixel(currentPx.px)}, {formatPixel(currentPx.py)}) in a {VIEW} × {VIEW} view
              </dd>
            </div>
            <div>
              <dt>x</dt>
              <dd>
                2 · {formatPixel(currentPx.px)} / {VIEW} − 1 = <strong>{current.x.toFixed(2)}</strong>
              </dd>
            </div>
            <div>
              <dt>y</dt>
              <dd>
                1 − 2 · {formatPixel(currentPx.py)} / {VIEW} = <strong>{current.y.toFixed(2)}</strong>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <svg className="vertex-demo__leader" aria-hidden="true" focusable="false">
        <path ref={leaderRef} />
      </svg>
      <figcaption className="vertex-demo__caption">{VIEWS.caption}</figcaption>
    </figure>
  );
}
```

- [ ] **Step 4: Write the styles**

Create `src/pages/home/ui/vertex-demo.scss`:

```scss
.vertex-demo {
  position: relative;
  margin: 0;

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    grid-template-areas:
      'canvas code'
      'canvas math';
    gap: var(--space-5) var(--space-7);
    align-items: start;
  }
  &__part--canvas { grid-area: canvas; }
  &__part--code { grid-area: code; }
  &__part--math { grid-area: math; }

  &__label {
    margin: 0 0 var(--space-2);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  &__svg {
    display: block;
    width: 100%;
    max-width: 34rem;
    height: auto;
    aspect-ratio: 1;
    overflow: visible;
    touch-action: none;
    border: 1.5px solid var(--ink);
    background: var(--paper-raised);
  }
  &__gridline line { stroke: var(--grid-minor); stroke-width: 1; }
  &__gridline--major line { stroke: var(--grid-major); }
  &__axis line {
    stroke: var(--ink-faint);
    stroke-width: 1;
    stroke-dasharray: 10 3 2 3;
  }
  &__fill { fill: rgba(var(--accent-rgb), 0.12); }
  &__edge { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; }

  &__handle {
    cursor: grab;
    outline: none;
    &:active { cursor: grabbing; }
  }
  &__hit { fill: transparent; }
  &__focus { fill: none; stroke: transparent; stroke-width: 2.5; }
  &__handle:focus-visible &__focus { stroke: var(--focus-ring); }
  &__ring { fill: none; stroke: var(--accent); stroke-width: 2; }
  &__dot { stroke: var(--paper-raised); stroke-width: 2; }
  &__dot--0 { fill: var(--channel-r); }
  &__dot--1 { fill: var(--channel-g); }
  &__dot--2 { fill: var(--channel-b); }

  &__tag {
    pointer-events: none;
    rect { fill: var(--accent); }
    text {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      fill: var(--on-accent);
    }
  }

  &__hint {
    max-width: 34rem;
    margin: var(--space-3) 0 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--ink-muted);
  }

  &__code {
    margin: 0;
    padding: var(--space-4) 0;
    border: 1.5px solid var(--ink);
    background: var(--code-bg);
    color: var(--code-ink);
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    line-height: 1.75;
    overflow-x: auto;
    .tok-fn { color: var(--code-fn); }
  }
  &__line {
    display: block;
    padding: 0 var(--space-4);
    white-space: pre;
  }
  &__line--selected {
    background: var(--accent);
    color: var(--on-accent);
    .tok-fn { color: inherit; }
  }

  &__math {
    display: grid;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    > div {
      display: grid;
      grid-template-columns: 4.5rem minmax(0, 1fr);
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--rule);
    }
    dt {
      font-size: 0.75rem;
      line-height: 1.9;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    dd { margin: 0; }
    strong { color: var(--ink); }
  }

  &__leader {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
    path { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 4 3; }
  }

  &__caption {
    max-width: 36rem;
    margin-top: var(--space-5);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.6;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
}

/* A thin orange wash turns muddy on navy, so blueprint shades the shape with the grid ink instead. */
[data-theme='blueprint'] .vertex-demo__fill { fill: var(--grid-major); }

@media (max-width: 900px) {
  .vertex-demo__grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'canvas' 'code' 'math';
  }
  .vertex-demo__svg { max-width: 26rem; }
  .vertex-demo__leader { display: none; }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Check it in the browser**

Mount `VertexDemo` temporarily, or wait for Task 5, which mounts it. Check:
- **Mouse:** dragging a vertex updates the code, the math and the leader line.
- **Keyboard:** Tab moves focus to each handle, which shows a visible focus ring, and the arrow keys move it.
- **Themes:** take screenshots at 1440 px and 390 px wide, in both themes.

If you mounted the demo temporarily, revert that before committing.

- [ ] **Step 7: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/home/ui/VertexDemo.tsx src/pages/home/ui/vertex-demo.scss tests/black-box/home-stage.test.ts
git diff --staged
git commit -m "feat(home): add the interactive vertex demo with live code and math"
```

Expected: 285 tests pass.

---

### Task 5: Home sections and page composition

**Files:**
- Create in `src/pages/home/ui/sections/`: `SectionHeading.tsx`, `HeroSection.tsx`, `ProblemSection.tsx`, `ViewsSection.tsx`, `CurriculumSection.tsx`, `UnderTheHoodSection.tsx`, `TeamSection.tsx`, `TryItSection.tsx`, `sections.scss`
- Modify: `src/pages/home/ui/HomePage.tsx`
- Modify: `src/pages/home/ui/home.scss`: drop the `__views`, `__section-title` and `__view-list` rules, and change both `max-width: 1200px` to `75rem`.
- Modify: `src/widgets/site-footer/ui/SiteFooter.tsx`, `site-footer.scss` (optional `actions` slot)
- Modify: `tests/black-box/home-stage.test.ts` (append)

**Interfaces:**
- Consumes: Task 3 content and Task 4 `VertexDemo`.
- Produces:
  - Every section is `<section id={id} data-slide="" aria-labelledby={`${id}-title`}>`. The hero keeps `aria-labelledby="home-title"`.
  - `SiteFooter({ actions?: ComponentChildren })`.
  - `HomePage` keeps `<main id="main" className="home">`, which BB-SITE-15 checks.

- [ ] **Step 1: Write the failing test**

Append to `tests/black-box/home-stage.test.ts`:

```ts
import { prerender } from '@/app/prerender';

describe('BB-HOME-15: The prerendered home page carries every section of the talk', () => {
  it('renders the seven slides in order with the team, the stack line and the demo code', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    const positions = SECTIONS.map((s) => html.indexOf(`id="${s.id}"`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html.match(/data-slide(?:="")?[\s>]/g)?.length).toBe(7);
    for (const member of TEAM.members) expect(html).toContain(member.name);
    expect(html).toContain(UNDER_THE_HOOD.stack.join(' · '));
    expect(html).toContain('glVertex2f(0.0000f, 0.5000f);');
    const text = html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .toLowerCase();
    for (const word of BANNED) expect(text).not.toContain(word);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: FAIL. `id="problem"` is not found.

- [ ] **Step 3: Write the sections**

`src/pages/home/ui/sections/SectionHeading.tsx`:

```tsx
import { SECTIONS } from '@/pages/home/model/content';

interface SectionHeadingProps {
  id: string;
  title: string;
  subhead?: string;
}

/** Title strip shared by every section after the hero: a sheet number, the section label, then the heading. */
export default function SectionHeading({ id, title, subhead }: SectionHeadingProps) {
  const index = SECTIONS.findIndex((section) => section.id === id);
  return (
    <header className="home-section__head">
      <p className="home-section__eyebrow">
        <span className="home-section__sheet">{String(index + 1).padStart(2, '0')}</span>
        {SECTIONS[index].label}
      </p>
      <h2 id={`${id}-title`} className="home-section__title">
        {title}
      </h2>
      {subhead && <p className="home-section__subhead">{subhead}</p>}
    </header>
  );
}
```

`src/pages/home/ui/sections/HeroSection.tsx`. This is the existing hero markup, moved, with `id` and `data-slide` added:

```tsx
import HeroFigure from '../HeroFigure';

export default function HeroSection() {
  return (
    <section id="top" className="home__hero" data-slide="" aria-labelledby="home-title">
      <div className="home__copy">
        <p className="home__eyebrow">OpenGL 1.5 · 2D · in your browser</p>
        <h1 id="home-title" className="home__title">
          Every shape is a <em>program.</em>
        </h1>
        <p className="home__lede">
          Draw a triangle and VAMS writes the OpenGL that draws it, then shows the math underneath.
          No compiler, no setup: just the concept.
        </p>
        <p className="home__actions">
          <a className="home__cta" href="/app">Open the app</a>
        </p>
      </div>
      <HeroFigure />
    </section>
  );
}
```

`src/pages/home/ui/sections/ProblemSection.tsx`:

```tsx
import { PROBLEM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function ProblemSection() {
  return (
    <section id="problem" className="home-section" data-slide="" aria-labelledby="problem-title">
      <SectionHeading id="problem" title={PROBLEM.title} />
      <ol className="problem-list">
        {PROBLEM.points.map((point) => (
          <li key={point.term}>
            <strong>{point.term}</strong> {point.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

`src/pages/home/ui/sections/ViewsSection.tsx`:

```tsx
import { VIEWS } from '@/pages/home/model/content';
import VertexDemo from '../VertexDemo';
import SectionHeading from './SectionHeading';

export default function ViewsSection() {
  return (
    <section id="views" className="home-section" data-slide="" aria-labelledby="views-title">
      <SectionHeading id="views" title={VIEWS.title} subhead={VIEWS.subhead} />
      <VertexDemo />
    </section>
  );
}
```

`src/pages/home/ui/sections/CurriculumSection.tsx`:

```tsx
import { CURRICULUM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function CurriculumSection() {
  return (
    <section id="curriculum" className="home-section" data-slide="" aria-labelledby="curriculum-title">
      <SectionHeading id="curriculum" title={CURRICULUM.title} />
      <ol className="curriculum-list">
        {CURRICULUM.sections.map((section, i) => (
          <li key={section.name}>
            <span className="curriculum-list__number">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="curriculum-list__name">{section.name}</h3>
            <p className="curriculum-list__summary">{section.summary}</p>
            <ul className="curriculum-list__calls" aria-label={`Key calls in ${section.name}`}>
              {section.calls.map((call) => (
                <li key={call}>
                  <code>{call}</code>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <dl className="mode-list">
        {CURRICULUM.modes.map((mode) => (
          <div key={mode.name}>
            <dt>{mode.name}</dt>
            <dd>{mode.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
```

`src/pages/home/ui/sections/UnderTheHoodSection.tsx`:

```tsx
import { UNDER_THE_HOOD } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function UnderTheHoodSection() {
  return (
    <section id="under-the-hood" className="home-section" data-slide="" aria-labelledby="under-the-hood-title">
      <SectionHeading id="under-the-hood" title={UNDER_THE_HOOD.title} />
      <dl className="hood-list">
        {UNDER_THE_HOOD.blocks.map((block) => (
          <div key={block.term}>
            <dt>{block.term}</dt>
            <dd>{block.text}</dd>
          </div>
        ))}
      </dl>
      <p className="hood-stack">{UNDER_THE_HOOD.stack.join(' · ')}</p>
    </section>
  );
}
```

`src/pages/home/ui/sections/TeamSection.tsx`:

```tsx
import { TEAM } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function TeamSection() {
  return (
    <section id="team" className="home-section" data-slide="" aria-labelledby="team-title">
      <SectionHeading id="team" title={`${TEAM.name}.`} subhead={TEAM.program} />
      <dl className="team-list">
        {TEAM.members.map((member) => (
          <div key={member.name}>
            <dt>{member.name}</dt>
            <dd>{member.credit}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
```

`src/pages/home/ui/sections/TryItSection.tsx`:

```tsx
import { TRY_IT } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function TryItSection() {
  return (
    <section id="try" className="home-section home-section--try" data-slide="" aria-labelledby="try-title">
      <SectionHeading id="try" title={TRY_IT.title} />
      <p className="home__actions">
        <a className="home__cta home__cta--large" href="/app">{TRY_IT.cta}</a>
      </p>
      <p className="try-url">{TRY_IT.displayUrl}</p>
      <p className="try-note">{TRY_IT.note}</p>
    </section>
  );
}
```

- [ ] **Step 4: Compose the page and add the footer slot**

Replace `src/pages/home/ui/HomePage.tsx`:

```tsx
import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import HeroSection from './sections/HeroSection';
import ProblemSection from './sections/ProblemSection';
import ViewsSection from './sections/ViewsSection';
import CurriculumSection from './sections/CurriculumSection';
import UnderTheHoodSection from './sections/UnderTheHoodSection';
import TeamSection from './sections/TeamSection';
import TryItSection from './sections/TryItSection';
import './home.scss';
import './sections/sections.scss';

export default function HomePage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main id="main" className="home">
        <HeroSection />
        <ProblemSection />
        <ViewsSection />
        <CurriculumSection />
        <UnderTheHoodSection />
        <TeamSection />
        <TryItSection />
      </main>
      <SiteFooter />
    </div>
  );
}
```

In `src/widgets/site-footer/ui/SiteFooter.tsx`:
- add `import type { ComponentChildren } from 'preact';`
- change the signature to `export default function SiteFooter({ actions }: { actions?: ComponentChildren }) {`
- add `{actions && <div className="site-footer__actions">{actions}</div>}` after the links paragraph.

In `site-footer.scss`, add `.site-footer__actions { grid-column: 1 / -1; }`, so the slot takes a full row in both the two-column and the stacked layout.

- [ ] **Step 5: Write the section styles**

Create `src/pages/home/ui/sections/sections.scss`:

```scss
/* Every section after the hero shares one frame: a title strip with a sheet number, then content. */
.home-section {
  max-width: 75rem;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
  border-top: 1.5px solid var(--rule);

  &__head { margin-bottom: var(--space-6); }
  &__eyebrow {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0 0 var(--space-3);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  &__sheet {
    padding: 0.1em 0.5em;
    border: 1.5px solid var(--ink);
    font-weight: 700;
    color: var(--ink);
  }
  &__title {
    max-width: 22ch;
    margin: 0;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: clamp(2rem, 4.2vw, 3.25rem);
    line-height: 1.08;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
  &__subhead {
    max-width: 40rem;
    margin: var(--space-3) 0 0;
    font-size: 1.125rem;
    line-height: 1.55;
    color: var(--ink-muted);
  }
}

.problem-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: problem;
  > li {
    padding-top: var(--space-4);
    border-top: 3px solid var(--ink);
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--ink-muted);
    counter-increment: problem;
    &::before {
      content: counter(problem, decimal-leading-zero);
      display: block;
      margin-bottom: var(--space-3);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      color: var(--ink-muted);
    }
  }
  strong {
    display: block;
    margin-bottom: var(--space-2);
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--ink);
  }
}

.curriculum-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1.5px solid var(--ink);
  background: var(--paper-raised);
  > li {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-4);
    border-left: 1.5px solid var(--ink);
    &:first-child { border-left: 0; }
  }
  &__number {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
  }
  &__name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.2;
  }
  &__summary {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--ink-muted);
  }
  &__calls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin: auto 0 0;
    padding: 0;
    list-style: none;
    code {
      display: inline-block;
      padding: 0.15em 0.4em;
      background: var(--code-bg);
      color: var(--code-ink);
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }
  }
}

.mode-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-6);
  margin: var(--space-6) 0 0;
  > div {
    padding-left: var(--space-4);
    border-left: 3px solid var(--accent);
  }
  dt {
    font-family: var(--font-mono);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  dd {
    margin: var(--space-2) 0 0;
    line-height: 1.55;
    color: var(--ink-muted);
  }
}

.hood-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
  margin: 0;
  > div {
    padding: var(--space-5);
    border: 1.5px solid var(--ink);
    background: var(--paper-raised);
  }
  dt {
    font-family: var(--font-display);
    font-size: 1.375rem;
    font-weight: 600;
    line-height: 1.25;
  }
  dd {
    margin: var(--space-3) 0 0;
    line-height: 1.6;
    color: var(--ink-muted);
  }
}

.hood-stack {
  margin: var(--space-6) 0 0;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}

.team-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5) var(--space-7);
  margin: 0;
  > div {
    padding-top: var(--space-4);
    border-top: 1.5px solid var(--ink);
  }
  dt {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.25;
  }
  dd {
    margin: var(--space-2) 0 0;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
}

.home__cta--large {
  min-height: 64px;
  font-size: 1.25rem;
}

.try-url {
  display: inline-block;
  margin: var(--space-5) 0 0;
  padding-bottom: 2px;
  border-bottom: 1.5px solid var(--ink);
  font-family: var(--font-mono);
  font-size: 1.125rem;
  letter-spacing: 0.04em;
}

.try-note {
  margin: var(--space-4) 0 0;
  color: var(--ink-muted);
}

@media (max-width: 900px) {
  .problem-list,
  .hood-list,
  .mode-list,
  .team-list { grid-template-columns: minmax(0, 1fr); }
  .curriculum-list {
    grid-template-columns: minmax(0, 1fr);
    > li {
      border-left: 0;
      border-top: 1.5px solid var(--ink);
      &:first-child { border-top: 0; }
    }
  }
}

@media (max-width: 640px) {
  .home-section { padding: var(--space-7) var(--space-4); }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/home-stage.test.ts tests/black-box/site-shell.test.ts`
Expected: PASS. BB-SITE-15 still finds `class="home"`, and BB-HOME-15 passes.

- [ ] **Step 7: Check it in the browser**

Run `npm run build && npm run preview`, then check:
- `/` at 1440 px and 390 px, in both themes. Screenshot every section.
- **Contrast:** text against its background meets 4.5:1.
- **Keyboard:** Tab reaches every link and vertex handle, each with a visible focus indicator.
- The footer still lays out correctly on `/` and `/404`.

- [ ] **Step 8: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/home/ui src/widgets/site-footer/ui tests/black-box/home-stage.test.ts
git diff --staged
git commit -m "feat(home): add the problem, views, curriculum, under-the-hood, team and try-it sections"
```

`git add src/pages/home/ui` stages only files inside that directory, which is explicit enough. Check the staged diff for strays anyway.

Expected: 286 tests pass.

---

### Task 6: Stage mode

**Files:**
- Create: `src/features/stage-mode/model/useStageMode.ts`
- Create: `src/features/stage-mode/ui/StageIndicator.tsx`, `src/features/stage-mode/ui/PresentButton.tsx`, `src/features/stage-mode/ui/stage-mode.scss`
- Create: `src/features/stage-mode/index.ts`
- Create: `src/pages/home/ui/home-stage.scss`
- Modify: `src/pages/home/ui/HomePage.tsx`
- Modify: `index.html`
- Modify: `tests/black-box/home-stage.test.ts` (append)

**Interfaces:**
- Consumes:
  - From Task 2: the controller functions.
  - From Task 3: `SECTIONS`.
  - `toggleTheme` from `@/shared/lib/theme`.
  - `useLocation` from `preact-iso`.
- Produces:
  - `useStageMode(sectionIds: readonly string[], onEnterApp: () => void): StageMode`
  - `StageMode { active; ready; index; count; enter(); exit() }`
  - `StageIndicator({ index, count, label })`
  - `PresentButton({ onPresent })`

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/home-stage.test.ts`:

```ts
import { afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LocationProvider } from 'preact-iso';
import HomePage from '@/pages/home';

function mountHome(url: string) {
  window.history.replaceState(null, '', url);
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(h(LocationProvider, null, h(HomePage, null)), host);
  return host;
}

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

function resetStage() {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('stage');
  window.history.replaceState(null, '', '/');
}

describe('BB-HOME-16: A stage URL opens on its slide and keys step and exit', () => {
  afterEach(resetStage);
  it('starts at the hashed slide, steps forward with PageDown and leaves on Escape', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const host = mountHome('/?stage#curriculum');
    await settle();
    const root = document.documentElement;
    const indicator = () => host.querySelector('.stage-indicator')?.textContent ?? null;
    expect(root.classList.contains('stage')).toBe(true);
    expect(indicator()).toContain('04 / 07');

    press('PageDown');
    await settle();
    expect(indicator()).toContain('05 / 07');
    expect(window.location.search).toBe('?stage');
    expect(window.location.hash).toBe('#under-the-hood');

    press('Escape');
    await settle();
    expect(root.classList.contains('stage')).toBe(false);
    expect(indicator()).toBeNull();
    expect(window.location.search).toBe('');

    render(null, host);
    host.remove();
  });
});

describe('BB-HOME-17: P enters stage mode and stepping past the end opens the editor', () => {
  afterEach(resetStage);
  it('enters from the scroll page, jumps to the last slide, routes to /app and cleans up on unmount', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const host = mountHome('/');
    await settle();
    const root = document.documentElement;
    expect(root.classList.contains('stage')).toBe(false);
    expect(host.querySelector('.present-button')).not.toBeNull();

    press('p');
    await settle();
    expect(root.classList.contains('stage')).toBe(true);
    expect(host.querySelector('.stage-indicator')?.textContent).toContain('01 / 07');

    press('End');
    await settle();
    expect(host.querySelector('.stage-indicator')?.textContent).toContain('07 / 07');

    press('PageDown');
    await settle();
    expect(window.location.pathname).toBe('/app');

    render(null, host);
    host.remove();
    expect(root.classList.contains('stage')).toBe(false);
  });
});

describe('BB-HOME-18: The early inline script applies the stage layout before first paint', () => {
  afterEach(resetStage);
  it('adds the stage class only for / with a stage parameter', () => {
    const html = readFileSync('index.html', 'utf8');
    const body = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    const root = document.documentElement;
    const run = (url: string) => {
      window.history.replaceState(null, '', url);
      root.className = '';
      new Function(body)();
      return root.classList;
    };
    expect(run('/?stage').contains('stage')).toBe(true);
    expect(run('/?stage#team').contains('stage')).toBe(true);
    expect(run('/').contains('stage')).toBe(false);
    expect(run('/?stages').contains('stage')).toBe(false);
    const app = run('/app?stage');
    expect(app.contains('stage')).toBe(false);
    expect(app.contains('route-editor')).toBe(true);
    root.className = '';
  });
});
```

Merge `afterEach, vi` into the existing first `import … from 'vitest'` line rather than adding a second vitest import, if lint flags a duplicate import.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: FAIL. BB-HOME-16 finds no `stage` class, and BB-HOME-18 finds no stage handling in the inline script.

- [ ] **Step 3: Write the hook**

Create `src/features/stage-mode/model/useStageMode.ts`:

```ts
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { toggleTheme } from '@/shared/lib/theme';
import { clampIndex, focusKind, keyToAction, nextIndex, prevIndex, readStageFromUrl } from './stage-controller';

export interface StageMode {
  active: boolean;
  /** True after the first client render; the indicator waits for it so hydration matches the prerender. */
  ready: boolean;
  index: number;
  count: number;
  enter: () => void;
  exit: () => void;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToSection(id: string, smooth: boolean) {
  document.getElementById(id)?.scrollIntoView?.({
    behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    block: 'start',
  });
}

/** The section whose top edge is closest to the top of the viewport. */
function nearestSectionIndex(sectionIds: readonly string[]) {
  let best = 0;
  let bestDistance = Infinity;
  sectionIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const distance = Math.abs(el.getBoundingClientRect().top);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.()?.catch(() => {});
    return;
  }
  document.documentElement.requestFullscreen?.()?.catch(() => {});
}

function initialStage(sectionIds: readonly string[]) {
  if (typeof window === 'undefined') return { active: false, index: 0 };
  return readStageFromUrl(window.location.search, window.location.hash, sectionIds);
}

/**
 * Presents the page as slides. `sectionIds` must be a stable array (a module constant): it lists
 * the slide sections in order. `onEnterApp` runs when the presenter steps past the last slide.
 */
export function useStageMode(sectionIds: readonly string[], onEnterApp: () => void): StageMode {
  const count = sectionIds.length;
  // Read the URL during the first client render so a /?stage load never drops the stage class
  // that the early inline script already set. Only the indicator depends on this state, and it
  // waits for `ready`.
  const [initial] = useState(() => initialStage(sectionIds));
  const [active, setActive] = useState(initial.active);
  const [index, setIndex] = useState(initial.index);
  const [ready, setReady] = useState(false);

  const activeRef = useRef(active);
  activeRef.current = active;
  const indexRef = useRef(index);
  indexRef.current = index;
  const enterAppRef = useRef(onEnterApp);
  enterAppRef.current = onEnterApp;
  const pendingScrollRef = useRef(initial.active);
  const urlTouchedRef = useRef(initial.active);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- second pass after hydration, so the indicator never mismatches the prerendered HTML
  useEffect(() => setReady(true), []);

  const enter = useCallback(() => {
    if (activeRef.current) return;
    setIndex(nearestSectionIndex(sectionIds));
    pendingScrollRef.current = true;
    setActive(true);
  }, [sectionIds]);

  const exit = useCallback(() => {
    if (!activeRef.current) return;
    pendingScrollRef.current = true;
    setActive(false);
  }, []);

  const goTo = useCallback(
    (target: number) => {
      const next = clampIndex(target, count);
      setIndex(next);
      scrollToSection(sectionIds[next], true);
    },
    [count, sectionIds],
  );

  // Apply the layout class, then re-anchor on the current slide, because entering or leaving
  // changes every section's height.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('stage', active);
    if (pendingScrollRef.current) {
      pendingScrollRef.current = false;
      scrollToSection(sectionIds[indexRef.current], false);
    }
    return () => root.classList.remove('stage');
  }, [active, sectionIds]);

  // Keep ?stage and the slide hash in the URL so a reload during rehearsal returns to the same slide.
  useEffect(() => {
    if (!active && !urlTouchedRef.current) return;
    urlTouchedRef.current = active;
    const { pathname } = window.location;
    const hash = `#${sectionIds[index]}`;
    window.history.replaceState(window.history.state, '', active ? `${pathname}?stage${hash}` : `${pathname}${hash}`);
  }, [active, index, sectionIds]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const current = indexRef.current;
      const action = keyToAction(event, {
        active: activeRef.current,
        atLast: current === count - 1,
        focus: focusKind(document.activeElement),
      });
      if (!action) return;
      event.preventDefault();
      switch (action) {
        case 'enter-stage':
          enter();
          break;
        case 'exit':
          exit();
          break;
        case 'next':
          goTo(nextIndex(current, count));
          break;
        case 'prev':
          goTo(prevIndex(current));
          break;
        case 'first':
          goTo(0);
          break;
        case 'last':
          goTo(count - 1);
          break;
        case 'theme':
          toggleTheme();
          break;
        case 'fullscreen':
          toggleFullscreen();
          break;
        case 'enter-app':
          enterAppRef.current();
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [count, enter, exit, goTo]);

  // Follow mouse-wheel and touch scrolling while presenting.
  useEffect(() => {
    if (!active || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = sectionIds.indexOf((entry.target as HTMLElement).id);
          if (i >= 0) setIndex(i);
        }
      },
      { threshold: 0.6 },
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [active, sectionIds]);

  return { active, ready, index, count, enter, exit };
}
```

- [ ] **Step 4: Write the UI and the public API**

`src/features/stage-mode/ui/StageIndicator.tsx`:

```tsx
import './stage-mode.scss';

interface StageIndicatorProps {
  index: number;
  count: number;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function StageIndicator({ index, count, label }: StageIndicatorProps) {
  return (
    <p className="stage-indicator" aria-live="polite">
      <span className="stage-indicator__sr">
        Slide {index + 1} of {count}: {label}.{' '}
      </span>
      <span aria-hidden="true">
        {pad(index + 1)} / {pad(count)}
      </span>
    </p>
  );
}
```

`src/features/stage-mode/ui/PresentButton.tsx`:

```tsx
import './stage-mode.scss';

export default function PresentButton({ onPresent }: { onPresent: () => void }) {
  return (
    <button type="button" className="present-button" onClick={onPresent} aria-keyshortcuts="P">
      Present <kbd aria-hidden="true">P</kbd>
    </button>
  );
}
```

`src/features/stage-mode/ui/stage-mode.scss`:

```scss
/* The slide counter, drawn as a dimension label: a short ink rule between two end stops. */
.stage-indicator {
  position: fixed;
  right: 1.5rem;
  bottom: 1.25rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  letter-spacing: 0.1em;
  color: var(--ink);
  &::before {
    content: '';
    width: 2rem;
    height: 0.6rem;
    border-left: 1.5px solid var(--ink);
    border-right: 1.5px solid var(--ink);
    background: linear-gradient(var(--ink), var(--ink)) center / 100% 1.5px no-repeat;
  }
}

.stage-indicator__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.present-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1.5px solid var(--ink);
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  kbd {
    padding: 0 0.35em;
    border: 1px solid var(--ink-muted);
    border-radius: var(--radius-s);
    font-family: inherit;
    font-size: 0.75rem;
  }
  &:hover { background: var(--paper-raised); }
}
```

`src/features/stage-mode/index.ts`:

```ts
export { useStageMode, type StageMode } from './model/useStageMode';
export { default as StageIndicator } from './ui/StageIndicator';
export { default as PresentButton } from './ui/PresentButton';
```

- [ ] **Step 5: Wire the hook into the page**

Replace `src/pages/home/ui/HomePage.tsx`:

```tsx
import { useLocation } from 'preact-iso';
import SiteHeader from '@/widgets/site-header';
import SiteFooter from '@/widgets/site-footer';
import { PresentButton, StageIndicator, useStageMode } from '@/features/stage-mode';
import { SECTIONS } from '@/pages/home/model/content';
import HeroSection from './sections/HeroSection';
import ProblemSection from './sections/ProblemSection';
import ViewsSection from './sections/ViewsSection';
import CurriculumSection from './sections/CurriculumSection';
import UnderTheHoodSection from './sections/UnderTheHoodSection';
import TeamSection from './sections/TeamSection';
import TryItSection from './sections/TryItSection';
import './home.scss';
import './sections/sections.scss';
import './home-stage.scss';

const SECTION_IDS = SECTIONS.map((section) => section.id);

export default function HomePage() {
  const { route } = useLocation();
  const stage = useStageMode(SECTION_IDS, () => route('/app'));
  return (
    <div className="site-page">
      <SiteHeader />
      <main id="main" className="home">
        <HeroSection />
        <ProblemSection />
        <ViewsSection />
        <CurriculumSection />
        <UnderTheHoodSection />
        <TeamSection />
        <TryItSection />
      </main>
      <SiteFooter actions={<PresentButton onPresent={stage.enter} />} />
      {stage.active && stage.ready && (
        <StageIndicator index={stage.index} count={stage.count} label={SECTIONS[stage.index].label} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write the stage layout**

Create `src/pages/home/ui/home-stage.scss`:

```scss
/* Stage mode is the presenter's projector layout. The root font size follows the viewport height, and
   the spacing tokens switch to rem, so each slide keeps the same framing at 1080p, 720p and 4:3.
   max() keeps text at least the browser's default size, so zooming still enlarges it. */
html.stage {
  font-size: max(2.2vh, 100%);
  scroll-snap-type: y mandatory;
  scroll-padding-top: 0;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;

  .site-header,
  .site-footer { display: none; }

  [data-slide] {
    box-sizing: border-box;
    display: grid;
    align-content: center;
    min-height: 100vh;
    height: 100vh;
    padding-top: var(--space-6);
    padding-bottom: var(--space-6);
    overflow: hidden;
    border-top: 0;
    scroll-snap-align: start;
  }

  .home__title { font-size: 4.25rem; }
  .home-section__title { max-width: 26ch; font-size: 3rem; }
  .home__lede,
  .home-section__subhead { font-size: 1.25rem; }
  .vertex-demo__svg { max-height: 58vh; max-width: 58vh; }
}
```

- [ ] **Step 7: Update the early inline script**

In `index.html`, add this line inside the inline script, after the `route-editor` line:

```js
       if (location.pathname === '/' && new URLSearchParams(location.search).has('stage')) root.classList.add('stage');
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/home-stage.test.ts tests/black-box/site-shell.test.ts`
Expected: PASS. All 18 BB-HOME tests and every BB-SITE test pass.

- [ ] **Step 9: Check it in the browser**

Run `npm run build && npm run preview`, then check:
- **Entering:** stage mode starts from P, from the Present button and from `/?stage#curriculum`.
- **No flash:** `/?stage#curriculum` loads straight into stage mode with no flash of the scroll layout.
- **Stepping:** the arrows, PageUp and PageDown, Space and Shift+Space, Home and End all step correctly.
- **T** toggles the theme, **F** toggles fullscreen, and **Esc** exits back to the same section.
- **Leaving:** stepping past the last slide lands in a working editor, and `html.stage` is gone there.
- **Vertex focus:** with a vertex focused on the Views slide, the arrows move the vertex and PageDown still steps.
- **Overflow:** screenshot every slide at 1920×1080 and 1280×720 in both themes, and at 1024×768 in vellum. No slide may overflow.

- [ ] **Step 10: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/stage-mode src/pages/home/ui/HomePage.tsx src/pages/home/ui/home-stage.scss index.html tests/black-box/home-stage.test.ts
git diff --staged
git commit -m "feat(stage-mode): present the home page as slides with keyboard and clicker control"
```

Expected: 289 tests pass.

---

### Task 7: Final verification

**Files:** none change unless a check fails. If a fix is needed, commit it with its own message.

- [ ] **Step 1: Clean build and full checks**

```bash
rm -rf dist
npm run lint && npm run build && npm test
```

Expected: everything passes, with 289 tests.

- [ ] **Step 2: Bundle cost of the demo**

Build `main` and this branch, and sum the JavaScript that `dist/index.html` loads in each (entry plus modulepreloads). Report both totals and the difference.

To build `main`, use a temporary `git worktree` outside the repo, and remove it afterwards.

- [ ] **Step 3: Browser checks against `npm run preview`**

- [ ] `/` requests no PixiJS chunk.
- [ ] Lighthouse accessibility on `/` scores at least 95 in vellum and in blueprint, with no contrast failures.
- [ ] Keyboard-only pass through the scroll page and through stage mode.
- [ ] Screenshots of every slide at 1920×1080 and 1280×720 in both themes, plus 1024×768 in vellum. No slide overflows.
- [ ] `/?stage#curriculum` loads straight into stage mode on that slide, with no flash.
- [ ] Stepping past the last slide lands in a working editor, and the editor has no `stage` class.
- [ ] Round trip `/` → `/app` → `/` still works, as in the site-shell checks.
- [ ] Generated code for a sample scene is identical to `main`. Nothing under `src/features/code-generation`, `src/core`, `src/entities` or `src/shared/engine` changed: `git diff main...HEAD --stat -- <those paths>` is empty.

- [ ] **Step 4: Report**

Summarise each check as PASS or FAIL with evidence: counts, scores, sizes and screenshot names. List any follow-ups.
