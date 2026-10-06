# Demo Readiness Implementation Plan

**Goal:** Make the expo handoff from the talk into the live editor safe. This adds:
- scene and lesson links;
- a "My scenes" library with automatic backups;
- a crash-recovery screen;
- an installable offline app.

**Architecture:**
- **Library and presets** live in the existing `entities/project` slice.
- **Scene operations and the My scenes UI** form a new `features/scene-library` slice.
- **Crash recovery** has a presentational part in a new `features/crash-recovery` slice.
- **Link handling and recovery actions** live in `pages/editor`, where the features meet.
- **The offline layer** is `vite-plugin-pwa` (Workbox `generateSW`), configured from `src/app/pwa/`.

Every scene change still flows through `sanitizeProjectData` → store → views.

**Tech Stack:** Preact 10 + preact/compat, preact-iso, Zustand 5 (persist), Vite 7 prerender, `idb-keyval` 6, `vite-plugin-pwa` 2 with `workbox-window` 7, Vitest 4 + happy-dom 20, and `fake-indexeddb` 6 for tests.

**Spec:** [docs/specs/2026-10-06-demo-readiness-design.md](../specs/2026-10-06-demo-readiness-design.md)

## Global Constraints

- **Commits:**
  - Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`), with an optional scope.
  - No `Co-Authored-By` trailer and no "Generated with" line.
  - Commit text describes the engineering only. It never mentions an assistant, skill or workflow.
- **Staging:**
  - Stage explicit paths and read `git diff --staged` before committing. Never use `git add -A` or `git add .`.
  - Never stage `.gitignore`: it carries an unrelated local edit.
  - Never `git add -f`.
- **Before every commit:** `npm run lint`, `npm run build` and `npm test` must all pass. `npm test` rewrites `tests/reports/*.json`; restore them with `git checkout -- tests/reports` and never commit them.
- **Test IDs:**
  - Every test has a stable ID, `{SUITE}-{MODULE}-{NN}`. New files use `BB-LIB-*`, `BB-LINK-*`, `BB-RECOVER-*` and `BB-PWA-*`.
  - Existing IDs never change.
  - Tests live in `tests/`, never beside the source.
- **Student-facing text** never uses "coming soon", "not supported", "future", "deferred", "3D" or "lighting".
- **Section labels are exactly** `Pipeline | Primitives | Buffers | Transforms | Textures`.
- **Persistence:** the persisted store stays at `version: 7`. Added persisted fields must be optional, so old saves load unchanged.
- **Styles** build on `src/shared/styles/_tokens.scss` and work in both themes, `vellum` (default) and `[data-theme='blueprint']`. Accessibility target: WCAG 2.2 AA. `--accent-text` is for large text only.
- **Lint (`eslint-plugin-react-hooks` 7)** rejects two things:
  - writing `ref.current` during render;
  - calling `setState` synchronously in an effect body. Calls inside `.then` callbacks or timers are fine.
- **Text inputs** use `onInput` and read `e.currentTarget.value`.
- **The home page (`/`) must not import the store or scene data.** It may import only `src/entities/project/model/preset-links.ts`, which has no imports.
- **Never run `taskkill /IM node.exe`.** Stop only processes you started.

## Review Focus

Five inputs the spec implies but no happy-path test reaches. Each now has a test in the task that owns the code:

1. **Browser storage is full when a student presses Save in My scenes.** Expected: an error toast, the dialog stays usable, the scene is untouched. Test: BB-LIB-16 (Task 4).
2. **A library entry written by an older or newer build, or edited by hand.** Expected: Open still works and drops what it can't read. Test: BB-LIB-13 (Task 4).
3. **A reload right after following a scene link.** Expected: the link is not applied twice and no second backup is made. Test: BB-LINK-12 (Task 5).
4. **Start fresh when the library can't be written.** Expected: the scene is downloaded before the reset, so it is never lost. Test: BB-RECOVER-08 (Task 6).
5. **A new version deploys while the presenter is mid-talk.** Expected: no notice over the slides; it appears after stage mode ends. Test: BB-PWA-06 (Task 7).

---

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `src/entities/project/model/scene-library.ts` | 1 | `SceneEntry`, `SceneLibrary`, the IndexedDB and memory adapters, `getSceneLibrary` |
| `src/entities/project/model/preset-links.ts` | 2 | `PRESET_LINKS`, `presetHref` (no imports) |
| `src/entities/project/model/scene-presets.ts` | 2 | The four presets as `VamsProjectData`, `getPreset`, `isPresetSlug` |
| `src/features/scene-library/model/scene-ops.ts` | 3 | `isSceneEmpty`, `loadProjectData`, backups, `replaceScene`, `saveCurrentScene`, downloads |
| `src/features/scene-library/model/dialog-store.ts` | 4 | `useMyScenesDialog` open state |
| `src/features/scene-library/ui/MyScenesButton.tsx`, `MyScenesDialog.tsx`, `my-scenes.scss` | 4 | My scenes UI |
| `src/features/scene-library/index.ts` | 3, 4 | Public exports |
| `src/features/project-io/ui/ProjectActions.tsx` | 4 | Takes a `loadProject` prop |
| `src/features/workspace-reset/ui/NewWorkspaceButton.tsx` | 4 | Takes a `beforeReset` prop |
| `src/widgets/layout/top-bar/TopBar.tsx` | 4 | Wires the props and mounts `MyScenesButton` |
| `src/pages/editor/model/editor-link.ts` | 5 | `parseEditorLink`, `stripEditorLinkParams`, `applyEditorLink` |
| `src/pages/editor/model/useEditorLink.ts` | 5 | Applies the link once on mount |
| `src/features/stage-mode/model/stage-controller.ts`, `useStageMode.ts` | 5 | `withStageParam` keeps the other query parameters |
| `src/pages/home/ui/sections/TryItSection.tsx`, `src/pages/home/model/content.ts`, `src/pages/home/ui/sections/sections.scss`, `src/pages/home/ui/HomePage.tsx` | 5 | "Start from:" links and the stage handoff |
| `src/core/store/recovery-signal.ts`, `src/core/store/index.ts` | 6 | Corrupt-save signal, lesson-backup persistence and restore |
| `src/features/crash-recovery/*` | 6 | `EditorErrorBoundary`, `RecoveryScreen` |
| `src/pages/editor/model/recovery.ts`, `src/pages/editor/ui/EditorPage.tsx`, `src/pages/editor/ui/EditorApp.tsx`, `src/app/SiteApp.tsx` | 6 | Recovery actions, corrupt-save notice, wiring |
| `src/app/pwa/*`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.app.json`, `index.html`, `public/_headers`, `public/*.png` | 7 | Offline app |
| `tests/README.md`, `docs/specs/2026-10-04-website-overhaul-roadmap.md` | 8 | Docs |

---

### Task 1: Scene library storage

**Files:**
- Create: `src/entities/project/model/scene-library.ts`
- Modify: `package.json`, `package-lock.json` (dependencies)
- Test: `tests/black-box/scene-library.test.ts` (new; BB-LIB-01..05)

**Interfaces:**
- Consumes: `VamsProjectFile` from `src/entities/project/model/project-io.ts`.
- Produces:
  - `type BackupReason`, `interface SceneEntry`, `interface SceneLibrary`;
  - `BACKUP_LIMIT = 5`, `MAX_NAME_LENGTH = 80`, `UNTITLED_SCENE`;
  - `normalizeSceneName(name: string): string`, `createSceneId(): string`;
  - `createMemoryLibrary(): SceneLibrary`, `createIdbLibrary(store?: UseStore): SceneLibrary`;
  - `getSceneLibrary(): Promise<SceneLibrary>`, `setSceneLibraryForTests(library: SceneLibrary | null): void`.

- [ ] **Step 1: Install dependencies**

```bash
npm install idb-keyval@^6.2.2
npm install -D fake-indexeddb@^6.0.0
```

Expected: `package.json` lists `idb-keyval` under `dependencies` and `fake-indexeddb` under `devDependencies`.

- [ ] **Step 2: Write the failing tests**

Create `tests/black-box/scene-library.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-LIB
 * My scenes: the scene library, scene operations and the My scenes dialog.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStore } from 'idb-keyval';
import { useVamsStore } from '@/core/store';
import { buildProjectFile } from '@/entities/project/model/project-io';
import {
  BACKUP_LIMIT,
  createIdbLibrary,
  createMemoryLibrary,
  getSceneLibrary,
  normalizeSceneName,
  setSceneLibraryForTests,
  UNTITLED_SCENE,
  type SceneEntry,
  type SceneLibrary,
} from '@/entities/project/model/scene-library';

let dbCount = 0;
const adapters: [string, () => SceneLibrary][] = [
  ['memory', createMemoryLibrary],
  ['indexeddb', () => createIdbLibrary(createStore(`vams-test-${++dbCount}`, 'scenes'))],
];

function entry(id: string, kind: SceneEntry['kind'], at: number, name = id): SceneEntry {
  return {
    id,
    name,
    kind,
    reason: kind === 'backup' ? 'scene-link' : null,
    createdAt: at,
    updatedAt: at,
    file: buildProjectFile(useVamsStore.getState()),
    raw: null,
  };
}

describe('BB-LIB-01: Saved entries round-trip and list newest first', () => {
  it.each(adapters)('%s adapter', async (name, make) => {
    const library = make();
    expect(library.persistent).toBe(name === 'indexeddb');
    await library.save(entry('a', 'saved', 1000));
    await library.save(entry('b', 'saved', 3000));
    await library.save(entry('c', 'saved', 2000));
    expect((await library.list()).map((e) => e.id)).toEqual(['b', 'c', 'a']);
    const b = await library.get('b');
    expect(b?.file?.app).toBe('VAMS');
    expect(await library.get('missing')).toBeUndefined();
  });
});

describe('BB-LIB-02: Entries can be renamed and removed', () => {
  it.each(adapters)('%s adapter', async (_name, make) => {
    const library = make();
    await library.save(entry('a', 'saved', 1000, 'First'));
    await library.rename('a', '  Bricks  ');
    expect((await library.get('a'))?.name).toBe('Bricks');
    await library.rename('missing', 'x'); // no throw for an unknown id
    await library.remove('a');
    expect(await library.list()).toEqual([]);
  });
});

describe('BB-LIB-03: Only the newest five backups are kept; saved entries are never pruned', () => {
  it.each(adapters)('%s adapter', async (_name, make) => {
    const library = make();
    for (let i = 0; i < 3; i++) await library.save(entry(`saved-${i}`, 'saved', i));
    for (let i = 0; i < 7; i++) await library.save(entry(`backup-${i}`, 'backup', 100 + i));
    const all = await library.list();
    const backups = all.filter((e) => e.kind === 'backup').map((e) => e.id);
    expect(backups).toHaveLength(BACKUP_LIMIT);
    expect(backups).toEqual(['backup-6', 'backup-5', 'backup-4', 'backup-3', 'backup-2']);
    expect(all.filter((e) => e.kind === 'saved')).toHaveLength(3);
  });
});

describe('BB-LIB-04: Scene names are trimmed, capped and never empty', () => {
  it('normalises names', () => {
    expect(normalizeSceneName('  Bricks  ')).toBe('Bricks');
    expect(normalizeSceneName('   ')).toBe(UNTITLED_SCENE);
    expect(normalizeSceneName('x'.repeat(100))).toHaveLength(80);
  });
});

describe('BB-LIB-05: The shared library falls back to memory without IndexedDB', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSceneLibraryForTests(null);
  });
  it('uses IndexedDB when present and memory when absent', async () => {
    setSceneLibraryForTests(null);
    expect((await getSceneLibrary()).persistent).toBe(true);
    setSceneLibraryForTests(null);
    vi.stubGlobal('indexedDB', undefined);
    expect((await getSceneLibrary()).persistent).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/scene-library.test.ts`
Expected: FAIL, because `@/entities/project/model/scene-library` does not exist.

- [ ] **Step 4: Implement the library**

Create `src/entities/project/model/scene-library.ts`:

```ts
import { createStore, del, get, set, values, type UseStore } from 'idb-keyval';
import type { VamsProjectFile } from './project-io';

/**
 * My scenes: named scenes and automatic backups kept in this browser.
 * Entries hold standard project files, so anything here can also be downloaded and reopened with Open.
 */

/** Why a backup was taken. Saved entries have no reason. */
export type BackupReason =
  | 'scene-link'
  | 'library-open'
  | 'open-file'
  | 'new-workspace'
  | 'recovery'
  | 'corrupt-save';

export interface SceneEntry {
  id: string;
  name: string;
  kind: 'saved' | 'backup';
  reason: BackupReason | null;
  createdAt: number;
  updatedAt: number;
  /** The scene as a project file; null only for a corrupt-save backup. */
  file: VamsProjectFile | null;
  /** The unreadable saved text, kept only for a corrupt-save backup. */
  raw: string | null;
}

export interface SceneLibrary {
  /** False when entries live only in memory and vanish with the tab. */
  readonly persistent: boolean;
  /** Newest `updatedAt` first. */
  list(): Promise<SceneEntry[]>;
  get(id: string): Promise<SceneEntry | undefined>;
  /** Insert or replace. Saving a backup prunes backups to the newest BACKUP_LIMIT. */
  save(entry: SceneEntry): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export const BACKUP_LIMIT = 5;
export const MAX_NAME_LENGTH = 80;
export const UNTITLED_SCENE = 'Untitled scene';
export const LIBRARY_DB = 'vams';
export const LIBRARY_STORE = 'scenes';

export function normalizeSceneName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH).trim() || UNTITLED_SCENE;
}

export function createSceneId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function byNewest(a: SceneEntry, b: SceneEntry): number {
  return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt;
}

interface Backend {
  all(): Promise<SceneEntry[]>;
  read(id: string): Promise<SceneEntry | undefined>;
  write(entry: SceneEntry): Promise<void>;
  delete(id: string): Promise<void>;
}

function createLibrary(backend: Backend, persistent: boolean): SceneLibrary {
  return {
    persistent,
    async list() {
      return (await backend.all()).sort(byNewest);
    },
    get: (id) => backend.read(id),
    async save(entry) {
      await backend.write({ ...entry, name: normalizeSceneName(entry.name) });
      if (entry.kind !== 'backup') return;
      const stale = (await backend.all())
        .filter((e) => e.kind === 'backup')
        .sort(byNewest)
        .slice(BACKUP_LIMIT);
      for (const old of stale) await backend.delete(old.id);
    },
    async rename(id, name) {
      const current = await backend.read(id);
      if (!current) return;
      await backend.write({ ...current, name: normalizeSceneName(name), updatedAt: Date.now() });
    },
    remove: (id) => backend.delete(id),
  };
}

export function createMemoryLibrary(): SceneLibrary {
  const entries = new Map<string, SceneEntry>();
  return createLibrary(
    {
      all: async () => [...entries.values()],
      read: async (id) => entries.get(id),
      write: async (entry) => {
        entries.set(entry.id, entry);
      },
      delete: async (id) => {
        entries.delete(id);
      },
    },
    false,
  );
}

export function createIdbLibrary(store: UseStore = createStore(LIBRARY_DB, LIBRARY_STORE)): SceneLibrary {
  return createLibrary(
    {
      all: () => values<SceneEntry>(store),
      read: (id) => get<SceneEntry>(id, store),
      write: (entry) => set(entry.id, entry, store),
      delete: (id) => del(id, store),
    },
    true,
  );
}

const PROBE_KEY = '__vams-probe__';
let shared: Promise<SceneLibrary> | null = null;

async function openSharedLibrary(): Promise<SceneLibrary> {
  if (typeof indexedDB === 'undefined') return createMemoryLibrary();
  try {
    const store = createStore(LIBRARY_DB, LIBRARY_STORE);
    await set(PROBE_KEY, 1, store);
    await del(PROBE_KEY, store);
    return createIdbLibrary(store);
  } catch {
    // Some private-browsing modes refuse IndexedDB writes; keep scenes for this tab instead.
    return createMemoryLibrary();
  }
}

/** One library for the whole app: IndexedDB when it works, otherwise memory for this tab. */
export function getSceneLibrary(): Promise<SceneLibrary> {
  shared ??= openSharedLibrary();
  return shared;
}

/** Replace the shared library (or forget it, with null). Tests only. */
export function setSceneLibraryForTests(library: SceneLibrary | null): void {
  shared = library ? Promise.resolve(library) : null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/scene-library.test.ts`
Expected: PASS, 8 tests (BB-LIB-01..03 run once per adapter).

- [ ] **Step 6: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add package.json package-lock.json src/entities/project/model/scene-library.ts tests/black-box/scene-library.test.ts
git diff --staged --stat
git commit -m "feat(scenes): store named scenes and backups in IndexedDB with a memory fallback"
```

---

### Task 2: Prepared scenes

**Files:**
- Create: `src/entities/project/model/preset-links.ts`
- Create: `src/entities/project/model/scene-presets.ts`
- Test: `tests/black-box/editor-links.test.ts` (new; BB-LINK-01..04)

**Interfaces:**
- Consumes: `sanitizeProjectData`, `VamsProjectData` (project-io); `SceneNode`, `Vertex` (`@/core/types/scene`); `CurriculumSection` (`@/core/store/types`).
- Produces:
  - from `preset-links.ts`: `PRESET_LINKS: readonly { slug; title }[]`, `type PresetSlug`, `presetHref(slug: PresetSlug): string`;
  - from `scene-presets.ts`: `interface ScenePreset { slug; title; section; data }`, `getPreset(slug: string): ScenePreset | undefined`, `isPresetSlug(slug: string): slug is PresetSlug`.

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/editor-links.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-LINK
 * Links into the editor: prepared scenes, lesson and scene links, the slide 07 starting points
 * and the stage URL.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sanitizeProjectData } from '@/entities/project/model/project-io';
import { PRESET_LINKS, presetHref } from '@/entities/project/model/preset-links';
import { getPreset, isPresetSlug } from '@/entities/project/model/scene-presets';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { extractDrawBlock, generateDemoCode, INITIAL_TRIANGLE } from '@/pages/home/model/demo-code';

const NO_CALLBACKS = { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' };
/** Stands in for the canvas-drawn sample texture, which happy-dom cannot paint. */
const BRICKS = { id: 'sample-bricks', name: 'Tiling Bricks', dataUrl: 'data:image/png;base64,AA', width: 256, height: 256, isSample: true };

function program(slug: string): string {
  const preset = getPreset(slug)!;
  return generateCodeFromState(
    {
      objects: preset.data.objects,
      canvasBackgroundColor: preset.data.canvasBackgroundColor,
      callbacks: NO_CALLBACKS,
      viewportLimits: preset.data.viewportLimits,
      textures: [BRICKS],
    },
    { width: 800, height: 600 },
  );
}

describe('BB-LINK-01: Every prepared scene resolves by slug with its section', () => {
  it('lists four presets in order and rejects unknown slugs', () => {
    expect(PRESET_LINKS.map((p) => p.slug)).toEqual(['triangle', 'transforms', 'primitives', 'textured-quad']);
    expect(PRESET_LINKS.map((p) => p.title)).toEqual(['Triangle', 'Transforms', 'Primitives tour', 'Textured quad']);
    expect(PRESET_LINKS.map((p) => getPreset(p.slug)?.section)).toEqual(['Primitives', 'Transforms', 'Primitives', 'Textures']);
    expect(getPreset('nope')).toBeUndefined();
    expect(isPresetSlug('triangle')).toBe(true);
    expect(isPresetSlug('Triangle')).toBe(false);
    expect(presetHref('textured-quad')).toBe('/app?scene=textured-quad');
  });
});

describe('BB-LINK-02: Prepared scenes survive a save and load unchanged', () => {
  it('round-trips each preset through JSON and the project sanitizer', () => {
    for (const { slug } of PRESET_LINKS) {
      const data = getPreset(slug)!.data;
      expect(sanitizeProjectData(JSON.parse(JSON.stringify(data)))).toEqual(data);
    }
    expect(getPreset('transforms')!.data.objects.map((o) => o.type)).toEqual(['GROUP', 'QUADS', 'TRIANGLES', 'TRIANGLE_FAN']);
    expect(getPreset('primitives')!.data.objects.map((o) => o.type)).toEqual(['POINTS', 'LINE_STRIP', 'TRIANGLE_FAN', 'QUADS']);
    // Each call builds fresh objects, so a loaded preset can never alias another.
    expect(getPreset('triangle')!.data.objects[0]).not.toBe(getPreset('triangle')!.data.objects[0]);
  });
});

describe('BB-LINK-03: Prepared scenes generate the OpenGL they are meant to show', () => {
  it('matches the landing demo for Triangle and emits each preset’s key calls', () => {
    expect(extractDrawBlock(program('triangle'))?.lines).toEqual(generateDemoCode(INITIAL_TRIANGLE).lines);

    const transforms = program('transforms');
    expect(transforms).toContain('ObjectState state_House = { 0.2000f, 0.1000f, 15.0000f, 0.8000f, 0.8000f };');
    expect(transforms).toContain('glTranslatef(state_House.x, state_House.y, 0.0f);');
    expect(transforms).toContain('glBegin(GL_TRIANGLE_FAN);');
    expect(transforms).toContain('void animate_Sun()');
    expect(transforms).toContain('glutIdleFunc(_vams_idle);');

    const primitives = program('primitives');
    for (const mode of ['GL_POINTS', 'GL_LINE_STRIP', 'GL_TRIANGLE_FAN', 'GL_QUADS']) {
      expect(primitives).toContain(`glBegin(${mode});`);
    }

    const textured = program('textured-quad');
    expect(textured).toContain('glBindTexture(GL_TEXTURE_2D, tex_Bricks);');
    expect(textured).toContain('glTexCoord2f(2.0000f, 2.0000f);');
    expect(textured).toContain('GL_TEXTURE_WRAP_S, GL_REPEAT');
    expect(textured).toContain('GL_TEXTURE_MAG_FILTER, GL_NEAREST');
  });
});

describe('BB-LINK-04: The preset list the home page imports carries no dependencies', () => {
  it('has no import statements', () => {
    expect(readFileSync('src/entities/project/model/preset-links.ts', 'utf8')).not.toMatch(/^\s*import\s/m);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/editor-links.test.ts`
Expected: FAIL, because the preset modules do not exist.

- [ ] **Step 3: Create the preset list**

Create `src/entities/project/model/preset-links.ts`:

```ts
/**
 * The prepared scenes the editor opens from a link (/app?scene=<slug>).
 * This module has no imports, so the home page can list the scenes without loading scene data.
 */
export const PRESET_LINKS = [
  { slug: 'triangle', title: 'Triangle' },
  { slug: 'transforms', title: 'Transforms' },
  { slug: 'primitives', title: 'Primitives tour' },
  { slug: 'textured-quad', title: 'Textured quad' },
] as const;

export type PresetSlug = (typeof PRESET_LINKS)[number]['slug'];

export function presetHref(slug: PresetSlug): string {
  return `/app?scene=${slug}`;
}
```

- [ ] **Step 4: Create the presets**

Create `src/entities/project/model/scene-presets.ts`:

```ts
import type { CurriculumSection } from '@/core/store/types';
import type { SceneNode, TransformState, Vertex } from '@/core/types/scene';
import { sanitizeProjectData, type VamsProjectData } from './project-io';
import { PRESET_LINKS, type PresetSlug } from './preset-links';

export interface ScenePreset {
  slug: PresetSlug;
  title: string;
  section: CurriculumSection;
  data: VamsProjectData;
}

/** Id of the editor's built-in "Tiling Bricks" sample texture (features/textures/lib/sample-textures.ts). */
const SAMPLE_BRICKS_ID = 'sample-bricks';
const IDENTITY: TransformState = { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 };

/** A scene object with the same defaults the editor gives a newly placed shape. */
function node(fields: Pick<SceneNode, 'id' | 'name' | 'type' | 'vertices'> & Partial<SceneNode>): SceneNode {
  return {
    visible: true,
    shading: 'SMOOTH',
    transform: { ...IDENTITY },
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
    animation: null,
    ...fields,
  };
}

function vertices(prefix: string, points: [number, number][], colors: string | string[]): Vertex[] {
  return points.map(([x, y], i) => ({
    id: `${prefix}-v${i}`,
    x,
    y,
    color: typeof colors === 'string' ? colors : colors[i],
  }));
}

function at(x: number, y: number): TransformState {
  return { ...IDENTITY, translateX: x, translateY: y };
}

/** The home page's live demo triangle (src/pages/home/model/demo-code.ts), so the talk hands over seamlessly. */
function triangle(): SceneNode[] {
  return [
    node({
      id: 'triangle',
      name: 'Triangle',
      type: 'TRIANGLES',
      vertices: vertices('triangle', [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]], ['#ff0000', '#00ff00', '#0000ff']),
    }),
  ];
}

function transforms(): SceneNode[] {
  return [
    node({
      id: 'house',
      name: 'House',
      type: 'GROUP',
      vertices: [],
      children: ['walls', 'roof'],
      transform: { translateX: 0.2, translateY: 0.1, rotate: 15, scaleX: 0.8, scaleY: 0.8 },
    }),
    node({
      id: 'walls',
      name: 'Walls',
      type: 'QUADS',
      parentId: 'house',
      vertices: vertices('walls', [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.15], [-0.3, 0.15]], '#e8d5b5'),
    }),
    node({
      id: 'roof',
      name: 'Roof',
      type: 'TRIANGLES',
      parentId: 'house',
      vertices: vertices('roof', [[-0.38, 0.15], [0.38, 0.15], [0, 0.45]], '#b91c1c'),
    }),
    node({
      id: 'sun',
      name: 'Sun',
      type: 'TRIANGLE_FAN',
      transform: at(-0.6, 0.6),
      animation: { motion: 'rotate', speed: 1 },
      vertices: vertices(
        'sun',
        [[0, 0], [0.15, 0], [0, 0.15], [-0.15, 0], [0, -0.15], [0.15, 0]],
        ['#ffd23f', '#ff8c1a', '#ff8c1a', '#ff8c1a', '#ff8c1a', '#ff8c1a'],
      ),
    }),
  ];
}

function primitives(): SceneNode[] {
  return [
    node({
      id: 'points',
      name: 'Points',
      type: 'POINTS',
      transform: at(-0.5, 0.5),
      vertices: vertices('points', [[-0.2, -0.15], [0, 0.15], [0.2, -0.15], [0, 0]], '#ffd23f'),
    }),
    node({
      id: 'line-strip',
      name: 'Line strip',
      type: 'LINE_STRIP',
      lineWidth: 3,
      transform: at(0.5, 0.5),
      vertices: vertices('line-strip', [[-0.25, -0.15], [-0.1, 0.15], [0.05, -0.15], [0.25, 0.15]], '#38bdf8'),
    }),
    node({
      id: 'triangle-fan',
      name: 'Triangle fan',
      type: 'TRIANGLE_FAN',
      transform: at(-0.5, -0.5),
      vertices: vertices(
        'triangle-fan',
        [[0, 0], [0.25, 0], [0.18, 0.18], [0, 0.25], [-0.18, 0.18], [-0.25, 0]],
        ['#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
      ),
    }),
    node({
      id: 'quad',
      name: 'Quad',
      type: 'QUADS',
      transform: at(0.5, -0.5),
      vertices: vertices('quad', [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]], ['#a855f7', '#ec4899', '#f97316', '#22c55e']),
    }),
  ];
}

function texturedQuad(): SceneNode[] {
  return [
    node({
      id: 'bricks',
      name: 'Bricks',
      type: 'QUADS',
      texture: { textureId: SAMPLE_BRICKS_ID, filter: 'NEAREST', wrap: 'REPEAT' },
      // UVs run 0..2, so with GL_REPEAT the bricks tile twice in each direction.
      uvs: [{ u: 0, v: 0 }, { u: 2, v: 0 }, { u: 2, v: 2 }, { u: 0, v: 2 }],
      vertices: vertices('bricks', [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]], '#ffffff'),
    }),
  ];
}

const BUILDERS: Record<PresetSlug, { section: CurriculumSection; build: () => SceneNode[] }> = {
  triangle: { section: 'Primitives', build: triangle },
  transforms: { section: 'Transforms', build: transforms },
  primitives: { section: 'Primitives', build: primitives },
  'textured-quad': { section: 'Textures', build: texturedQuad },
};

export function isPresetSlug(slug: string): slug is PresetSlug {
  return PRESET_LINKS.some((link) => link.slug === slug);
}

/** A fresh copy of a prepared scene, passed through the same validator as an opened file. */
export function getPreset(slug: string): ScenePreset | undefined {
  const link = PRESET_LINKS.find((l) => l.slug === slug);
  if (!link) return undefined;
  const { section, build } = BUILDERS[link.slug];
  return { slug: link.slug, title: link.title, section, data: sanitizeProjectData({ objects: build() }) };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/editor-links.test.ts`
Expected: PASS, 4 tests.

If BB-LINK-02's round-trip fails for one field, `sanitizeProjectData` normalises a value the builder sets differently. Make the builder emit the normalised value. Never loosen the assertion.

- [ ] **Step 6: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/entities/project/model/preset-links.ts src/entities/project/model/scene-presets.ts tests/black-box/editor-links.test.ts
git diff --staged --stat
git commit -m "feat(scenes): add four prepared scenes for the editor"
```

---

### Task 3: Scene operations

**Files:**
- Create: `src/features/scene-library/model/scene-ops.ts`
- Create: `src/features/scene-library/index.ts`
- Test: `tests/black-box/scene-library.test.ts` (append BB-LIB-06..10)

**Interfaces:**
- Consumes:
  - from Task 1: `getSceneLibrary`, `createSceneId`, `normalizeSceneName`, `SceneEntry`, `BackupReason`;
  - from project-io: `buildProjectFile`, `toStorePatchFromProject`, `downloadJSON`, `VamsProjectData`;
  - `getActiveTheme`, `toEditorTheme` from `@/shared/lib/theme`.
- Produces, exported from `src/features/scene-library/index.ts`:
  - `isSceneEmpty(state): boolean`;
  - `loadProjectData(data: VamsProjectData): number`, which returns the number of detached textures;
  - `backupCurrentScene(reason: BackupReason, label: string): Promise<SceneEntry | null>`;
  - `backupCorruptSave(raw: string): Promise<SceneEntry>`;
  - `replaceScene(data, { reason, label }): Promise<{ backedUp: boolean; detached: number }>`;
  - `saveCurrentScene(name: string): Promise<SceneEntry>`;
  - `backupLabel(title: string): string`;
  - `entryFileName(entry): string`, `downloadText(filename, text): void`, `downloadEntry(entry): void`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/scene-library.test.ts`:

```ts
import { getActiveTheme, toEditorTheme } from '@/shared/lib/theme';
import { sanitizeProjectData } from '@/entities/project/model/project-io';
import {
  backupCurrentScene,
  backupLabel,
  entryFileName,
  isSceneEmpty,
  loadProjectData,
  replaceScene,
} from '@/features/scene-library';
import { addQuad, addTriangle } from '../helpers/store';

function useMemoryLibrary(): SceneLibrary {
  const library = createMemoryLibrary();
  setSceneLibraryForTests(library);
  return library;
}

function failingLibrary(): SceneLibrary {
  const library = createMemoryLibrary();
  return { ...library, save: () => Promise.reject(new Error('QuotaExceededError')) };
}

describe('BB-LIB-06: A scene counts as empty only when nothing would be lost', () => {
  it('checks objects, background, a shape in progress, callbacks and the viewport', () => {
    const blank = useVamsStore.getState();
    expect(isSceneEmpty(blank)).toBe(true);
    expect(isSceneEmpty({ ...blank, canvasBackgroundColor: '#112233' })).toBe(false);
    expect(isSceneEmpty({ ...blank, pendingShapeType: 'TRIANGLES' })).toBe(false);
    expect(isSceneEmpty({ ...blank, callbacks: { ...blank.callbacks, idle: 'x += 1;' } })).toBe(false);
    expect(isSceneEmpty({ ...blank, viewportLimits: { minX: -2, maxX: 2, minY: -1, maxY: 1 } })).toBe(false);
    addTriangle();
    expect(isSceneEmpty(useVamsStore.getState())).toBe(false);
  });
});

describe('BB-LIB-07: Backing up the current scene', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('skips an empty scene and saves a labelled backup otherwise', async () => {
    const library = useMemoryLibrary();
    expect(await backupCurrentScene('scene-link', backupLabel('Triangle'))).toBeNull();
    expect(await library.list()).toEqual([]);

    const tri = addTriangle();
    const entry = await backupCurrentScene('scene-link', backupLabel('Triangle'));
    expect(entry?.name).toBe('Before opening ‘Triangle’');
    const [stored] = await library.list();
    expect(stored.kind).toBe('backup');
    expect(stored.reason).toBe('scene-link');
    expect(stored.file?.data.objects.map((o) => o.id)).toEqual([tri.id]);
    expect(entryFileName(stored)).toBe('before-opening-triangle.vams');
  });
});

describe('BB-LIB-08: Replacing the scene backs up first, then loads', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('loads the data with the site theme and a cleared history', async () => {
    const library = useMemoryLibrary();
    addTriangle();
    const incoming = sanitizeProjectData({ objects: [{ id: 'q', name: 'Q', type: 'QUADS', vertices: [] }], theme: 'light' });
    const result = await replaceScene(incoming, { reason: 'library-open', label: backupLabel('Q') });
    expect(result).toEqual({ backedUp: true, detached: 0 });
    const state = useVamsStore.getState();
    expect(state.objects.map((o) => o.id)).toEqual(['q']);
    expect(state.theme).toBe(toEditorTheme(getActiveTheme()));
    expect(state.past).toEqual([]);
    expect(await library.list()).toHaveLength(1);
  });
  it('reports no backup when the scene was empty', async () => {
    useMemoryLibrary();
    const result = await replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'scene-link', label: 'x' });
    expect(result.backedUp).toBe(false);
  });
});

describe('BB-LIB-09: A failed backup leaves the scene untouched', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('rejects and keeps the current objects', async () => {
    setSceneLibraryForTests(failingLibrary());
    const tri = addTriangle();
    await expect(
      replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'scene-link', label: 'x' }),
    ).rejects.toThrow('QuotaExceededError');
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual([tri.id]);
  });
});

describe('BB-LIB-10: Loading detaches textures the editor does not have', () => {
  it('drops unknown texture attachments and counts them', () => {
    addQuad();
    const data = sanitizeProjectData({
      objects: [
        { id: 'a', name: 'A', type: 'QUADS', vertices: [], texture: { textureId: 'missing', filter: 'LINEAR', wrap: 'REPEAT' } },
        { id: 'b', name: 'B', type: 'QUADS', vertices: [], texture: { textureId: 'sample-bricks', filter: 'LINEAR', wrap: 'REPEAT' } },
      ],
    });
    expect(loadProjectData(data)).toBe(1);
    const [a, b] = useVamsStore.getState().objects;
    expect(a.texture).toBeNull();
    expect(b.texture?.textureId).toBe('sample-bricks');
  });
});
```

Move the new `import` lines to the top of the file with the other imports: ES imports are hoisted, and the repo keeps them at the top. The `afterEach` import already exists from Task 1.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/scene-library.test.ts`
Expected: FAIL, because `@/features/scene-library` does not exist.

- [ ] **Step 3: Implement the scene operations**

Create `src/features/scene-library/model/scene-ops.ts`:

```ts
import { useVamsStore } from '@/core/store';
import type { VamsState } from '@/core/store/types';
import {
  buildProjectFile,
  downloadJSON,
  toStorePatchFromProject,
  type VamsProjectData,
} from '@/entities/project/model/project-io';
import {
  createSceneId,
  getSceneLibrary,
  normalizeSceneName,
  type BackupReason,
  type SceneEntry,
} from '@/entities/project/model/scene-library';
import { getActiveTheme, toEditorTheme } from '@/shared/lib/theme';

type SceneFields = Pick<VamsState, 'objects' | 'canvasBackgroundColor' | 'pendingShapeType' | 'callbacks' | 'viewportLimits'>;

/** True when there is nothing on the canvas worth keeping. */
export function isSceneEmpty(state: SceneFields): boolean {
  const { minX, maxX, minY, maxY } = state.viewportLimits;
  return (
    state.objects.length === 0 &&
    state.canvasBackgroundColor === '#000000' &&
    state.pendingShapeType === null &&
    Object.values(state.callbacks).every((body) => body.trim() === '') &&
    minX === -1 &&
    maxX === 1 &&
    minY === -1 &&
    maxY === 1
  );
}

/**
 * Load project data into the editor. The site theme stays authoritative, texture attachments
 * the editor cannot resolve are dropped, and undo history starts over.
 * Returns how many texture attachments were dropped.
 */
export function loadProjectData(data: VamsProjectData): number {
  useVamsStore.setState({ ...toStorePatchFromProject(data), theme: toEditorTheme(getActiveTheme()) }, false);
  const state = useVamsStore.getState();
  const known = new Set(state.getAllTextures().map((t) => t.id));
  let detached = 0;
  const objects = state.objects.map((o) => {
    if (o.texture && !known.has(o.texture.textureId)) {
      detached++;
      return { ...o, texture: null };
    }
    return o;
  });
  if (detached > 0) useVamsStore.setState({ objects });
  state.clearHistory();
  return detached;
}

export function backupLabel(title: string): string {
  return `Before opening ‘${title}’`;
}

function newEntry(fields: Pick<SceneEntry, 'name' | 'kind' | 'reason' | 'file' | 'raw'>): SceneEntry {
  const now = Date.now();
  return { id: createSceneId(), createdAt: now, updatedAt: now, ...fields, name: normalizeSceneName(fields.name) };
}

/** Keep the current scene in My scenes before something replaces it. Returns null for an empty scene. */
export async function backupCurrentScene(reason: BackupReason, label: string): Promise<SceneEntry | null> {
  const state = useVamsStore.getState();
  if (isSceneEmpty(state)) return null;
  const entry = newEntry({ name: label, kind: 'backup', reason, file: buildProjectFile(state), raw: null });
  await (await getSceneLibrary()).save(entry);
  return entry;
}

/** Keep saved editor data that could not be read, so it can still be downloaded. */
export async function backupCorruptSave(raw: string): Promise<SceneEntry> {
  const entry = newEntry({ name: 'Unreadable saved scene', kind: 'backup', reason: 'corrupt-save', file: null, raw });
  await (await getSceneLibrary()).save(entry);
  return entry;
}

export interface ReplaceOptions {
  reason: BackupReason;
  label: string;
}

export interface ReplaceResult {
  backedUp: boolean;
  detached: number;
}

/**
 * Back up the current scene, then load `data`. If the backup fails the scene is left alone and
 * the error propagates, so the caller can say why nothing changed.
 */
export async function replaceScene(data: VamsProjectData, options: ReplaceOptions): Promise<ReplaceResult> {
  const backup = await backupCurrentScene(options.reason, options.label);
  const detached = loadProjectData(data);
  return { backedUp: backup !== null, detached };
}

/** Save the current scene as a named entry in My scenes. */
export async function saveCurrentScene(name: string): Promise<SceneEntry> {
  const entry = newEntry({ name, kind: 'saved', reason: null, file: buildProjectFile(useVamsStore.getState()), raw: null });
  await (await getSceneLibrary()).save(entry);
  return entry;
}

export function entryFileName(entry: SceneEntry): string {
  const base = entry.name
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return `${base || 'vams-scene'}.vams`;
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download an entry as a project file that Open can read (or, for a corrupt save, its raw text). */
export function downloadEntry(entry: SceneEntry): void {
  if (entry.file) downloadJSON(entryFileName(entry), entry.file);
  else if (entry.raw !== null) downloadText(entryFileName(entry), entry.raw);
}
```

Create `src/features/scene-library/index.ts`:

```ts
export {
  backupCorruptSave,
  backupCurrentScene,
  backupLabel,
  downloadEntry,
  downloadText,
  entryFileName,
  isSceneEmpty,
  loadProjectData,
  replaceScene,
  saveCurrentScene,
  type ReplaceOptions,
  type ReplaceResult,
} from './model/scene-ops';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/scene-library.test.ts`
Expected: PASS, with BB-LIB-01..10 all green.

- [ ] **Step 5: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/scene-library/model/scene-ops.ts src/features/scene-library/index.ts tests/black-box/scene-library.test.ts
git diff --staged --stat
git commit -m "feat(scenes): back up the current scene before anything replaces it"
```

---

### Task 4: My scenes dialog and top bar wiring

**Files:**
- Create: `src/features/scene-library/model/dialog-store.ts`
- Create: `src/features/scene-library/ui/MyScenesButton.tsx`
- Create: `src/features/scene-library/ui/MyScenesDialog.tsx`
- Create: `src/features/scene-library/ui/my-scenes.scss`
- Modify: `src/features/scene-library/index.ts`
- Modify: `src/features/project-io/ui/ProjectActions.tsx`
- Modify: `src/features/workspace-reset/ui/NewWorkspaceButton.tsx`
- Modify: `src/widgets/layout/top-bar/TopBar.tsx`
- Modify: `src/pages/editor/ui/EditorApp.tsx`
- Test: `tests/black-box/scene-library.test.ts` (append BB-LIB-11..16)

**Interfaces:**
- Consumes:
  - Task 1: `getSceneLibrary`, `SceneEntry`, `MAX_NAME_LENGTH`;
  - Task 3: `isSceneEmpty`, `replaceScene`, `saveCurrentScene`, `backupCurrentScene`, `backupLabel`, `downloadEntry`;
  - project-io: `sanitizeProjectData`;
  - `confirm` from `@/shared/ui/confirm-dialog/confirm-store`.
- Produces:
  - `useMyScenesDialog` (zustand: `isOpen`, `open()`, `close()`);
  - default exports `MyScenesButton` and `MyScenesDialog`, re-exported by name from the feature index;
  - `ProjectActions` prop `loadProject: (data: VamsProjectData, fileName: string) => Promise<number>` (required);
  - `NewWorkspaceButton` prop `beforeReset: () => Promise<unknown>` (required).

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/scene-library.test.ts`. Move the imports to the top of the file:

```ts
import { h, render } from 'preact';
import MyScenesDialog from '@/features/scene-library/ui/MyScenesDialog';
import { useMyScenesDialog } from '@/features/scene-library/model/dialog-store';
import NewWorkspaceButton from '@/features/workspace-reset/ui/NewWorkspaceButton';
import { useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function mount(vnode: ReturnType<typeof h>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}

function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}

async function mountDialog() {
  useMyScenesDialog.getState().open();
  const host = mount(h(MyScenesDialog, null));
  await settle();
  return host;
}

function buttonNamed(host: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll('button')].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name,
  );
}

function rowNames(host: HTMLElement, list: 'saved' | 'backups'): string[] {
  return [...host.querySelectorAll(`[data-list="${list}"] .my-scenes__name`)].map((n) => n.textContent ?? '');
}

describe('BB-LIB-11: My scenes lists saved scenes and backups separately', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('shows each list newest first and offers only Download for an unreadable save', async () => {
    const library = useMemoryLibrary();
    await library.save(entry('s1', 'saved', 1000, 'Older'));
    await library.save(entry('s2', 'saved', 2000, 'Newer'));
    await library.save({ ...entry('c', 'backup', 3000, 'Unreadable saved scene'), reason: 'corrupt-save', file: null, raw: '{' });
    const host = await mountDialog();
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('my-scenes-title');
    expect(rowNames(host, 'saved')).toEqual(['Newer', 'Older']);
    expect(rowNames(host, 'backups')).toEqual(['Unreadable saved scene']);
    expect(buttonNamed(host, 'Open Unreadable saved scene')).toBeUndefined();
    expect(buttonNamed(host, 'Download Unreadable saved scene')).toBeDefined();
    expect(host.textContent).toContain('Clearing site data removes them');
    unmount(host);
  });
});

describe('BB-LIB-12: Saving the current scene from the dialog', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('is disabled for an empty scene and saves a named entry otherwise', async () => {
    const library = useMemoryLibrary();
    let host = await mountDialog();
    expect(buttonNamed(host, 'Save')?.disabled).toBe(true);
    expect(host.textContent).toContain('Add something to the canvas first.');
    expect(host.textContent).toContain('Nothing saved yet.');
    unmount(host);

    addTriangle();
    host = await mountDialog();
    const input = host.querySelector<HTMLInputElement>('#my-scenes-name')!;
    input.value = 'My triangle';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect((await library.list()).map((e) => [e.name, e.kind])).toEqual([['My triangle', 'saved']]);
    expect(rowNames(host, 'saved')).toEqual(['My triangle']);
    unmount(host);
  });
});

describe('BB-LIB-13: Opening an entry replaces the scene and keeps the old one as a backup', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('sanitises the stored file, loads it and closes the dialog', async () => {
    const library = useMemoryLibrary();
    const stored = entry('s1', 'saved', 1000, 'Stored');
    // An entry written by another build: one valid quad and one object type this build does not know.
    stored.file = {
      ...stored.file!,
      data: { ...stored.file!.data, objects: [{ id: 'q', name: 'Q', type: 'QUADS', vertices: [] }, { id: 'z', type: 'HEXAGON' }] as never },
    };
    await library.save(stored);
    addTriangle();
    const host = await mountDialog();
    buttonNamed(host, 'Open Stored')!.click();
    await settle();
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual(['q']);
    expect(useMyScenesDialog.getState().isOpen).toBe(false);
    const backups = (await library.list()).filter((e) => e.kind === 'backup');
    expect(backups.map((e) => e.name)).toEqual(['Before opening ‘Stored’']);
    unmount(host);
  });
});

describe('BB-LIB-14: Renaming in place: Enter saves, Escape cancels without closing', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('renames with Enter and keeps the dialog open on Escape', async () => {
    const library = useMemoryLibrary();
    await library.save(entry('s1', 'saved', 1000, 'Draft'));
    const host = await mountDialog();
    buttonNamed(host, 'Rename Draft')!.click();
    await settle();
    let field = host.querySelector<HTMLInputElement>('input[aria-label="New name for Draft"]')!;
    field.value = 'Final';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect((await library.get('s1'))?.name).toBe('Final');

    buttonNamed(host, 'Rename Final')!.click();
    await settle();
    field = host.querySelector<HTMLInputElement>('input[aria-label="New name for Final"]')!;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(useMyScenesDialog.getState().isOpen).toBe(true);
    expect(host.querySelector('input[aria-label="New name for Final"]')).toBeNull();
    unmount(host);
  });
});

describe('BB-LIB-15: New workspace keeps a backup first and stops if it cannot', () => {
  it('clears after a successful backup and keeps the scene when the backup fails', async () => {
    const ok = vi.fn().mockResolvedValue(null);
    addTriangle();
    let host = mount(h(NewWorkspaceButton, { beforeReset: ok }));
    host.querySelector('button')!.click();
    await settle();
    expect(useConfirmStore.getState().options?.message).toBe('Your current scene will be kept in My scenes as a backup.');
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(useVamsStore.getState().objects).toEqual([]);
    unmount(host);

    const failing = vi.fn().mockRejectedValue(new Error('full'));
    addTriangle();
    host = mount(h(NewWorkspaceButton, { beforeReset: failing }));
    host.querySelector('button')!.click();
    await settle();
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(useVamsStore.getState().objects).toHaveLength(1);
    unmount(host);
  });
});

describe('BB-LIB-16: A full browser storage does not break the dialog', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    useMyScenesDialog.getState().close();
  });
  it('keeps the scene and the dialog when Save fails', async () => {
    setSceneLibraryForTests(failingLibrary());
    const tri = addTriangle();
    const host = await mountDialog();
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(useMyScenesDialog.getState().isOpen).toBe(true);
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual([tri.id]);
    expect(buttonNamed(host, 'Save')?.disabled).toBe(false);
    unmount(host);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/scene-library.test.ts`
Expected: FAIL, because the dialog modules do not exist.

- [ ] **Step 3: Create the dialog store and button**

Create `src/features/scene-library/model/dialog-store.ts`:

```ts
import { create } from 'zustand';

interface MyScenesDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Open state for My scenes, kept in a store so a toast action can open the dialog too. */
export const useMyScenesDialog = create<MyScenesDialogState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

Create `src/features/scene-library/ui/MyScenesButton.tsx`:

```tsx
import { Library } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { useMyScenesDialog } from '../model/dialog-store';

export default function MyScenesButton() {
  const appMode = useVamsStore((state) => state.appMode);
  const open = useMyScenesDialog((state) => state.open);
  if (appMode === 'Lesson') return null;
  return (
    <button type="button" className="icon-btn" onClick={open} title="My scenes" aria-label="My scenes">
      <Library size={16} aria-hidden />
    </button>
  );
}
```

- [ ] **Step 4: Create the dialog**

Create `src/features/scene-library/ui/MyScenesDialog.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { sanitizeProjectData } from '@/entities/project/model/project-io';
import { getSceneLibrary, MAX_NAME_LENGTH, type SceneEntry } from '@/entities/project/model/scene-library';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';
import { useMyScenesDialog } from '../model/dialog-store';
import { backupLabel, downloadEntry, isSceneEmpty, replaceScene, saveCurrentScene } from '../model/scene-ops';
import './my-scenes.scss';

const STORED_HERE = 'Scenes are stored in this browser. Clearing site data removes them — use Download to keep a copy.';
const TAB_ONLY = 'This browser is not keeping scenes after you close the tab. Use Download to keep a copy.';
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function defaultName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Scene ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function MyScenesDialog() {
  const isOpen = useMyScenesDialog((state) => state.isOpen);
  if (!isOpen) return null;
  return <MyScenesDialogInner />;
}

function MyScenesDialogInner() {
  const close = useMyScenesDialog((state) => state.close);
  const sceneEmpty = useVamsStore(isSceneEmpty);
  const [entries, setEntries] = useState<SceneEntry[] | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [name, setName] = useState(defaultName);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    const library = await getSceneLibrary();
    const list = await library.list();
    if (!aliveRef.current) return;
    setPersistent(library.persistent);
    setEntries(list);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => nameRef.current?.focus());
    refresh().catch((error) => console.error(error));
    return () => {
      aliveRef.current = false;
      previouslyFocused?.focus?.();
    };
  }, [refresh]);

  /** Run an action, report a failure as a toast, and re-read the list either way. */
  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
    } catch (error) {
      console.error(error);
      toast.error(failure);
    }
    await refresh().catch((error) => console.error(error));
  };

  const onSave = (event: Event) => {
    event.preventDefault();
    void run(async () => {
      const saved = await saveCurrentScene(name);
      toast.success(`Saved ‘${saved.name}’`);
      setName(defaultName());
    }, "Couldn't save the scene. The browser's storage may be full; use Download to keep a copy.");
  };

  const onOpen = (entry: SceneEntry) =>
    run(async () => {
      if (!entry.file) return;
      const { detached } = await replaceScene(sanitizeProjectData(entry.file.data), {
        reason: 'library-open',
        label: backupLabel(entry.name),
      });
      close();
      toast.success(`Opened ‘${entry.name}’`);
      if (detached > 0) toast.message('Some textures could not be loaded and were detached.');
    }, "Couldn't keep a backup of the current scene, so it was left as it is.");

  const onRename = (entry: SceneEntry, value: string) =>
    run(async () => {
      await (await getSceneLibrary()).rename(entry.id, value);
      setRenaming(null);
    }, "Couldn't rename the scene.");

  const onDelete = (entry: SceneEntry) =>
    run(async () => {
      const ok = await confirm({
        title: `Delete ‘${entry.name}’?`,
        message: 'This removes it from My scenes in this browser.',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (ok) await (await getSceneLibrary()).remove(entry.id);
    }, "Couldn't delete the scene.");

  const onDownload = (entry: SceneEntry) => {
    try {
      downloadEntry(entry);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't download the scene.");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  const saved = entries?.filter((e) => e.kind === 'saved') ?? [];
  const backups = entries?.filter((e) => e.kind === 'backup') ?? [];

  const renderRow = (entry: SceneEntry) => {
    const edit = renaming !== null && renaming.id === entry.id ? renaming : null;
    return (
      <li className="my-scenes__row" key={entry.id}>
        <div className="my-scenes__meta">
          {edit ? (
            <input
              className="my-scenes__rename"
              aria-label={`New name for ${entry.name}`}
              value={edit.value}
              maxLength={MAX_NAME_LENGTH}
              ref={(el) => el?.focus()}
              onInput={(e) => setRenaming({ id: entry.id, value: e.currentTarget.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onRename(entry, edit.value);
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setRenaming(null);
                }
              }}
            />
          ) : (
            <span className="my-scenes__name">{entry.name}</span>
          )}
          <time className="my-scenes__time" dateTime={new Date(entry.updatedAt).toISOString()}>
            {timeFormat.format(entry.updatedAt)}
          </time>
        </div>
        <div className="my-scenes__actions">
          {edit ? (
            <>
              <button type="button" className="my-scenes__btn" onClick={() => void onRename(entry, edit.value)}>
                Save name
              </button>
              <button type="button" className="my-scenes__btn" onClick={() => setRenaming(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {entry.file && (
                <button type="button" className="my-scenes__btn" aria-label={`Open ${entry.name}`} onClick={() => void onOpen(entry)}>
                  Open
                </button>
              )}
              {entry.kind === 'saved' && (
                <button
                  type="button"
                  className="my-scenes__btn"
                  aria-label={`Rename ${entry.name}`}
                  onClick={() => setRenaming({ id: entry.id, value: entry.name })}
                >
                  Rename
                </button>
              )}
              <button type="button" className="my-scenes__btn" aria-label={`Download ${entry.name}`} onClick={() => onDownload(entry)}>
                Download
              </button>
              <button
                type="button"
                className="my-scenes__btn my-scenes__btn--danger"
                aria-label={`Delete ${entry.name}`}
                onClick={() => void onDelete(entry)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  const renderList = (id: 'saved' | 'backups', title: string, items: SceneEntry[], empty: string) => (
    <section className="my-scenes__section" aria-labelledby={`my-scenes-${id}`}>
      <h3 id={`my-scenes-${id}`} className="my-scenes__heading">{title}</h3>
      {entries === null ? (
        <p className="my-scenes__empty">Loading…</p>
      ) : items.length === 0 ? (
        <p className="my-scenes__empty">{empty}</p>
      ) : (
        <ul className="my-scenes__list" data-list={id}>
          {items.map(renderRow)}
        </ul>
      )}
    </section>
  );

  return (
    <div className="my-scenes-overlay" onMouseDown={close}>
      <div
        className="my-scenes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-scenes-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="my-scenes__header">
          <h2 id="my-scenes-title">My scenes</h2>
          <button type="button" className="my-scenes__close" onClick={close} aria-label="Close My scenes">
            <X size={18} aria-hidden />
          </button>
        </header>

        <form className="my-scenes__save" onSubmit={onSave}>
          <label htmlFor="my-scenes-name">Save current scene</label>
          <div className="my-scenes__save-row">
            <input
              id="my-scenes-name"
              ref={nameRef}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              aria-describedby={sceneEmpty ? 'my-scenes-empty-hint' : undefined}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <button type="submit" className="my-scenes__btn my-scenes__btn--primary" disabled={sceneEmpty}>
              Save
            </button>
          </div>
          {sceneEmpty && (
            <p id="my-scenes-empty-hint" className="my-scenes__hint">
              Add something to the canvas first.
            </p>
          )}
        </form>

        {renderList('saved', 'Saved', saved, 'Nothing saved yet.')}
        {renderList('backups', 'Backups (last 5 are kept)', backups, 'No backups yet.')}

        <p className="my-scenes__note">{persistent ? STORED_HERE : TAB_ONLY}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Style the dialog**

Create `src/features/scene-library/ui/my-scenes.scss`:

```scss
@use '../../../shared/styles/tokens' as *;

.my-scenes-overlay {
  position: fixed;
  inset: 0;
  z-index: 1050; // above the Help Center (1000), below confirm() (1100)
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: rgba(var(--shadow-rgb), 0.5);
  backdrop-filter: blur(2px);
}

.my-scenes {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(560px, 100%);
  max-height: min(80vh, 720px);
  overflow-y: auto;
  padding: 1.25rem 1.4rem;
  background-color: $bg-panel;
  color: $text-main;
  border: 1px solid $border-color;
  border-radius: 10px;
  box-shadow: 0 16px 48px rgba(var(--shadow-rgb), 0.45);
  @include scrollbar;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    h2 { margin: 0; font-family: var(--font-display); font-size: 1.3rem; }
  }

  &__close {
    @include flex-center;
    width: 2rem;
    height: 2rem;
    color: $text-muted;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    &:hover { color: $text-main; border-color: $border-color; }
  }

  &__save {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    label { font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: $text-muted; }
  }

  &__save-row {
    display: flex;
    gap: 0.5rem;
    input { flex: 1; min-width: 0; }
  }

  input {
    padding: 0.45rem 0.6rem;
    font: inherit;
    font-size: 0.9rem;
    color: $text-main;
    background-color: $bg-input;
    border: 1px solid $border-color;
    border-radius: 6px;
  }

  &__hint, &__empty, &__note {
    margin: 0;
    font-size: 0.82rem;
    color: $text-muted;
  }

  &__note {
    padding-top: 0.75rem;
    border-top: 1px solid $border-color;
  }

  &__heading {
    margin: 0 0 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: $text-muted;
  }

  &__list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid $border-color;
    border-radius: 8px;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.55rem 0.7rem;
    & + & { border-top: 1px solid $border-color; }
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__time {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: $text-muted;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  &__btn {
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: $text-main;
    background: transparent;
    border: 1px solid $border-color;
    border-radius: 6px;
    cursor: pointer;
    &:hover { background-color: rgba(var(--border-rgb), 0.4); }
    &:disabled { cursor: not-allowed; opacity: 0.55; }

    &--primary {
      color: var(--on-accent-blue);
      background-color: $accent-blue;
      border-color: transparent;
      &:hover:not(:disabled) { background-color: var(--accent-blue-light); color: var(--on-accent-light); }
    }

    &--danger { color: $accent-red-text; }
  }

  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 6: Export the UI from the feature index**

Append to `src/features/scene-library/index.ts`:

```ts
export { useMyScenesDialog } from './model/dialog-store';
export { default as MyScenesButton } from './ui/MyScenesButton';
export { default as MyScenesDialog } from './ui/MyScenesDialog';
```

- [ ] **Step 7: Give ProjectActions a `loadProject` prop**

In `src/features/project-io/ui/ProjectActions.tsx`:

1. Change the imports. Remove `toStorePatchFromProject`, `getActiveTheme` and `toEditorTheme`, and add the `VamsProjectData` type:

```tsx
import {
  buildProjectFile,
  createDefaultProjectFilename,
  downloadJSON,
  parseProjectFromFile,
  type VamsProjectData,
} from '@/entities/project/model/project-io';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
```

2. Replace the component signature and remove the `clearHistory` selector line:

```tsx
interface ProjectActionsProps {
  /** Loads an opened project file, keeping a backup of the current scene first. Resolves to the number of detached textures. */
  loadProject: (data: VamsProjectData, fileName: string) => Promise<number>;
}

export default function ProjectActions({ loadProject }: ProjectActionsProps) {
```

3. Replace the whole `handleProjectFileSelected` function:

```tsx
  const handleProjectFileSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let projectData: VamsProjectData;
    try {
      projectData = await parseProjectFromFile(file);
    } catch (error) {
      console.error(error);
      toast.error('Invalid project file');
      return;
    }
    try {
      const detached = await loadProject(projectData, file.name);
      if (detached > 0) toast.message('Some textures could not be loaded and were detached.');
      toast.success(`Project loaded: ${file.name}`);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't keep a backup of the current scene, so the project was not opened.");
    }
  };
```

- [ ] **Step 8: Give NewWorkspaceButton a `beforeReset` prop**

In `src/features/workspace-reset/ui/NewWorkspaceButton.tsx`:

1. Replace the signature:

```tsx
interface NewWorkspaceButtonProps {
  /** Keeps the current scene in My scenes. A rejection cancels the reset. */
  beforeReset: () => Promise<unknown>;
}

export default function NewWorkspaceButton({ beforeReset }: NewWorkspaceButtonProps) {
```

2. Change the confirm message to `message: 'Your current scene will be kept in My scenes as a backup.',`.

3. Replace the start of the `if (proceed) {` block so that the backup runs first:

```tsx
    if (proceed) {
      try {
        await beforeReset();
      } catch (error) {
        console.error(error);
        toast.error("Couldn't keep a backup of the current scene, so the workspace was not cleared.");
        return;
      }
      useVamsStore.setState({
```

The rest of the block is unchanged.

- [ ] **Step 9: Wire the top bar and mount the dialog**

In `src/widgets/layout/top-bar/TopBar.tsx`, add the imports:

```tsx
import type { VamsProjectData } from '@/entities/project/model/project-io';
import { MyScenesButton, backupCurrentScene, backupLabel, replaceScene } from '@/features/scene-library';
```

Add module-level helpers above the component:

```tsx
function loadProject(data: VamsProjectData, fileName: string): Promise<number> {
  return replaceScene(data, { reason: 'open-file', label: backupLabel(fileName) }).then((result) => result.detached);
}

function backupBeforeReset(): Promise<unknown> {
  return backupCurrentScene('new-workspace', 'Before New workspace');
}
```

Replace the two lines `<NewWorkspaceButton />` and `<ProjectActions />` with:

```tsx
        <NewWorkspaceButton beforeReset={backupBeforeReset} />
        <MyScenesButton />
        <ProjectActions loadProject={loadProject} />
```

In `src/pages/editor/ui/EditorApp.tsx`, add the import `import { MyScenesDialog } from '@/features/scene-library';`, and render `<MyScenesDialog />` directly after `<HelpCenter />`.

Confirm that nothing else renders these components without the new props:

```bash
grep -rn "<ProjectActions\|<NewWorkspaceButton" src
```

Expected: only `TopBar.tsx`.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/scene-library.test.ts`
Expected: PASS, BB-LIB-01..16.

- [ ] **Step 11: Check the dialog in a browser**

Run `npm run dev`, open `/app`, add a triangle, then open **My scenes** from the top bar. Check:
- Save, Open, Rename and Delete work in vellum and in blueprint.
- Tab reaches every control with a visible focus ring.
- Escape closes the dialog, and focus returns to the button.

Stop only the dev server you started.

- [ ] **Step 12: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/scene-library src/features/project-io/ui/ProjectActions.tsx src/features/workspace-reset/ui/NewWorkspaceButton.tsx src/widgets/layout/top-bar/TopBar.tsx src/pages/editor/ui/EditorApp.tsx tests/black-box/scene-library.test.ts
git diff --staged --stat
git commit -m "feat(scenes): add the My scenes dialog and back up before Open and New workspace"
```

---

### Task 5: Editor links, slide 07 starting points, stage URL

**Files:**
- Create: `src/pages/editor/model/editor-link.ts`
- Create: `src/pages/editor/model/useEditorLink.ts`
- Modify: `src/pages/editor/ui/EditorApp.tsx`
- Modify: `src/features/stage-mode/model/stage-controller.ts` (add `withStageParam`)
- Modify: `src/features/stage-mode/model/useStageMode.ts` (use it)
- Modify: `src/pages/home/model/content.ts`, `src/pages/home/ui/sections/TryItSection.tsx`, `src/pages/home/ui/sections/sections.scss`, `src/pages/home/ui/HomePage.tsx`
- Test: `tests/black-box/editor-links.test.ts` (append BB-LINK-05..13); `tests/black-box/home-stage.test.ts` (extend BB-HOME-17 with one assertion)

**Interfaces:**
- Consumes:
  - Task 2: `getPreset`, `isPresetSlug`, `PRESET_LINKS`, `presetHref`;
  - Task 3: `replaceScene`, `backupLabel`;
  - Task 4: `useMyScenesDialog`;
  - `getLessonById` from `@/features/lesson-engine/model/lesson-registry`.
- Produces:
  - `type EditorLink`, `interface LinkTargets`;
  - `parseEditorLink(search, targets?)`, `stripEditorLinkParams(search)`;
  - `applyEditorLink(link, { openLibrary })`, `INVALID_LINK_MESSAGE`;
  - `useEditorLink()`;
  - `withStageParam(search, active)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/editor-links.test.ts`. Move the imports to the top of the file:

```ts
import { afterEach } from 'vitest';
import { h, render } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { useVamsStore } from '@/core/store';
import { createMemoryLibrary, setSceneLibraryForTests, type SceneLibrary } from '@/entities/project/model/scene-library';
import {
  applyEditorLink,
  parseEditorLink,
  stripEditorLinkParams,
} from '@/pages/editor/model/editor-link';
import { useEditorLink } from '@/pages/editor/model/useEditorLink';
import { withStageParam } from '@/features/stage-mode/model/stage-controller';
import TryItSection from '@/pages/home/ui/sections/TryItSection';
import { addTriangle } from '../helpers/store';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function memoryLibrary(): SceneLibrary {
  const library = createMemoryLibrary();
  setSceneLibraryForTests(library);
  return library;
}

const noop = { openLibrary: () => {} };

describe('BB-LINK-05: Links are parsed against real lessons and scenes', () => {
  it('recognises lessons, scenes, and rejects anything else', () => {
    expect(parseEditorLink('')).toEqual({ kind: 'none' });
    expect(parseEditorLink('?stage')).toEqual({ kind: 'none' });
    expect(parseEditorLink('?lesson=primitives-demo-1')).toEqual({ kind: 'lesson', id: 'primitives-demo-1' });
    expect(parseEditorLink('?scene=triangle')).toEqual({ kind: 'scene', slug: 'triangle' });
    expect(parseEditorLink('?scene=%20triangle%20')).toEqual({ kind: 'scene', slug: 'triangle' });
    expect(parseEditorLink('?scene=Triangle')).toEqual({ kind: 'invalid', param: 'scene', value: 'Triangle' });
    expect(parseEditorLink('?lesson=')).toEqual({ kind: 'invalid', param: 'lesson', value: '' });
    // lesson wins over scene, even when the lesson is unknown
    expect(parseEditorLink('?lesson=nope&scene=triangle')).toEqual({ kind: 'invalid', param: 'lesson', value: 'nope' });
    expect(parseEditorLink('?scene=x', { isLesson: () => false, isScene: () => true })).toEqual({ kind: 'scene', slug: 'x' });
  });
});

describe('BB-LINK-06: Link parameters are removed and every other parameter is kept', () => {
  it('strips lesson and scene only', () => {
    expect(stripEditorLinkParams('?scene=triangle')).toBe('');
    expect(stripEditorLinkParams('?a=1&scene=x&b=2')).toBe('?a=1&b=2');
    expect(stripEditorLinkParams('?lesson=x&scene=y')).toBe('');
    expect(stripEditorLinkParams('')).toBe('');
  });
});

describe('BB-LINK-07: A lesson link opens the lesson in its section', () => {
  it('switches section, starts the lesson and skips the welcome card', async () => {
    const tri = addTriangle();
    await applyEditorLink({ kind: 'lesson', id: 'transforms-demo-1' }, noop);
    const s = useVamsStore.getState();
    expect(s.activeSection).toBe('Transforms');
    expect(s.activeLessonId).toBe('transforms-demo-1');
    expect(s.appMode).toBe('Lesson');
    expect(s.sceneBackup?.map((o) => o.id)).toEqual([tri.id]);
    expect(s.hasSeenWelcome).toBe(true);
    s.clearLessonState();
    s.setAppMode('Author');
  });
});

describe('BB-LINK-08: A scene link keeps the current scene, then opens the prepared one', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('backs up, loads the preset and switches to its section', async () => {
    const library = memoryLibrary();
    addTriangle();
    await applyEditorLink({ kind: 'scene', slug: 'transforms' }, noop);
    const s = useVamsStore.getState();
    expect(s.objects.map((o) => o.name)).toEqual(['House', 'Walls', 'Roof', 'Sun']);
    expect(s.activeSection).toBe('Transforms');
    expect((await library.list()).map((e) => e.name)).toEqual(['Before opening ‘Transforms’']);
  });
});

describe('BB-LINK-09: A scene link on an empty canvas makes no backup', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('loads without writing to the library', async () => {
    const library = memoryLibrary();
    await applyEditorLink({ kind: 'scene', slug: 'triangle' }, noop);
    expect(useVamsStore.getState().objects.map((o) => o.name)).toEqual(['Triangle']);
    expect(await library.list()).toEqual([]);
  });
});

describe('BB-LINK-10: A scene link never replaces work it could not back up', () => {
  afterEach(() => setSceneLibraryForTests(null));
  it('leaves the scene when the backup fails', async () => {
    const failing = createMemoryLibrary();
    setSceneLibraryForTests({ ...failing, save: () => Promise.reject(new Error('full')) });
    const tri = addTriangle();
    await applyEditorLink({ kind: 'scene', slug: 'triangle' }, noop);
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual([tri.id]);
  });
});

describe('BB-LINK-11: An invalid link changes nothing but the welcome card', () => {
  it('keeps the scene, mode and section', async () => {
    const tri = addTriangle();
    const before = useVamsStore.getState().activeSection;
    await applyEditorLink({ kind: 'invalid', param: 'scene', value: 'nope' }, noop);
    const s = useVamsStore.getState();
    expect(s.objects.map((o) => o.id)).toEqual([tri.id]);
    expect(s.appMode).toBe('Author');
    expect(s.activeSection).toBe(before);
    expect(s.hasSeenWelcome).toBe(true);
  });
});

describe('BB-LINK-12: A link applies once: the URL is cleaned so a reload does not repeat it', () => {
  afterEach(() => {
    setSceneLibraryForTests(null);
    window.history.replaceState(null, '', '/');
  });
  it('removes its parameter, keeps the rest, and a second mount does nothing', async () => {
    const library = memoryLibrary();
    addTriangle();
    window.history.replaceState(null, '', '/app?scene=transforms&x=1#h');
    function Probe() {
      useEditorLink();
      return null;
    }
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(Probe, null), host);
    await settle();
    expect(window.location.pathname).toBe('/app');
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#h');
    expect(useVamsStore.getState().objects[0].name).toBe('House');

    // Simulate a reload: the editor mounts again on the cleaned URL.
    render(null, host);
    render(h(Probe, null), host);
    await settle();
    expect((await library.list()).filter((e) => e.kind === 'backup')).toHaveLength(1);
    expect(useVamsStore.getState().objects[0].name).toBe('House');
    render(null, host);
    host.remove();
  });
});

describe('BB-LINK-13: Slide 07 offers the prepared scenes, and stage mode keeps other URL parameters', () => {
  it('links each preset and toggles only the stage parameter', () => {
    const html = renderToString(h(TryItSection, null));
    expect(html).toContain('Start from:');
    for (const p of PRESET_LINKS) expect(html).toContain(`href="${presetHref(p.slug)}"`);

    expect(withStageParam('', true)).toBe('?stage');
    expect(withStageParam('?stage', false)).toBe('');
    expect(withStageParam('?x=1', true)).toBe('?stage&x=1');
    expect(withStageParam('?stage&x=1', false)).toBe('?x=1');
    expect(withStageParam('?stage=&x=1', true)).toBe('?stage&x=1');
  });
});
```

In `tests/black-box/home-stage.test.ts`, inside BB-HOME-17, add the line below directly after `expect(window.location.pathname).toBe('/app');`. The test's ID and title stay as they are.

```ts
    expect(window.location.search).toBe('?scene=triangle');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/editor-links.test.ts tests/black-box/home-stage.test.ts`
Expected: FAIL. The modules are missing, `withStageParam` is not exported, and the BB-HOME-17 search is `''`.

- [ ] **Step 3: Implement link parsing and application**

Create `src/pages/editor/model/editor-link.ts`:

```ts
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { getPreset, isPresetSlug } from '@/entities/project/model/scene-presets';
import { getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import { backupLabel, replaceScene } from '@/features/scene-library';

/** What a /app URL asks the editor to open: ?lesson=<id> or ?scene=<slug>. */
export type EditorLink =
  | { kind: 'none' }
  | { kind: 'lesson'; id: string }
  | { kind: 'scene'; slug: string }
  | { kind: 'invalid'; param: 'lesson' | 'scene'; value: string };

export interface LinkTargets {
  isLesson(id: string): boolean;
  isScene(slug: string): boolean;
}

const LINK_PARAMS = ['lesson', 'scene'] as const;

const DEFAULT_TARGETS: LinkTargets = {
  isLesson: (id) => getLessonById(id) !== undefined,
  isScene: isPresetSlug,
};

export const INVALID_LINK_MESSAGE = "That link doesn't match a lesson or scene. The editor opened as usual.";

/** A lesson link wins over a scene link when both are present. */
export function parseEditorLink(search: string, targets: LinkTargets = DEFAULT_TARGETS): EditorLink {
  const params = new URLSearchParams(search);
  const lesson = params.get('lesson');
  if (lesson !== null) {
    const id = lesson.trim();
    return id && targets.isLesson(id) ? { kind: 'lesson', id } : { kind: 'invalid', param: 'lesson', value: id };
  }
  const scene = params.get('scene');
  if (scene !== null) {
    const slug = scene.trim();
    return slug && targets.isScene(slug) ? { kind: 'scene', slug } : { kind: 'invalid', param: 'scene', value: slug };
  }
  return { kind: 'none' };
}

export function stripEditorLinkParams(search: string): string {
  const params = new URLSearchParams(search);
  LINK_PARAMS.forEach((name) => params.delete(name));
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

export interface ApplyDeps {
  openLibrary: () => void;
}

/** Drive the store to what the link asks for, using the same actions as the GUI. */
export async function applyEditorLink(link: EditorLink, deps: ApplyDeps): Promise<void> {
  if (link.kind === 'none') return;
  // A linked visitor arrives with a purpose; the welcome card would cover it.
  useVamsStore.getState().markWelcomeSeen();

  if (link.kind === 'invalid') {
    toast.error(INVALID_LINK_MESSAGE);
    return;
  }

  if (link.kind === 'lesson') {
    const lesson = getLessonById(link.id);
    if (!lesson) return;
    if (useVamsStore.getState().activeLessonId) useVamsStore.getState().clearLessonState();
    const state = useVamsStore.getState();
    state.setActiveSection(lesson.section);
    state.setActiveLesson(lesson.id);
    state.setAppMode('Lesson');
    return;
  }

  const preset = getPreset(link.slug);
  if (!preset) return;
  try {
    const { backedUp } = await replaceScene(preset.data, { reason: 'scene-link', label: backupLabel(preset.title) });
    useVamsStore.getState().setActiveSection(preset.section);
    if (backedUp) {
      toast.success(`Opened ‘${preset.title}’`, {
        description: 'Your previous scene is in My scenes.',
        action: { label: 'My scenes', onClick: deps.openLibrary },
      });
    } else {
      toast.success(`Opened ‘${preset.title}’`);
    }
  } catch (error) {
    console.error(error);
    toast.error(`Couldn't keep a backup of your current scene, so ‘${preset.title}’ was not opened.`);
  }
}
```

Create `src/pages/editor/model/useEditorLink.ts`:

```ts
import { useEffect } from 'react';
import { useMyScenesDialog } from '@/features/scene-library';
import { applyEditorLink, parseEditorLink, stripEditorLinkParams } from './editor-link';

const openLibrary = () => useMyScenesDialog.getState().open();

/**
 * Apply a ?lesson= or ?scene= link once when the editor mounts. The parameter is removed from the
 * URL first, so a reload (or a crash mid-way) never applies it twice.
 */
export function useEditorLink(): void {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const link = parseEditorLink(search);
    if (link.kind === 'none') return;
    window.history.replaceState(window.history.state, '', `${pathname}${stripEditorLinkParams(search)}${hash}`);
    void applyEditorLink(link, { openLibrary });
  }, []);
}
```

In `src/pages/editor/ui/EditorApp.tsx`, add `import { useEditorLink } from '../model/useEditorLink';`, and call `useEditorLink();` directly after `useKeyboardShortcuts();`.

- [ ] **Step 4: Keep other parameters in the stage URL**

Append to `src/features/stage-mode/model/stage-controller.ts`:

```ts
/** Add or remove the bare `stage` flag and keep every other query parameter. */
export function withStageParam(search: string, active: boolean): string {
  const params = new URLSearchParams(search);
  params.delete('stage');
  const rest = params.toString();
  if (!active) return rest ? `?${rest}` : '';
  return rest ? `?stage&${rest}` : '?stage';
}
```

In `src/features/stage-mode/model/useStageMode.ts`, add `withStageParam` to the existing import from `./stage-controller`. Then replace the URL effect's body:

```ts
  useEffect(() => {
    if (!active && !urlTouchedRef.current) return;
    urlTouchedRef.current = active;
    const { pathname, search } = window.location;
    const hash = `#${sectionIds[index]}`;
    window.history.replaceState(window.history.state, '', `${pathname}${withStageParam(search, active)}${hash}`);
  }, [active, index, sectionIds]);
```

- [ ] **Step 5: Add the starting points to slide 07 and hand over to Triangle**

In `src/pages/home/model/content.ts`, add a field to `TRY_IT` after `note`:

```ts
  startFrom: 'Start from:',
```

Replace `src/pages/home/ui/sections/TryItSection.tsx` with:

```tsx
import { PRESET_LINKS, presetHref } from '@/entities/project/model/preset-links';
import { TRY_IT } from '@/pages/home/model/content';
import SectionHeading from './SectionHeading';

export default function TryItSection() {
  return (
    <section id="try" className="home-section home-section--try" data-slide="" aria-labelledby="try-title">
      <SectionHeading id="try" title={TRY_IT.title} />
      <p className="home__actions">
        <a className="home__cta home__cta--large" href="/app">{TRY_IT.cta}</a>
      </p>
      <nav className="try-presets" aria-label="Prepared scenes">
        <span className="try-presets__label">{TRY_IT.startFrom}</span>
        <ul className="try-presets__list">
          {PRESET_LINKS.map((preset) => (
            <li key={preset.slug}>
              <a href={presetHref(preset.slug)}>{preset.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      <p className="try-url">{TRY_IT.displayUrl}</p>
      <p className="try-note">{TRY_IT.note}</p>
    </section>
  );
}
```

Append to `src/pages/home/ui/sections/sections.scss`. It uses rem units, so the links scale with stage mode's root font size.

```scss
.try-presets {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.4rem 0.75rem;
  margin-top: 1.25rem;
  font-family: var(--font-mono);
  font-size: 0.95rem;

  &__label {
    color: var(--ink-muted);
  }

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;

    li + li::before {
      content: '·';
      margin-right: 0.75rem;
      color: var(--ink-faint);
    }
  }

  a {
    color: var(--ink);
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 0.2em;

    &:hover {
      text-decoration-color: var(--accent);
    }

    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 3px;
      border-radius: 2px;
    }
  }
}
```

If `sections.scss` centres slide 07 some other way (for example with `text-align`), match that alignment, and keep the links readable at stage scale.

In `src/pages/home/ui/HomePage.tsx`, add `import { presetHref } from '@/entities/project/model/preset-links';`. Then change the stage hook call:

```tsx
  const stage = useStageMode(SECTION_IDS, () => route(presetHref('triangle')));
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/editor-links.test.ts tests/black-box/home-stage.test.ts`
Expected: PASS, including BB-LINK-01..13 and BB-HOME-01..19.

- [ ] **Step 7: Check that the home bundle carries no store**

Run: `npm run build`. Then search the home page's own entry chunk for a string that exists only in the store:

```bash
grep -l "vams-storage" dist/assets/main-*.js || echo "store not in main chunk"
```

Expected: `store not in main chunk`. If the string is found, a home import pulled in the store. Fix the import before committing.

- [ ] **Step 8: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/editor/model/editor-link.ts src/pages/editor/model/useEditorLink.ts src/pages/editor/ui/EditorApp.tsx src/features/stage-mode/model/stage-controller.ts src/features/stage-mode/model/useStageMode.ts src/pages/home/model/content.ts src/pages/home/ui/sections/TryItSection.tsx src/pages/home/ui/sections/sections.scss src/pages/home/ui/HomePage.tsx tests/black-box/editor-links.test.ts tests/black-box/home-stage.test.ts
git diff --staged --stat
git commit -m "feat(editor): open lessons and prepared scenes from /app links and list them on the last slide"
```

---

### Task 6: Crash recovery

**Files:**
- Create: `src/core/store/recovery-signal.ts`
- Modify: `src/core/store/index.ts`
- Create: `src/features/crash-recovery/ui/EditorErrorBoundary.tsx`
- Create: `src/features/crash-recovery/ui/RecoveryScreen.tsx`
- Create: `src/features/crash-recovery/ui/recovery-screen.scss`
- Create: `src/features/crash-recovery/index.ts`
- Create: `src/pages/editor/model/recovery.ts`
- Modify: `src/pages/editor/ui/EditorPage.tsx`, `src/pages/editor/ui/EditorApp.tsx`, `src/app/SiteApp.tsx`
- Test: `tests/black-box/crash-recovery.test.ts` (new; BB-RECOVER-01..08)

**Interfaces:**
- Consumes: from Task 3, `backupCurrentScene`, `backupCorruptSave` and `downloadText`; from Task 4, `useMyScenesDialog`; from project-io, `buildProjectFile`, `createDefaultProjectFilename` and `downloadJSON`.
- Produces:
  - `STORAGE_KEY` (exported from `@/core/store`), `reportCorruptSave(raw)`, `takeCorruptSave()`;
  - `EditorErrorBoundary` (props `fallback: (error: Error) => ReactNode`), `isChunkLoadError(error)`;
  - `RecoveryScreen` (props `error: Error`, `actions: RecoveryActions`) and `interface RecoveryActions { reload(): void; download(): void; startFresh(): Promise<void> }`;
  - from `pages/editor/model/recovery.ts`: `downloadWork()`, `startFresh()`, `keepCorruptSave(raw, openLibrary?)`, `useCorruptSaveNotice()`.

- [ ] **Step 1: Write the failing tests**

Create `tests/black-box/crash-recovery.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-RECOVER
 * Crash recovery: lesson reloads, corrupt saves, the editor error boundary and the recovery screen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render } from 'preact';
import { useVamsStore, STORAGE_KEY } from '@/core/store';
import { takeCorruptSave } from '@/core/store/recovery-signal';
import { createMemoryLibrary, setSceneLibraryForTests } from '@/entities/project/model/scene-library';
import { EditorErrorBoundary, RecoveryScreen, isChunkLoadError, type RecoveryActions } from '@/features/crash-recovery';
import { keepCorruptSave, startFresh } from '@/pages/editor/model/recovery';
import { addQuad, addTriangle } from '../helpers/store';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Spies this file creates, restored after each test. vi.restoreAllMocks() would also undo the
 * console silencing that tests/setup.ts installs for the whole run.
 */
const spies: { mockRestore(): void }[] = [];
function track<T extends { mockRestore(): void }>(spy: T): T {
  spies.push(spy);
  return spy;
}

function stubReload() {
  return track(vi.spyOn(window.location, 'reload').mockImplementation(() => {}));
}

afterEach(() => {
  spies.splice(0).forEach((spy) => spy.mockRestore());
  setSceneLibraryForTests(null);
  sessionStorage.clear();
});

describe('BB-RECOVER-01: Reloading mid-lesson restores the student’s own scene', () => {
  it('leaves the lesson and puts the backed-up scene back', async () => {
    const student = addTriangle();
    useVamsStore.getState().setActiveLesson('primitives-demo-1');
    addQuad(); // the lesson's scene
    await useVamsStore.persist.rehydrate();
    const s = useVamsStore.getState();
    expect(s.objects.map((o) => o.id)).toEqual([student.id]);
    expect(s.sceneBackup).toBeNull();
    expect(s.activeLessonId).toBeNull();
  });
});

describe('BB-RECOVER-02: A normal reload leaves the scene alone', () => {
  it('keeps objects when no lesson backup was saved', async () => {
    const tri = addTriangle();
    await useVamsStore.persist.rehydrate();
    expect(useVamsStore.getState().objects.map((o) => o.id)).toEqual([tri.id]);
  });
});

describe('BB-RECOVER-03: An unreadable save is handed over, not deleted silently', () => {
  it('removes the key, keeps the text for the editor, and does not reload', async () => {
    const reload = stubReload();
    localStorage.setItem(STORAGE_KEY, '{"state":');
    await useVamsStore.persist.rehydrate();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(takeCorruptSave()).toBe('{"state":');
    expect(takeCorruptSave()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('BB-RECOVER-04: Lesson backups are saved with the scene', () => {
  it('persists sceneBackup while a lesson runs', () => {
    addTriangle();
    useVamsStore.getState().setActiveLesson('primitives-demo-1');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.version).toBe(7);
    expect(saved.state.sceneBackup).toHaveLength(1);
    useVamsStore.getState().clearLessonState();
  });
});

function Boom({ error }: { error: Error }): null {
  throw error;
}

function mountBoundary(error: Error, actions: RecoveryActions) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(
    h(EditorErrorBoundary, { fallback: (e: Error) => h(RecoveryScreen, { error: e, actions }) }, h(Boom, { error })),
    host,
  );
  return host;
}

const fakeActions = (): RecoveryActions => ({ reload: vi.fn(), download: vi.fn(), startFresh: vi.fn().mockResolvedValue(undefined) });

describe('BB-RECOVER-05: A render crash shows the recovery screen instead of a blank page', () => {
  it('offers Reload, Download my work and Start fresh, with the error in details', async () => {
    const actions = fakeActions();
    const host = mountBoundary(new Error('kaboom'), actions);
    await settle();
    expect(host.querySelector('h1')?.textContent).toBe('VAMS hit a problem');
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(['Reload', 'Download my work', 'Start fresh']);
    expect(host.querySelector('details pre')?.textContent).toContain('kaboom');
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(actions.reload).toHaveBeenCalledTimes(1);
    render(null, host);
    host.remove();
  });
});

describe('BB-RECOVER-06: A failed editor download reloads once, then shows the recovery screen', () => {
  it('reloads on the first chunk error in a tab session only', async () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/EditorApp-x.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('kaboom'))).toBe(false);

    const reload = stubReload();
    const chunkError = new TypeError('Failed to fetch dynamically imported module: /assets/EditorApp-x.js');
    let host = mountBoundary(chunkError, fakeActions());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
    render(null, host);
    host.remove();

    host = mountBoundary(chunkError, fakeActions());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(host.querySelector('h1')?.textContent).toBe('VAMS hit a problem');
    render(null, host);
    host.remove();
  });
});

describe('BB-RECOVER-07: An unreadable save is kept in My scenes', () => {
  it('stores the raw text as a corrupt-save backup', async () => {
    const library = createMemoryLibrary();
    setSceneLibraryForTests(library);
    await keepCorruptSave('{"state":', () => {});
    const [entry] = await library.list();
    expect(entry).toMatchObject({ kind: 'backup', reason: 'corrupt-save', name: 'Unreadable saved scene', file: null, raw: '{"state":' });
  });
});

describe('BB-RECOVER-08: Start fresh keeps the scene first, as a backup or as a download', () => {
  it('backs up to My scenes, clears the save and reloads', async () => {
    const library = createMemoryLibrary();
    setSceneLibraryForTests(library);
    const reload = stubReload();
    addTriangle();
    await startFresh();
    expect((await library.list()).map((e) => e.reason)).toEqual(['recovery']);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('downloads the scene when the library cannot be written', async () => {
    const failing = createMemoryLibrary();
    setSceneLibraryForTests({ ...failing, save: () => Promise.reject(new Error('full')) });
    const reload = stubReload();
    // happy-dom follows a clicked download link, which would move the test page to the blob URL.
    const clicked = track(vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}));
    addTriangle();
    await startFresh();
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/crash-recovery.test.ts`
Expected: FAIL, because the modules are missing and `STORAGE_KEY` is not exported.

- [ ] **Step 3: Change the store's persistence**

Create `src/core/store/recovery-signal.ts`:

```ts
/**
 * Saved editor data that failed to load. The store hands it here instead of deleting it, and
 * the editor collects it once on mount to keep a copy in My scenes.
 */
let pending: string | null = null;

export function reportCorruptSave(raw: string | null): void {
  if (raw) pending = raw;
}

export function takeCorruptSave(): string | null {
  const raw = pending;
  pending = null;
  return raw;
}
```

In `src/core/store/index.ts`:

1. Add `import { reportCorruptSave } from '@/core/store/recovery-signal';`, and declare `export const STORAGE_KEY = 'vams-storage';` above `useVamsStore`.
2. In `resetProject`, replace `localStorage.removeItem('vams-storage');` with `localStorage.removeItem(STORAGE_KEY);`.
3. Set `name: STORAGE_KEY,`.
4. Replace the whole `onRehydrateStorage` option:

```ts
      onRehydrateStorage: () => {
        return (rehydratedState, error) => {
          if (error) {
            // Keep the unreadable text for the editor to back up, then start from a blank scene.
            console.error('Saved editor data could not be read; starting fresh and keeping a copy.', error);
            let raw: string | null = null;
            try {
              raw = localStorage.getItem(STORAGE_KEY);
              localStorage.removeItem(STORAGE_KEY);
            } catch {
              // Storage is unavailable; there is nothing to keep.
            }
            reportCorruptSave(raw);
            return;
          }
          // A lesson backup that survived a reload means the page reloaded mid-lesson:
          // put the student's own scene back and leave the lesson.
          if (rehydratedState?.sceneBackup) rehydratedState.clearLessonState();
        };
      },
```

5. Add the five lesson backups to the end of the `partialize` object. They are optional for old saves, so `version` stays 7:

```ts
        sceneBackup: state.sceneBackup,
        callbacksBackup: state.callbacksBackup,
        canvasBackgroundColorBackup: state.canvasBackgroundColorBackup,
        viewportLimitsBackup: state.viewportLimitsBackup,
        uploadedTexturesBackup: state.uploadedTexturesBackup,
```

- [ ] **Step 4: Create the boundary and the recovery screen**

Create `src/features/crash-recovery/ui/EditorErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react';

const CHUNK_RELOAD_FLAG = 'vams-chunk-reload';
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch/i;

/** True for errors thrown when a lazily loaded file cannot be fetched (for example after a deploy). */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR.test(message);
}

/** Reload once per tab session to fetch fresh files. Returns false when that was already tried. */
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

interface Props {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
  reloading: boolean;
}

/**
 * Catches editor render errors and shows `fallback` instead of a blank page.
 * Preact treats an error as handled only when the boundary's state changes, so both paths set state.
 */
export default class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false };

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error) && reloadOnce()) {
      this.setState({ reloading: true });
      return;
    }
    this.setState({ error: error instanceof Error ? error : new Error(String(error)), reloading: false });
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error);
    if (this.state.reloading) return null;
    return this.props.children;
  }
}
```

Create `src/features/crash-recovery/ui/RecoveryScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import './recovery-screen.scss';

export interface RecoveryActions {
  reload(): void;
  download(): void;
  startFresh(): Promise<void>;
}

interface Props {
  error: Error;
  actions: RecoveryActions;
}

export default function RecoveryScreen({ error, actions }: Props) {
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const startFresh = async () => {
    setBusy(true);
    try {
      await actions.startFresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="recovery" aria-labelledby="recovery-title">
      <div className="recovery__panel">
        <h1 id="recovery-title" className="recovery__title" ref={headingRef} tabIndex={-1}>
          VAMS hit a problem
        </h1>
        <p className="recovery__lead">Your work is still on this device. Choose what to do next.</p>
        <div className="recovery__actions">
          <button type="button" className="recovery__btn recovery__btn--primary" onClick={actions.reload}>
            Reload
          </button>
          <button type="button" className="recovery__btn" onClick={actions.download}>
            Download my work
          </button>
          <button type="button" className="recovery__btn" disabled={busy} onClick={() => void startFresh()}>
            Start fresh
          </button>
        </div>
        <p className="recovery__hint">Start fresh keeps a copy of your scene in My scenes, then opens an empty editor.</p>
        <details className="recovery__details">
          <summary>Technical details</summary>
          <pre>{error.message || String(error)}</pre>
        </details>
      </div>
    </main>
  );
}
```

Create `src/features/crash-recovery/ui/recovery-screen.scss`:

```scss
.recovery {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 2rem 1.25rem;
  color: var(--ink);
  background-color: var(--paper);
  background-image:
    linear-gradient(var(--grid-minor) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-minor) 1px, transparent 1px);
  background-size: 24px 24px;

  &__panel {
    width: min(560px, 100%);
    padding: 2rem 2rem 1.5rem;
    background-color: var(--paper-raised);
    border: 1px solid var(--rule);
    border-top: 4px solid var(--accent);
    border-radius: 4px;
  }

  &__title {
    margin: 0 0 0.5rem;
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 500;
    &:focus { outline: none; }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 4px; }
  }

  &__lead { margin: 0 0 1.5rem; font-size: 1.05rem; color: var(--ink-muted); }

  &__actions { display: flex; flex-wrap: wrap; gap: 0.6rem; }

  &__btn {
    padding: 0.6rem 1.1rem;
    font-family: var(--font-ui);
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--ink);
    background: transparent;
    border: 1px solid var(--rule);
    border-radius: 4px;
    cursor: pointer;
    &:hover { border-color: var(--ink); }
    &:disabled { cursor: progress; opacity: 0.6; }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

    &--primary {
      color: var(--on-accent);
      background-color: var(--accent);
      border-color: var(--accent);
    }
  }

  &__hint { margin: 1rem 0 0; font-size: 0.85rem; color: var(--ink-muted); }

  &__details {
    margin-top: 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--ink-muted);
    summary { cursor: pointer; }
    pre {
      margin: 0.5rem 0 0;
      padding: 0.75rem;
      overflow-x: auto;
      white-space: pre-wrap;
      color: var(--code-ink);
      background-color: var(--code-bg);
      border-radius: 4px;
    }
  }
}
```

Create `src/features/crash-recovery/index.ts`:

```ts
export { default as EditorErrorBoundary, isChunkLoadError } from './ui/EditorErrorBoundary';
export { default as RecoveryScreen, type RecoveryActions } from './ui/RecoveryScreen';
```

- [ ] **Step 5: Implement the recovery actions and the corrupt-save notice**

Create `src/pages/editor/model/recovery.ts`:

```ts
import { useEffect } from 'react';
import { toast } from 'sonner';
import { STORAGE_KEY, useVamsStore } from '@/core/store';
import { takeCorruptSave } from '@/core/store/recovery-signal';
import { buildProjectFile, createDefaultProjectFilename, downloadJSON } from '@/entities/project/model/project-io';
import { backupCorruptSave, backupCurrentScene, downloadText, useMyScenesDialog } from '@/features/scene-library';

function readSavedText(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Download the editor's scene; if the scene itself cannot be read, download the saved text instead. */
export function downloadWork(): void {
  const filename = createDefaultProjectFilename('vams-recovered');
  try {
    downloadJSON(filename, buildProjectFile(useVamsStore.getState()));
  } catch (error) {
    console.error(error);
    const raw = readSavedText();
    if (raw !== null) downloadText(filename, raw);
  }
}

/** Keep the scene (in My scenes, or as a download when that fails), clear the save, and reload. */
export async function startFresh(): Promise<void> {
  try {
    await backupCurrentScene('recovery', 'Before Start fresh');
  } catch (error) {
    console.error(error);
    downloadWork();
  }
  useVamsStore.persist.clearStorage();
  window.location.reload();
}

const openLibrary = () => useMyScenesDialog.getState().open();

/** Keep an unreadable save in My scenes and tell the student; offer a download if that fails. */
export async function keepCorruptSave(raw: string, open: () => void = openLibrary): Promise<void> {
  try {
    await backupCorruptSave(raw);
    toast.warning("Your saved scene couldn't be read, so VAMS started fresh. A copy is in My scenes.", {
      action: { label: 'My scenes', onClick: open },
      duration: 15000,
    });
  } catch (error) {
    console.error(error);
    toast.warning("Your saved scene couldn't be read, so VAMS started fresh.", {
      action: { label: 'Download', onClick: () => downloadText('vams-unreadable-save.json', raw) },
      duration: Infinity,
    });
  }
}

/** Collect a corrupt save reported during hydration, once per editor mount. */
export function useCorruptSaveNotice(): void {
  useEffect(() => {
    const raw = takeCorruptSave();
    if (raw) void keepCorruptSave(raw);
  }, []);
}
```

- [ ] **Step 6: Wire the editor page, the editor app and the site app**

Replace `src/pages/editor/ui/EditorPage.tsx` with:

```tsx
import { Suspense, lazy, useEffect, useState } from 'react';
import { EditorErrorBoundary, RecoveryScreen, type RecoveryActions } from '@/features/crash-recovery';
import EditorLoading from './EditorLoading';

const EditorApp = lazy(() => import('./EditorApp'));
const loadRecovery = () => import('../model/recovery');

/** Loaded on demand, so the store stays out of the bundle every page shares. */
const recoveryActions: RecoveryActions = {
  reload: () => window.location.reload(),
  download: () => {
    loadRecovery()
      .then((m) => m.downloadWork())
      .catch((error) => console.error(error));
  },
  startFresh: () => loadRecovery().then((m) => m.startFresh()),
};

export default function EditorPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Two-pass render: prerendering and hydration both see the loading shell; the editor mounts afterwards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return <EditorLoading />;
  return (
    <EditorErrorBoundary fallback={(error) => <RecoveryScreen error={error} actions={recoveryActions} />}>
      <Suspense fallback={<EditorLoading />}>
        <EditorApp />
      </Suspense>
    </EditorErrorBoundary>
  );
}
```

In `src/pages/editor/ui/EditorApp.tsx`, add `import { useCorruptSaveNotice } from '../model/recovery';`, and call `useCorruptSaveNotice();` directly after `useEditorLink();`.

In `src/app/SiteApp.tsx`, the editor boundary now owns the chunk-load reload. Remove `CHUNK_RELOAD_FLAG` and `recoverFromRenderError`, and replace them with a handler that only logs. For pages other than `/app` this is what the old handler did:

```tsx
/** The editor has its own boundary with a recovery screen; other pages only log. */
function logRenderError(error: unknown) {
  console.error('Render error', error);
}
```

Change `<ErrorBoundary onError={recoverFromRenderError}>` to `<ErrorBoundary onError={logRenderError}>`. The imports stay the same; `findRouteMeta` is still used by `syncDocumentTitle`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/crash-recovery.test.ts`
Expected: PASS, BB-RECOVER-01..08.

Then run the whole suite, `npm test`. Any test asserting the old automatic reset or the `SiteApp` reload handler must be updated to the new behaviour, with its ID kept. Record which ones you changed in your report.

- [ ] **Step 8: Check the recovery screen in a browser**

Run `npm run dev`. Temporarily add `throw new Error('test crash');` as the first line of `EditorApp`'s body, open `/app`, and check:
- The recovery screen appears in both themes.
- Download my work saves a `.vams` file.
- The heading has focus.

Remove the temporary line, and confirm `git diff` shows no change to it. Stop only the dev server you started.

- [ ] **Step 9: Run all checks, confirm the store is still out of the main chunk, and commit**

```bash
npm run lint && npm run build && npm test
grep -l "vams-storage" dist/assets/main-*.js || echo "store not in main chunk"
git checkout -- tests/reports
git add src/core/store/recovery-signal.ts src/core/store/index.ts src/features/crash-recovery src/pages/editor/model/recovery.ts src/pages/editor/ui/EditorPage.tsx src/pages/editor/ui/EditorApp.tsx src/app/SiteApp.tsx tests/black-box/crash-recovery.test.ts
git diff --staged --stat
git commit -m "feat(editor): show a recovery screen on crashes and keep unreadable saves and mid-lesson scenes"
```

---

### Task 7: Offline app

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/app/pwa/pwa-options.ts`
- Create: `src/app/pwa/register.ts`
- Create: `src/app/pwa/UpdateNotice.tsx`
- Create: `src/app/pwa/update-notice.scss`
- Create: `tests/helpers/pwa-register-stub.ts`
- Create: `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`
- Modify: `vite.config.ts`, `vitest.config.ts`, `tsconfig.app.json`, `index.html`, `public/_headers`, `src/app/SiteApp.tsx`
- Test: `tests/black-box/offline-app.test.ts` (new; BB-PWA-01..07)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `buildPwaOptions(): Partial<VitePWAOptions>`, `toRouteUrl(url): string | null`, `routeDocumentsTransform`, `PWA_THEME_COLOR`, `PWA_BACKGROUND_COLOR`;
  - `registerServiceWorker(events)`;
  - the default export `UpdateNotice` (props `register?`, `offlineNoticeMs?`).

- [ ] **Step 1: Install dependencies**

```bash
npm install -D vite-plugin-pwa@^2.0.0 workbox-window@^7.4.0
```

- [ ] **Step 2: Write the failing tests**

Create `tests/black-box/offline-app.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-PWA
 * Offline app: service-worker options, the precache route mapping, icons and the update notice.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { h, render } from 'preact';
import { buildPwaOptions, routeDocumentsTransform, toRouteUrl } from '@/app/pwa/pwa-options';
import UpdateNotice from '@/app/pwa/UpdateNotice';
import type { ServiceWorkerEvents } from '@/app/pwa/register';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

type ManifestIcon = { src: string; purpose?: string };

function manifestOf(): { icons?: ManifestIcon[]; [key: string]: unknown } {
  const manifest = buildPwaOptions().manifest;
  return manifest ? (manifest as { icons?: ManifestIcon[] }) : {};
}

describe('BB-PWA-01: Updates wait for the user and the app is installable', () => {
  it('prompts instead of activating on its own, and describes the app', () => {
    const options = buildPwaOptions();
    expect(options.registerType).toBe('prompt');
    expect(options.injectRegister).toBe(false);
    expect(options.workbox?.skipWaiting).not.toBe(true);
    expect(options.workbox?.clientsClaim).not.toBe(true);
    expect(options.devOptions?.enabled).toBe(false);
    const manifest = manifestOf();
    expect(manifest).toMatchObject({
      name: 'VAMS — Visual OpenGL 1.5 simulator',
      short_name: 'VAMS',
      start_url: '/app',
      scope: '/',
      display: 'standalone',
      theme_color: '#1d2b4f',
      background_color: '#f4f5f2',
    });
    expect(manifest.icons?.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });
});

describe('BB-PWA-02: Linked and stage URLs resolve to cached pages', () => {
  it('ignores query parameters, skips social images and falls back to the 404 page', () => {
    const workbox = buildPwaOptions().workbox!;
    const ignored = workbox.ignoreURLParametersMatching ?? [];
    for (const param of ['scene', 'lesson', 'stage']) expect(ignored.some((re) => re.test(param))).toBe(true);
    expect(workbox.globIgnores).toContain('og/**');
    expect(workbox.globPatterns?.[0]).not.toContain('webmanifest');
    expect(workbox.navigateFallback).toBe('/404/index.html');
    expect(workbox.navigateFallbackDenylist?.some((re) => re.test('/sitemap.xml'))).toBe(true);
    expect(workbox.cleanupOutdatedCaches).toBe(true);
  });
});

describe('BB-PWA-03: Prerendered route documents are cached under their clean URL too', () => {
  it('adds an app entry and leaves the root and 404 documents alone', async () => {
    expect(toRouteUrl('app/index.html')).toBe('app');
    expect(toRouteUrl('index.html')).toBeNull();
    expect(toRouteUrl('404/index.html')).toBeNull();
    expect(toRouteUrl('assets/main.js')).toBeNull();
    const entries = ['index.html', 'app/index.html', '404/index.html', 'assets/a.js'].map((url) => ({ url, revision: 'r', size: 1 }));
    const { manifest } = await routeDocumentsTransform(entries);
    expect(manifest.map((e) => e.url)).toEqual(['index.html', 'app/index.html', 'app', '404/index.html', 'assets/a.js']);
    expect(manifest.find((e) => e.url === 'app')?.revision).toBe('r');
  });
});

describe('BB-PWA-04: Every icon the manifest and page name exists', () => {
  it('finds the icon files in public/', () => {
    const icons = manifestOf().icons ?? [];
    expect(icons).toHaveLength(3);
    for (const icon of icons) expect(existsSync(`public${icon.src}`)).toBe(true);
    expect(existsSync('public/apple-touch-icon-180x180.png')).toBe(true);
  });
});

function mountNotice(offlineNoticeMs = 6000) {
  let events: ServiceWorkerEvents | null = null;
  const update = vi.fn().mockResolvedValue(undefined);
  const register = (e: ServiceWorkerEvents) => {
    events = e;
    return Promise.resolve(update);
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(h(UpdateNotice, { register, offlineNoticeMs }), host);
  return { host, update, fire: () => events! };
}

describe('BB-PWA-05: The notice offers the waiting update and announces offline readiness', () => {
  afterEach(() => document.documentElement.classList.remove('stage'));
  it('reloads into the update on request, hides on Later, and the offline note times out', async () => {
    const { host, update, fire } = mountNotice(20);
    await settle();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('');

    fire().onOfflineReady();
    await settle();
    expect(host.textContent).toContain('VAMS now works offline.');
    await new Promise((resolve) => setTimeout(resolve, 40));
    await settle();
    expect(host.textContent).not.toContain('VAMS now works offline.');

    fire().onNeedRefresh();
    await settle();
    expect(host.textContent).toContain('A new version of VAMS is ready.');
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Reload')!.click();
    expect(update).toHaveBeenCalledWith(true);
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Later')!.click();
    await settle();
    expect(host.textContent).not.toContain('A new version');
    render(null, host);
    host.remove();
  });
});

describe('BB-PWA-06: No notice covers the slides while presenting', () => {
  afterEach(() => document.documentElement.classList.remove('stage'));
  it('holds the update notice until stage mode ends', async () => {
    const { host, fire } = mountNotice();
    await settle();
    document.documentElement.classList.add('stage');
    await settle();
    fire().onNeedRefresh();
    await settle();
    expect(host.textContent).not.toContain('A new version');
    document.documentElement.classList.remove('stage');
    await settle();
    expect(host.textContent).toContain('A new version of VAMS is ready.');
    render(null, host);
    host.remove();
  });
});

describe('BB-PWA-07: The page and host headers support the installed app', () => {
  it('sets a theme colour and never caches the service worker file', () => {
    expect(readFileSync('index.html', 'utf8')).toContain('<meta name="theme-color" content="#1d2b4f" />');
    const headers = readFileSync('public/_headers', 'utf8');
    expect(headers).toMatch(/\/sw\.js\s+Cache-Control: no-cache/);
    expect(headers).toMatch(/\/manifest\.webmanifest\s+Cache-Control: no-cache/);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/offline-app.test.ts`
Expected: FAIL, because the modules are missing.

- [ ] **Step 4: Create the PWA options**

Create `src/app/pwa/pwa-options.ts`:

```ts
import type { VitePWAOptions } from 'vite-plugin-pwa';

/** Navy ink and vellum paper from src/shared/styles/_tokens.scss. */
export const PWA_THEME_COLOR = '#1d2b4f';
export const PWA_BACKGROUND_COLOR = '#f4f5f2';

interface PrecacheEntry {
  url: string;
  revision: string | null;
  size: number;
}

/**
 * The clean URL a prerendered route document is requested by (app/index.html → app), or null.
 * The root document is served through Workbox's directory index, and the 404 page is the
 * offline fallback, so neither needs another entry.
 */
export function toRouteUrl(url: string): string | null {
  const match = /^(.+)\/index\.html$/.exec(url);
  return match && match[1] !== '404' ? match[1] : null;
}

/** Cache each route document under its clean URL as well, so /app and /app/ both open offline. */
export async function routeDocumentsTransform(entries: PrecacheEntry[]) {
  const manifest = entries.flatMap((entry) => {
    const clean = toRouteUrl(entry.url);
    return clean ? [entry, { ...entry, url: clean }] : [entry];
  });
  return { manifest, warnings: [] as string[] };
}

export function buildPwaOptions(): Partial<VitePWAOptions> {
  return {
    // A new version waits until the user chooses Reload; nothing swaps code mid-session.
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      name: 'VAMS — Visual OpenGL 1.5 simulator',
      short_name: 'VAMS',
      description: 'See the OpenGL behind every shape.',
      start_url: '/app',
      scope: '/',
      display: 'standalone',
      background_color: PWA_BACKGROUND_COLOR,
      theme_color: PWA_THEME_COLOR,
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // The plugin adds manifest.webmanifest itself.
      globPatterns: ['**/*.{html,js,css,woff,woff2,ttf,svg,png,ico}'],
      globIgnores: ['og/**'],
      // /app?scene=triangle and /?stage resolve to their cached pages.
      ignoreURLParametersMatching: [/.*/],
      manifestTransforms: [routeDocumentsTransform],
      navigateFallback: '/404/index.html',
      navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/],
      cleanupOutdatedCaches: true,
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    },
    devOptions: { enabled: false },
  };
}
```

In `vite.config.ts`, add `import { VitePWA } from 'vite-plugin-pwa'` and `import { buildPwaOptions } from './src/app/pwa/pwa-options'`. Then add `VitePWA(buildPwaOptions()),` after `seoFiles(siteUrl),` in `plugins`.

If `tsc -b` reports that `tsconfig.node.json` doesn't include `src/app/pwa/pwa-options.ts`, it is handled the same way as the existing `./src/app/routes/route-meta` import in `vite.config.ts`. Mirror whatever that file does for route-meta.

- [ ] **Step 5: Create the registration wrapper, the notice and the test stub**

Create `src/app/pwa/register.ts`:

```ts
export interface ServiceWorkerEvents {
  onNeedRefresh(): void;
  onOfflineReady(): void;
}

export type ApplyUpdate = (reloadPage?: boolean) => Promise<void>;

/**
 * Register the service worker after hydration. Resolves to a function that activates a waiting
 * update and reloads, or to null where service workers are unavailable.
 */
export async function registerServiceWorker(events: ServiceWorkerEvents): Promise<ApplyUpdate | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const { registerSW } = await import('virtual:pwa-register');
  return registerSW({ immediate: true, onNeedRefresh: events.onNeedRefresh, onOfflineReady: events.onOfflineReady });
}
```

Create `tests/helpers/pwa-register-stub.ts`:

```ts
/** Stands in for vite-plugin-pwa's virtual module, which exists only in a real build. */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
```

Create `src/app/pwa/UpdateNotice.tsx`:

```tsx
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { registerServiceWorker, type ApplyUpdate, type ServiceWorkerEvents } from './register';
import './update-notice.scss';

type Notice = 'none' | 'update' | 'offline-ready';

function subscribeStage(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const isPresenting = () => document.documentElement.classList.contains('stage');

interface Props {
  register?: (events: ServiceWorkerEvents) => Promise<ApplyUpdate | null>;
  offlineNoticeMs?: number;
}

/** Tells the user when VAMS works offline and when a new version is waiting. Silent while presenting. */
export default function UpdateNotice({ register = registerServiceWorker, offlineNoticeMs = 6000 }: Props) {
  const [notice, setNotice] = useState<Notice>('none');
  const applyRef = useRef<ApplyUpdate | null>(null);
  const presenting = useSyncExternalStore(subscribeStage, isPresenting, () => false);

  useEffect(() => {
    let live = true;
    register({
      onNeedRefresh: () => {
        if (live) setNotice('update');
      },
      onOfflineReady: () => {
        if (live) setNotice('offline-ready');
      },
    })
      .then((apply) => {
        applyRef.current = apply;
      })
      .catch((error) => console.error('Service worker registration failed', error));
    return () => {
      live = false;
    };
  }, [register]);

  useEffect(() => {
    if (notice !== 'offline-ready' || presenting) return;
    const timer = setTimeout(() => setNotice('none'), offlineNoticeMs);
    return () => clearTimeout(timer);
  }, [notice, presenting, offlineNoticeMs]);

  const visible = notice !== 'none' && !presenting;

  return (
    <div className="update-notice" role="status">
      {visible && notice === 'update' && (
        <div className="update-notice__card">
          <p className="update-notice__text">A new version of VAMS is ready.</p>
          <div className="update-notice__actions">
            <button
              type="button"
              className="update-notice__btn update-notice__btn--primary"
              onClick={() => void applyRef.current?.(true)}
            >
              Reload
            </button>
            <button type="button" className="update-notice__btn" onClick={() => setNotice('none')}>
              Later
            </button>
          </div>
        </div>
      )}
      {visible && notice === 'offline-ready' && (
        <div className="update-notice__card">
          <p className="update-notice__text">VAMS now works offline.</p>
        </div>
      )}
    </div>
  );
}
```

Create `src/app/pwa/update-notice.scss`:

```scss
.update-notice {
  position: fixed;
  left: 1rem;
  bottom: 1rem;
  z-index: 1200; // above editor dialogs; sonner toasts sit bottom-right

  &__card {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
    max-width: min(420px, calc(100vw - 2rem));
    padding: 0.75rem 1rem;
    color: var(--ink);
    background-color: var(--paper-raised);
    border: 1px solid var(--rule);
    border-left: 4px solid var(--accent);
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(var(--shadow-rgb), 0.25);
  }

  &__text {
    margin: 0;
    font-family: var(--font-ui);
    font-size: 0.9rem;
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
  }

  &__btn {
    padding: 0.35rem 0.8rem;
    font-family: var(--font-ui);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink);
    background: transparent;
    border: 1px solid var(--rule);
    border-radius: 4px;
    cursor: pointer;
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

    &--primary {
      color: var(--on-accent);
      background-color: var(--accent);
      border-color: var(--accent);
    }
  }
}
```

In `src/app/SiteApp.tsx`, add `import UpdateNotice from '@/app/pwa/UpdateNotice';`, and render `<UpdateNotice />` inside `<LocationProvider>`, directly after the closing `</ErrorBoundary>`.

- [ ] **Step 6: Configure TypeScript and Vitest for the virtual module**

In `tsconfig.app.json`, change `"types": ["vite/client"]` to `"types": ["vite/client", "vite-plugin-pwa/client"]`.

In `vitest.config.ts`, add this entry to `resolve.alias`:

```ts
      'virtual:pwa-register': fileURLToPath(new URL('./tests/helpers/pwa-register-stub.ts', import.meta.url)),
```

- [ ] **Step 7: Add the icons, the meta tags and the headers**

Render the icons once from the existing mark:

```bash
npx --yes @vite-pwa/assets-generator@^1 --preset minimal-2023 public/favicon.svg
```

Then:
- Keep `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png` and `public/apple-touch-icon-180x180.png`.
- Delete the other generated files: `public/pwa-64x64.png`, and `public/favicon.ico` if it was created. Nothing references them.
- Open each kept PNG with an image viewer and check the mark is centred and uncropped.

In `index.html`, add these two lines after the existing `<link rel="icon" …>` line:

```html
   <meta name="theme-color" content="#1d2b4f" />
   <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

Append to `public/_headers`:

```
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/offline-app.test.ts`
Expected: PASS, BB-PWA-01..07.

- [ ] **Step 9: Verify the build output**

Run: `npm run build`. Then:

```bash
ls dist/sw.js dist/manifest.webmanifest
grep -o 'url:"app"' dist/sw.js
grep -c 'rel="manifest"' dist/index.html dist/app/index.html dist/404/index.html
grep -c 'og/' dist/sw.js || true
```

Expected:
- both files exist;
- `url:"app"` is found;
- each HTML file reports `1`;
- the `og/` count is `0`.

- [ ] **Step 10: Verify offline behaviour in a browser**

Run `npm run preview` and open the printed URL in Chrome. Check:
- After the first load, DevTools → Application → Service Workers shows `sw.js` activated, and "VAMS now works offline." appears once.
- With DevTools → Network → Offline enabled, these load: `/`, `/?stage`, `/app?scene=triangle` (which opens the Triangle scene) and `/does-not-exist` (the 404 page).
- After a rebuild and a fresh preview, a reload shows "A new version of VAMS is ready."

Stop only the preview server you started.

- [ ] **Step 11: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add package.json package-lock.json src/app/pwa tests/helpers/pwa-register-stub.ts vite.config.ts vitest.config.ts tsconfig.app.json index.html public/_headers public/pwa-192x192.png public/pwa-512x512.png public/maskable-icon-512x512.png public/apple-touch-icon-180x180.png src/app/SiteApp.tsx tests/black-box/offline-app.test.ts
git diff --staged --stat
git commit -m "feat(app): work offline and install as an app, with an update notice that waits for the user"
```

---

### Task 8: Documentation

**Files:**
- Modify: `tests/README.md`
- Modify: `docs/specs/2026-10-04-website-overhaul-roadmap.md`

- [ ] **Step 1: Add the new suites to the test README**

In `tests/README.md`, inside the `black-box/` block of the layout tree, add these rows after the `site-shell.test.ts` row, keeping the tree's alignment:

```
│   ├── scene-library.test.ts             (BB-LIB-*: My scenes library,
│   │                                        backups, dialog)
│   ├── editor-links.test.ts              (BB-LINK-*: prepared scenes,
│   │                                        /app links, slide 07)
│   ├── crash-recovery.test.ts            (BB-RECOVER-*: lesson reload,
│   │                                        corrupt saves, recovery screen)
│   └── offline-app.test.ts               (BB-PWA-*: service worker,
│                                            manifest, update notice)
```

Change the `└──` on the previous last row to `├──`.

- [ ] **Step 2: Update the roadmap**

In `docs/specs/2026-10-04-website-overhaul-roadmap.md`:

1. Replace the SP3 row's status cell (`Not started`) with `Complete (<today's date, YYYY-MM-DD>): [spec](2026-10-06-demo-readiness-design.md), [plan](../plans/2026-10-06-demo-readiness.md)`. Replace the item text with `**SP3 Demo readiness:** lesson and scene links, My scenes library with backups, crash recovery screen, offline installable app`.
2. Replace divergence item 4 with: `Ch. 6 Rec. 3 frames offline use as future work, and §3.6.2 says students need internet access. The site now works offline after one visit and can be installed as an app (SP3).`
3. Append divergence item 9: `§3.4.2 describes saving only as project-file download and upload. The editor now also keeps a My scenes library and automatic backups in the browser, opens lessons and prepared scenes from links, and shows a recovery screen after a crash (SP3).`
4. Add two bullets to the start of "Rehearsal checklist (Nov 3)":

```
- On the demo machine, open `/` and `/app` once online and wait for "VAMS now works offline". Then turn networking off and run the whole talk.
- Open each "Start from" link on slide 07 once.
```

- [ ] **Step 3: Run all checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add tests/README.md docs/specs/2026-10-04-website-overhaul-roadmap.md
git diff --staged --stat
git commit -m "docs: record SP3 demo readiness in the roadmap and the test suite map"
```
