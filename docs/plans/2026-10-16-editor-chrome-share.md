# Editor Chrome and Sharing Implementation Plan

**Goal:** Give the editor a polished top bar (scene name, save state, one settings menu, Share) and a canvas drawn as the program's window, then let students and the expo audience share scenes by link and QR code, with a read-only view on phones.

**Architecture:** The working scene gains a persisted identity (`sceneId`, `sceneName`) and auto-saves to its own My scenes entry. The canvas column becomes a header, a dotted stage and a framed window around the existing PixiJS canvas. Sharing builds a versioned payload from the store. Small scenes travel inside the link (`/app#s=`, fflate + base64url). Scenes with uploaded images go through one Cloudflare Pages Function into Workers KV for 90 days (`/s/<id>`). Links open in the editor on computers and in a read-only scene view on phones.

**Tech Stack:** Preact (preact/compat), Zustand + Immer (persist), PixiJS 8, SCSS tokens, Vitest + happy-dom, Playwright (visual), fflate, uqr, Cloudflare Pages Functions + Workers KV.

**Spec:** [docs/specs/2026-10-16-editor-chrome-share-design.md](../specs/2026-10-16-editor-chrome-share-design.md). Its owner decisions and rulings are binding.

**Visual reference (local, not committed):** the approved mockups `topbar-layout.html` (B), `canvas-look.html` (B), `window-frame.html` (A) and `share-dialog.html` (A) from the 2026-10-16 design session.

## Global Constraints

- Every rule in AGENTS.md applies.
  - FSD layering: `app → pages → widgets → features → entities → shared`, plus `core`, imported through `@/`.
  - Generated code is a pure function of state.
  - Student-facing text never says "coming soon", "not supported", "future", "deferred", "3D" or "lighting".
- **Styles:**
  - Font sizes come only from `--text-*` tokens (BB-SHELL-22 enforces it).
  - New colours, sizes and shadows extend `src/shared/styles/_tokens.scss` in both themes (`:root` light, `[data-theme='dark']`).
  - New editor stylesheets stay sentence case: no `text-transform: uppercase` (BB-SHELL-23).
- **Spelling and characters:**
  - New student-facing text uses British spelling (colour, centre) and the curly ’ apostrophe and ‘ ’ quotes, as the existing toasts do.
  - Numbers use the true minus sign from `@/shared/lib/format-number`.
- **Store:**
  - The persisted store version goes from 9 to 10 in Task 1 and nowhere else.
  - New runtime-only fields stay out of `partialize`.
- **Tests:**
  - Vitest tests live in `tests/`.
  - Every new test carries the next free ID in its file. Grep for the highest; never count.
  - Existing IDs never change.
- **Before every commit:**
  - `npm run lint`, `npm run build` and `npm test` all pass;
  - then `git checkout -- tests/reports`;
  - stage paths explicitly (never `git add -A` or `git add .`), and never stage `.gitignore` or `AGENTS.md`;
  - read `git diff --staged`.
- **Commits:**
  - Conventional Commits only: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
  - No `Co-Authored-By`, no "Generated with", and no mention of an assistant, agent or workflow in commits, comments or docs.
- **Ports and processes:**
  - Port 5173 belongs to another program; the visual suite and preview use 4319.
  - Never run `taskkill /IM node.exe`. Stop only processes you started, by PID.
- **Checkpoint screenshots:** taken at 1280 px, dark and light, with `deviceScaleFactor: 2`.
- **Constants:**

  | Constant | Value |
  | --- | --- |
  | Link origin | `https://vams.pages.dev` |
  | Longest link that carries the scene | 1,000 characters |
  | Stored payload cap | 1,000,000 bytes |
  | Shrunk image bound | 512 px on the longest side |
  | Expiry | 90 days |
  | Id | 8 base62 characters |
  | Phone threshold | window narrower than 960 px |
  | Rate limit | 10 shares per minute per visitor |
  | Auto-save delay | 1,000 ms |

## Review Focus

1. **Opening a shared link while a lesson is running.** The lesson must be left (recorded as left mid-way) before the shared scene loads. Otherwise the lesson's backup is restored over the shared scene. Task 10 tests it.
2. **An edit made less than a second before a scene switch.** The pending auto-save writes the old scene's content to the old scene's entry. It never writes the new scene's content to the old entry, or the reverse. Task 2 tests it.
3. **Opening a carried link in a tab where the editor is already open.** A changed `#s=` hash fires `hashchange` without a reload, and the scene must still open. Task 10 tests it.
4. **Storage that refuses a write** (quota, private mode) during auto-save. The bar shows "Not saved", and nothing throws or breaks the edit. Task 2 tests it.
5. **A shared scene whose object uses a texture the payload doesn't carry.** The attachment is dropped, as when opening a project file, and the scene still opens. Task 10 tests it.

---

## File map

| Path | Status | Responsibility |
| --- | --- | --- |
| `src/core/store/types.ts` | Modify | `SceneIdentitySlice` type, part of `VamsState` |
| `src/entities/project/model/scene-identity-slice.ts` | Create | `sceneId`, `sceneName`, `renameScene` |
| `src/entities/project/model/scene-library.ts` | Modify | `sceneIdentity()` helper; `'shared-link'` backup reason |
| `src/core/store/index.ts` | Modify | Compose the slice, persist `sceneId` and `sceneName`, version 10, give a migrated save an id |
| `src/core/store/persist-migrate.ts` | Modify | Version 10 step |
| `src/features/scene-library/model/scene-ops.ts` | Modify | `replaceScene` and `loadProjectData` set the identity in the same update |
| `src/features/scene-library/model/autosave.ts` | Create | `startSceneAutosave`, `useSaveStatus` |
| `src/features/scene-library/ui/SceneTitle.tsx` | Create | The name, rename field, save state, lesson title |
| `src/features/scene-library/ui/scene-title.scss` | Create | Its styles |
| `src/features/workspace-reset/model/useNewWorkspace.ts` | Modify | A new workspace starts a new identity |
| `src/pages/editor/model/recovery.ts` | Modify | Start fresh starts a new identity |
| `src/shared/lib/theme/theme.ts` | Modify | `ThemeChoice`, `readThemeChoice`, `setThemeChoice` |
| `src/features/editor-preferences/ui/EditorPreferencesMenu.tsx` | Modify | Settings menu: Theme and View |
| `src/widgets/layout/top-bar/TopBar.tsx`, `FileMenu.tsx`, `top-bar.scss` | Modify | Layout B, tidy File menu |
| `src/shared/lib/program-window.ts` | Create | `PROGRAM_WINDOW_TITLE = 'VAMS Preview'` |
| `src/shared/lib/site-url.ts` | Create | `SITE_URL = 'https://vams.pages.dev'` (moved from `app/routes/route-meta.ts`) |
| `src/shared/engine/pixi/grid-labels.ts` | Create | `insetLabel()` keeps axis labels inside the canvas |
| `src/widgets/canvas/CanvasPane.tsx`, `canvas-pane.scss` | Create | Header, stage, window, illustrations |
| `src/widgets/canvas/ui/CanvasHeader.tsx` | Create | Volume, placement hint, cursor readout, Run/Stop |
| `src/widgets/canvas/ui/CanvasWindow.tsx` | Create | The framed window and its title bar (also used by the scene view) |
| `src/widgets/canvas/ui/CanvasOverlays.tsx`, `vams-canvas.scss` | Modify | Floating plates removed; empty card in the UI font |
| `src/features/callbacks/ui/RunOverlay.tsx` | Modify | `RunControl` (Run/Stop) split out for the header |
| `src/entities/share/model/share-payload.ts` | Create | Build and read the versioned payload |
| `src/entities/share/model/share-codec.ts` | Create | Encode and decode, link builders, `planShare` |
| `src/features/share/model/shrink-image.ts` | Create | `fitWithin`, `shrinkPayloadImages` |
| `src/features/share/model/share-api.ts` | Create | `createStoredShare`, `fetchStoredShare` |
| `src/features/share/model/share-flow.ts` | Create | `prepareShare` → `ShareResult` |
| `src/features/share/model/open-shared.ts` | Create | `resolveSharedScene`, `openSharedScene` |
| `src/features/share/model/dialog-store.ts` | Create | `useShareDialog` |
| `src/features/share/ui/ShareButton.tsx`, `ShareDialog.tsx`, `share.scss` | Create | The top-bar button and the dialog |
| `src/features/share/index.ts` | Create | Public API |
| `src/shared/lib/qr.ts` | Create | `qrSvg`, `qrPngBlob` |
| `src/shared/ui/qr/QrCode.tsx` | Create | Renders `qrSvg` |
| `functions/_lib/share-store.ts` | Create | Payload checks, id, TTL, KV and limiter types |
| `functions/api/share.ts` | Create | `POST /api/share` |
| `functions/api/share/[id].ts` | Create | `GET /api/share/<id>` |
| `tsconfig.functions.json`, `tsconfig.json` | Create, Modify | Type-check `functions/` |
| `public/_redirects` | Create | `/s/*` → `/app` |
| `wrangler.toml` | Create (Task 12) | KV binding, once the namespace exists |
| `src/pages/editor/model/editor-link.ts`, `useEditorLink.ts` | Modify | `parseShareLink`, open on mount and on `hashchange` |
| `src/pages/editor/model/scene-view.ts` | Create | `shouldShowSceneView` |
| `src/pages/editor/ui/EditorPage.tsx` | Modify | Phone → scene view |
| `src/pages/editor/ui/SceneViewApp.tsx`, `scene-view.scss` | Create | The read-only scene view |
| `src/app/SiteApp.tsx` | Modify | Route `/s/:id` |
| `src/app/pwa/pwa-options.ts` | Modify | Deny `/api/` navigations |
| `src/pages/home/ui/sections/TryItSection.tsx`, `home.scss` | Modify | Closing-slide QR |
| `src/features/help/model/help-content.ts`, docs | Modify | Task 15 |

New test files: `tests/black-box/top-bar.test.ts` (BB-TOP-*), `tests/black-box/canvas-window.test.ts` (BB-CANVAS-*), `tests/white-box/share-payload.test.ts` (WB-SHARE-*), `tests/white-box/share-function.test.ts` (WB-SHAREFN-*), `tests/black-box/share.test.ts` (BB-SHARE-*), `tests/black-box/scene-view.test.ts` (BB-VIEW-*). Existing files gain tests with their next free number.

## Rulings made in this plan

| # | Ruling | Why | Cost if wrong |
| --- | --- | --- | --- |
| P1 | The scene identity is set in the same `setState` as the scene content (`loadProjectData(data, identity)`, the new-workspace reset) | Auto-save watches both; an intermediate state with the new content under the old id would overwrite the old entry (Review Focus 2) | An extra parameter |
| P2 | The version-10 migration gives an old save `sceneName: 'Untitled scene'` and `sceneId: ''`; rehydration gives an empty id a fresh one | `core/store/persist-migrate.ts` cannot import the id generator from `entities` without an upward import | One line in `onRehydrateStorage` |
| P3 | Auto-save skips a scene that is empty and still named "Untitled scene" | Opening the editor must not fill My scenes with empty entries | One condition |
| P4 | My scenes' "Save current scene" becomes "Save a copy" | The working scene is already saved by name; a manual save now makes a copy | A label |
| P5 | The Pages Function checks the payload's structure only (version, name, arrays, image data URL prefixes, size). The full clean-up runs in the browser with `sanitizeProjectData` when a scene is opened | Pages Functions are bundled without the app's `@/` alias, and the browser has to sanitise anyway | The server stores structurally valid junk, which the client rejects |
| P6 | Images up to 512 px on both sides are kept as they are; larger images are resampled smoothly to fit 512 px. The spec's "64 px or less" clause is covered by this, since such images are never resampled | Simpler, same outcome | None |
| P7 | Opening a shared scene keeps the visitor's own axis, grid, tracker and learning settings | They are the visitor's preferences, not the scene | One merge |
| P8 | The header's Run/Stop button is the one stop control; the Run strip keeps its title and hint but loses its own Stop button | Two Stop buttons for one action | Tests that click `.run-strip__stop` move to the header button |
| P9 | `wrangler.toml` is created only in Task 12, with the real KV id | Cloudflare Pages fails a deploy whose `wrangler.toml` names a namespace that doesn't exist | None |
| P10 | `DEFAULT_SITE_URL` moves to `src/shared/lib/site-url.ts` as `SITE_URL`; `app/routes/route-meta.ts` re-exports it under its old name | Features and pages need the origin, and may not import `app` | One re-export |
| P11 | The scene view lives in `pages/editor` (`ui/SceneViewApp.tsx`), not in a new page slice | `EditorPage` decides between the two, and a page may not import another page | None |
| P12 | The scene view turns off persistence for its page by giving the store a no-op storage (`useVamsStore.persist.setOptions`) before loading the shared scene. "Open in the editor anyway" is a full navigation, so the editor starts with persistence on | It reuses the real renderer and code generator without a second store | A view bug can't write, since the storage is a no-op |

---

# Build step 1: top bar and canvas window (editor, by Oct 28)

### Task 1: The working scene's identity in the store

**Files:**
- Modify: `src/core/store/types.ts`
- Create: `src/entities/project/model/scene-identity-slice.ts`
- Modify: `src/entities/project/model/scene-library.ts`
- Modify: `src/core/store/index.ts`
- Modify: `src/core/store/persist-migrate.ts`
- Modify: `tests/setup.ts`
- Test: `tests/white-box/persistence-manager.test.ts` (WB-PERSIST-09 to 11), `tests/black-box/scene-library.test.ts` (BB-LIB-17)

**Interfaces:**
- Produces:
  - `SceneIdentitySlice` in `@/core/store/types`, part of `VamsState`:
    ```ts
    sceneId: string;
    sceneName: string;
    renameScene(name: string): void;
    ensureSceneId(): void;
    ```
  - From `@/entities/project/model/scene-library`:
    ```ts
    sceneIdentity(name?: string, id?: string): { sceneId: string; sceneName: string };
    sceneNameFromFile(fileName: string): string;
    ```
    `BackupReason` gains `'shared-link'`.
  - Store version 10.

- [ ] **Step 1: Write the failing tests**

Append to `tests/white-box/persistence-manager.test.ts`:

```ts
describe('WB-PERSIST-09: Browser storage version 9 migrates to version 10', () => {
  it('names an old save "Untitled scene" and leaves its id for rehydration to assign', () => {
    const out = migratePersistedState({ objects: [], callbacks: emptyCallbacks() }, 9) as { sceneName: unknown; sceneId: unknown };
    expect(out.sceneName).toBe('Untitled scene');
    expect(out.sceneId).toBe('');
    const kept = migratePersistedState({ objects: [], sceneName: 'Mine', sceneId: 'abc' }, 9) as { sceneName: unknown; sceneId: unknown };
    expect(kept).toMatchObject({ sceneName: 'Mine', sceneId: 'abc' });
  });
});

describe('WB-PERSIST-10: The store saves the scene identity at version 10', () => {
  it('persists sceneId and sceneName', () => {
    const options = useVamsStore.persist.getOptions();
    expect(options.version).toBe(10);
    useVamsStore.setState({ sceneId: 'id-1', sceneName: 'Solar system' });
    const saved = options.partialize!(useVamsStore.getState()) as Record<string, unknown>;
    expect(saved.sceneId).toBe('id-1');
    expect(saved.sceneName).toBe('Solar system');
  });
});

describe('WB-PERSIST-11: ensureSceneId gives a migrated save an id once', () => {
  it('fills an empty id and keeps an existing one', () => {
    useVamsStore.setState({ sceneId: '' });
    useVamsStore.getState().ensureSceneId();
    const first = useVamsStore.getState().sceneId;
    expect(first).not.toBe('');
    useVamsStore.getState().ensureSceneId();
    expect(useVamsStore.getState().sceneId).toBe(first);
  });
});
```

Append to `tests/black-box/scene-library.test.ts` (add `sceneIdentity` and `sceneNameFromFile` to the existing `@/entities/project/model/scene-library` import):

```ts
describe('BB-LIB-17: The working scene has a name the student can change', () => {
  it('normalises names as My scenes does, and makes fresh identities', () => {
    const s = useVamsStore.getState();
    s.renameScene('  Solar system  ');
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    s.renameScene('   ');
    expect(useVamsStore.getState().sceneName).toBe(UNTITLED_SCENE);
    s.renameScene('x'.repeat(120));
    expect(useVamsStore.getState().sceneName).toHaveLength(80);
    const a = sceneIdentity();
    const b = sceneIdentity('Orbit');
    expect(a.sceneName).toBe(UNTITLED_SCENE);
    expect(b.sceneName).toBe('Orbit');
    expect(a.sceneId).not.toBe(b.sceneId);
    expect(sceneIdentity('Kept', 'id-9').sceneId).toBe('id-9');
    expect(sceneNameFromFile('solar-system.vams')).toBe('solar-system');
    expect(sceneNameFromFile('scene.JSON')).toBe('scene');
    expect(sceneNameFromFile('.vams')).toBe(UNTITLED_SCENE);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/white-box/persistence-manager.test.ts tests/black-box/scene-library.test.ts`
Expected: FAIL. `renameScene` and `sceneIdentity` do not exist, and the version is 9.

- [ ] **Step 3: Add the type**

In `src/core/store/types.ts`, before `export type VamsState`:

```ts
export interface SceneIdentitySlice {
  /** The working scene's own My scenes entry. Empty only until a migrated save is rehydrated. */
  sceneId: string;
  /** The working scene's name, shown in the top bar. */
  sceneName: string;
  /** Rename the working scene; names follow My scenes' rules. */
  renameScene: (name: string) => void;
  /** Give a save migrated from version 9 its own My scenes id. */
  ensureSceneId: () => void;
}
```

and add `SceneIdentitySlice &` to the `VamsState` intersection, after `TourSlice &`.

- [ ] **Step 4: Add the helpers to the scene library**

In `src/entities/project/model/scene-library.ts`:
- Add `| 'shared-link'` to `BackupReason`.
- After `normalizeSceneName`, add:

```ts
/** A fresh identity for the working scene: its own My scenes id and a normalised name. */
export function sceneIdentity(name: string = UNTITLED_SCENE, id: string = createSceneId()): { sceneId: string; sceneName: string } {
  return { sceneId: id, sceneName: normalizeSceneName(name) };
}

/** A project file's name without its extension, as a scene name. */
export function sceneNameFromFile(fileName: string): string {
  return normalizeSceneName(fileName.replace(/\.(vams|json)$/i, ''));
}
```

`createSceneId` is declared below `normalizeSceneName`. Function declarations are hoisted, so the order is fine.

- [ ] **Step 5: Create the slice**

`src/entities/project/model/scene-identity-slice.ts`:

```ts
import type { StateCreator } from 'zustand';
import type { SceneIdentitySlice, VamsState } from '@/core/store/types';
import { createSceneId, normalizeSceneName, sceneIdentity } from './scene-library';

export const createSceneIdentitySlice: StateCreator<VamsState, [], [], SceneIdentitySlice> = (set, get) => ({
  ...sceneIdentity(),
  renameScene: (name) => set({ sceneName: normalizeSceneName(name) }),
  ensureSceneId: () => {
    if (!get().sceneId) set({ sceneId: createSceneId() });
  },
});
```

- [ ] **Step 6: Compose, persist and migrate**

In `src/core/store/index.ts`:
- Import `createSceneIdentitySlice` from `@/entities/project/model/scene-identity-slice`.
- Add `...createSceneIdentitySlice(...a),` after `...createTourSlice(...a),`.
- Set `version: 10`.
- In `onRehydrateStorage`'s success path, before `rehydratedState?.pickOpeningPanel();`, add:
  ```ts
  rehydratedState?.ensureSceneId();
  ```
- In `partialize`, after `hasSeenWelcome`, add:
  ```ts
  sceneId: state.sceneId,
  sceneName: state.sceneName,
  ```

In `src/core/store/persist-migrate.ts`:
- Extend the doc comment with "Version 10 names the working scene and gives it its own My scenes entry; an older save is 'Untitled scene' with an id assigned on rehydration."
- Before `return state;`, add:

```ts
  if (version < 10) {
    if (typeof state.sceneName !== 'string') state.sceneName = 'Untitled scene';
    if (typeof state.sceneId !== 'string') state.sceneId = '';
  }
```

In `tests/setup.ts`, add `sceneId: 'scene-test', sceneName: 'Untitled scene',` to the `beforeEach` `setState`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/white-box/persistence-manager.test.ts tests/black-box/scene-library.test.ts`
Expected: PASS.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/core/store/types.ts src/entities/project/model/scene-identity-slice.ts src/entities/project/model/scene-library.ts src/core/store/index.ts src/core/store/persist-migrate.ts tests/setup.ts tests/white-box/persistence-manager.test.ts tests/black-box/scene-library.test.ts
git diff --staged
git commit -m "feat(scenes): give the working scene a name and its own My scenes id"
```

---

### Task 2: Scene switches set the identity, and the scene auto-saves by name

**Files:**
- Modify: `src/features/scene-library/model/scene-ops.ts`
- Modify: `src/features/scene-library/model/open-preset.ts`
- Modify: `src/features/scene-library/ui/MyScenesDialog.tsx`
- Modify: `src/features/scene-library/index.ts`
- Modify: `src/widgets/layout/top-bar/FileMenu.tsx`
- Modify: `src/features/workspace-reset/model/useNewWorkspace.ts`
- Modify: `src/pages/editor/model/recovery.ts`
- Create: `src/features/scene-library/model/autosave.ts`
- Modify: `src/pages/editor/ui/EditorApp.tsx`
- Test: `tests/black-box/scene-library.test.ts` (BB-LIB-18 to 24)

**Interfaces:**
- Consumes: `sceneIdentity`, `sceneNameFromFile`, `renameScene` (Task 1).
- Produces:
  - `loadProjectData(data, identity?)`
  - `ReplaceOptions { reason; label; name: string; adoptId?: string }`
  - From `@/features/scene-library`:
    ```ts
    startSceneAutosave(opts?: { delay?: number; library?: () => Promise<SceneLibrary> }): () => void;
    useSceneAutosave(): void;
    useSaveStatus; // Zustand store of { status: SaveStatus }
    type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
    AUTOSAVE_DELAY; // = 1000
    ```

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/scene-library.test.ts`. Add these imports at the top as needed:
- `startSceneAutosave`, `useSaveStatus` from `@/features/scene-library`;
- `sceneIdentity` (already imported in Task 1);
- `setSceneLibraryForTests`, which the file already imports.

```ts
async function drainAutosave() {
  await vi.advanceTimersByTimeAsync(1100);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('BB-LIB-18: Edits save the working scene to its own My scenes entry', () => {
  afterEach(() => vi.useRealTimers());

  it('writes the scene under its id and name a second after the edit', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    useVamsStore.setState({ sceneId: 'mine', sceneName: 'Solar system' });
    const stop = startSceneAutosave({ library: async () => lib });
    addTriangle();
    expect(useSaveStatus.getState().status).toBe('saving');
    expect(await lib.list()).toEqual([]);
    await drainAutosave();
    const [entry] = await lib.list();
    expect(entry).toMatchObject({ id: 'mine', name: 'Solar system', kind: 'saved', reason: null });
    expect(entry.file!.data.objects).toHaveLength(1);
    expect(useSaveStatus.getState().status).toBe('saved');
    stop();
  });
});

describe('BB-LIB-19: An empty untitled scene is not saved, a named one is', () => {
  afterEach(() => vi.useRealTimers());

  it('skips the blank editor and saves once the scene is renamed', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    const stop = startSceneAutosave({ library: async () => lib });
    useVamsStore.setState({ canvasBackgroundColor: '#000000' });
    await drainAutosave();
    expect(await lib.list()).toEqual([]);
    useVamsStore.getState().renameScene('Plan');
    await drainAutosave();
    expect((await lib.list()).map((e) => e.name)).toEqual(['Plan']);
    stop();
  });
});

describe('BB-LIB-20: Lesson scenes never write to My scenes', () => {
  afterEach(() => vi.useRealTimers());

  it('does nothing while a lesson is active', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    const stop = startSceneAutosave({ library: async () => lib });
    useVamsStore.setState({ activeLessonId: 'transforms-demo-1', appMode: 'Lesson' });
    addTriangle();
    await drainAutosave();
    expect(await lib.list()).toEqual([]);
    useVamsStore.setState({ activeLessonId: null, appMode: 'Author' });
    stop();
  });
});

describe('BB-LIB-21: An edit just before a scene switch is saved to the scene it belongs to', () => {
  afterEach(() => vi.useRealTimers());

  it('writes the old content to the old entry and the new content to the new one', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    useVamsStore.setState({ sceneId: 'old', sceneName: 'Old' });
    const stop = startSceneAutosave({ library: async () => lib });
    addTriangle();
    addQuad();
    loadProjectData(sanitizeProjectData({ objects: [] }), sceneIdentity('New', 'new'));
    addTriangle();
    await drainAutosave();
    const byId = Object.fromEntries((await lib.list()).map((e) => [e.id, e]));
    expect(byId.old.file!.data.objects).toHaveLength(2);
    expect(byId.old.name).toBe('Old');
    expect(byId.new.file!.data.objects).toHaveLength(1);
    expect(byId.new.name).toBe('New');
    stop();
  });

  it('never shows the new content under the old id', async () => {
    useVamsStore.setState({ sceneId: 'old', sceneName: 'Old' });
    addTriangle();
    const seen: [string, number][] = [];
    const unsub = useVamsStore.subscribe((s) => seen.push([s.sceneId, s.objects.length]));
    loadProjectData(sanitizeProjectData({ objects: [] }), sceneIdentity('New', 'new'));
    unsub();
    expect(seen.some(([id, n]) => id === 'old' && n === 0)).toBe(false);
  });
});

describe('BB-LIB-22: A refused save shows "Not saved" and breaks nothing', () => {
  afterEach(() => vi.useRealTimers());

  it('sets the error status, then recovers on the next good save', async () => {
    vi.useFakeTimers();
    const lib = createMemoryLibrary();
    const refuse = vi.spyOn(lib, 'save').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    useVamsStore.setState({ sceneId: 'mine', sceneName: 'Mine' });
    const stop = startSceneAutosave({ library: async () => lib });
    expect(() => addTriangle()).not.toThrow();
    await drainAutosave();
    expect(useSaveStatus.getState().status).toBe('error');
    addQuad();
    await drainAutosave();
    expect(useSaveStatus.getState().status).toBe('saved');
    expect(refuse).toHaveBeenCalledTimes(2);
    errors.mockRestore();
    stop();
  });
});

describe('BB-LIB-23: Opening a scene sets its name and id', () => {
  it('starts a new identity for a preset or file, and adopts a saved entry', async () => {
    const lib = createMemoryLibrary();
    setSceneLibraryForTests(lib);
    useVamsStore.setState({ sceneId: 'before', sceneName: 'Before' });
    await replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'open-file', label: 'x', name: 'orbit' });
    expect(useVamsStore.getState().sceneName).toBe('orbit');
    expect(useVamsStore.getState().sceneId).not.toBe('before');
    await replaceScene(sanitizeProjectData({ objects: [] }), { reason: 'library-open', label: 'x', name: 'Kept', adoptId: 'saved-7' });
    expect(useVamsStore.getState()).toMatchObject({ sceneId: 'saved-7', sceneName: 'Kept' });
    setSceneLibraryForTests(null);
  });
});

describe('BB-LIB-24: A new workspace is a new untitled scene, and My scenes saves a copy', () => {
  it('resets the identity and labels the manual save as a copy', async () => {
    const lib = createMemoryLibrary();
    setSceneLibraryForTests(lib);
    useVamsStore.setState({ sceneId: 'before', sceneName: 'Before' });
    addTriangle();
    useConfirmStore.setState({ request: null });
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(NewWorkspaceButton, {}), host);
    (host.querySelector('button') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    useConfirmStore.getState().resolve?.(true);
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    expect(useVamsStore.getState().sceneName).toBe(UNTITLED_SCENE);
    expect(useVamsStore.getState().sceneId).not.toBe('before');
    render(null, host);
    useMyScenesDialog.getState().open();
    render(h(MyScenesDialog, {}), host);
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    expect(document.body.textContent).toContain('Save a copy');
    useMyScenesDialog.getState().close();
    render(null, host);
    host.remove();
    setSceneLibraryForTests(null);
  });
});
```

Before relying on BB-LIB-24, read how `useConfirmStore` resolves in this file's existing BB-LIB tests (search for `NewWorkspaceButton`) and copy that pattern exactly. The confirm-store field names above are illustrative. Also check that `setSceneLibraryForTests(null)` is how other tests reset; if it takes no `null`, use what the file already does.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/scene-library.test.ts`
Expected: FAIL. `startSceneAutosave` is missing, `loadProjectData` ignores the identity, and `replaceScene` has no `name`.

- [ ] **Step 3: Load the identity with the scene**

In `src/features/scene-library/model/scene-ops.ts`:
- Import `sceneIdentity` from `@/entities/project/model/scene-library`.
- Change `loadProjectData`'s signature and its `setState`:

```ts
export function loadProjectData(data: VamsProjectData, identity?: { sceneId: string; sceneName: string }): number {
  // The identity changes in the same update as the scene, so auto-save never sees new content under the old id.
  useVamsStore.setState({ ...toStorePatchFromProject(data), ...identity, theme: toEditorTheme(getActiveTheme()) }, false);
```

- Change `ReplaceOptions` and `replaceScene`:

```ts
export interface ReplaceOptions {
  reason: BackupReason;
  label: string;
  /** The opened scene's name. */
  name: string;
  /** A saved My scenes entry being reopened keeps its id, so edits update that entry. */
  adoptId?: string;
}

export async function replaceScene(data: VamsProjectData, options: ReplaceOptions): Promise<ReplaceResult> {
  const backup = await backupCurrentScene(options.reason, options.label);
  const detached = loadProjectData(data, sceneIdentity(options.name, options.adoptId));
  return { backedUp: backup !== null, detached };
}
```

- [ ] **Step 4: Update every caller**

- `open-preset.ts`: `replaceScene(preset.data, { reason: 'scene-link', label: backupLabel(preset.title), name: preset.title })`.
- `FileMenu.tsx`: in `loadProject`, pass `name: sceneNameFromFile(fileName)`, importing `sceneNameFromFile` from `@/entities/project/model/scene-library`.
- `MyScenesDialog.tsx`: where `replaceScene(sanitizeProjectData(entry.file.data), { ... })` is called, add `name: entry.name, adoptId: entry.kind === 'saved' ? entry.id : undefined`.
  - Change the save form's label from "Save current scene" to "Save a copy".
  - Change its button text from "Save" to "Save copy".
  - Change its success toast to `` `Saved a copy as ‘${saved.name}’` ``.
  - Leave the input's id and name intact.
- `useNewWorkspace.ts`: add `...sceneIdentity(),` to the reset `setState`, importing `sceneIdentity` from `@/entities/project/model/scene-library`.
- `src/pages/editor/model/recovery.ts`: find `startFresh`. Where it resets the scene, add the same `...sceneIdentity()` to that reset's `setState`. If it resets by calling an existing action, call `useVamsStore.setState(sceneIdentity())` right after it, in the same function.
- Run `grep -rn "replaceScene(" src tests`. Every call must pass `name`, so TypeScript catches any that don't.

- [ ] **Step 5: Create the auto-save**

`src/features/scene-library/model/autosave.ts`:

```ts
import { useEffect } from 'react';
import { create } from 'zustand';
import { useVamsStore, type VamsState } from '@/core/store';
import { buildProjectFile } from '@/entities/project/model/project-io';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import { getSceneLibrary, UNTITLED_SCENE, type SceneLibrary } from '@/entities/project/model/scene-library';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** What the top bar shows beside the scene's name. */
export const useSaveStatus = create<{ status: SaveStatus }>(() => ({ status: 'idle' }));

export const AUTOSAVE_DELAY = 1000;

/** The parts of the store a saved scene is made of. */
const WATCHED = ['objects', 'callbacks', 'viewportLimits', 'canvasBackgroundColor', 'uploadedTextures', 'sceneName', 'sceneId'] as const;

const changed = (a: VamsState, b: VamsState) => WATCHED.some((k) => a[k] !== b[k]);
const inLesson = (s: VamsState) => s.activeLessonId !== null || s.appMode === 'Lesson';
// A blank, untitled editor is not worth an entry in My scenes.
const worthSaving = (s: VamsState) => s.sceneId !== '' && !(isSceneEmpty(s) && s.sceneName === UNTITLED_SCENE);

async function write(state: VamsState, library: () => Promise<SceneLibrary>): Promise<void> {
  const lib = await library();
  const existing = await lib.get(state.sceneId);
  const now = Date.now();
  await lib.save({
    id: state.sceneId,
    name: state.sceneName,
    kind: 'saved',
    reason: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    file: buildProjectFile(state),
    raw: null,
  });
}

export interface AutosaveOptions {
  delay?: number;
  library?: () => Promise<SceneLibrary>;
}

/** Saves the working scene to its own My scenes entry a moment after each change. Returns the stop function. */
export function startSceneAutosave({ delay = AUTOSAVE_DELAY, library = getSceneLibrary }: AutosaveOptions = {}): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: VamsState | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const snapshot = pending;
    pending = null;
    if (!snapshot) return;
    write(snapshot, library).then(
      () => {
        if (!pending) useSaveStatus.setState({ status: 'saved' });
      },
      (error) => {
        console.error(error);
        useSaveStatus.setState({ status: 'error' });
      },
    );
  };

  const unsubscribe = useVamsStore.subscribe((state, prev) => {
    if (!changed(state, prev)) return;
    // Another scene opened: the previous scene's last edit goes to its own entry now.
    if (state.sceneId !== prev.sceneId && pending) flush();
    if (inLesson(state) || !worthSaving(state)) return;
    pending = state;
    useSaveStatus.setState({ status: 'saving' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  });

  return () => {
    unsubscribe();
    flush();
  };
}

/** Runs the auto-save while the editor is mounted. */
export function useSceneAutosave(): void {
  useEffect(() => startSceneAutosave(), []);
}
```

Export `startSceneAutosave`, `useSceneAutosave`, `useSaveStatus`, `AUTOSAVE_DELAY` and `type SaveStatus` from `src/features/scene-library/index.ts`. In `EditorApp.tsx`, import `useSceneAutosave` from `@/features/scene-library` and call it after `useRecordLessonOnLeave();`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/black-box/scene-library.test.ts`
Expected: PASS. Then run `npm test`. Fix any older test whose `replaceScene` call or "Save current scene" text changed, keeping its ID.

- [ ] **Step 7: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/scene-library src/widgets/layout/top-bar/FileMenu.tsx src/features/workspace-reset/model/useNewWorkspace.ts src/pages/editor/model/recovery.ts src/pages/editor/ui/EditorApp.tsx tests/black-box/scene-library.test.ts
git diff --staged
git commit -m "feat(scenes): auto-save the working scene to My scenes by name"
```

(`git add src/features/scene-library` stages that directory's changes only. Check `git diff --staged --stat` lists nothing unexpected.)

---

### Task 3: Top bar layout B, the scene title and one settings menu

**Files:**
- Modify: `src/shared/lib/theme/theme.ts`, `src/shared/lib/theme/index.ts`
- Modify: `src/features/editor-preferences/ui/EditorPreferencesMenu.tsx`
- Modify: `src/widgets/layout/top-bar/FileMenu.tsx`
- Modify: `src/features/lesson-engine/ui/LearnButton.tsx`
- Create: `src/features/scene-library/ui/SceneTitle.tsx`, `src/features/scene-library/ui/scene-title.scss`
- Modify: `src/features/scene-library/index.ts`
- Modify: `src/widgets/layout/top-bar/TopBar.tsx`, `src/widgets/layout/top-bar/top-bar.scss`
- Modify: `src/shared/styles/_tokens.scss` (only if a new value is needed)
- Test: create `tests/black-box/top-bar.test.ts` (BB-TOP-01 to 06); update `tests/black-box/editor-shell.test.ts` where it opens "View settings"

**Interfaces:**
- Consumes: `sceneName`, `renameScene` (Task 1), `useSaveStatus` (Task 2), `getLessonById` from `@/features/lesson-engine/model/lesson-registry`.
- Produces:
  - `ThemeChoice`, `readThemeChoice()` and `setThemeChoice(choice)` from `@/shared/lib/theme`;
  - `SceneTitle` from `@/features/scene-library`;
  - a `.top-bar__share` slot where Task 9 mounts Share.

- [ ] **Step 1: Write the failing tests**

`tests/black-box/top-bar.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-TOP
 * The editor's top bar: layout, the scene title, the File and settings menus.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import TopBar from '@/widgets/layout/top-bar';
import { SceneTitle, useSaveStatus } from '@/features/scene-library';
import { readThemeChoice, setThemeChoice } from '@/shared/lib/theme';

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
async function openMenu(host: HTMLElement, label: string) {
  (host.querySelector(`button[aria-label="${label}"], button[aria-haspopup="menu"][title="${label}"]`) as HTMLButtonElement
    ?? [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!).click();
  await settle();
}
const menuItems = () => [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]')].map((el) => el.textContent?.trim());

afterEach(() => {
  useVamsStore.setState({ appMode: 'Author', activeLessonId: null, currentStepIndex: 0 });
  useSaveStatus.setState({ status: 'idle' });
});

describe('BB-TOP-01: Layout B puts File, Learn and the scene on the left', () => {
  it('orders the controls and has one theme control', async () => {
    const host = mount(h(TopBar, {}));
    await settle();
    const left = host.querySelector('.top-bar__left')!;
    expect([...left.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual(['File', 'Learn', 'Untitled scene']);
    const right = host.querySelector('.top-bar__actions')!;
    expect(right.querySelector('[aria-label="Settings"]')).not.toBeNull();
    expect(host.querySelector('[aria-label^="Switch to the"]')).toBeNull();
    expect(host.querySelector('.top-bar__share')).not.toBeNull();
    unmount(host);
  });
});

describe('BB-TOP-02: The File menu no longer repeats Save', () => {
  it('lists the scene actions and C++ export only', async () => {
    const host = mount(h(TopBar, {}));
    await settle();
    await openMenu(host, 'File');
    expect(menuItems()).toEqual(['New workspace', 'My scenes…', 'Open project file…', 'Save project file', 'Export C++ code']);
    unmount(host);
  });
});

describe('BB-TOP-03: Settings holds the theme and the view options', () => {
  it('offers Light, Dark and System, and the three view checkboxes', async () => {
    const host = mount(h(TopBar, {}));
    await settle();
    await openMenu(host, 'Settings');
    expect(menuItems()).toEqual(['Light', 'Dark', 'System', 'Coordinate axes', 'Gridlines', 'Coordinate tracker', 'Keyboard shortcuts']);
    setThemeChoice('dark');
    expect(readThemeChoice()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    setThemeChoice('system');
    expect(readThemeChoice()).toBe('system');
    expect(localStorage.getItem('vams-theme')).toBeNull();
    unmount(host);
  });
});

describe('BB-TOP-04: The scene name renames in place', () => {
  it('saves on Enter, normalised, and Escape cancels', async () => {
    useVamsStore.setState({ sceneName: 'Untitled scene' });
    const host = mount(h(SceneTitle, {}));
    await settle();
    (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
    await settle();
    const input = host.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    input.value = '  Solar system ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    (host.querySelector('.scene-title__name') as HTMLButtonElement).click();
    await settle();
    const again = host.querySelector('input') as HTMLInputElement;
    again.value = 'Nope';
    again.dispatchEvent(new Event('input', { bubbles: true }));
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    expect(document.activeElement).toBe(host.querySelector('.scene-title__name'));
    unmount(host);
  });
});

describe('BB-TOP-05: The save state reads Saving, Saved or Not saved', () => {
  it('follows the auto-save status', async () => {
    const host = mount(h(SceneTitle, {}));
    const state = () => host.querySelector('.scene-title__state')?.textContent ?? '';
    useSaveStatus.setState({ status: 'saving' });
    await settle();
    expect(state()).toBe('Saving…');
    useSaveStatus.setState({ status: 'saved' });
    await settle();
    expect(state()).toBe('Saved');
    useSaveStatus.setState({ status: 'error' });
    await settle();
    expect(state()).toBe('Not saved');
    expect(host.querySelector('.scene-title__state')!.getAttribute('title')).toContain('storage');
    useSaveStatus.setState({ status: 'idle' });
    await settle();
    expect(state()).toBe('');
    unmount(host);
  });
});

describe('BB-TOP-06: During a lesson the slot shows the lesson and its step', () => {
  it('reads the title and step, with no rename and no save state', async () => {
    useVamsStore.setState({ appMode: 'Lesson', activeLessonId: 'transforms-demo-1', currentStepIndex: 2 });
    const host = mount(h(SceneTitle, {}));
    await settle();
    const text = host.querySelector('.scene-title')!.textContent!;
    expect(text).toMatch(/^.+ · Step 3 of \d+$/);
    expect(host.querySelector('.scene-title__name')).toBeNull();
    expect(host.querySelector('.scene-title__state')).toBeNull();
    unmount(host);
  });
});
```

Check how `MenuButton` names its trigger before finalising `openMenu`. Read `src/shared/ui/controls/MenuButton.tsx`: an `iconOnly` trigger carries `aria-label={label}`, and a text trigger shows its children. Adjust `openMenu` to match, keeping the assertions. Do the same for the menu items' roles.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/top-bar.test.ts`
Expected: FAIL. `SceneTitle` and `setThemeChoice` do not exist.

- [ ] **Step 3: Theme choice**

Append to `src/shared/lib/theme/theme.ts`:

```ts
/** An explicit theme, or 'system' to follow the operating system. */
export type ThemeChoice = SiteTheme | 'system';

export function readThemeChoice(): ThemeChoice {
  return readStoredTheme() ?? 'system';
}

export function setThemeChoice(choice: ThemeChoice): void {
  if (choice !== 'system') {
    setTheme(choice);
    return;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Storage can be unavailable; the system theme still applies for this visit.
    }
  }
  const next = systemTheme();
  applyTheme(next);
  notify(next);
}
```

Add `readThemeChoice`, `setThemeChoice` and `type ThemeChoice` to the `export { … } from './theme'` list in `src/shared/lib/theme/index.ts`.

- [ ] **Step 4: The settings menu**

Replace `src/features/editor-preferences/ui/EditorPreferencesMenu.tsx`:

```tsx
import { Keyboard, Settings } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { readThemeChoice, setThemeChoice, useSiteTheme, type ThemeChoice } from '@/shared/lib/theme';
import { MenuButton, type MenuEntry } from '@/shared/ui/controls';

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

/** The editor's one settings menu: the theme and what the canvas shows. */
export default function EditorPreferencesMenu() {
  // Re-render when the theme changes, so the checked choice stays current.
  useSiteTheme();
  const choice = readThemeChoice();
  const axisVisibility = useVamsStore((state) => state.axisVisibility);
  const setAxisVisibility = useVamsStore((state) => state.setAxisVisibility);
  const showCoordinateTracker = useVamsStore((state) => state.showCoordinateTracker);
  const setShowCoordinateTracker = useVamsStore((state) => state.setShowCoordinateTracker);
  const openHelp = useVamsStore((state) => state.openHelp);

  const entries: MenuEntry[] = [
    { kind: 'group', id: 'theme', label: 'Theme' },
    ...THEMES.map((t): MenuEntry => ({
      kind: 'radio', id: `theme-${t.id}`, label: t.label, checked: choice === t.id, onSelect: () => setThemeChoice(t.id),
    })),
    { kind: 'separator', id: 'sep-theme' },
    { kind: 'group', id: 'view', label: 'View' },
    {
      kind: 'checkbox', id: 'axes', label: 'Coordinate axes', checked: axisVisibility.showOriginMarker,
      onSelect: () => setAxisVisibility({ ...axisVisibility, showOriginMarker: !axisVisibility.showOriginMarker }),
    },
    {
      kind: 'checkbox', id: 'grid', label: 'Gridlines', checked: axisVisibility.showGridlines,
      onSelect: () => setAxisVisibility({ ...axisVisibility, showGridlines: !axisVisibility.showGridlines }),
    },
    {
      kind: 'checkbox', id: 'tracker', label: 'Coordinate tracker', checked: showCoordinateTracker,
      onSelect: () => setShowCoordinateTracker(!showCoordinateTracker),
    },
    { kind: 'separator', id: 'sep' },
    { kind: 'item', id: 'shortcuts', label: 'Keyboard shortcuts', icon: <Keyboard />, onSelect: () => openHelp('shortcuts') },
  ];

  return <MenuButton label="Settings" iconOnly variant="quiet" icon={<Settings />} align="end" entries={entries} />;
}
```

In `tests/black-box/editor-shell.test.ts`, change `openMenu(host, 'View settings')` to `openMenu(host, 'Settings')` (lines near 356 and 363). If those tests assert the exact item list, add the Theme items to the expected list. Keep the IDs.

- [ ] **Step 5: File and Learn as quiet text buttons**

In `FileMenu.tsx`:
- Remove the `json` entry and the `FileJson` import.
- Move the separator so the list reads New workspace, My scenes…, separator, Open project file…, Save project file, separator, Export C++ code. The lesson-mode list keeps Save project file, separator, Export C++ code.
- Pass `variant="quiet"` to the `MenuButton` and remove `align="end"`, since the menu now opens from the left.

In `LearnButton.tsx`, pass `variant="quiet"` to the `Button`.

- [ ] **Step 6: The scene title**

`src/features/scene-library/ui/SceneTitle.tsx`:

```tsx
import './scene-title.scss';
import { useEffect, useRef, useState } from 'react';
import { useVamsStore } from '@/core/store';
import { getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import { useSaveStatus, type SaveStatus } from '../model/autosave';

const STATE_TEXT: Record<SaveStatus, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved' };

/** The working scene's name and save state; during a lesson, the lesson and its step. */
export default function SceneTitle() {
  const sceneName = useVamsStore((s) => s.sceneName);
  const renameScene = useVamsStore((s) => s.renameScene);
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));
  const step = useVamsStore((s) => s.currentStepIndex);
  const status = useSaveStatus((s) => s.status);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sceneName);
  const nameRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
    else if (returnFocus.current) {
      returnFocus.current = false;
      nameRef.current?.focus();
    }
  }, [editing]);

  if (lessonId) {
    const lesson = getLessonById(lessonId);
    const total = lesson?.steps.length ?? 0;
    return (
      <span className="scene-title scene-title--lesson">
        {lesson ? `${lesson.title} · Step ${Math.min(step + 1, total)} of ${total}` : ''}
      </span>
    );
  }

  const finish = (save: boolean) => {
    if (save) renameScene(draft);
    returnFocus.current = true;
    setEditing(false);
  };

  return (
    <span className="scene-title">
      {editing ? (
        <input
          ref={inputRef}
          className="scene-title__input"
          aria-label="Scene name"
          maxLength={80}
          value={draft}
          onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finish(true);
            if (e.key === 'Escape') {
              e.stopPropagation();
              finish(false);
            }
          }}
          onBlur={() => editing && finish(true)}
        />
      ) : (
        <button
          ref={nameRef}
          type="button"
          className="scene-title__name"
          title="Rename this scene"
          aria-label={`${sceneName}, rename`}
          onClick={() => {
            setDraft(sceneName);
            setEditing(true);
          }}
        >
          {sceneName}
        </button>
      )}
      <span
        className={`scene-title__state is-${status}`}
        aria-live="polite"
        title={status === 'error' ? 'Your browser refused to save to its storage. Save a project file to keep this work.' : undefined}
      >
        {STATE_TEXT[status]}
      </span>
    </span>
  );
}
```

BB-TOP-01 expects the name button's text to be the name ("Untitled scene"). Its accessible name adds ", rename", so keep the visible text the name alone.

`src/features/scene-library/ui/scene-title.scss` (tokens only; check that each variable exists in `_tokens.scss`, and add one there in both themes if needed):

```scss
@use '../../../shared/styles/tokens' as *;

.scene-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  color: var(--ink);
  font-size: var(--text-sm);

  &--lesson {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  &__name {
    min-width: 0;
    max-width: 320px;
    overflow: hidden;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--radius-s);
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;

    &:hover { background: var(--paper-sunken); }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
  }

  &__input {
    width: 240px;
    height: 28px;
    padding: 0 6px;
    border: 1px solid var(--field-line);
    border-radius: var(--radius-s);
    background: var(--field-bg);
    color: var(--ink);
    font: inherit;
    font-weight: 600;

    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
  }

  &__state {
    flex-shrink: 0;
    color: var(--ink-faint);
    font-size: var(--text-xs);

    &.is-error { color: var(--warning); }
  }
}
```

Export `SceneTitle` from `src/features/scene-library/index.ts`: `export { default as SceneTitle } from './ui/SceneTitle';`.

- [ ] **Step 7: The bar**

Replace `TopBar.tsx`'s body:

```tsx
import { Toaster } from 'sonner';
import Logo from '@/shared/ui/logo';
import { useSiteTheme } from '@/shared/lib/theme';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LearnButton from '@/features/lesson-engine/ui/LearnButton';
import HelpButton from '@/features/help/ui/HelpButton';
import { SceneTitle } from '@/features/scene-library';
import { useRunSnapshot } from '@/features/callbacks';
import FileMenu from './FileMenu';
import './top-bar.scss';

/** Layout B: File, Learn and the scene on the left; history, settings, help and Share on the right. */
export default function TopBar() {
  const theme = useSiteTheme();
  const running = useRunSnapshot().running;
  return (
    <header className="top-bar">
      <Toaster position="bottom-center" theme={theme} />
      <a className="top-bar__home" href="/" aria-label="VAMS home">
        <Logo />
      </a>
      <div className="top-bar__left" inert={running || undefined}>
        <FileMenu />
        <LearnButton />
        <span className="top-bar__sep" aria-hidden="true" />
        <SceneTitle />
      </div>
      <div className="top-bar__actions" inert={running || undefined}>
        <HistoryControls />
        <span className="top-bar__sep" aria-hidden="true" />
        <EditorPreferencesMenu />
        <HelpButton />
        <span className="top-bar__share" />
      </div>
    </header>
  );
}
```

In `top-bar.scss`:
- `.top-bar__left` is `display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1;`.
- `.top-bar__actions` keeps `margin-left: auto`, with `flex-shrink: 0`.
- `.top-bar__share` is `display: contents`.
- `.top-bar .vbtn--quiet` height is 30 px.
- Icon-only quiet buttons are 30 px square.

The logo, the 44 px height and `ink-chrome` are unchanged. `ThemeToggleButton` stays in the codebase (the site header uses it); only the editor bar stops importing it.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run tests/black-box/top-bar.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS. Fix older shell tests that counted the top bar's buttons or looked for the theme toggle in it, keeping their IDs. Note each in the report.

- [ ] **Step 9: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/lib/theme src/features/editor-preferences/ui/EditorPreferencesMenu.tsx src/widgets/layout/top-bar src/features/lesson-engine/ui/LearnButton.tsx src/features/scene-library tests/black-box/top-bar.test.ts tests/black-box/editor-shell.test.ts
git diff --staged
git commit -m "feat(editor): lay out the top bar with the scene's name, one settings menu and a tidy File menu"
```

---

### Task 4: The canvas as the program's window

**Files:**
- Create: `src/shared/lib/program-window.ts`
- Modify: `src/features/code-generation/model/code-generator.ts` (use the constant; output unchanged)
- Create: `src/shared/engine/pixi/grid-labels.ts`
- Modify: `src/shared/engine/pixi/hooks/useGridSystem.ts`
- Modify: `src/features/callbacks/ui/RunOverlay.tsx`, its scss, and `src/features/callbacks/index.ts`
- Create: `src/widgets/canvas/ui/CanvasHeader.tsx`, `src/widgets/canvas/ui/CanvasWindow.tsx`, `src/widgets/canvas/CanvasPane.tsx`, `src/widgets/canvas/canvas-pane.scss`
- Modify: `src/widgets/canvas/ui/CanvasOverlays.tsx`, `src/widgets/canvas/VamsCanvas.tsx`, `src/widgets/canvas/vams-canvas.scss`, `src/widgets/canvas/index.ts`
- Modify: `src/pages/editor/ui/EditorApp.tsx`
- Modify: `src/shared/styles/_tokens.scss` (stage and window tokens)
- Test: create `tests/black-box/canvas-window.test.ts` (BB-CANVAS-01 to 06); `tests/white-box/matrix-engine.test.ts` or a new WB file for `insetLabel` (next free ID); update BB-SHELL-16 and BB-RUN-11 for the moved controls

**Interfaces:**
- Produces:
  - `PROGRAM_WINDOW_TITLE` from `@/shared/lib/program-window`;
  - `insetLabel(...)` from `@/shared/engine/pixi/grid-labels`;
  - `RunControl` and `RunLayer` from `@/features/callbacks`;
  - `CanvasWindow({ size, running, children })` from `@/widgets/canvas/ui/CanvasWindow`, reused by the scene view in Task 11;
  - `CanvasPane`, the canvas column;
  - `VamsCanvas` gains a `readOnly?: boolean` prop.

- [ ] **Step 1: Write the failing tests**

`tests/black-box/canvas-window.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-CANVAS
 * The canvas column: its header, the stage and the program's window.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import CanvasHeader from '@/widgets/canvas/ui/CanvasHeader';
import CanvasWindow from '@/widgets/canvas/ui/CanvasWindow';
import { CanvasOverlays } from '@/widgets/canvas/ui/CanvasOverlays';
import { PROGRAM_WINDOW_TITLE } from '@/shared/lib/program-window';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { addTriangle } from '../helpers/store';

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

afterEach(() => {
  useVamsStore.setState({ interactionMode: 'SELECT', showCoordinateTracker: false, cursorWorld: null, viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 } });
});

describe('BB-CANVAS-01: The header names the viewing volume on both axes', () => {
  it('reads x and y ranges with true minus signs', async () => {
    useVamsStore.setState({ viewportLimits: { minX: -2, maxX: 2, minY: -1.5, maxY: 1.5 } });
    const host = mount(h(CanvasHeader, {}));
    await settle();
    expect(host.querySelector('.canvas-header__title')!.textContent).toBe('Canvas');
    expect(host.querySelector('.canvas-header__volume')!.textContent).toBe('x −2…2 · y −1.5…1.5');
    unmount(host);
  });
});

describe('BB-CANVAS-02: The cursor readout shows only with the tracker on', () => {
  it('reads X and Y from the store', async () => {
    useVamsStore.setState({ cursorWorld: { x: 0.42, y: -0.18 } });
    const host = mount(h(CanvasHeader, {}));
    await settle();
    expect(host.querySelector('.canvas-header__cursor')).toBeNull();
    useVamsStore.setState({ showCoordinateTracker: true });
    await settle();
    expect(host.querySelector('.canvas-header__cursor')!.textContent).toBe('X 0.42  Y −0.18');
    unmount(host);
  });
});

describe('BB-CANVAS-03: Placing vertices puts the keys in the header', () => {
  it('replaces the floating banner', async () => {
    const host = mount(h(CanvasHeader, {}));
    useVamsStore.setState({ interactionMode: 'VERTEX_PLACE' });
    await settle();
    const hint = host.querySelector('.canvas-header__hint')!;
    expect(hint.textContent).toBe('Click to place a vertex · Enter finish · Backspace undo · Esc cancel');
    expect([...hint.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Enter', 'Backspace', 'Esc']);
    unmount(host);
  });
});

describe('BB-CANVAS-04: The window title bar reads what the program sets', () => {
  it('shows the glutCreateWindow title and the glutInitWindowSize size', async () => {
    const host = mount(h(CanvasWindow, { size: { width: 586, height: 610 }, running: false }, h('div', { class: 'scene' })));
    await settle();
    expect(host.querySelector('.canvas-window__title')!.textContent).toBe(PROGRAM_WINDOW_TITLE);
    expect(host.querySelector('.canvas-window__size')!.textContent).toBe('586 × 610');
    expect(host.querySelector('.canvas-window__running')).toBeNull();
    const code = generateCodeFromState(
      { objects: [], canvasBackgroundColor: '#000000', callbacks: emptyCallbacks(), viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 }, textures: [] },
      { width: 586, height: 610 },
    );
    expect(code).toContain(`glutCreateWindow("${PROGRAM_WINDOW_TITLE}")`);
    expect(code).toContain('glutInitWindowSize(586, 610)');
    render(h(CanvasWindow, { size: { width: 586, height: 610 }, running: true }, h('div', {})), host);
    await settle();
    expect(host.querySelector('.canvas-window__running')!.textContent).toBe('running');
    unmount(host);
  });
});

describe('BB-CANVAS-05: Nothing floats over the scene but the empty card', () => {
  it('has no viewport plate, tracker or banner, and the card uses the UI font class', async () => {
    const host = mount(h(CanvasOverlays, { showEmptyHint: true }));
    await settle();
    expect(host.querySelector('.viewport-info, .coordinate-tracker, .placement-mode-banner')).toBeNull();
    const card = host.querySelector('.empty-canvas-hint')!;
    expect(card.querySelector('p')!.textContent).toBe('Your scene is empty.');
    unmount(host);
  });
});

describe('BB-CANVAS-06: Run sits in the header and turns into Stop', () => {
  it('shows Run, then Stop while running', async () => {
    addTriangle();
    const host = mount(h(CanvasHeader, {}));
    await settle();
    expect(host.querySelector('.run-button')).not.toBeNull();
    unmount(host);
  });
});
```

Also write the `insetLabel` test. Add it to the white-box file that already tests the PixiJS helpers, if one exists (search `tests/white-box` for `useGridSystem` or `pixi`); otherwise create `tests/white-box/grid-labels.test.ts` with ID `WB-GRID-01`:

```ts
import { describe, it, expect } from 'vitest';
import { insetLabel } from '@/shared/engine/pixi/grid-labels';

describe('WB-GRID-01: Axis labels stay inside the canvas', () => {
  const screen = { width: 400, height: 300 };
  it('pushes a label at an edge back inside by the padding, and leaves inner labels alone', () => {
    // A centred x-axis label (anchor 0.5, 0) 20 px wide at the left edge.
    expect(insetLabel({ x: 0, y: 150 }, { width: 20, height: 12 }, { x: 0.5, y: 0 }, screen)).toEqual({ x: 14, y: 150 });
    // At the right edge.
    expect(insetLabel({ x: 400, y: 150 }, { width: 20, height: 12 }, { x: 0.5, y: 0 }, screen)).toEqual({ x: 386, y: 150 });
    // A y-axis label (anchor 1, 0.5) at the top edge.
    expect(insetLabel({ x: 200, y: 0 }, { width: 24, height: 12 }, { x: 1, y: 0.5 }, screen)).toEqual({ x: 200, y: 10 });
    // Bottom edge, top-anchored.
    expect(insetLabel({ x: 200, y: 300 }, { width: 24, height: 12 }, { x: 0.5, y: 0 }, screen)).toEqual({ x: 200, y: 284 });
    expect(insetLabel({ x: 200, y: 150 }, { width: 24, height: 12 }, { x: 0.5, y: 0 }, screen)).toEqual({ x: 200, y: 150 });
  });
});
```

The padding is 4 px: a left-edge centred label of width 20 has its left at x − 10, so x = 14 puts that left edge at 4.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/canvas-window.test.ts tests/white-box/grid-labels.test.ts`
Expected: FAIL. The modules do not exist.

- [ ] **Step 3: Shared constant and label helper**

`src/shared/lib/program-window.ts`:

```ts
/** The title the generated program gives its window (glutCreateWindow). */
export const PROGRAM_WINDOW_TITLE = 'VAMS Preview';
```

In `code-generator.ts`, import it and change the line to `` code += `    glutCreateWindow("${PROGRAM_WINDOW_TITLE}");\n\n`; ``. The generated text is identical; the generator and BB-CB-12 fixture tests prove it.

`src/shared/engine/pixi/grid-labels.ts`:

```ts
const PAD = 4;

/**
 * Moves a label's anchor point so the whole label stays at least PAD px inside the canvas.
 * Labels well inside are untouched.
 */
export function insetLabel(
  at: { x: number; y: number },
  size: { width: number; height: number },
  anchor: { x: number; y: number },
  screen: { width: number; height: number },
): { x: number; y: number } {
  const left = at.x - anchor.x * size.width;
  const top = at.y - anchor.y * size.height;
  const dx = Math.max(PAD - left, Math.min(0, screen.width - PAD - (left + size.width)));
  const dy = Math.max(PAD - top, Math.min(0, screen.height - PAD - (top + size.height)));
  return { x: at.x + dx, y: at.y + dy };
}
```

In `useGridSystem.ts`, after each `t.position.set(...)` and `t.anchor.set(...)` of a label (three places), apply:

```ts
const p = insetLabel({ x: t.position.x, y: t.position.y }, { width: t.width, height: t.height }, { x: t.anchor.x, y: t.anchor.y }, { width: screenWidth, height: screenHeight });
t.position.set(p.x, p.y);
```

- [ ] **Step 4: Split Run into a control and a layer**

In `RunOverlay.tsx`, keep every existing string and behaviour, but split the component into three exports:
- `export function RunControl()` holds the idle branch: the Run button and its `.run-plate`, returning `null` for an illustration as now. While `snap.running`, it renders instead:
  ```tsx
  <Button className="run-stop" icon={<Square />} onClick={() => runController.stop()}>Stop</Button>
  ```
  It owns `runButtonRef` and the effect that returns focus to Run when the program stops.
- `export function RunLayer()` holds the running branch:
  - the `.run-layer` with its window, surface, handle, strip and readout;
  - the effect that focuses the surface on start.

  Remove the strip's Stop button (`.run-strip__stop`) per ruling P8. `RunLayer` renders `null` when not running.
- `export default function RunOverlay()` returns `<><RunControl /><RunLayer /></>`, the two together as the canvas pane places them.

Add `RunControl` and `RunLayer` to `src/features/callbacks/index.ts`. Existing BB-RUN tests that mount `RunOverlay` keep working: they find Stop by its text. If any test clicked `.run-strip__stop`, point it at `.run-stop` and keep its ID. Remove the strip-stop rule from `run-overlay.scss`, and give `.run-stop` the danger-quiet look the strip's Stop had.

- [ ] **Step 5: The header, the window and the pane**

`src/widgets/canvas/ui/CanvasHeader.tsx`:

```tsx
import { useVamsStore } from '@/core/store';
import { RunControl } from '@/features/callbacks';
import { fmt, short } from '@/shared/lib/format-number';

/** The canvas column's header: the viewing volume, placement keys, the cursor and Run. */
export default function CanvasHeader() {
  const v = useVamsStore((s) => s.viewportLimits);
  const placing = useVamsStore((s) => s.interactionMode === 'VERTEX_PLACE');
  const tracker = useVamsStore((s) => s.showCoordinateTracker);
  const cursor = useVamsStore((s) => s.cursorWorld);
  return (
    <div className="canvas-header">
      <span className="canvas-header__title">Canvas</span>
      <span className="canvas-header__volume">{`x ${short(v.minX)}…${short(v.maxX)} · y ${short(v.minY)}…${short(v.maxY)}`}</span>
      {placing && (
        <span className="canvas-header__hint" role="status">
          Click to place a vertex · <kbd>Enter</kbd> finish · <kbd>Backspace</kbd> undo · <kbd>Esc</kbd> cancel
        </span>
      )}
      <span className="canvas-header__spacer" />
      {tracker && cursor && (
        <span className="canvas-header__cursor">{`X ${fmt(cursor.x)}  Y ${fmt(cursor.y)}`}</span>
      )}
      <RunControl />
    </div>
  );
}
```

`src/widgets/canvas/ui/CanvasWindow.tsx`:

```tsx
import type { ComponentChildren } from 'preact';
import { PROGRAM_WINDOW_TITLE } from '@/shared/lib/program-window';

interface CanvasWindowProps {
  size: { width: number; height: number };
  running: boolean;
  children: ComponentChildren;
}

/** The program's window: a quiet title bar with what glutCreateWindow and glutInitWindowSize set. */
export default function CanvasWindow({ size, running, children }: CanvasWindowProps) {
  return (
    <div className="canvas-window">
      <div className="canvas-window__bar">
        <span className="canvas-window__title">{PROGRAM_WINDOW_TITLE}</span>
        {running && (
          <span className="canvas-window__running">
            <span className="canvas-window__dot" aria-hidden="true" />running
          </span>
        )}
        <span className="canvas-window__size">{`${size.width} × ${size.height}`}</span>
      </div>
      <div className="canvas-window__body">{children}</div>
    </div>
  );
}
```

BB-CANVAS-04 expects `.canvas-window__running`'s text to be exactly "running". The dot is an empty span, so it adds no text.

`src/widgets/canvas/CanvasPane.tsx`:

```tsx
import './canvas-pane.scss';
import { useVamsStore } from '@/core/store';
import { showsIllustration } from '@/core/store/illustration';
import { useRunSnapshot } from '@/features/callbacks';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import CanvasHeader from './ui/CanvasHeader';
import CanvasWindow from './ui/CanvasWindow';
import VamsCanvas from './VamsCanvas';
import PipelineDiagram from './views/PipelineDiagram';
import RasterVectorView from './views/RasterVectorView';

/** The canvas column: a header like the side panels', and the program's window on a stage. */
export default function CanvasPane() {
  const illustration = useVamsStore((s) => (showsIllustration(s) ? s.pipelineMode : 'Playground'));
  const running = useRunSnapshot().running;
  const size = useCanvasSize();
  const framed = illustration === 'Playground';
  return (
    <div className="canvas-pane">
      <CanvasHeader />
      <div className={`canvas-stage${framed ? '' : ' canvas-stage--bare'}`}>
        {/* The canvas stays mounted under an illustration, as ViewportRouter kept it, so PixiJS is not rebuilt. */}
        <div className="canvas-stage__frame" hidden={!framed}>
          <CanvasWindow size={size} running={running}>
            <VamsCanvas isHidden={!framed} />
          </CanvasWindow>
        </div>
        {illustration === 'Diagram' && <PipelineDiagram />}
        {illustration === 'RasterVector' && <RasterVectorView />}
      </div>
    </div>
  );
}
```

`useCanvasSize` measures `.canvas-wrapper`. It runs once on mount; make sure the wrapper exists then. If `useCanvasSize`'s effect finds no element because `CanvasPane` renders before `VamsCanvas`, measure from a ref instead. Change `useCanvasSize` to accept an optional element getter, keeping the old behaviour as the default, and test it with BB-CANVAS-04's size path. Check this with the real editor at the checkpoint.

`src/widgets/canvas/index.ts` exports `CanvasPane`. In `EditorApp.tsx`, replace `canvas={<ViewportRouter />}` with `canvas={<CanvasPane />}`. Delete `ViewportRouter.tsx` if nothing else imports it (`grep -rn ViewportRouter src tests`); if a test imports it, move that test to `CanvasPane` with the same ID.

`CanvasOverlays.tsx` is reduced to `{ showEmptyHint?: boolean }`:
- the empty card, with its text and buttons unchanged;
- `<RunLayer />`.

It no longer takes the viewport, the interaction mode, the coordinates or the tracker. In `VamsCanvas.tsx`:
- pass only `showEmptyHint`;
- drop the local `coordinates` state, since the header reads `cursorWorld`; the `handlePointerMove` rAF writer stays;
- add the `readOnly?: boolean` prop, which sets `className` `canvas-wrapper--readonly`, with `pointer-events: none` in scss and no hover cursor. The scene view uses it in Task 11.

Update BB-SHELL-16 to mount the new `CanvasOverlays`, keeping its ID:
- it checks the empty card and its buttons, as before;
- the viewport, tracker and banner assertions move to BB-CANVAS-01 to 03, so drop them from BB-SHELL-16 and say so in its title: "Canvas overlays keep the empty card and its actions".

- [ ] **Step 6: Styles**

Add tokens to `_tokens.scss` in both themes, near the canvas plate tokens:
- `--stage-bg`: light `#e3e8f3`, dark `#0c1019`;
- `--stage-dot`: light `#c6cfe2`, dark `#29324a`;
- `--window-line`: light `#9aa6c2`, dark `#3a4563`;
- `--window-shadow`: light `0 8px 24px rgba(18, 24, 39, 0.18)`, dark `0 8px 24px rgba(0, 0, 0, 0.35)`.

The title bar uses the chrome tokens through `@include ink-chrome;`, so it is ink in both themes, like the top bar.

`src/widgets/canvas/canvas-pane.scss`:

```scss
@use '../../shared/styles/tokens' as *;

.canvas-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--stage-bg);
}

.canvas-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 10px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink-muted);
  font-size: var(--text-sm);
  white-space: nowrap;

  &__title { font-weight: 600; color: var(--ink); }
  &__volume, &__cursor { font-family: $font-mono; font-size: var(--text-xs); color: var(--ink-faint); }
  &__hint {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--text-xs);
    color: var(--ink);

    kbd {
      padding: 0 4px;
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius-s);
      font-family: $font-mono;
      font-size: var(--text-xs);
    }
  }
  &__spacer { flex: 1; }
}

.canvas-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 14px;
  background-color: var(--stage-bg);
  background-image: radial-gradient(var(--stage-dot) 1px, transparent 1px);
  background-size: 14px 14px;

  &--bare { padding: 0; background-image: none; }
  &__frame { flex: 1; display: flex; min-width: 0; min-height: 0; }
  &__frame[hidden] { display: none; }
}

.canvas-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--window-line);
  border-radius: 8px;
  box-shadow: var(--window-shadow);

  &__bar {
    @include ink-chrome;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 28px;
    padding: 0 10px;
    flex-shrink: 0;
    font-size: var(--text-xs);
    color: var(--ink);
  }
  &__title { font-weight: 500; }
  &__running { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-muted); }
  &__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--run-fired); }
  &__size { margin-left: auto; font-family: $font-mono; color: var(--ink-muted); }
  &__body { position: relative; flex: 1; min-height: 0; }
}
```

Check that `--rule-strong` and `--run-fired` exist (`grep -n "rule-strong\|run-fired" src/shared/styles/_tokens.scss`), and use the nearest existing token if not. In `vams-canvas.scss`:
- remove the rules for `.viewport-info`, `.coordinate-tracker` and `.placement-mode-banner`;
- give `.empty-canvas-hint` `font-family: $font-ui`, `font-size: var(--text-sm)`, `background: var(--paper-raised)`, `color: var(--ink)` and `border-color: var(--rule)`, so it is solid and hides the tick labels behind it;
- keep `background-color: #000` on `.canvas-wrapper`, the scene's clear colour.

The Pipeline illustrations render inside `.canvas-stage--bare`, on the stage without the window frame (spec ruling 8).

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/black-box/canvas-window.test.ts tests/white-box/grid-labels.test.ts tests/black-box/run-mode.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS. Then `npm test`.

- [ ] **Step 8: Look at it**

Run `npm run build`, then `npx vite preview --port 4319 --strictPort` as a background process. With Playwright (`channel: 'chrome'`, viewport 1280×720, `deviceScaleFactor: 2`), open `/app` with `localStorage` `vams-storage` = `{"state":{"hasSeenWelcome":true},"version":10}`, once in dark and once in light (`vams-theme`). Capture the full page: with an empty scene; with a triangle selected; while placing vertices; and while running a scene that has a callback.

Save the images to the git-ignored `checkpoints/step-1/`. Look at them. The header must line up with the side panels' 36 px headers, the window must have even 14 px gutters, and no label may be clipped. Fix what is off before committing. Stop the preview by its PID.

- [ ] **Step 9: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/lib/program-window.ts src/features/code-generation/model/code-generator.ts src/shared/engine/pixi src/features/callbacks src/widgets/canvas src/pages/editor/ui/EditorApp.tsx src/shared/styles/_tokens.scss src/shared/lib/use-canvas-size.ts tests/black-box/canvas-window.test.ts tests/white-box/grid-labels.test.ts tests/black-box/run-mode.test.ts tests/black-box/editor-shell.test.ts
git diff --staged
git commit -m "feat(canvas): draw the canvas as the program's window under a header like the side panels'"
```

---

### Task 5: Checkpoint 1 (top bar and canvas window)

This task ends with the owner's sign-off; build step 2 does not start until then.

**Files:**
- Modify: `tests/visual/editor.spec.ts`, `tests/visual/code-math.spec.ts` (version 10 in their seeded storage, if a test fails on it)
- Local only, git-ignored: `checkpoints/step-1/` captures and `step-1.html`

- [ ] **Step 1: Retake the visual baselines**

Run: `npx playwright test --update-snapshots` (the config builds and serves on 4319).
Expected: every VIS test passes after the update. Read a sample of the new baselines, the editor at 1280 in dark and light, and confirm the new top bar and window.

- [ ] **Step 2: Capture for the owner**

At 2× (`deviceScaleFactor: 2`, toHaveScreenshot `scale: 'device'`), capture:
- the editor at 1280, dark and light, with the mocks' scene (Triangle selected);
- the File menu open and the Settings menu open;
- the scene name being renamed;
- a lesson running, showing its title in the bar;
- placing vertices;
- Run in progress.

Build `step-1.html` with each capture beside the approved mockups (`topbar-layout.html` B and `canvas-look.html` B), images shown at half their natural width.

- [ ] **Step 3: Owner sign-off**

Show the page. Make the requested changes, and re-show them until signed off.

- [ ] **Step 4: Commit the visual spec changes, if any**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add tests/visual/editor.spec.ts tests/visual/code-math.spec.ts
git diff --staged
git commit -m "test(visual): seed the editor screenshots at store version 10"
```

Skip the commit when nothing changed.

---

# Build step 2: Share (dialog and links by Oct 28; function and scene view by Nov 2)

More rulings for this step:

| # | Ruling | Why | Cost if wrong |
| --- | --- | --- | --- |
| P13 | A stored share that the server can't return for a reason other than "missing" (a 5xx) reads "That shared scene couldn’t be loaded. Try again in a moment." | The spec's three messages don't cover a server error, and "expired" would be false | One string |
| P14 | Opening a shared scene (`openSharedScene`) lives in `pages/editor/model`, not in `features/share` | It leaves a lesson (lesson-engine) and replaces the scene (scene-library). A feature may not import other features; a page may | None |
| P15 | `parseShareLink` and `shouldShowSceneView` live in `pages/editor/model/share-link.ts`, which imports nothing heavy | `EditorPage` is in the bundle every page shares and must not pull in the store | None |
| P16 | Shrunk images are re-encoded as WebP at quality 0.85 (browsers without WebP encoding fall back to PNG by themselves) | A 512 px photo as PNG can pass 1 MB on its own | Lossy for photos; pixel art up to 512 px is never resampled |
| P17 | The Share dialog saves the project file itself, through `buildProjectFile` and `downloadJSON` from `entities/project`, and gets the lesson's title as a prop from `EditorApp` | `features/share` may not import `features/project-io` or `features/lesson-engine` | None |

### Task 6: The shared scene payload and its links

**Files:**
- Create: `src/shared/lib/site-url.ts`
- Modify: `src/app/routes/route-meta.ts` (re-export)
- Create: `src/entities/share/model/share-payload.ts`, `src/entities/share/model/share-codec.ts`, `src/entities/share/index.ts`
- Modify: `package.json`, `package-lock.json` (fflate)
- Test: create `tests/white-box/share-payload.test.ts` (WB-SHARE-01 to 07)

**Interfaces:**
- Produces, from `@/entities/share`:
  ```ts
  SHARE_VERSION; // = 1
  type SharePayload;
  type ShareTexture;
  type SharedScene = { name: string; data: VamsProjectData };
  buildSharePayload(src: ShareSource): SharePayload;
  readSharePayload(raw: unknown): SharedScene | null;
  hasUploads(p: SharePayload): boolean;
  withoutUploads(p: SharePayload): SharePayload;
  payloadBytes(p: SharePayload): number;
  MAX_STORED_BYTES; // = 1_000_000
  encodeShare(p: SharePayload): string;
  decodeShare(data: string): unknown | null;
  carriedLink(p, origin?): string;
  storedLink(id, origin?): string;
  lessonLink(id, origin?): string;
  MAX_CARRIED_URL; // = 1000
  planShare(p): { kind: 'carried'; url: string } | { kind: 'stored' };
  ```
- `SITE_URL` from `@/shared/lib/site-url`.

- [ ] **Step 1: Install fflate**

Run: `npm install fflate@^0.8.3`
Expected: added to `dependencies`.

- [ ] **Step 2: Write the failing tests**

`tests/white-box/share-payload.test.ts`:

```ts
/**
 * WHITE-BOX TEST SUITE — WB-SHARE
 * The shared scene payload: what it carries, how it is packed into a link, and how it is read back.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSharePayload, carriedLink, decodeShare, encodeShare, hasUploads, lessonLink, MAX_CARRIED_URL,
  payloadBytes, planShare, readSharePayload, storedLink, withoutUploads, type SharePayload,
} from '@/entities/share';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { SITE_URL } from '@/shared/lib/site-url';
import { addTriangle, getState } from '../helpers/store';

const LIMITS = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const upload = { id: 'up-1', name: 'Photo', dataUrl: 'data:image/png;base64,AAAA', width: 800, height: 600 };
const sample = { id: 'sample-bricks', name: 'Tiling Bricks', dataUrl: 'data:image/png;base64,', width: 256, height: 256, isSample: true };

function sceneWith(textureIds: string[]): SharePayload {
  addTriangle();
  const objects = getState().objects.map((o, i) => ({ ...o, texture: textureIds[i] ? { textureId: textureIds[i], filter: 'NEAREST' as const, wrap: 'REPEAT' as const } : null }));
  return buildSharePayload({ sceneName: 'Solar system', objects, callbacks: emptyCallbacks(), viewportLimits: LIMITS, canvasBackgroundColor: '#000000', textures: [upload, sample] });
}

describe('WB-SHARE-01: The payload carries the scene and only the textures it uses', () => {
  it('lists a used sample by id and leaves unused textures out', () => {
    const p = sceneWith(['sample-bricks']);
    expect(p.v).toBe(1);
    expect(p.name).toBe('Solar system');
    expect(p.objects).toHaveLength(1);
    expect(p.textures).toEqual([{ id: 'sample-bricks', sample: true }]);
    expect(hasUploads(p)).toBe(false);
    const q = sceneWith(['up-1']);
    expect(q.textures).toEqual([{ id: 'up-1', name: 'Photo', dataUrl: upload.dataUrl, width: 800, height: 600 }]);
    expect(hasUploads(q)).toBe(true);
    expect(withoutUploads(q).textures).toEqual([]);
  });
});

describe('WB-SHARE-02: A link round-trips the payload', () => {
  it('encodes to base64url and decodes to the same JSON', () => {
    const p = sceneWith([]);
    const data = encodeShare(p);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShare(data)).toEqual(JSON.parse(JSON.stringify(p)));
    expect(carriedLink(p)).toBe(`${SITE_URL}/app#s=${data}`);
  });
});

describe('WB-SHARE-03: Damaged link data decodes to null, never throws', () => {
  it('rejects junk, truncation and non-JSON', () => {
    const data = encodeShare(sceneWith([]));
    expect(decodeShare('!!!')).toBeNull();
    expect(decodeShare(data.slice(0, data.length >> 1))).toBeNull();
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('aGVsbG8')).toBeNull();
  });
});

describe('WB-SHARE-04: Reading a payload sanitises it and checks the version', () => {
  it('returns the name and clean project data, or null', () => {
    const p = sceneWith(['up-1']);
    const read = readSharePayload(JSON.parse(JSON.stringify(p)))!;
    expect(read.name).toBe('Solar system');
    expect(read.data.objects).toHaveLength(1);
    expect(read.data.uploadedTextures.map((t) => t.id)).toEqual(['up-1']);
    expect(readSharePayload({ ...p, v: 2 })).toBeNull();
    expect(readSharePayload({ ...p, objects: 'nope' })).toBeNull();
    expect(readSharePayload(null)).toBeNull();
    expect(readSharePayload([])).toBeNull();
    expect(readSharePayload({ ...p, name: '   ' })!.name).toBe('Untitled scene');
    expect(readSharePayload({ ...p, objects: [{ junk: true }] })!.data.objects).toEqual([]);
  });
});

describe('WB-SHARE-05: Small scenes travel in the link, others are stored', () => {
  it('chooses by uploads and by the 1,000-character limit', () => {
    const small = sceneWith([]);
    const plan = planShare(small);
    expect(plan.kind).toBe('carried');
    if (plan.kind === 'carried') expect(plan.url.length).toBeLessThanOrEqual(MAX_CARRIED_URL);
    expect(planShare(sceneWith(['up-1'])).kind).toBe('stored');
    const big = { ...small, objects: Array.from({ length: 60 }, (_, i) => ({ ...small.objects[0], id: `o-${i}`, name: `Shape ${i} ${Math.random()}` })) };
    expect(planShare(big).kind).toBe('stored');
  });
});

describe('WB-SHARE-06: The other link builders', () => {
  it('builds stored and lesson links on the site origin', () => {
    expect(storedLink('k3x9q2Ab')).toBe(`${SITE_URL}/s/k3x9q2Ab`);
    expect(lessonLink('transforms-demo-1')).toBe(`${SITE_URL}/app?lesson=transforms-demo-1`);
  });
});

describe('WB-SHARE-07: payloadBytes counts UTF-8 bytes', () => {
  it('counts a multibyte name by bytes', () => {
    const p = { ...sceneWith([]), name: 'ü' };
    expect(payloadBytes(p)).toBe(new TextEncoder().encode(JSON.stringify(p)).length);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/white-box/share-payload.test.ts`
Expected: FAIL. `@/entities/share` does not exist.

- [ ] **Step 4: The site URL**

`src/shared/lib/site-url.ts`:

```ts
/** The deployed site's address: shared links, QR codes and the canonical URLs use it. */
export const SITE_URL = 'https://vams.pages.dev';
```

In `src/app/routes/route-meta.ts`, replace `export const DEFAULT_SITE_URL = 'https://vams.pages.dev';` with:

```ts
import { SITE_URL } from '@/shared/lib/site-url';
export const DEFAULT_SITE_URL = SITE_URL;
```

Put the import with the file's other imports.

- [ ] **Step 5: The payload**

`src/entities/share/model/share-payload.ts`:

```ts
import type { VamsState } from '@/core/store/types';
import type { TextureAsset } from '@/core/types/textures';
import { sanitizeProjectData, type VamsProjectData } from '@/entities/project/model/project-io';
import { normalizeSceneName } from '@/entities/project/model/scene-library';

export const SHARE_VERSION = 1;
export const MAX_STORED_BYTES = 1_000_000;

/** Sample textures are drawn by code, so a share names them; an upload travels as its image. */
export type ShareTexture =
  | { id: string; sample: true }
  | { id: string; name: string; dataUrl: string; width: number; height: number };

/** A shared scene: its content only, never the editor's UI state. */
export interface SharePayload {
  v: typeof SHARE_VERSION;
  name: string;
  objects: VamsState['objects'];
  callbacks: VamsState['callbacks'];
  viewportLimits: VamsState['viewportLimits'];
  canvasBackgroundColor: string;
  textures: ShareTexture[];
}

export type ShareSource = Pick<VamsState, 'sceneName' | 'objects' | 'callbacks' | 'viewportLimits' | 'canvasBackgroundColor'> & {
  textures: readonly TextureAsset[];
};

export interface SharedScene {
  name: string;
  data: VamsProjectData;
}

export function buildSharePayload(src: ShareSource): SharePayload {
  const used = new Set(src.objects.map((o) => o.texture?.textureId).filter((id): id is string => Boolean(id)));
  const textures = src.textures
    .filter((t) => used.has(t.id))
    .map((t): ShareTexture => (t.isSample ? { id: t.id, sample: true } : { id: t.id, name: t.name, dataUrl: t.dataUrl, width: t.width, height: t.height }));
  return {
    v: SHARE_VERSION,
    name: src.sceneName,
    objects: src.objects,
    callbacks: src.callbacks,
    viewportLimits: src.viewportLimits,
    canvasBackgroundColor: src.canvasBackgroundColor,
    textures,
  };
}

export const isUpload = (t: ShareTexture): t is Exclude<ShareTexture, { sample: true }> => !('sample' in t);
export const hasUploads = (p: SharePayload): boolean => p.textures.some(isUpload);

/** The payload with its uploaded images left out; objects that used them open untextured. */
export function withoutUploads(p: SharePayload): SharePayload {
  return { ...p, textures: p.textures.filter((t) => !isUpload(t)) };
}

export function payloadBytes(p: SharePayload): number {
  return new TextEncoder().encode(JSON.stringify(p)).length;
}

/** Reads a payload from a link or the server. Malformed input gives null; content is sanitised like a project file. */
export function readSharePayload(raw: unknown): SharedScene | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== SHARE_VERSION || !Array.isArray(r.objects)) return null;
  const uploads = Array.isArray(r.textures)
    ? r.textures.filter((t) => t && typeof t === 'object' && (t as { sample?: unknown }).sample !== true)
    : [];
  const data = sanitizeProjectData({
    objects: r.objects,
    callbacks: r.callbacks,
    viewportLimits: r.viewportLimits,
    canvasBackgroundColor: r.canvasBackgroundColor,
    uploadedTextures: uploads,
  });
  return { name: normalizeSceneName(typeof r.name === 'string' ? r.name : ''), data };
}
```

- [ ] **Step 6: The codec and the links**

`src/entities/share/model/share-codec.ts`:

```ts
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { SITE_URL } from '@/shared/lib/site-url';
import { hasUploads, type SharePayload } from './share-payload';

/** A link that carries its scene stays short enough for a QR code read off a projector. */
export const MAX_CARRIED_URL = 1000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodeShare(p: SharePayload): string {
  return toBase64Url(deflateSync(strToU8(JSON.stringify(p)), { level: 9 }));
}

/** The JSON a link carries, or null when the data is damaged. */
export function decodeShare(data: string): unknown | null {
  if (!data || !/^[A-Za-z0-9_-]+$/.test(data)) return null;
  try {
    return JSON.parse(strFromU8(inflateSync(fromBase64Url(data))));
  } catch {
    return null;
  }
}

export const carriedLink = (p: SharePayload, origin: string = SITE_URL): string => `${origin}/app#s=${encodeShare(p)}`;
export const storedLink = (id: string, origin: string = SITE_URL): string => `${origin}/s/${id}`;
export const lessonLink = (id: string, origin: string = SITE_URL): string => `${origin}/app?lesson=${encodeURIComponent(id)}`;

/** Uploaded images, or a link too long to scan, mean the scene is stored. */
export function planShare(p: SharePayload): { kind: 'carried'; url: string } | { kind: 'stored' } {
  if (hasUploads(p)) return { kind: 'stored' };
  const url = carriedLink(p);
  return url.length <= MAX_CARRIED_URL ? { kind: 'carried', url } : { kind: 'stored' };
}
```

`src/entities/share/index.ts` re-exports everything from both modules (`export * from './model/share-payload'; export * from './model/share-codec';`).

If WB-SHARE-03's `'aGVsbG8'` case ever inflates without throwing, the `JSON.parse` catch still returns null. If WB-SHARE-05's big scene stays under the limit, raise its object count until it passes 1,000 characters. Its purpose is the over-limit branch.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/white-box/share-payload.test.ts`
Expected: PASS.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add package.json package-lock.json src/shared/lib/site-url.ts src/app/routes/route-meta.ts src/entities/share tests/white-box/share-payload.test.ts
git diff --staged
git commit -m "feat(share): build, pack and read the shared scene payload"
```

---

### Task 7: Shrinking images, the share API client and QR codes

**Files:**
- Create: `src/features/share/model/shrink-image.ts`, `src/features/share/model/share-api.ts`
- Create: `src/shared/lib/qr.ts`, `src/shared/ui/qr/QrCode.tsx`
- Modify: `package.json`, `package-lock.json` (uqr)
- Test: `tests/white-box/share-payload.test.ts` (WB-SHARE-08 to 11)

**Interfaces:**
- Consumes: `SharePayload`, `isUpload` (Task 6).
- Produces:
  - `SHARE_IMAGE_MAX` (= 512);
  - `fitWithin(w, h, max?)`;
  - `type ResizeImage = (dataUrl: string, size: { width: number; height: number }) => Promise<string>`;
  - `shrinkPayloadImages(p, resize?): Promise<{ payload: SharePayload; shrunk: number }>`, where `shrunk` counts the shrunk images;
  - `createStoredShare(p, fetchImpl?)` → `{ ok: true; id; expiresAt } | { ok: false; reason: 'offline' | 'limited' | 'too-large' | 'invalid' | 'unavailable' }`;
  - `fetchStoredShare(id, fetchImpl?)` → `{ ok: true; payload: unknown } | { ok: false; reason: 'missing' | 'offline' | 'unavailable' }`;
  - `qrSvg(text): string` and `qrPngBlob(svg, px?): Promise<Blob>` from `@/shared/lib/qr`;
  - `QrCode({ text, label, size?, className? })` from `@/shared/ui/qr/QrCode`.

- [ ] **Step 1: Install uqr**

Run: `npm install uqr@^0.1.3`
Expected: added to `dependencies`. Open `node_modules/uqr/dist/index.d.mts` (or the package's `.d.ts`) and confirm:
- `encode(text, options)` returns `{ data: boolean[][] }`, with `true` for a dark module;
- `options` takes `ecc` (`'L' | 'M' | 'Q' | 'H'`) and `border`.

If a name differs, adapt `qrSvg` below to it, keeping its signature and output.

- [ ] **Step 2: Write the failing tests**

Append to `tests/white-box/share-payload.test.ts`:

```ts
import { fitWithin, shrinkPayloadImages, SHARE_IMAGE_MAX } from '@/features/share/model/shrink-image';
import { createStoredShare, fetchStoredShare } from '@/features/share/model/share-api';
import { qrSvg } from '@/shared/lib/qr';
import { vi } from 'vitest';

describe('WB-SHARE-08: Images fit within 512 px, keeping their shape', () => {
  it('scales the longer side to 512 and leaves small images alone', () => {
    expect(SHARE_IMAGE_MAX).toBe(512);
    expect(fitWithin(2048, 1024)).toEqual({ width: 512, height: 256 });
    expect(fitWithin(600, 1800)).toEqual({ width: 171, height: 512 });
    expect(fitWithin(512, 300)).toEqual({ width: 512, height: 300 });
    expect(fitWithin(64, 64)).toEqual({ width: 64, height: 64 });
    expect(fitWithin(5000, 2)).toEqual({ width: 512, height: 1 });
  });

  it('shrinks only the uploads that need it and counts them', async () => {
    const resize = vi.fn(async (_url: string, size: { width: number; height: number }) => `data:image/webp;base64,${size.width}x${size.height}`);
    const p = {
      ...sceneWith(['up-1']),
      textures: [
        { id: 'up-1', name: 'Photo', dataUrl: 'data:image/png;base64,AAAA', width: 2048, height: 1024 },
        { id: 'up-2', name: 'Icon', dataUrl: 'data:image/png;base64,BBBB', width: 32, height: 32 },
        { id: 'sample-bricks', sample: true as const },
      ],
    };
    const { payload, shrunk } = await shrinkPayloadImages(p, resize);
    expect(shrunk).toBe(1);
    expect(resize).toHaveBeenCalledTimes(1);
    expect(payload.textures[0]).toEqual({ id: 'up-1', name: 'Photo', dataUrl: 'data:image/webp;base64,512x256', width: 512, height: 256 });
    expect(payload.textures[1]).toBe(p.textures[1]);
    expect(payload.textures[2]).toBe(p.textures[2]);
  });
});

describe('WB-SHARE-09: Storing a share reports each outcome', () => {
  const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  it('returns the id and expiry on 201, and a reason otherwise', async () => {
    const p = sceneWith([]);
    expect(await createStoredShare(p, respond(201, { id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' }))).toEqual({ ok: true, id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' });
    expect(await createStoredShare(p, respond(429, {}))).toEqual({ ok: false, reason: 'limited' });
    expect(await createStoredShare(p, respond(413, {}))).toEqual({ ok: false, reason: 'too-large' });
    expect(await createStoredShare(p, respond(400, {}))).toEqual({ ok: false, reason: 'invalid' });
    expect(await createStoredShare(p, respond(503, {}))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await createStoredShare(p, vi.fn(async () => { throw new TypeError('Failed to fetch'); }))).toEqual({ ok: false, reason: 'offline' });
    const sent = respond(201, { id: 'a', expiresAt: 'b' });
    await createStoredShare(p, sent);
    expect(sent).toHaveBeenCalledWith('/api/share', expect.objectContaining({ method: 'POST' }));
  });
});

describe('WB-SHARE-10: Fetching a stored share reports each outcome', () => {
  it('returns the payload, or missing, offline or unavailable', async () => {
    const ok = vi.fn(async () => new Response('{"v":1}', { status: 200 }));
    expect(await fetchStoredShare('k3x9q2Ab', ok)).toEqual({ ok: true, payload: { v: 1 } });
    expect(ok).toHaveBeenCalledWith('/api/share/k3x9q2Ab');
    expect(await fetchStoredShare('k3x9q2Ab', vi.fn(async () => new Response('', { status: 404 })))).toEqual({ ok: false, reason: 'missing' });
    expect(await fetchStoredShare('k3x9q2Ab', vi.fn(async () => new Response('', { status: 500 })))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await fetchStoredShare('k3x9q2Ab', vi.fn(async () => new Response('not json', { status: 200 })))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await fetchStoredShare('k3x9q2Ab', vi.fn(async () => { throw new TypeError('offline'); }))).toEqual({ ok: false, reason: 'offline' });
  });
});

describe('WB-SHARE-11: QR codes are SVG, dark on white, and deterministic', () => {
  it('draws a square code with a white background', () => {
    const svg = qrSvg('https://vams.pages.dev');
    expect(svg).toMatch(/^<svg[^>]+viewBox="0 0 (\d+) \1"/);
    expect(svg).toContain('fill="#fff"');
    expect(svg).toMatch(/<path fill="#000" d="M/);
    expect(qrSvg('https://vams.pages.dev')).toBe(svg);
    expect(qrSvg('https://vams.pages.dev/s/k3x9q2Ab')).not.toBe(svg);
  });
});
```

Move the new imports to the top of the file with the others. ESLint requires imports first.

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/white-box/share-payload.test.ts`
Expected: FAIL. The modules do not exist.

- [ ] **Step 4: Shrinking**

`src/features/share/model/shrink-image.ts`:

```ts
import { isUpload, type SharePayload } from '@/entities/share';

/** Shared copies of uploaded images are at most this many pixels on their longer side. */
export const SHARE_IMAGE_MAX = 512;

export function fitWithin(width: number, height: number, max: number = SHARE_IMAGE_MAX): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type ResizeImage = (dataUrl: string, size: { width: number; height: number }) => Promise<string>;

/** Redraws an image at a smaller size, smoothly, as WebP (PNG where WebP can't be encoded). */
export const canvasResize: ResizeImage = async (dataUrl, size) => {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas to shrink the image with');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/webp', 0.85);
};

/** The payload with every uploaded image larger than SHARE_IMAGE_MAX shrunk. The student's own images are untouched. */
export async function shrinkPayloadImages(p: SharePayload, resize: ResizeImage = canvasResize): Promise<{ payload: SharePayload; shrunk: number }> {
  let shrunk = 0;
  const textures = await Promise.all(
    p.textures.map(async (t) => {
      if (!isUpload(t)) return t;
      const size = fitWithin(t.width, t.height);
      if (size.width === t.width && size.height === t.height) return t;
      shrunk++;
      return { ...t, ...size, dataUrl: await resize(t.dataUrl, size) };
    }),
  );
  return { payload: { ...p, textures }, shrunk };
}
```

- [ ] **Step 5: The API client**

`src/features/share/model/share-api.ts`:

```ts
import type { SharePayload } from '@/entities/share';

export type StoreFailure = 'offline' | 'limited' | 'too-large' | 'invalid' | 'unavailable';
export type FetchFailure = 'missing' | 'offline' | 'unavailable';

const STATUS: Record<number, StoreFailure> = { 400: 'invalid', 413: 'too-large', 429: 'limited' };

export async function createStoredShare(
  p: SharePayload,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; id: string; expiresAt: string } | { ok: false; reason: StoreFailure }> {
  let res: Response;
  try {
    res = await fetchImpl('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.status !== 201) return { ok: false, reason: STATUS[res.status] ?? 'unavailable' };
  const body = (await res.json().catch(() => null)) as { id?: unknown; expiresAt?: unknown } | null;
  if (body && typeof body.id === 'string' && typeof body.expiresAt === 'string') return { ok: true, id: body.id, expiresAt: body.expiresAt };
  return { ok: false, reason: 'unavailable' };
}

export async function fetchStoredShare(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; payload: unknown } | { ok: false; reason: FetchFailure }> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/share/${encodeURIComponent(id)}`);
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.status === 404) return { ok: false, reason: 'missing' };
  if (!res.ok) return { ok: false, reason: 'unavailable' };
  try {
    return { ok: true, payload: await res.json() };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
```

- [ ] **Step 6: QR codes**

`src/shared/lib/qr.ts`:

```ts
import { encode } from 'uqr';

/** A QR code as SVG: dark modules on white with a two-module quiet zone, sized by its container. */
export function qrSvg(text: string): string {
  const { data } = encode(text, { ecc: 'M', border: 2 });
  const size = data.length;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (data[y][x]) d += `M${x} ${y}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
}

/** The SVG drawn to a PNG, for downloading. Browser only. */
export async function qrPngBlob(svg: string, px = 1024): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas to draw the QR code with');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, px, px);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'));
}
```

`src/shared/ui/qr/QrCode.tsx`:

```tsx
import { useMemo } from 'react';
import { qrSvg } from '@/shared/lib/qr';

interface QrCodeProps {
  text: string;
  /** What the code opens, for screen readers. */
  label: string;
  size?: number;
  className?: string;
}

/** A QR code for `text`, drawn as SVG so it stays sharp at any size and prerenders. */
export default function QrCode({ text, label, size = 132, className }: QrCodeProps) {
  const svg = useMemo(() => qrSvg(text), [text]);
  return (
    <div
      className={`qr-code${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={label}
      style={{ width: `${size}px`, height: `${size}px` }}
      // The SVG is generated from our own text by qrSvg; it holds no markup from outside.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
```

Add `.qr-code svg { display: block; width: 100%; height: 100%; }` in a new `src/shared/ui/qr/qr-code.scss`, imported by `QrCode.tsx`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/white-box/share-payload.test.ts`
Expected: PASS.

- [ ] **Step 8: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add package.json package-lock.json src/features/share/model/shrink-image.ts src/features/share/model/share-api.ts src/shared/lib/qr.ts src/shared/ui/qr tests/white-box/share-payload.test.ts
git diff --staged
git commit -m "feat(share): shrink shared images, talk to the share API and draw QR codes"
```

---

### Task 8: The Cloudflare Pages Function that stores shares

**Files:**
- Create: `functions/_lib/share-store.ts`, `functions/api/share.ts`, `functions/api/share/[id].ts`
- Create: `tsconfig.functions.json`; modify `tsconfig.json`
- Create: `public/_redirects`
- Test: create `tests/white-box/share-function.test.ts` (WB-SHAREFN-01 to 07)

**Interfaces:**
- Produces:
  - `POST /api/share`: JSON payload → 201 `{ id, expiresAt }`, or 400, 413, 429 or 503 `{ error }`;
  - `GET /api/share/<id>`: 200 with the payload, or 404 or 503;
  - `/s/*` rewrites to `/app`;
  - the environment shape `ShareEnv { SHARES: KvLike; SHARE_LIMITER?: LimiterLike }`, which Task 12 binds.

- [ ] **Step 1: Write the failing tests**

`tests/white-box/share-function.test.ts`:

```ts
/**
 * WHITE-BOX TEST SUITE — WB-SHAREFN
 * The Pages Function behind stored share links, run against an in-memory KV.
 */
import { describe, it, expect } from 'vitest';
import { onRequestPost } from '../../functions/api/share';
import { onRequestGet } from '../../functions/api/share/[id]';
import { MAX_PAYLOAD_BYTES, newShareId, TTL_SECONDS, type KvLike, type ShareEnv } from '../../functions/_lib/share-store';

class MemoryKv implements KvLike {
  entries = new Map<string, { value: string; ttl?: number }>();
  failPut = false;
  async get(key: string) {
    return this.entries.get(key)?.value ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    if (this.failPut) throw new Error('KV down');
    this.entries.set(key, { value, ttl: options?.expirationTtl });
  }
}

const payload = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, name: 'Solar system', objects: [], callbacks: {}, viewportLimits: {}, canvasBackgroundColor: '#000000', textures: [], ...extra });
const post = (env: ShareEnv, body: string, ip = '203.0.113.7') =>
  onRequestPost({ request: new Request('https://vams.pages.dev/api/share', { method: 'POST', body, headers: { 'CF-Connecting-IP': ip } }), env });
const get = (env: ShareEnv, id: string) => onRequestGet({ params: { id }, env });

describe('WB-SHAREFN-01: A valid share is stored for 90 days and read back', () => {
  it('returns 201 with an 8-character id, and GET returns the same JSON', async () => {
    const kv = new MemoryKv();
    const res = await post({ SHARES: kv }, payload());
    expect(res.status).toBe(201);
    const { id, expiresAt } = (await res.json()) as { id: string; expiresAt: string };
    expect(id).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(kv.entries.get(id)!.ttl).toBe(TTL_SECONDS);
    expect(TTL_SECONDS).toBe(7_776_000);
    expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(89 * 86_400_000);
    const back = await get({ SHARES: kv }, id);
    expect(back.status).toBe(200);
    expect(await back.text()).toBe(payload());
  });
});

describe('WB-SHAREFN-02: Malformed payloads are refused with 400', () => {
  it('rejects non-JSON, the wrong version, bad arrays and non-image data URLs', async () => {
    const kv = new MemoryKv();
    for (const body of [
      'not json',
      '[]',
      payload({ v: 2 }),
      payload({ objects: 'x' }),
      payload({ name: 'x'.repeat(81) }),
      payload({ textures: [{ id: 'a', name: 'x', dataUrl: 'data:text/html;base64,PGI+', width: 1, height: 1 }] }),
      payload({ textures: [{ id: 'a' }] }),
    ]) {
      expect((await post({ SHARES: kv }, body)).status).toBe(400);
    }
    expect(kv.entries.size).toBe(0);
    expect((await post({ SHARES: kv }, payload({ textures: [{ id: 'sample-bricks', sample: true }, { id: 'u', name: 'p', dataUrl: 'data:image/webp;base64,AAAA', width: 2, height: 2 }] }))).status).toBe(201);
  });
});

describe('WB-SHAREFN-03: A payload over 1 MB is refused with 413', () => {
  it('counts bytes, not characters', async () => {
    const kv = new MemoryKv();
    const big = payload({ name: 'ok', objects: [{ pad: 'x'.repeat(MAX_PAYLOAD_BYTES) }] });
    expect((await post({ SHARES: kv }, big)).status).toBe(413);
    expect(kv.entries.size).toBe(0);
  });
});

describe('WB-SHAREFN-04: The rate limiter turns a visitor away with 429', () => {
  it('asks the limiter by the visitor address and stores nothing when refused', async () => {
    const kv = new MemoryKv();
    const keys: string[] = [];
    const env: ShareEnv = { SHARES: kv, SHARE_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: false }; } } };
    expect((await post(env, payload(), '198.51.100.4')).status).toBe(429);
    expect(keys).toEqual(['198.51.100.4']);
    expect(kv.entries.size).toBe(0);
  });
});

describe('WB-SHAREFN-05: Storage failures answer 503', () => {
  it('reports a failed write', async () => {
    const kv = new MemoryKv();
    kv.failPut = true;
    expect((await post({ SHARES: kv }, payload())).status).toBe(503);
  });
});

describe('WB-SHAREFN-06: Unknown and malformed ids are 404', () => {
  it('never reads the store for an id of the wrong shape', async () => {
    const kv = new MemoryKv();
    expect((await get({ SHARES: kv }, 'k3x9q2Ab')).status).toBe(404);
    expect((await get({ SHARES: kv }, '../etc')).status).toBe(404);
    expect((await get({ SHARES: kv }, '')).status).toBe(404);
  });
});

describe('WB-SHAREFN-07: Ids are 8 base62 characters, uniformly drawn', () => {
  it('skips bytes past the last full alphabet cycle', () => {
    const feed = (bytes: number[]) => (out: Uint8Array) => {
      out.set(bytes.slice(0, out.length).concat(Array(Math.max(0, out.length - bytes.length)).fill(0)));
      return out;
    };
    // 255, 254 and 248 are skipped; then 0→0, 1→1, 2→2, 61→z, 62→0, 63→1, 124→0, 247→z.
    expect(newShareId(feed([255, 254, 248, 0, 1, 2, 61, 62, 63, 124, 247]))).toBe('012z010z');
    expect(newShareId()).toMatch(/^[0-9A-Za-z]{8}$/);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/white-box/share-function.test.ts`
Expected: FAIL. The modules do not exist.

- [ ] **Step 3: The shared helpers**

`functions/_lib/share-store.ts`:

```ts
/** Shared-scene storage for the Pages Functions. Checks structure only; the editor sanitises a scene when it opens it. */

export const MAX_PAYLOAD_BYTES = 1_000_000;
export const TTL_SECONDS = 90 * 24 * 60 * 60;
export const ID_LENGTH = 8;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]*$/;

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
}

export interface LimiterLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ShareEnv {
  SHARES: KvLike;
  SHARE_LIMITER?: LimiterLike;
}

/** Eight base62 characters. Bytes of 248 and above are skipped, so every character is equally likely. */
export function newShareId(random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const b of random(new Uint8Array(16))) {
      if (b < 248 && id.length < ID_LENGTH) id += ALPHABET[b % 62];
    }
  }
  return id;
}

export const isShareId = (id: string): boolean => /^[0-9A-Za-z]{8}$/.test(id);

export type PayloadCheck = { ok: true } | { ok: false; status: 400 | 413; error: string };

const bad = (error: string): PayloadCheck => ({ ok: false, status: 400, error });

function isTexture(t: unknown): boolean {
  if (!t || typeof t !== 'object') return false;
  const r = t as Record<string, unknown>;
  if (typeof r.id !== 'string') return false;
  if (r.sample === true) return true;
  return typeof r.dataUrl === 'string' && IMAGE.test(r.dataUrl) && Number.isFinite(r.width) && Number.isFinite(r.height);
}

export function checkPayload(text: string): PayloadCheck {
  if (new TextEncoder().encode(text).length > MAX_PAYLOAD_BYTES) return { ok: false, status: 413, error: 'The scene is over 1 MB.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return bad('The scene is not JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return bad('The scene is not an object.');
  const p = parsed as Record<string, unknown>;
  if (p.v !== 1) return bad('Unknown scene version.');
  if (typeof p.name !== 'string' || p.name.length > 80) return bad('The scene name is missing or too long.');
  if (!Array.isArray(p.objects) || p.objects.length > 1000) return bad('The scene objects are missing or too many.');
  if (!Array.isArray(p.textures) || !p.textures.every(isTexture)) return bad('A texture is not a PNG, JPEG or WebP image.');
  return { ok: true };
}

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
```

- [ ] **Step 4: The handlers**

`functions/api/share.ts`:

```ts
import { checkPayload, json, MAX_PAYLOAD_BYTES, newShareId, TTL_SECONDS, type ShareEnv } from '../_lib/share-store';

/** POST /api/share: store a shared scene for 90 days and return its id. Nothing about the visitor is stored. */
export async function onRequestPost({ request, env }: { request: Request; env: ShareEnv }): Promise<Response> {
  if (env.SHARE_LIMITER) {
    const key = request.headers.get('CF-Connecting-IP') ?? 'anonymous';
    const { success } = await env.SHARE_LIMITER.limit({ key });
    if (!success) return json({ error: 'Too many shares. Try again in a minute.' }, 429);
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_PAYLOAD_BYTES) return json({ error: 'The scene is over 1 MB.' }, 413);
  const text = await request.text();
  const check = checkPayload(text);
  if (!check.ok) return json({ error: check.error }, check.status);
  try {
    let id = newShareId();
    for (let i = 0; i < 3 && (await env.SHARES.get(id)) !== null; i++) id = newShareId();
    await env.SHARES.put(id, text, { expirationTtl: TTL_SECONDS, metadata: { createdAt: Date.now() } });
    return json({ id, expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString() }, 201);
  } catch {
    return json({ error: 'Shared scenes can’t be stored right now.' }, 503);
  }
}
```

`functions/api/share/[id].ts`:

```ts
import { isShareId, json, type ShareEnv } from '../../_lib/share-store';

/** GET /api/share/<id>: the stored scene, or 404 once it has expired. */
export async function onRequestGet({ params, env }: { params: { id?: string | string[] }; env: ShareEnv }): Promise<Response> {
  const id = typeof params.id === 'string' ? params.id : '';
  if (!isShareId(id)) return json({ error: 'Not found' }, 404);
  try {
    const text = await env.SHARES.get(id);
    if (text === null) return json({ error: 'Not found' }, 404);
    return new Response(text, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  } catch {
    return json({ error: 'Shared scenes can’t be read right now.' }, 503);
  }
}
```

- [ ] **Step 5: Type-checking and the rewrite**

`tsconfig.functions.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.functions.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022", "WebWorker"],
    "module": "ESNext",
    "types": [],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["functions"]
}
```

Add `{ "path": "./tsconfig.functions.json" }` to `tsconfig.json`'s `references`. Run `npm run build`; it must type-check `functions/`.

`public/_redirects` (Vite copies `public/` into `dist/`):

```
/s/*  /app  200
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/white-box/share-function.test.ts`
Expected: PASS.

- [ ] **Step 7: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add functions tsconfig.functions.json tsconfig.json public/_redirects tests/white-box/share-function.test.ts
git diff --staged
git commit -m "feat(share): store shared scenes for 90 days in a Pages Function"
```

---

### Task 9: The Share button and dialog

**Files:**
- Create: `src/features/share/model/share-flow.ts`, `src/features/share/model/dialog-store.ts`
- Create: `src/features/share/ui/ShareButton.tsx`, `src/features/share/ui/ShareDialog.tsx`, `src/features/share/ui/share.scss`
- Create: `src/features/share/index.ts`
- Modify: `src/widgets/layout/top-bar/TopBar.tsx` (Share in `.top-bar__share`)
- Modify: `src/pages/editor/ui/EditorApp.tsx` (mount the dialog)
- Test: create `tests/black-box/share.test.ts` (BB-SHARE-01 to 08)

**Interfaces:**
- Consumes:
  - from Task 6: `buildSharePayload`, `planShare`, `carriedLink`, `storedLink`, `lessonLink`, `withoutUploads`, `payloadBytes`, `MAX_STORED_BYTES`, `MAX_CARRIED_URL`;
  - from Task 7: `shrinkPayloadImages`, `createStoredShare`, `QrCode`, `qrSvg`, `qrPngBlob`.
- Produces:
  - `type ShareResult = { kind: 'lesson'; url; title } | { kind: 'carried'; url } | { kind: 'stored'; url; expiresAt; shrunk: number } | { kind: 'fallback'; url } | { kind: 'failed' }`;
  - `prepareShare(input: ShareInput, deps?): Promise<ShareResult>`;
  - `useShareDialog` (`{ open: boolean; show(): void; close(): void }`);
  - `ShareButton`, and `ShareDialog({ lessonTitle: string | null })`.

- [ ] **Step 1: Write the failing tests**

`tests/black-box/share.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-SHARE
 * Sharing a scene: choosing the link, the dialog's states, copying and the QR code.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { prepareShare, ShareButton, ShareDialog, useShareDialog, type ShareResult } from '@/features/share';
import { SITE_URL } from '@/shared/lib/site-url';
import { addTriangle, getState } from '../helpers/store';

async function settle() {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
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
const LIMITS = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const upload = { id: 'up-1', name: 'Photo', dataUrl: 'data:image/png;base64,AAAA', width: 2048, height: 1024 };
function input(extra: Partial<Parameters<typeof prepareShare>[0]> = {}) {
  addTriangle();
  return { sceneName: 'Solar system', objects: getState().objects, callbacks: emptyCallbacks(), viewportLimits: LIMITS, canvasBackgroundColor: '#000000', textures: [], lesson: null, ...extra };
}
const textured = () => {
  const base = input({ textures: [upload] });
  return { ...base, objects: base.objects.map((o) => ({ ...o, texture: { textureId: 'up-1', filter: 'NEAREST' as const, wrap: 'REPEAT' as const } })) };
};
const shrink = async (p: never) => ({ payload: p, shrunk: 1 });

afterEach(() => {
  useShareDialog.getState().close();
  useVamsStore.setState({ appMode: 'Author', activeLessonId: null });
});

describe('BB-SHARE-01: A small scene shares a link that carries it', () => {
  it('needs no server', async () => {
    const store = vi.fn();
    const r = await prepareShare(input(), { store });
    expect(r.kind).toBe('carried');
    expect((r as Extract<ShareResult, { kind: 'carried' }>).url.startsWith(`${SITE_URL}/app#s=`)).toBe(true);
    expect(store).not.toHaveBeenCalled();
  });
});

describe('BB-SHARE-02: A scene with an uploaded image is stored, shrunk', () => {
  it('returns the short link and the expiry', async () => {
    const store = vi.fn(async () => ({ ok: true as const, id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' }));
    const r = await prepareShare(textured(), { store, shrink });
    expect(r).toEqual({ kind: 'stored', url: `${SITE_URL}/s/k3x9q2Ab`, expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 1 });
  });
});

describe('BB-SHARE-03: When storing fails, the link leaves the uploads out, or there is no link', () => {
  it('falls back to a carried link, and fails when even that is too long', async () => {
    const store = vi.fn(async () => ({ ok: false as const, reason: 'offline' as const }));
    const r = await prepareShare(textured(), { store, shrink });
    expect(r.kind).toBe('fallback');
    const many = input();
    const huge = { ...many, objects: Array.from({ length: 80 }, (_, i) => ({ ...many.objects[0], id: `o-${i}`, name: `Shape number ${i}` })) };
    expect((await prepareShare(huge, { store, shrink })).kind).toBe('failed');
  });
});

describe('BB-SHARE-04: During a lesson, Share gives the lesson link', () => {
  it('uses ?lesson=', async () => {
    const r = await prepareShare(input({ lesson: { id: 'transforms-demo-1', title: 'Transforms 1' } }));
    expect(r).toEqual({ kind: 'lesson', url: `${SITE_URL}/app?lesson=transforms-demo-1`, title: 'Transforms 1' });
  });
});

describe('BB-SHARE-05: The dialog shows the link, the note and the QR code', () => {
  it('reads as approved for a carried link', async () => {
    addTriangle();
    useVamsStore.setState({ sceneName: 'Solar system' });
    const host = mount(h('div', {}, h(ShareButton, {}), h(ShareDialog, { lessonTitle: null })));
    (host.querySelector('.share-button') as HTMLButtonElement).click();
    await settle();
    const dialog = document.querySelector('.share-dialog')!;
    expect(dialog.querySelector('h2')!.textContent).toBe('Share ‘Solar system’');
    expect(dialog.textContent).toContain('Anyone with the link opens a copy of this scene. On a phone it opens as a view.');
    expect((dialog.querySelector('.share-dialog__link') as HTMLInputElement).value).toMatch(/\/app#s=/);
    expect(dialog.textContent).toContain('This link carries your scene and never expires.');
    expect(dialog.querySelector('.qr-code svg')).not.toBeNull();
    expect(dialog.querySelector('.qr-code')!.getAttribute('aria-label')).toBe('QR code for this link');
    unmount(host);
  });
});

describe('BB-SHARE-06: Copy link copies and says so', () => {
  it('writes the link to the clipboard', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    addTriangle();
    const host = mount(h(ShareDialog, { lessonTitle: null }));
    useShareDialog.getState().show();
    await settle();
    const url = (document.querySelector('.share-dialog__link') as HTMLInputElement).value;
    ([...document.querySelectorAll('.share-dialog button')].find((b) => b.textContent === 'Copy link') as HTMLButtonElement).click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(url);
    unmount(host);
  });
});

describe('BB-SHARE-07: Done closes the dialog and focus returns to Share', () => {
  it('restores focus', async () => {
    addTriangle();
    const host = mount(h('div', {}, h(ShareButton, {}), h(ShareDialog, { lessonTitle: null })));
    const button = host.querySelector('.share-button') as HTMLButtonElement;
    button.focus();
    button.click();
    await settle();
    ([...document.querySelectorAll('.share-dialog button')].find((b) => b.textContent === 'Done') as HTMLButtonElement).click();
    await settle();
    expect(document.querySelector('.share-dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
    unmount(host);
  });
});

describe('BB-SHARE-08: The dialog words each state', () => {
  it('stored, shrunk, fallback, failed and lesson', async () => {
    const { ShareResultView } = await import('@/features/share/ui/ShareDialog');
    const view = (result: ShareResult) => {
      const host = mount(h(ShareResultView, { result, onSaveFile: () => {} }));
      const text = host.textContent ?? '';
      unmount(host);
      return text;
    };
    expect(view({ kind: 'stored', url: 'u', expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 1 })).toContain('Stored for 90 days, until 14 Jan 2027.');
    expect(view({ kind: 'stored', url: 'u', expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 1 })).toContain('Your uploaded image is shared at 512 px.');
    expect(view({ kind: 'stored', url: 'u', expiresAt: '2027-01-14T00:00:00.000Z', shrunk: 2 })).toContain('Your uploaded images are shared at 512 px.');
    expect(view({ kind: 'fallback', url: 'u' })).toContain('Your uploaded images are left out.');
    expect(view({ kind: 'failed' })).toContain('Couldn’t make a link right now.');
    expect(view({ kind: 'lesson', url: 'u', title: 'Transforms 1' })).toContain('Anyone with the link opens this lesson.');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/share.test.ts`
Expected: FAIL. `@/features/share` does not exist.

- [ ] **Step 3: The flow and the dialog store**

`src/features/share/model/share-flow.ts`:

```ts
import {
  buildSharePayload, carriedLink, lessonLink, MAX_CARRIED_URL, MAX_STORED_BYTES, payloadBytes, planShare, storedLink, withoutUploads,
  type SharePayload, type ShareSource,
} from '@/entities/share';
import { createStoredShare } from './share-api';
import { shrinkPayloadImages } from './shrink-image';

export type ShareResult =
  | { kind: 'lesson'; url: string; title: string }
  | { kind: 'carried'; url: string }
  | { kind: 'stored'; url: string; expiresAt: string; shrunk: number }
  | { kind: 'fallback'; url: string }
  | { kind: 'failed' };

export type ShareInput = ShareSource & { lesson: { id: string; title: string } | null };

export interface ShareDeps {
  store?: (p: SharePayload) => ReturnType<typeof createStoredShare>;
  shrink?: (p: SharePayload) => ReturnType<typeof shrinkPayloadImages>;
}

/** Chooses and makes the link: the lesson's, one that carries the scene, or a stored one; with a fallback when storing fails. */
export async function prepareShare(input: ShareInput, deps: ShareDeps = {}): Promise<ShareResult> {
  if (input.lesson) return { kind: 'lesson', url: lessonLink(input.lesson.id), title: input.lesson.title };
  const store = deps.store ?? ((p: SharePayload) => createStoredShare(p));
  const shrink = deps.shrink ?? ((p: SharePayload) => shrinkPayloadImages(p));
  const payload = buildSharePayload(input);
  const plan = planShare(payload);
  if (plan.kind === 'carried') return plan;
  const fallback = (): ShareResult => {
    const url = carriedLink(withoutUploads(payload));
    return url.length <= MAX_CARRIED_URL ? { kind: 'fallback', url } : { kind: 'failed' };
  };
  const { payload: small, shrunk } = await shrink(payload);
  if (payloadBytes(small) > MAX_STORED_BYTES) return fallback();
  const stored = await store(small);
  return stored.ok ? { kind: 'stored', url: storedLink(stored.id), expiresAt: stored.expiresAt, shrunk } : fallback();
}
```

`src/features/share/model/dialog-store.ts`:

```ts
import { create } from 'zustand';

export const useShareDialog = create<{ open: boolean; show: () => void; close: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));
```

- [ ] **Step 4: The button and the dialog**

`src/features/share/ui/ShareButton.tsx`:

```tsx
import { Share2 } from 'lucide-react';
import { Button } from '@/shared/ui/controls';
import { useShareDialog } from '../model/dialog-store';

export default function ShareButton() {
  const show = useShareDialog((s) => s.show);
  return (
    <Button variant="primary" className="share-button" icon={<Share2 />} aria-haspopup="dialog" onClick={show}>
      Share
    </Button>
  );
}
```

`src/features/share/ui/ShareDialog.tsx`: read `src/shared/ui/controls/Dialog.tsx` first for its props (`open`, `onClose`, `labelledBy`, `size`, `className`, `initialFocusRef`) and how it returns focus. Use it as `MyScenesDialog` does.

```tsx
import './share.scss';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { buildProjectFile, createDefaultProjectFilename, downloadJSON } from '@/entities/project/model/project-io';
import { qrPngBlob, qrSvg } from '@/shared/lib/qr';
import { Button, Dialog } from '@/shared/ui/controls';
import QrCode from '@/shared/ui/qr/QrCode';
import { useShareDialog } from '../model/dialog-store';
import { prepareShare, type ShareResult } from '../model/share-flow';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function slug(name: string) {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'vams-scene';
}

function Note({ tone, children }: { tone: 'ok' | 'warn'; children: string }) {
  return (
    <p className={`share-dialog__note is-${tone}`}>
      <span className="share-dialog__dot" aria-hidden="true" />
      {children}
    </p>
  );
}

/** The link, its notes and the QR code for one result. Exported for tests. */
export function ShareResultView({ result, onSaveFile }: { result: ShareResult; onSaveFile: () => void }) {
  if (result.kind === 'failed') {
    return (
      <div className="share-dialog__failed">
        <p>Couldn’t make a link right now.</p>
        <Button variant="primary" onClick={onSaveFile}>Save project file</Button>
      </div>
    );
  }
  const copy = () =>
    navigator.clipboard.writeText(result.url).then(
      () => toast.success('Link copied'),
      () => toast.error('Couldn’t copy. Select the link and copy it.'),
    );
  const download = () =>
    qrPngBlob(qrSvg(result.url)).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug(result.kind === 'lesson' ? result.title : useVamsStore.getState().sceneName)}-qr.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  return (
    <div className="share-dialog__body">
      <div className="share-dialog__main">
        <div className="share-dialog__field">
          <input className="share-dialog__link" readOnly value={result.url} aria-label="Link" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="primary" onClick={copy}>Copy link</Button>
        </div>
        {result.kind === 'carried' && <Note tone="ok">This link carries your scene and never expires.</Note>}
        {result.kind === 'stored' && <Note tone="ok">{`Stored for 90 days, until ${date(result.expiresAt)}.`}</Note>}
        {result.kind === 'stored' && result.shrunk > 0 && (
          <Note tone="warn">{result.shrunk === 1 ? 'Your uploaded image is shared at 512 px.' : 'Your uploaded images are shared at 512 px.'}</Note>
        )}
        {result.kind === 'fallback' && <Note tone="warn">Your uploaded images are left out.</Note>}
        {result.kind === 'lesson' && <Note tone="ok">Anyone with the link opens this lesson.</Note>}
      </div>
      <div className="share-dialog__qr">
        <QrCode text={result.url} label="QR code for this link" />
        <button type="button" className="share-dialog__textlink" onClick={() => void download()}>Download QR</button>
      </div>
    </div>
  );
}

export default function ShareDialog({ lessonTitle }: { lessonTitle: string | null }) {
  const open = useShareDialog((s) => s.open);
  const close = useShareDialog((s) => s.close);
  const titleId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<ShareResult | null>(null);
  const sceneName = useVamsStore((s) => s.sceneName);
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));

  useEffect(() => {
    if (!open) {
      setResult(null);
      return;
    }
    let live = true;
    const s = useVamsStore.getState();
    void prepareShare({
      sceneName: s.sceneName,
      objects: s.objects,
      callbacks: s.callbacks,
      viewportLimits: s.viewportLimits,
      canvasBackgroundColor: s.canvasBackgroundColor,
      textures: s.getAllTextures(),
      lesson: lessonId ? { id: lessonId, title: lessonTitle ?? '' } : null,
    }).then((r) => live && setResult(r));
    return () => {
      live = false;
    };
  }, [open, lessonId, lessonTitle]);

  if (!open) return null;

  const saveFile = () => {
    try {
      downloadJSON(createDefaultProjectFilename(), buildProjectFile(useVamsStore.getState()));
      toast.success('Project saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save project');
    }
  };

  return (
    <Dialog open onClose={close} labelledBy={titleId} size="md" className="share-dialog" initialFocusRef={doneRef}>
      <h2 id={titleId}>{lessonId ? 'Share this lesson' : `Share ‘${sceneName}’`}</h2>
      <p className="share-dialog__lead">
        {lessonId ? 'Anyone with the link opens this lesson.' : 'Anyone with the link opens a copy of this scene. On a phone it opens as a view.'}
      </p>
      {result ? (
        <ShareResultView result={result} onSaveFile={saveFile} />
      ) : (
        <div className="share-dialog__field">
          <input className="share-dialog__link" readOnly value="Making your link…" aria-label="Link" />
          <Button variant="primary" disabled>Copy link</Button>
        </div>
      )}
      <div className="share-dialog__foot">
        {!lessonId && result?.kind !== 'failed' ? (
          <button type="button" className="share-dialog__textlink" onClick={saveFile}>Save project file instead</button>
        ) : (
          <span />
        )}
        <Button ref={doneRef} onClick={close}>Done</Button>
      </div>
    </Dialog>
  );
}
```

The lesson branch's lead sentence repeats the green note. Keep the lead for lessons and drop the `Note` from `ShareResultView`'s lesson branch, unless BB-SHARE-08 needs it there: `ShareResultView` renders alone in that test. Keep the note in `ShareResultView`, and give the lesson lead in `ShareDialog` the same words; reading twice beats a dialog with no explanation. If `Dialog` does not accept `className` or `initialFocusRef`, use what `MyScenesDialog` uses.

`src/features/share/ui/share.scss` uses tokens only, matching the approved mock:
- the dialog body is a flex row with a 14 px gap;
- `.share-dialog__qr` is 132 px wide, centred, with "Download QR" under it;
- notes are `--text-xs`, `--ink-muted`, with a 6 px dot (`--success` green or `--warning` amber; check the token names in `_tokens.scss`);
- the footer has a 1 px `--rule` top border and 12 px top padding;
- the link input is mono, `--text-xs`, `--field-bg`;
- the QR's white background shows in both themes, from the SVG itself.

Below 480 px width, the body stacks.

`src/features/share/index.ts`:

```ts
export { prepareShare, type ShareResult, type ShareInput } from './model/share-flow';
export { useShareDialog } from './model/dialog-store';
export { default as ShareButton } from './ui/ShareButton';
export { default as ShareDialog } from './ui/ShareDialog';
export { createStoredShare, fetchStoredShare } from './model/share-api';
```

- [ ] **Step 5: Mount them**

- In `TopBar.tsx`, replace `<span className="top-bar__share" />` with `<span className="top-bar__share"><ShareButton /></span>`, importing `ShareButton` from `@/features/share`.
- In `EditorApp.tsx`:
  - import `ShareDialog` and `getLessonById` (from `@/features/lesson-engine/model/lesson-registry`);
  - compute `const lessonTitle = useVamsStore((s) => (s.activeLessonId ? getLessonById(s.activeLessonId)?.title ?? null : null));`;
  - add `<ShareDialog lessonTitle={lessonTitle} />` to `overlays`.
- Update BB-TOP-01 if it asserted an empty share slot. The slot now holds the button; assert `.top-bar__share .share-button` exists.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/black-box/share.test.ts tests/black-box/top-bar.test.ts`
Expected: PASS.

- [ ] **Step 7: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/share src/widgets/layout/top-bar/TopBar.tsx src/pages/editor/ui/EditorApp.tsx tests/black-box/share.test.ts tests/black-box/top-bar.test.ts
git diff --staged
git commit -m "feat(share): share a scene or lesson from the top bar with a link and QR code"
```

---

### Task 10: Opening shared links in the editor

**Files:**
- Create: `src/pages/editor/model/share-link.ts`
- Create: `src/features/share/model/resolve-shared.ts` (and export it from `src/features/share/index.ts`)
- Create: `src/pages/editor/model/open-shared.ts`
- Modify: `src/pages/editor/model/editor-link.ts` (strip `editor` too), `src/pages/editor/model/useEditorLink.ts`
- Modify: `src/app/SiteApp.tsx` (route `/s/:id`), and whatever sets the document title on route change, so `/s/*` gets the editor's title
- Modify: `src/app/pwa/pwa-options.ts`
- Modify: `src/features/scene-library/ui/MyScenesDialog.tsx`, if it labels backup reasons (add `'shared-link'`)
- Test: `tests/black-box/editor-links.test.ts` (BB-LINK-15 to 21), `tests/black-box/offline-app.test.ts` (BB-PWA-10)

**Interfaces:**
- Consumes: `decodeShare`, `readSharePayload` (Task 6); `fetchStoredShare` (Task 7); `replaceScene` with `name` (Task 2); `'shared-link'` (Task 1).
- Produces:
  - `type ShareLink = { kind: 'carried'; data: string } | { kind: 'stored'; id: string }`;
  - `parseShareLink(pathname, hash): ShareLink | null`;
  - `PHONE_MAX_WIDTH` (= 960);
  - `shouldShowSceneView(width, loc)`;
  - `editorAnywayUrl(loc)`;
  - `resolveSharedScene(link, fetchImpl?)` → `{ ok: true; scene: SharedScene } | { ok: false; message: string }`;
  - `SHARE_MESSAGES`;
  - `openSharedScene(link, deps): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/editor-links.test.ts`, importing what the cases need:
- `parseShareLink`, `shouldShowSceneView`, `editorAnywayUrl` and `PHONE_MAX_WIDTH` from `@/pages/editor/model/share-link`;
- `openSharedScene` from `@/pages/editor/model/open-shared`;
- `SHARE_MESSAGES` from `@/features/share`;
- `buildSharePayload` and `encodeShare` from `@/entities/share`;
- `createMemoryLibrary` and `setSceneLibraryForTests` from `@/entities/project/model/scene-library`;
- `toast` from `sonner` (spy on it).

```ts
const sharedPayload = (extra: Record<string, unknown> = {}) => {
  addTriangle();
  const s = useVamsStore.getState();
  const p = buildSharePayload({ sceneName: 'Solar system', objects: s.objects, callbacks: s.callbacks, viewportLimits: s.viewportLimits, canvasBackgroundColor: s.canvasBackgroundColor, textures: [] });
  useVamsStore.setState({ objects: [] });
  return { ...p, ...extra };
};

describe('BB-LINK-15: Shared links are recognised by path or hash', () => {
  it('parses /s/<id> and #s=<data>, and ignores everything else', () => {
    expect(parseShareLink('/s/k3x9q2Ab', '')).toEqual({ kind: 'stored', id: 'k3x9q2Ab' });
    expect(parseShareLink('/s/k3x9q2Ab/', '')).toEqual({ kind: 'stored', id: 'k3x9q2Ab' });
    expect(parseShareLink('/app', '#s=abc_-1')).toEqual({ kind: 'carried', data: 'abc_-1' });
    expect(parseShareLink('/app', '')).toBeNull();
    expect(parseShareLink('/app', '#section')).toBeNull();
    expect(parseShareLink('/learn', '')).toBeNull();
  });

  it('sends phones to the scene view unless they asked for the editor', () => {
    expect(PHONE_MAX_WIDTH).toBe(960);
    const stored = { pathname: '/s/k3x9q2Ab', search: '', hash: '' };
    expect(shouldShowSceneView(390, stored)).toBe(true);
    expect(shouldShowSceneView(959, { pathname: '/app', search: '', hash: '#s=abc' })).toBe(true);
    expect(shouldShowSceneView(960, stored)).toBe(false);
    expect(shouldShowSceneView(390, { ...stored, search: '?editor=1' })).toBe(false);
    expect(shouldShowSceneView(390, { pathname: '/app', search: '', hash: '' })).toBe(false);
    expect(editorAnywayUrl(stored)).toBe('/s/k3x9q2Ab?editor=1');
    expect(editorAnywayUrl({ pathname: '/app', search: '', hash: '#s=abc' })).toBe('/app?editor=1#s=abc');
  });
});

describe('BB-LINK-16: A carried link opens its scene, backed up and named', () => {
  it('replaces the scene, names it and keeps the visitor’s view settings', async () => {
    const lib = createMemoryLibrary();
    setSceneLibraryForTests(lib);
    const data = encodeShare(sharedPayload());
    addQuad();
    useVamsStore.setState({ showCoordinateTracker: true });
    const ok = await openSharedScene({ kind: 'carried', data }, { openLibrary: () => {} });
    expect(ok).toBe(true);
    const s = useVamsStore.getState();
    expect(s.sceneName).toBe('Solar system');
    expect(s.objects).toHaveLength(1);
    expect(s.showCoordinateTracker).toBe(true);
    expect((await lib.list()).some((e) => e.kind === 'backup' && e.reason === 'shared-link')).toBe(true);
  });
});

describe('BB-LINK-17: A stored link fetches its scene; failures say why', () => {
  it('opens on 200 and words 404, offline, damaged and server errors', async () => {
    const lib = createMemoryLibrary();
    setSceneLibraryForTests(lib);
    const errors = vi.spyOn(toast, 'error');
    const body = JSON.stringify(sharedPayload());
    expect(await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, fetchImpl: vi.fn(async () => new Response(body, { status: 200 })) })).toBe(true);
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, fetchImpl: vi.fn(async () => new Response('', { status: 404 })) });
    expect(errors).toHaveBeenLastCalledWith(SHARE_MESSAGES.missing);
    expect(SHARE_MESSAGES.missing).toBe('That shared scene has expired or can’t be found. Ask for a new link.');
    await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, fetchImpl: vi.fn(async () => { throw new TypeError('offline'); }) });
    expect(errors).toHaveBeenLastCalledWith('Connect to the internet to open this shared scene.');
    await openSharedScene({ kind: 'carried', data: 'damaged' }, { openLibrary: () => {} });
    expect(errors).toHaveBeenLastCalledWith('That link is incomplete. Ask for it again.');
    await openSharedScene({ kind: 'stored', id: 'k3x9q2Ab' }, { openLibrary: () => {}, fetchImpl: vi.fn(async () => new Response('', { status: 503 })) });
    expect(errors).toHaveBeenLastCalledWith('That shared scene couldn’t be loaded. Try again in a moment.');
    errors.mockRestore();
  });
});

describe('BB-LINK-18: Opening a shared link leaves a running lesson first', () => {
  it('ends the lesson, so its backup does not return over the shared scene', async () => {
    setSceneLibraryForTests(createMemoryLibrary());
    const data = encodeShare(sharedPayload());
    useVamsStore.setState({ appMode: 'Lesson', activeLessonId: 'transforms-demo-1', sceneBackup: [], currentStepIndex: 1 });
    await openSharedScene({ kind: 'carried', data }, { openLibrary: () => {} });
    const s = useVamsStore.getState();
    expect(s.activeLessonId).toBeNull();
    expect(s.appMode).toBe('Author');
    expect(s.sceneBackup).toBeNull();
    expect(s.objects).toHaveLength(1);
  });
});

describe('BB-LINK-19: A texture the share does not carry is dropped, and the scene still opens', () => {
  it('detaches the missing texture', async () => {
    setSceneLibraryForTests(createMemoryLibrary());
    const p = sharedPayload();
    p.objects = p.objects.map((o) => ({ ...o, texture: { textureId: 'not-here', filter: 'NEAREST', wrap: 'REPEAT' } })) as typeof p.objects;
    expect(await openSharedScene({ kind: 'carried', data: encodeShare(p) }, { openLibrary: () => {} })).toBe(true);
    expect(useVamsStore.getState().objects[0].texture).toBeNull();
  });
});

describe('BB-LINK-20: A shared link in the address bar opens once, on load and on hashchange', () => {
  it('cleans the URL to /app and applies a later #s= without a reload', async () => {
    setSceneLibraryForTests(createMemoryLibrary());
    const data = encodeShare(sharedPayload());
    window.history.replaceState(null, '', `/app#s=${data}`);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const { useEditorLink } = await import('@/pages/editor/model/useEditorLink');
    const Probe = () => {
      useEditorLink();
      return null;
    };
    render(h(Probe, {}), host);
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    expect(window.location.pathname + window.location.hash).toBe('/app');
    expect(useVamsStore.getState().sceneName).toBe('Solar system');
    const other = encodeShare({ ...sharedPayload(), name: 'Orbit' });
    window.location.hash = `#s=${other}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    expect(useVamsStore.getState().sceneName).toBe('Orbit');
    render(null, host);
    host.remove();
  });
});

describe('BB-LINK-21: /s/<id> is a route of the site', () => {
  it('renders the editor page for /s/<id>', async () => {
    const source = (await import('node:fs')).readFileSync('src/app/SiteApp.tsx', 'utf8');
    expect(source).toMatch(/<Route path="\/s\/:id" component=\{EditorPage\} \/>/);
    const redirects = (await import('node:fs')).readFileSync('public/_redirects', 'utf8');
    expect(redirects).toMatch(/^\/s\/\*\s+\/app\s+200$/m);
  });
});
```

Wrap every test that calls `setSceneLibraryForTests` in the file's existing reset, or add `afterEach(() => setSceneLibraryForTests(null))`, matching how BB-LIB resets it. Restore `window.history` to `/` after BB-LINK-20.

Append to `tests/black-box/offline-app.test.ts`:

```ts
describe('BB-PWA-10: Share API requests never fall back to a cached page', () => {
  it('denies /api/ navigations', () => {
    const deny = buildPwaOptions().workbox!.navigateFallbackDenylist!;
    expect(deny.some((r) => r.test('/api/share/k3x9q2Ab'))).toBe(true);
  });
});
```

(Import `buildPwaOptions` from `@/app/pwa/pwa-options` if the file doesn't already.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/editor-links.test.ts tests/black-box/offline-app.test.ts`
Expected: FAIL.

- [ ] **Step 3: The light link module**

`src/pages/editor/model/share-link.ts`. It must not import the store or any feature, because `EditorPage` uses it:

```ts
/** What a shared link points at: a scene carried in the hash, or one stored on the server. */
export type ShareLink = { kind: 'carried'; data: string } | { kind: 'stored'; id: string };

/** Windows narrower than this get the read-only scene view: the editor's own minimum width. */
export const PHONE_MAX_WIDTH = 960;

export function parseShareLink(pathname: string, hash: string): ShareLink | null {
  const stored = /^\/s\/([^/]+)\/?$/.exec(pathname);
  if (stored) return { kind: 'stored', id: decodeURIComponent(stored[1]) };
  const carried = /^#s=(.+)$/.exec(hash);
  return carried ? { kind: 'carried', data: carried[1] } : null;
}

interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export function shouldShowSceneView(width: number, loc: LocationLike): boolean {
  if (width >= PHONE_MAX_WIDTH) return false;
  if (new URLSearchParams(loc.search).has('editor')) return false;
  return parseShareLink(loc.pathname, loc.hash) !== null;
}

/** The same link, asking for the editor even on a narrow window. */
export function editorAnywayUrl(loc: LocationLike): string {
  const params = new URLSearchParams(loc.search);
  params.set('editor', '1');
  return `${loc.pathname}?${params.toString()}${loc.hash}`;
}
```

- [ ] **Step 4: Resolving and opening**

`src/features/share/model/resolve-shared.ts`:

```ts
import { decodeShare, readSharePayload, type SharedScene } from '@/entities/share';
import { fetchStoredShare } from './share-api';

export const SHARE_MESSAGES = {
  missing: 'That shared scene has expired or can’t be found. Ask for a new link.',
  damaged: 'That link is incomplete. Ask for it again.',
  offline: 'Connect to the internet to open this shared scene.',
  unavailable: 'That shared scene couldn’t be loaded. Try again in a moment.',
} as const;

type Link = { kind: 'carried'; data: string } | { kind: 'stored'; id: string };

export async function resolveSharedScene(link: Link, fetchImpl?: typeof fetch): Promise<{ ok: true; scene: SharedScene } | { ok: false; message: string }> {
  if (link.kind === 'carried') {
    const raw = decodeShare(link.data);
    const scene = raw === null ? null : readSharePayload(raw);
    return scene ? { ok: true, scene } : { ok: false, message: SHARE_MESSAGES.damaged };
  }
  if (!/^[0-9A-Za-z]{8}$/.test(link.id)) return { ok: false, message: SHARE_MESSAGES.missing };
  const res = await fetchStoredShare(link.id, fetchImpl);
  if (!res.ok) return { ok: false, message: SHARE_MESSAGES[res.reason] };
  const scene = readSharePayload(res.payload);
  return scene ? { ok: true, scene } : { ok: false, message: SHARE_MESSAGES.damaged };
}
```

Export `resolveSharedScene` and `SHARE_MESSAGES` from `src/features/share/index.ts`.

`src/pages/editor/model/open-shared.ts`:

```ts
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { resolveSharedScene } from '@/features/share';
import { recordLessonLeft } from '@/features/lesson-engine/model/progress';
import { backupLabel, replaceScene } from '@/features/scene-library';
import type { ShareLink } from './share-link';

export interface OpenSharedDeps {
  openLibrary: () => void;
  fetchImpl?: typeof fetch;
}

/** Opens a shared scene as the working scene, as a prepared scene link does. Returns whether it opened. */
export async function openSharedScene(link: ShareLink, deps: OpenSharedDeps): Promise<boolean> {
  const resolved = await resolveSharedScene(link, deps.fetchImpl);
  if (!resolved.ok) {
    toast.error(resolved.message);
    return false;
  }
  const { name, data } = resolved.scene;
  const running = useVamsStore.getState();
  if (running.activeLessonId) {
    // Leave the lesson first; its backup of the student's scene would otherwise come back over the shared one.
    recordLessonLeft(running.activeLessonId, running.currentStepIndex);
    running.clearLessonState();
    useVamsStore.getState().setAppMode('Author');
  }
  const now = useVamsStore.getState();
  // The visitor's own view preferences stay theirs.
  const merged = { ...data, axisVisibility: now.axisVisibility, showCoordinateTracker: now.showCoordinateTracker, learningSettings: now.learningSettings };
  try {
    const { backedUp } = await replaceScene(merged, { reason: 'shared-link', label: backupLabel(name), name });
    if (backedUp) {
      toast.success(`Opened ‘${name}’`, {
        description: 'Your previous scene is in My scenes.',
        action: { label: 'My scenes', onClick: deps.openLibrary },
      });
    } else {
      toast.success(`Opened ‘${name}’`);
    }
    return true;
  } catch (error) {
    console.error(error);
    toast.error(`Couldn’t keep a backup of your current scene, so ‘${name}’ was not opened.`);
    return false;
  }
}
```

Check that `setAppMode` exists on the store (`grep -n "setAppMode" src/core/store/*.ts`); `applyEditorLink` uses it. If `clearLessonState` already sets Author mode, the extra call is harmless.

- [ ] **Step 5: Wire the editor and the site**

`useEditorLink.ts`:

```ts
import { useEffect } from 'react';
import { useVamsStore } from '@/core/store';
import { useMyScenesDialog } from '@/features/scene-library';
import { applyEditorLink, parseEditorLink, stripEditorLinkParams } from './editor-link';
import { openSharedScene } from './open-shared';
import { parseShareLink } from './share-link';

const openLibrary = () => useMyScenesDialog.getState().open();

/**
 * Apply a ?lesson=, ?scene= or shared link once when the editor mounts, and a #s= link whenever the
 * hash changes. The link is removed from the URL first, so a reload (or a crash mid-way) never applies it twice.
 */
export function useEditorLink(): void {
  useEffect(() => {
    const apply = () => {
      const { pathname, search, hash } = window.location;
      const share = parseShareLink(pathname, hash);
      const link = parseEditorLink(search);
      if (!share && link.kind === 'none') return;
      const path = share ? '/app' : pathname;
      window.history.replaceState(window.history.state, '', `${path}${stripEditorLinkParams(search)}${share ? '' : hash}`);
      if (share) {
        useVamsStore.getState().markWelcomeSeen();
        void openSharedScene(share, { openLibrary });
        return;
      }
      void applyEditorLink(link, { openLibrary });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
}
```

In `editor-link.ts`, change `LINK_PARAMS` to `['lesson', 'scene', 'editor'] as const`, so `?editor=1` is stripped too.

In `src/app/SiteApp.tsx`, add `<Route path="/s/:id" component={EditorPage} />` after the `/app` route. Read `syncDocumentTitle` (and `route-meta.ts`) and make a path starting `/s/` use the `/app` route's title and metadata. Never add `/s/:id` to the prerender list or the sitemap.

In `src/app/pwa/pwa-options.ts`, add `/^\/api\//` to `navigateFallbackDenylist`.

If `MyScenesDialog.tsx` or `scene-library.ts` maps backup reasons to words, add `'shared-link'` → "Opened a shared link", in the style of `'scene-link'`'s wording.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/black-box/editor-links.test.ts tests/black-box/offline-app.test.ts`
Expected: PASS.

- [ ] **Step 7: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/editor/model src/features/share src/app/SiteApp.tsx src/app/pwa/pwa-options.ts src/app/routes src/features/scene-library tests/black-box/editor-links.test.ts tests/black-box/offline-app.test.ts
git diff --staged
git commit -m "feat(share): open shared links in the editor, on load and when the hash changes"
```

---

### Task 11: The read-only scene view on phones

**Files:**
- Create: `src/pages/editor/ui/SceneViewApp.tsx`, `src/pages/editor/ui/scene-view.scss`
- Modify: `src/pages/editor/ui/EditorPage.tsx`
- Modify: `src/widgets/canvas/VamsCanvas.tsx` (`readOnly`, if Task 4 didn't finish it)
- Test: create `tests/black-box/scene-view.test.ts` (BB-VIEW-01 to 04)

**Interfaces:**
- Consumes:
  - `shouldShowSceneView`, `editorAnywayUrl` and `parseShareLink` (Task 10);
  - `resolveSharedScene` (Task 10);
  - `CanvasWindow` and `VamsCanvas readOnly` (Task 4);
  - `loadProjectData(data, identity)` (Task 2);
  - `generateCodeFromState`;
  - `CodeViewer`.
- Produces: `SceneViewApp`, which writes nothing to the visitor's storage.

- [ ] **Step 1: Write the failing tests**

`tests/black-box/scene-view.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-VIEW
 * The read-only scene view a phone gets for a shared link.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render } from 'preact';
import { createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEY, useVamsStore } from '@/core/store';
import { buildSharePayload, encodeShare } from '@/entities/share';
import { createMemoryLibrary, setSceneLibraryForTests } from '@/entities/project/model/scene-library';
import SceneViewApp from '@/pages/editor/ui/SceneViewApp';
import { registerFakeRenderer } from '../helpers/fake-renderer';
import { addTriangle } from '../helpers/store';

async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function carried(name = 'Solar system') {
  addTriangle();
  const s = useVamsStore.getState();
  const data = encodeShare(buildSharePayload({ sceneName: name, objects: s.objects, callbacks: s.callbacks, viewportLimits: s.viewportLimits, canvasBackgroundColor: s.canvasBackgroundColor, textures: [] }));
  useVamsStore.setState({ objects: [] });
  return data;
}

afterEach(() => {
  useVamsStore.persist.setOptions({ storage: createJSONStorage(() => localStorage) });
  window.history.replaceState(null, '', '/');
  setSceneLibraryForTests(null);
});

describe('BB-VIEW-01: A phone sees the shared scene and its code', () => {
  it('shows the name, the window and the generated C++', async () => {
    registerFakeRenderer();
    window.history.replaceState(null, '', `/app#s=${carried()}`);
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneViewApp, {}), host);
    await settle();
    expect(host.querySelector('.scene-view__name')!.textContent).toBe('Solar system');
    expect(host.querySelector('.canvas-window__title')!.textContent).toBe('VAMS Preview');
    expect(host.textContent).toContain('Editing needs a computer. Open this link there.');
    expect(host.querySelector('.scene-view__code')!.textContent).toContain('glBegin(GL_TRIANGLES)');
    render(null, host);
    host.remove();
  });
});

describe('BB-VIEW-02: The view writes nothing to the visitor’s storage', () => {
  it('leaves localStorage and My scenes untouched', async () => {
    registerFakeRenderer();
    const lib = createMemoryLibrary();
    setSceneLibraryForTests(lib);
    localStorage.setItem(STORAGE_KEY, '{"state":{"sceneName":"Mine"},"version":10}');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    window.history.replaceState(null, '', `/app#s=${carried()}`);
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneViewApp, {}), host);
    await settle();
    useVamsStore.getState().renameScene('Changed in the view');
    await settle();
    expect(writes.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"state":{"sceneName":"Mine"},"version":10}');
    expect(await lib.list()).toEqual([]);
    writes.mockRestore();
    render(null, host);
    host.remove();
  });
});

describe('BB-VIEW-03: A link that can’t open says why', () => {
  it('shows the damaged-link message', async () => {
    window.history.replaceState(null, '', '/app#s=damaged');
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneViewApp, {}), host);
    await settle();
    expect(host.textContent).toContain('That link is incomplete. Ask for it again.');
    render(null, host);
    host.remove();
  });
});

describe('BB-VIEW-04: The view offers the editor anyway, and copies its link', () => {
  it('links to ?editor=1 and copies the current address', async () => {
    registerFakeRenderer();
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const data = carried();
    window.history.replaceState(null, '', `/app#s=${data}`);
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(SceneViewApp, {}), host);
    await settle();
    expect((host.querySelector('.scene-view__anyway') as HTMLAnchorElement).getAttribute('href')).toBe(`/app?editor=1#s=${data}`);
    ([...host.querySelectorAll('button')].find((b) => b.textContent === 'Copy link') as HTMLButtonElement).click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    render(null, host);
    host.remove();
  });
});
```

Check `tests/helpers/fake-renderer.ts` for how `registerFakeRenderer` is meant to be called, and follow it. BB-SHELL tests that mount canvases show the pattern.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/black-box/scene-view.test.ts`
Expected: FAIL. `SceneViewApp` does not exist.

- [ ] **Step 3: The view**

`src/pages/editor/ui/SceneViewApp.tsx`. Read `SegmentedControl`'s props in `src/shared/ui/controls/SegmentedControl.tsx` before using it.

```tsx
import './scene-view.scss';
import { useEffect, useState } from 'react';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { resolveSharedScene, SHARE_MESSAGES } from '@/features/share';
import { loadProjectData } from '@/features/scene-library';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import CanvasWindow from '@/widgets/canvas/ui/CanvasWindow';
import VamsCanvas from '@/widgets/canvas/VamsCanvas';
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { Button, SegmentedControl } from '@/shared/ui/controls';
import Logo from '@/shared/ui/logo';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { editorAnywayUrl, parseShareLink } from '../model/share-link';

/** This page only shows a shared scene: nothing it loads may reach the visitor's own saved editor. */
const NO_STORAGE: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

type ViewState = { status: 'loading' } | { status: 'ready'; name: string } | { status: 'error'; message: string };

export default function SceneViewApp() {
  const [view, setView] = useState<ViewState>({ status: 'loading' });
  const [pane, setPane] = useState<'scene' | 'code'>('scene');
  const size = useCanvasSize();
  const objects = useVamsStore((s) => s.objects);
  const callbacks = useVamsStore((s) => s.callbacks);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const background = useVamsStore((s) => s.canvasBackgroundColor);

  useEffect(() => {
    useVamsStore.persist.setOptions({ storage: createJSONStorage(() => NO_STORAGE) });
    const link = parseShareLink(window.location.pathname, window.location.hash);
    if (!link) {
      setView({ status: 'error', message: SHARE_MESSAGES.damaged });
      return;
    }
    void resolveSharedScene(link).then((r) => {
      if (!r.ok) {
        setView({ status: 'error', message: r.message });
        return;
      }
      loadProjectData(r.scene.data, { sceneId: '', sceneName: r.scene.name });
      useVamsStore.setState({ selectedObjectId: null, appMode: 'Author', activeLessonId: null });
      setView({ status: 'ready', name: r.scene.name });
    });
  }, []);

  const code =
    view.status === 'ready'
      ? generateCodeFromState({ objects, canvasBackgroundColor: background, callbacks, viewportLimits, textures: useVamsStore.getState().getAllTextures() }, size)
      : '';
  const copy = () =>
    navigator.clipboard.writeText(window.location.href).then(
      () => toast.success('Link copied'),
      () => toast.error('Couldn’t copy. Copy the address from the browser instead.'),
    );

  return (
    <div className="scene-view">
      <header className="scene-view__top">
        <a className="scene-view__home" href="/" aria-label="VAMS home"><Logo /></a>
        <h1 className="scene-view__name">{view.status === 'ready' ? view.name : 'Shared scene'}</h1>
        <ThemeToggleButton className="vbtn vbtn--quiet vbtn--md vbtn--icon" />
      </header>
      {view.status === 'error' && <p className="scene-view__error" role="alert">{view.message}</p>}
      {view.status !== 'error' && (
        <>
          <SegmentedControl
            label="Show"
            value={pane}
            onChange={(next: string) => setPane(next as 'scene' | 'code')}
            options={[{ value: 'scene', label: 'Scene' }, { value: 'code', label: 'Code' }]}
          />
          <div className="scene-view__window" hidden={pane !== 'scene'}>
            <CanvasWindow size={size} running={false}>
              <VamsCanvas readOnly />
            </CanvasWindow>
          </div>
          <div className="scene-view__code" hidden={pane !== 'code'}>
            <CodeViewer code={code} />
          </div>
        </>
      )}
      <p className="scene-view__note">Editing needs a computer. Open this link there.</p>
      <div className="scene-view__actions">
        <Button variant="primary" onClick={() => void copy()}>Copy link</Button>
        <a className="scene-view__anyway" href={editorAnywayUrl(window.location)}>Open in the editor anyway</a>
      </div>
    </div>
  );
}
```

Adapt the `SegmentedControl` props to its real API. The code must stay in the DOM even while hidden (BB-VIEW-01 reads it), so `hidden` is right.

`src/pages/editor/ui/scene-view.scss` (tokens only):
- a single column, max 640 px wide, centred, 12 px padding;
- the header is a flex row: logo, name (`--text-md`, 600, ellipsis), theme toggle;
- `.scene-view__window` is `aspect-ratio: 4 / 3; width: 100%; display: flex;`;
- `.scene-view__code` has `max-height: 60vh; overflow: auto`, and its `.code-viewer-container` is `position: relative`, so it doesn't stretch to the page;
- the note is muted `--text-sm`;
- the actions are a flex row with a quiet link.

- [ ] **Step 4: Choose the view on a phone**

In `EditorPage.tsx`:

```tsx
import { shouldShowSceneView } from '../model/share-link';
// …
const EditorApp = lazy(() => import('./EditorApp'));
const SceneViewApp = lazy(() => import('./SceneViewApp'));
// … after the mounted check:
const sceneView = shouldShowSceneView(window.innerWidth, window.location);
return (
  <EditorErrorBoundary fallback={(error) => <RecoveryScreen error={error} actions={recoveryActions} />}>
    <Suspense fallback={<EditorLoading />}>{sceneView ? <SceneViewApp /> : <EditorApp />}</Suspense>
  </EditorErrorBoundary>
);
```

`share-link.ts` imports nothing, so `EditorPage`'s shared bundle stays free of the store.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/black-box/scene-view.test.ts`
Expected: PASS. Then run `npm test`; the persist restore in `afterEach` keeps the other suites unaffected.

- [ ] **Step 6: Look at it on a phone width**

Build and preview on 4319 (background, stop by PID). With Playwright, load `/app#s=<data>` at 390×844, `deviceScaleFactor` 2, dark and light, using a payload from a triangle scene. Capture the Scene and Code panes into the git-ignored `checkpoints/step-2/`, and look at them. The window must fit the width, the code must scroll, and nothing may overflow sideways. Fix what is off.

- [ ] **Step 7: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/editor/ui src/widgets/canvas/VamsCanvas.tsx src/widgets/canvas/vams-canvas.scss tests/black-box/scene-view.test.ts
git diff --staged
git commit -m "feat(share): show shared scenes read-only on phones"
```

---

### Task 12: Cloudflare setup (with the owner)

This task touches the owner's Cloudflare account. Ask before every step that creates or changes anything there.

**Files:**
- Create: `wrangler.toml`

- [ ] **Step 1: Sign in**

Ask the owner to approve `npx wrangler@4 login`, which opens a browser for them to sign in. Then run `npx wrangler@4 whoami` and `npx wrangler@4 pages project list`, and note the Pages project that builds `main`.

- [ ] **Step 2: Create the KV namespace**

With the owner's go-ahead: `npx wrangler@4 kv namespace create SHARES`. Note the `id` it prints.

- [ ] **Step 3: Rate limiting**

Read Cloudflare's current docs for rate limiting in Pages Functions (the Workers rate-limiting binding and its `wrangler.toml` form).
- If Pages Functions support the binding, add it to `wrangler.toml` as `SHARE_LIMITER` with `limit = 10` and `period = 60`.
- If they don't, ask the owner to add one WAF rate-limiting rule for `/api/share` (POST, 10 requests per minute per IP, block for a minute) in the dashboard. Note in the commit message which one was done.

- [ ] **Step 4: Write `wrangler.toml`**

```toml
# Cloudflare Pages: the site's build output and the store behind shared scene links.
name = "PROJECT_NAME_FROM_STEP_1"
pages_build_output_dir = "dist"
compatibility_date = "2026-10-01"

[[kv_namespaces]]
binding = "SHARES"
id = "KV_ID_FROM_STEP_2"
```

Replace both values with the real ones from steps 1 and 2 before saving. Nothing in caps may reach the commit.

- [ ] **Step 5: Try it locally**

```bash
npm run build
npx wrangler@4 pages dev dist --port 4320 --kv SHARES
```

Run it as a background process and stop it by PID afterwards. With `curl`:
- POST a small valid payload to `http://localhost:4320/api/share` and expect `201`;
- GET `/api/share/<id>` and expect the same body;
- GET `/s/<id>` and expect the `/app` document.

Then open `http://localhost:4320/s/<id>` in Playwright at 1280 and at 390, and check that the editor opens the scene and the view shows it.

- [ ] **Step 6: Commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add wrangler.toml
git diff --staged
git commit -m "chore(share): bind the shared-scene KV namespace for Pages Functions"
```

The function goes live when `main` is pushed, which waits for the owner's approval at the end.

---

### Task 13: Checkpoint 2 (sharing)

This task ends with the owner's sign-off; build step 3 does not start until then.

**Files:**
- Create: `tests/visual/share.spec.ts` (VIS-SHARE-01 to 03)
- Modify: `tests/README.md` (the visual suite list; the full README update is Task 15)

- [ ] **Step 1: The visual suite**

`tests/visual/share.spec.ts`. Seed the editor as `tests/visual/code-math.spec.ts` does (`openMockScene`; import it or copy the seeding at store version 10). Add:
- **VIS-SHARE-01:** the Share dialog for the mocks' scene, at 1280, dark and light. It's a carried link, since that scene has no uploads.
- **VIS-SHARE-02:** the scene view at 390×844, dark and light, opened from `/app#s=<payload of the mocks' scene>`.
- **VIS-SHARE-03:** the Try it section is Task 14's; add this test there.

Create the baselines with `npx playwright test tests/visual/share.spec.ts --update-snapshots`, and look at them.

- [ ] **Step 2: Capture for the owner**

At 2×, capture these states:
- the dialog for a carried link;
- the dialog for a stored link with a shrunk image, through `wrangler pages dev` from Task 12, or by routing `/api/share` in Playwright to answer `201`;
- the fallback;
- the failure (route `/api/share` to `503`);
- the lesson link;
- the scene view in both panes;
- a computer opening a shared link, with the toast.

Build `step-2.html` with each beside `share-dialog.html` A.

- [ ] **Step 3: Owner sign-off**

Show it. Make the requested changes, and re-show them until signed off.

- [ ] **Step 4: Commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add tests/visual/share.spec.ts tests/README.md
git diff --staged
git commit -m "test(visual): capture the Share dialog and the phone scene view"
```

---

# Build step 3: the closing-slide QR and the documents (site, by Nov 2)

### Task 14: A QR code to the site on the "Try it" slide

**Files:**
- Modify: `src/pages/home/ui/sections/TryItSection.tsx`
- Modify: `src/pages/home/ui/home.scss` and `src/pages/home/ui/home-stage.scss` (stage-mode size)
- Modify: `tests/visual/share.spec.ts` (VIS-SHARE-03)
- Test: `tests/black-box/site-shell.test.ts` (BB-SITE-38)

**Interfaces:**
- Consumes: `QrCode` (Task 7), `SITE_URL` (Task 6), `TRY_IT.displayUrl`.

- [ ] **Step 1: Write the failing test**

Append to `tests/black-box/site-shell.test.ts` (add `renderToString` from `preact-render-to-string` and `TryItSection` from `@/pages/home/ui/sections/TryItSection` if not imported):

```ts
describe('BB-SITE-38: The Try it slide carries a QR code to the site', () => {
  it('prerenders an SVG code beside the written address', () => {
    const html = renderToString(h(TryItSection, {}));
    expect(html).toContain('class="qr-code try-qr__code"');
    expect(html).toMatch(/role="img" aria-label="QR code for vams\.pages\.dev"/);
    expect(html).toMatch(/<svg[^>]+viewBox="0 0 \d+ \d+"/);
    expect(html).toContain('vams.pages.dev');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/black-box/site-shell.test.ts -t "BB-SITE-38"`
Expected: FAIL.

- [ ] **Step 3: Add the code**

In `TryItSection.tsx`, replace `<p className="try-url">{TRY_IT.displayUrl}</p>` with:

```tsx
<figure className="try-qr">
  <QrCode text={SITE_URL} label="QR code for vams.pages.dev" size={168} className="try-qr__code" />
  <figcaption className="try-url">{TRY_IT.displayUrl}</figcaption>
</figure>
```

Import `QrCode` from `@/shared/ui/qr/QrCode` and `SITE_URL` from `@/shared/lib/site-url`.

In `home.scss`, style `.try-qr`:
- an inline flex row, centred items, a gap of `var(--space-4)`, and `margin: var(--space-4) 0 0`;
- the code with an 8 px radius and a 1 px `--rule` border;
- the caption keeps `.try-url`'s look.

In `home-stage.scss`, find the stage-mode selector (search for `stage` or `data-slide`). Under it, the QR's `width` and `height` grow to `min(34vh, 320px)` so it scans from the back of a room. The `size` prop sets inline pixels, so override with `!important` there, or pass no inline size and size by CSS: pick one and keep it consistent.

- [ ] **Step 4: Run it, then capture**

Run: `npx vitest run tests/black-box/site-shell.test.ts`
Expected: PASS.

Add **VIS-SHARE-03** to `tests/visual/share.spec.ts`: the Try it section in stage mode (`/?stage#try`, or however stage mode addresses a slide; read `stage-controller.ts`) at 1280, dark and light. Update its baseline and look at it. Scan the captured QR with a phone if one is at hand; otherwise decode it with the `uqr` round-trip: re-encode `SITE_URL` and compare the SVG.

- [ ] **Step 5: Lint, build, test, commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/home tests/black-box/site-shell.test.ts tests/visual/share.spec.ts
git diff --staged
git commit -m "feat(home): put a QR code to the site on the closing slide"
```

---

### Task 15: Documents

**Files:**
- Modify: `src/features/help/model/help-content.ts`
- Modify: `docs/product-plan.md`
- Modify: `docs/specs/2026-10-04-website-overhaul-roadmap.md`
- Modify: `tests/README.md`
- Test: `tests/black-box/help-center.test.ts` (BB-HELP-10)

- [ ] **Step 1: Write the failing test**

Append to `tests/black-box/help-center.test.ts`:

```ts
describe('BB-HELP-10: Help covers sharing, the top bar and the canvas window', () => {
  it('has a sharing topic and names the new places', () => {
    const sharing = JSON.stringify(HELP_TOPICS.find((t) => t.id === 'sharing'));
    for (const word of ['Share', 'QR', '90 days', 'phone', 'uploaded image']) expect(sharing, word).toContain(word);
    const tour = JSON.stringify(HELP_TOPICS.find((t) => t.id === 'workspace-tour'));
    for (const word of ['scene’s name', 'Settings', 'VAMS Preview']) expect(tour, word).toContain(word);
    const saving = JSON.stringify(HELP_TOPICS.find((t) => t.id === 'saving-loading'));
    expect(saving).toContain('saved by name in My scenes');
    expect(JSON.stringify(HELP_TOPICS)).not.toMatch(/Export scene JSON|theme button/i);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/black-box/help-center.test.ts -t "BB-HELP-10"`
Expected: FAIL.

- [ ] **Step 3: Help content**

In `help-content.ts`:

1. **`workspace-tour`.** Add a paragraph after the one describing the right column:

```ts
{
  kind: 'paragraph',
  text: 'The top bar holds File and Learn, then your scene’s name: click it to rename the scene, and the note beside it says when it was saved. On the right are undo and redo, Settings (the theme and what the canvas shows), Help and Share. The canvas is drawn as your program’s window, titled VAMS Preview with its size, the same title and size the generated main() gives it. The header above it shows the viewing volume, the cursor position when the coordinate tracker is on, and Run.',
},
```

2. **`saving-loading`.** Add a callout before the existing tip:

```ts
{
  kind: 'callout',
  tone: 'tip',
  text: 'Your working scene is saved by name in My scenes a moment after every change. My scenes also keeps a backup whenever another scene replaces it.',
},
```

3. **A new topic** after `saving-loading`, with category `'workspace'` (check `CATEGORY_ORDER` near the top of the file and use an existing category):

```ts
{
  id: 'sharing',
  category: 'workspace',
  title: 'Sharing a Scene',
  summary: 'Send your scene as a link or a QR code; on a phone it opens as a view.',
  keywords: ['share', 'link', 'qr', 'phone', 'send', 'classmate', 'instructor'],
  blocks: [
    {
      kind: 'paragraph',
      text: 'Share in the top bar makes a link to a copy of your scene, with a QR code beside it. Anyone who opens the link on a computer gets the scene in their own editor; your scene is never changed. On a phone it opens as a view: the scene in its window and its C++.',
    },
    {
      kind: 'list',
      items: [
        'Most scenes travel inside the link itself, so the link never expires.',
        'A scene with an uploaded image is stored for 90 days and gets a short link. Large images are shared at 512 px; your own copy keeps its full size.',
        'If a link can’t be made, Save project file sends everything, uploaded images included.',
        'During a lesson, Share gives a link to the lesson.',
      ],
    },
    {
      kind: 'callout',
      tone: 'tip',
      text: 'Opening a shared link keeps your current scene in My scenes first, so nothing is lost.',
    },
  ],
  related: ['saving-loading', 'workspace-tour'],
},
```

4. Search the file for "theme button", "Export scene JSON", "top-right" and other descriptions of the old top bar, and update them to the new layout.

- [ ] **Step 4: The product plan**

In `docs/product-plan.md`:
1. **Workspace Layout.**
   - Add a bullet: "**Top bar**: File, Learn and the working scene's name (renamed in place, auto-saved by name to My scenes) on the left; undo, redo, a Settings menu (theme and view options), Help and Share on the right. During a lesson the name slot shows the lesson and its step."
   - In the canvas bullet, add: "The canvas is drawn as the program's window, titled with the generated `glutCreateWindow` title and the `glutInitWindowSize` size, on a stage under a header that shows the viewing volume, the cursor and Run."
2. **A new section, "Sharing",** after the persistence or saving section:

> A scene is shared as a link and a QR code. A scene without uploaded images travels inside the link (`/app#s=…`), so the link never expires. A scene with uploaded images, or too large for a scannable code, is stored by one Cloudflare Pages Function in Workers KV for 90 days (`/s/<id>`), with images shrunk to 512 px. Links open in the editor on computers, backing up the visitor's scene first, and as a read-only scene view on phones. During a lesson, Share gives the lesson's link.

3. Run `grep -n "server" docs/product-plan.md`. If the plan states the app has no server, amend that sentence: "The site has no server beyond one Pages Function that stores shared scenes."

- [ ] **Step 5: The roadmap**

In `docs/specs/2026-10-04-website-overhaul-roadmap.md`:
1. **The Shared decisions table.** Change the Framework row's "no server needs" to "no server beyond one Pages Function and one KV namespace for shared scenes ([editor chrome and sharing](2026-10-16-editor-chrome-share-design.md))".
2. **Should item 8.** Append ". Complete (DATE) with the editor chrome and sharing project". Use the date the branch is merged.
3. **"Next projects" item 3.** Append " Complete (DATE): [spec](2026-10-16-editor-chrome-share-design.md), [plan](../plans/2026-10-16-editor-chrome-share.md). It also redesigned the top bar and drew the canvas as the program's window."
4. **"Below the line".** Add a bullet: "Switch the code panel to CodeMirror 6 (owner, 2026-10-16: only if time allows after the expo). The panel's folds were fixed in place first."
5. **Divergences.** Append two numbered items after the last:
   - "The manuscript describes a client-only web application. Sharing scenes with uploaded images uses one server-side Pages Function and a key-value store, which keep a shared scene for 90 days."
   - "The manuscript's canvas is a plain drawing area. The canvas is now drawn as the program's window, titled as the generated program titles it, under a header holding the viewing volume, the cursor and Run."

- [ ] **Step 6: The tests README**

In `tests/README.md`, add to the layout block:
- under black-box:
  - `top-bar.test.ts (BB-TOP-*: the top bar, the scene title and its menus)`;
  - `canvas-window.test.ts (BB-CANVAS-*: the canvas header and the program's window)`;
  - `share.test.ts (BB-SHARE-*: the Share dialog and choosing a link)`;
  - `scene-view.test.ts (BB-VIEW-*: the read-only scene view on phones)`;
- under white-box:
  - `share-payload.test.ts (WB-SHARE-*: the shared payload, links, image shrinking, QR codes)`;
  - `share-function.test.ts (WB-SHAREFN-*: the Pages Function that stores shares)`;
  - `grid-labels.test.ts (WB-GRID-*: axis labels inside the canvas)`, if Task 4 created it;
- under visual: `share.spec.ts (VIS-SHARE-*: the Share dialog, the scene view and the closing slide)`.

Update "run all N tests" to the count `npm test` prints.

- [ ] **Step 7: Run, lint, build, test, commit**

```bash
npx vitest run tests/black-box/help-center.test.ts
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/help/model/help-content.ts docs/product-plan.md docs/specs/2026-10-04-website-overhaul-roadmap.md tests/README.md tests/black-box/help-center.test.ts
git diff --staged
git commit -m "docs: help, product plan, roadmap and divergences for the top bar, canvas window and sharing"
```

---

## Self-review

- **Spec coverage:**
  - §1 build order: the three build-step headings, checkpoints in Tasks 5 and 13, and the closing look in Task 14.
  - §2 top bar:
    - layout, File, Learn, settings, Share slot: Task 3;
    - name and save state: Tasks 1 to 3;
    - lessons: Task 3 (BB-TOP-06), with Task 2 skipping lesson writes;
    - Run: the inert actions in Task 3; Share sits inside them.
  - §3 canvas window:
    - header, stage, window, title bar, running state, labels, empty card, illustrations: Task 4.
  - §4 Share:
    - payload: Task 6;
    - carrying links: Task 6;
    - stored links and the function: Tasks 7, 8 and 12;
    - fallback and failure: Task 9;
    - lesson link: Task 9;
    - dialog: Task 9.
  - §5 opening links:
    - on a computer, with its messages: Task 10;
    - the phone view: Task 11;
    - offline: Task 10 (the `/api/` denylist). An offline visit to `/s/<id>` falls back to the 404 document, whose client router renders the editor route and shows the offline message. Check this at checkpoint 2.
  - §6 the closing QR: Task 14.
  - §7 tests: every task, plus VIS-SHARE in Tasks 13 and 14.
  - §8 documents: Task 15.
- **Placeholders:**
  - `wrangler.toml`'s project name and KV id are runtime values from Task 12, filled in before commit; the step says so.
  - The roadmap dates are the merge date.
- **Type consistency:**
  - `sceneIdentity(name?, id?)`, `loadProjectData(data, identity?)` and `ReplaceOptions.name` / `adoptId`.
  - `startSceneAutosave` and `useSaveStatus`.
  - `SharePayload`, `ShareTexture` and `isUpload`.
  - `ShareSource` (with `textures`) and `ShareInput = ShareSource & { lesson }`.
  - `planShare` → `{ kind: 'carried'; url } | { kind: 'stored' }`.
  - `ShareResult`, where `shrunk` is a count.
  - `createStoredShare` and `fetchStoredShare` reasons, against `SHARE_MESSAGES` keys: `missing`, `offline`, `unavailable` and `damaged`. `fetchStoredShare` never returns `damaged`; `resolveSharedScene` produces it.
  - `ShareLink`, `parseShareLink`, `shouldShowSceneView`, `editorAnywayUrl` and `PHONE_MAX_WIDTH`.
  - `CanvasWindow({ size, running, children })` and `VamsCanvas readOnly`.
  - `RunControl` and `RunLayer`.
  - `PROGRAM_WINDOW_TITLE` and `SITE_URL`.
  - `KvLike`, `LimiterLike` and `ShareEnv` with `SHARES` and `SHARE_LIMITER`.
- **Review Focus:** each line has its test:
  1. BB-LINK-18;
  2. BB-LIB-21;
  3. BB-LINK-20;
  4. BB-LIB-22;
  5. BB-LINK-19.
- **Test IDs:**
  - Task 1: WB-PERSIST-09 to 11, BB-LIB-17.
  - Task 2: BB-LIB-18 to 24.
  - Task 3: BB-TOP-01 to 06.
  - Task 4: BB-CANVAS-01 to 06, WB-GRID-01.
  - Tasks 6 and 7: WB-SHARE-01 to 11.
  - Task 8: WB-SHAREFN-01 to 07.
  - Task 9: BB-SHARE-01 to 08.
  - Task 10: BB-LINK-15 to 21, BB-PWA-10.
  - Task 11: BB-VIEW-01 to 04.
  - Task 14: BB-SITE-38.
  - Task 15: BB-HELP-10.
  - Visual: VIS-SHARE-01 to 03.

  Each was the next free number on 2026-10-16. A number taken earlier by a fix shifts the later ones to the next free number.
