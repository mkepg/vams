# SP3 Demo readiness — design

Date: 2026-10-06
Roadmap: [2026-10-04-website-overhaul-roadmap.md](2026-10-04-website-overhaul-roadmap.md), Must item 3
Deadline: editor-touching work lands by the **2026-10-28** freeze

## Purpose

At the CS Expo the talk ends on slide 07 and hands over to the live editor. That handoff has to be safe in front of an expert audience and on unreliable venue Wi-Fi. SP3 makes it so, and gives students the same tools for everyday use:

1. **Links into the editor.** `/app?scene=<slug>` opens a prepared scene and `/app?lesson=<id>` opens a lesson, so the demo starts in one step. Slide 07 lists the prepared scenes as starting points.
2. **My scenes.** A library of named scenes kept in the browser, plus automatic backups whenever something replaces the student's work.
3. **Crash recovery.** A recovery screen replaces the blank page, and a corrupt save is backed up instead of deleted.
4. **Offline app.** A service worker caches the whole site after one online visit. The app can be installed, and a new version waits for the user's reload.

Success looks like this:

- On a laptop with networking off, the presenter can open `/`, step through the talk, and land in the Triangle scene.
- A student's own scene survives every path that used to destroy it: a link, opening a file, a new workspace, a reload mid-lesson, and a corrupt save.

### Decisions (owner, 2026-10-06)

| Question | Decision |
| --- | --- |
| Demo shape | Undecided until the day. Both a prepared scene and a lesson must be one step away |
| Offline | Full PWA: cached for everyone, installable, update on the user's reload |
| Crash UX | A recovery screen with Reload, Download my work, and Start fresh |
| Scene links vs. the student's scene | Back up the current scene, then replace it. No confirm dialog |
| Scene storage | A "My scenes" library in IndexedDB: named saves plus automatic backups (5 kept), no thumbnails |
| Prepared scenes | Triangle, Transforms, Primitives tour, Textured quad |
| Stage handoff | Slide 07 shows "Start from:" links. Stepping past the last slide opens Triangle |
| Service worker | `vite-plugin-pwa` (Workbox `generateSW`) |
| Library storage | A `SceneLibrary` interface with an IndexedDB adapter (`idb-keyval`) and an in-memory fallback |

## Architecture

Each new unit has one job and sits in the layer its imports allow. Nothing new imports sideways from another feature. Where an existing feature needs a new capability, the widget or page that mounts it passes the capability in as a prop.

| Unit | Location | Job | Depends on |
| --- | --- | --- | --- |
| Scene library | `src/entities/project/model/scene-library.ts` | Store, list, rename and delete `SceneEntry` records. Prunes backups to the newest 5 | `idb-keyval`; the project file type in the same slice |
| Scene presets | `src/entities/project/model/scene-presets.ts` and `preset-links.ts` | The four prepared scenes as `VamsProjectData`, plus `PRESET_LINKS` (slug and title only) | Scene and project types |
| Scene operations and My scenes UI | `src/features/scene-library/` | `isSceneEmpty`, `loadProjectData`, `backupCurrentScene`, `replaceScene`, downloads, the My scenes button and dialog | Store, project entity |
| Editor links | `src/pages/editor/model/editor-link.ts` and `useEditorLink.ts` | `parseEditorLink` (pure) and `useEditorLink` (applies the link once on mount) | Store, lesson registry, presets, scene operations. The editor page is where these features meet |
| Crash recovery | `src/features/crash-recovery/` plus `src/pages/editor/model/recovery.ts` | The feature holds `EditorErrorBoundary` and a presentational `RecoveryScreen`. The page module implements the recovery actions and the corrupt-save notice | Store, project entity, scene operations. The page loads the actions lazily, so the store stays out of the main chunk |
| Offline layer | `src/app/pwa/` plus `vite.config.ts` | PWA options, service-worker registration, and the update/offline notice | `vite-plugin-pwa` |

The library and presets live in the existing `entities/project` slice, because they store and produce project files. The editor-link and recovery-action code lives in `pages/editor`, because it combines several features. Under this layout, no new code imports sideways between slices of the same layer.

Data flow is unchanged in principle. Every way a scene changes runs `sanitizeProjectData` → `toStorePatchFromProject` → store → views:

- a link;
- a preset;
- a library Open;
- a file Open;
- a recovery action.

Presets and library entries pass through the same validator as a file a student opens.

## 1. Scene library (`entities/project/model/scene-library.ts`)

```ts
export type BackupReason =
  | 'scene-link'      // a /app?scene= link replaced the scene
  | 'library-open'    // My scenes → Open replaced the scene
  | 'open-file'       // top bar Open replaced the scene
  | 'new-workspace'   // New workspace cleared the scene
  | 'recovery'        // the recovery screen's Start fresh
  | 'corrupt-save';   // saved data failed to load

export interface SceneEntry {
  id: string;
  name: string;
  kind: 'saved' | 'backup';
  reason: BackupReason | null;   // null for saved entries
  createdAt: number;             // ms since epoch
  updatedAt: number;
  file: VamsProjectFile | null;  // null only for a corrupt-save backup
  raw: string | null;            // the unreadable saved text, corrupt-save only
}

export interface SceneLibrary {
  readonly persistent: boolean;          // false for the in-memory fallback
  list(): Promise<SceneEntry[]>;         // newest updatedAt first
  get(id: string): Promise<SceneEntry | undefined>;
  save(entry: SceneEntry): Promise<void>; // insert or replace; prunes backups to 5
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}
```

- `createIdbLibrary()` stores entries in IndexedDB database `vams`, object store `scenes`, keyed by `id`, through `idb-keyval`'s `createStore`.
- `createMemoryLibrary()` keeps entries in a `Map`.
- `getSceneLibrary()` returns one shared instance:
  - It uses IndexedDB when it exists and a probe write succeeds.
  - Otherwise it uses the memory library, with `persistent: false`.
- `BACKUP_LIMIT = 5`. After a backup is saved, the oldest backups past 5 are deleted. Saved entries are never pruned.
- Names are trimmed and limited to 80 characters. An empty name becomes "Untitled scene".
- A failed write rejects. Callers show a toast and never lose the in-editor scene.

## 2. Scene operations (`features/scene-library/model/scene-ops.ts`)

- **`isSceneEmpty(state)`** is true when all of these hold:
  - there are no objects and no uploaded textures;
  - the background is `#000000`;
  - no shape is being built;
  - every callback is blank;
  - the viewport is the default `-1..1`.

  This is the same test `NewWorkspaceButton` uses today, moved into one place.
- **`loadProjectData(data)`** does what the top bar's file Open does today:
  - applies `toStorePatchFromProject(data)`, keeping the site theme authoritative;
  - detaches textures whose id is unknown;
  - clears history;
  - returns the number of detached textures.
- **`backupCurrentScene(reason, label)`**:
  - If the scene is empty, it returns `null`.
  - Otherwise it saves a `backup` entry named `label`, holding `buildProjectFile(state)`, and returns the entry.
  - Labels read "Before opening ‘Triangle’", "Before New workspace" and so on.
  - If the library write fails, it throws.
- **`replaceScene(data, { reason, label })`** backs up, then loads. It resolves to `{ backedUp, detached }`: whether a backup was kept, and how many texture attachments the editor could not resolve and dropped. If the backup fails, the scene is **not** replaced, and the error propagates so the caller can say so. Losing the student's work silently is the one outcome this design forbids.

### Existing buttons

- **Top bar Open** (`ProjectActions`):
  - It gains a required prop `loadProject(data, fileName): Promise<number>`, which resolves to the number of detached textures. The top bar passes a function that calls `replaceScene(data, { reason: 'open-file', label: 'Before opening ‘<file name>’' })`.
  - The loading code moves from the component into `loadProjectData`.
  - The existing `window.confirm` stays.
  - A failed backup gets its own toast: "Couldn't keep a backup of the current scene, so the project was not opened."
- **New workspace** (`NewWorkspaceButton`):
  - It gains a required prop `beforeReset()`, which the top bar wires to `backupCurrentScene('new-workspace', 'Before New workspace')`.
  - The confirm message changes to "Your current scene will be kept in My scenes as a backup."
  - If the backup fails, the reset is cancelled and a toast explains why.

## 3. My scenes UI (`features/scene-library/ui`)

**The button.** A `MyScenesButton` sits in the top bar between New workspace and Open. It's an icon button with the `Library` icon, `aria-label="My scenes"` and `title="My scenes"`. It is hidden in Lesson mode, the same way the lesson launcher hides.

**The dialog.** `MyScenesDialog` is a modal: `role="dialog"`, `aria-modal`, labelled by its title. Escape and the backdrop close it, and focus returns to the button. Its open state lives in a small zustand store, `useMyScenesDialog` (`open()`, `close()`, `isOpen`), so a toast action can open it too.

Contents, top to bottom:

1. **Save current scene:** a text input, defaulting to "Scene <date time>", and a **Save** button.
   - Saving creates a `saved` entry.
   - If the scene is empty, Save is disabled and the hint reads "Add something to the canvas first."
2. **Saved:** one row per entry, newest first. Each row shows the name and the updated time, with **Open**, **Rename**, **Download** and **Delete** buttons.
   - **Rename** swaps the name for an inline input. Enter saves, Escape cancels.
   - **Delete** asks through the existing `confirm()` with `tone: 'danger'`.
3. **Backups:** one row per entry, showing the label and time, with **Open**, **Download** and **Delete** buttons.
   - A `corrupt-save` backup has no Open; its Download writes the raw text.
   - The list header reads "Backups (last 5 are kept)".
4. **Footer note:** "Scenes are stored in this browser. Clearing site data removes them — use Download to keep a copy."
   - When the library isn't persistent, it reads instead: "This browser is not keeping scenes after you close the tab. Use Download to keep a copy."

**Behaviour:**

- **Open** runs `replaceScene(entry.file.data, { reason: 'library-open', label: 'Before opening ‘<name>’' })`. It then closes the dialog and toasts "Opened ‘<name>’".
- **Download** uses the existing `downloadJSON`. The file name comes from the entry name, made filesystem-safe, plus `.vams`.
- An empty list shows "Nothing saved yet."

**Styling.** Build on `_tokens.scss` in both themes and follow the confirm dialog's structure. Every control is a real `<button>` or `<input>` with a visible label or `aria-label`. Each row's actions are labelled with the entry name, for example "Open Triangle". Target WCAG 2.2 AA.

## 4. Scene presets (`entities/project/model/scene-presets.ts`)

| Slug | Title | Section | Content |
| --- | --- | --- | --- |
| `triangle` | Triangle | Primitives | One `GL_TRIANGLES` object with the landing demo's vertices (−0.5,−0.5), (0.5,−0.5), (0,0.5) and colours red, green, blue. Its `glBegin…glEnd` block must equal the landing demo's block |
| `transforms` | Transforms | Transforms | A `GROUP` "House" (translate 0.2, 0.1; rotate 15°; scale 0.8) holding a `QUADS` "Walls" and a `TRIANGLES` "Roof", plus a `TRIANGLE_FAN` "Sun" with a saved `rotate` animation |
| `primitives` | Primitives tour | Primitives | Four objects, one per quadrant: `POINTS`, `LINE_STRIP`, `TRIANGLE_FAN`, `QUADS` |
| `textured-quad` | Textured quad | Textures | A `QUADS` object with the sample texture `sample-bricks` attached (`NEAREST`, `REPEAT`) and UVs 0..2, so the bricks tile twice |

- Every preset passes through `sanitizeProjectData` unchanged in object count and types.
- Every preset generates code containing the expected GL calls.
- `PRESET_LINKS` (`{ slug, title }[]`, in table order) is in its own module with no other imports, so the home page can list the presets without loading scene data.
- `getPreset(slug)` returns `{ slug, title, section, data }` or `undefined`.

## 5. Editor links (`pages/editor/model`)

```ts
export type EditorLink =
  | { kind: 'none' }
  | { kind: 'lesson'; id: string }
  | { kind: 'scene'; slug: string }
  | { kind: 'invalid'; param: 'lesson' | 'scene'; value: string };

export function parseEditorLink(search: string, targets?: LinkTargets): EditorLink; // targets default to the lesson registry and presets
export function stripEditorLinkParams(search: string): string; // keeps every other parameter
```

**Parsing:**
- `lesson` wins over `scene` when both are present.
- An empty or unknown lesson id or scene slug parses as `invalid`.
- Validity is checked against `getLessonById` and `getPreset`.

**`useEditorLink()`** takes no arguments. It applies the link through `applyEditorLink` (which calls `replaceScene`) and opens the library through `useMyScenesDialog`. It runs once when `EditorApp` mounts, after store hydration:

- **Lesson:**
  1. If a lesson is already active, `clearLessonState()`.
  2. `setActiveSection(lesson.section)`.
  3. `setActiveLesson(id)`.
  4. `setAppMode('Lesson')`.

  These are the same actions the lesson launcher uses. A lesson already backs up the student's scene and restores it on exit (and, after §7, on reload), so no library backup is needed.
- **Scene:**
  1. `await replaceScene(preset.data, { reason: 'scene-link', label: 'Before opening ‘<title>’' })`.
  2. `setActiveSection(preset.section)`.
  3. Toast "Opened ‘<title>’". If the scene was backed up, the toast adds "Your previous scene is in My scenes." and a **My scenes** action that calls `openLibrary`.
  4. If the backup fails, toast an error and leave the scene alone.
- **Invalid:** toast "That link doesn't match a lesson or scene. The editor opened as usual." and change nothing else.
- **Every link,** valid or invalid:
  - `markWelcomeSeen()`, so the welcome card never covers a linked demo;
  - then `history.replaceState` with `stripEditorLinkParams`, so a reload doesn't apply the link again or make another backup.

**Stage URL fix.** `useStageMode` writes the URL with the other query parameters kept. Only `stage` is added or removed, and the hash is set.

## 6. Slide 07 and the stage handoff

- Under the large "Open the app" button, slide 07 shows "Start from:" followed by one link per entry in `PRESET_LINKS`, each pointing at `/app?scene=<slug>`. The links are styled quietly in mono labels, readable at stage scale, and keyboard-reachable.
- In `HomePage`, the stage `enter-app` action routes to `/app?scene=triangle`.
- The home page imports only `PRESET_LINKS`.

## 7. Crash recovery (`features/crash-recovery`, `pages/editor/model/recovery.ts`)

### Lesson reload

`partialize` adds the five lesson backups:
- `sceneBackup`
- `callbacksBackup`
- `canvasBackgroundColorBackup`
- `viewportLimitsBackup`
- `uploadedTexturesBackup`

On successful rehydration, if `sceneBackup` is not null, the page was reloaded mid-lesson, so `clearLessonState()` runs. That restores the student's scene and clears the backups.

`uploadedTexturesBackup` is persisted as `null` when it is the same array as `uploadedTextures`, so lesson textures are not stored twice.

The fields are optional to old saves, which have none, so **`version` stays 7** and no migration is needed.

### Corrupt save

When `onRehydrateStorage` reports an error, the store no longer deletes and reloads. Instead it:

1. reads the raw `vams-storage` text;
2. hands it to `core/store/recovery-signal.ts` through `reportCorruptSave(raw)`. The text stays in module memory until the editor collects it with `takeCorruptSave()`; `peekCorruptSave()` reads it without consuming it;
3. removes the key, so the editor starts blank;
4. does **not** reload.

### Editor boundary

`EditorPage` wraps its `Suspense` and `EditorApp` in `EditorErrorBoundary`, a class component with `componentDidCatch`. When it catches an error:

- **A chunk-load error** (a message matching a failed dynamic import) reloads once per tab session. This is the existing behaviour, moved here from `SiteApp`.
- **Anything else, or a second chunk failure,** renders `RecoveryScreen` in place of the editor.

`SiteApp` keeps its `ErrorBoundary` without the `/app` reload handler.

### Recovery screen

`RecoveryScreen` is a full-page panel styled on the site tokens. Heading: "VAMS hit a problem". Lead: "Your work is still on this device. Choose what to do next." Actions:

- **Reload** reloads the page.
- **Download my work** builds a project file from the in-memory store and downloads it. If that throws, it downloads the raw saved text instead: the text in `localStorage`, or, when hydration already cleared the key, the unreadable save held by `peekCorruptSave()`.
- **Start fresh**:
  1. backs up the current scene (reason `recovery`); if the library write fails, it downloads the backup instead, so nothing is lost;
  2. clears the persisted store;
  3. reloads.

Mid-lesson, Download my work and Start fresh first call `clearLessonState()`, so they act on the student's own scene rather than the lesson's. When either fails, the screen shows "That didn't work. Reload to try again." in an alert region.

On mount the screen removes the `route-editor` class that `index.html` sets on the page root for `/app`, so a crash on the first render gets the normal root font size and scrolling. The panel itself scrolls (`overflow: auto`, `min-height: 100vh`), and the error text uses `--danger` for contrast.

A `<details>` disclosure, "Technical details", shows the error message.

### Corrupt-save notice

On mount, `EditorApp` calls `takeCorruptSave()`. If it returns text, the app:

1. saves a `corrupt-save` backup with `raw` set, labelled "Unreadable saved scene";
2. shows a toast: "Your saved scene couldn't be read, so VAMS started fresh. A copy is in My scenes.", with a **My scenes** action.

If the library write fails, the toast offers **Download** of the raw text instead.

## 8. Offline app (`vite-plugin-pwa`)

`src/app/pwa/pwa-options.ts` exports `buildPwaOptions()`, which `vite.config.ts` passes to `VitePWA`. It is a pure function, so tests check it.

**Options:**
- `registerType: 'prompt'`, `injectRegister: false`. The app registers the worker itself; nothing calls `skipWaiting` until the user reloads.
- `workbox.globPatterns: ['**/*.{html,js,css,woff,woff2,ttf,svg,png,ico}']`. The plugin adds `manifest.webmanifest` itself, `globIgnores: ['og/**']`. Social preview images aren't needed offline.
- `workbox.ignoreURLParametersMatching: [/.*/]`, so `/app?scene=triangle` and `/?stage` resolve to their cached pages.
- `workbox.manifestTransforms: [routeDocumentsTransform]`, which adds a clean-URL entry for each prerendered route document: `app/index.html` is also cached as `app`. Both are needed: `/app/` resolves through the directory index, and `/app` through the clean URL. The root `index.html` stays as it is, because Workbox's directory index serves `/`.
- `workbox.navigateFallback: '404/index.html'`, so an unknown path offline shows the site's 404 page. `navigateFallbackDenylist` covers `/sitemap.xml` and `/robots.txt`.
- `workbox.cleanupOutdatedCaches: true`. `maximumFileSizeToCacheInBytes` is 4 MiB; the largest chunk today is 0.67 MB.
- `devOptions.enabled: false`.

**Manifest:**

| Field | Value |
| --- | --- |
| `name` | `VAMS — Visual OpenGL 1.5 simulator` |
| `short_name` | `VAMS` |
| `description` | `See the OpenGL behind every shape.` |
| `start_url` | `/app` |
| `scope` | `/` |
| `display` | `standalone` |
| `background_color` | `#f4f5f2` (vellum paper) |
| `theme_color` | `#1d2b4f` (navy ink) |
| `icons` | 192 and 512 PNG, and a 512 maskable PNG |

The icons are rendered once from `public/favicon.svg` and committed as final assets. `index.html` gains `<meta name="theme-color" content="#1d2b4f">` and an `apple-touch-icon` link.

**Registration and notice:**
- `src/app/pwa/register.ts` wraps `virtual:pwa-register`.
- `UpdateNotice`, mounted once in `SiteApp`, registers after hydration in the browser only. It shows a small fixed notice:
  - "A new version of VAMS is ready." with **Reload** (`updateSW(true)`) and **Later**, when an update is waiting;
  - "VAMS now works offline." once, when the first install finishes. It auto-hides after 6 s.
- The notice stays hidden while `html.stage` is set, and appears after stage mode ends. It has `role="status"`.
- Tests alias `virtual:pwa-register` to a stub.

**Headers.** `public/_headers` gains `Cache-Control: no-cache` for `/sw.js` and `/manifest.webmanifest`.

## Testing

All new tests follow the `{SUITE}-{MODULE}-{NN}` scheme in new files. `tests/README.md` gains the new rows.

| File | IDs | Covers |
| --- | --- | --- |
| `tests/black-box/scene-library.test.ts` | BB-LIB-* | Library CRUD on both adapters (IndexedDB through `fake-indexeddb`); backup pruning at 5; name normalisation; `isSceneEmpty`; `backupCurrentScene` / `replaceScene`, including a failing backup that leaves the scene untouched; the dialog's Save, Open, Rename, Delete and empty states |
| `tests/black-box/editor-links.test.ts` | BB-LINK-* | `parseEditorLink` cases; `stripEditorLinkParams`; applying lesson, scene and invalid links to the store; welcome suppression; the four presets (sanitize round-trip, generated GL calls, Triangle block equals the landing demo block); slide 07 links; the stage URL keeping other parameters |
| `tests/black-box/crash-recovery.test.ts` | BB-RECOVER-* | Lesson-reload restore through `persist.rehydrate()`; corrupt save → signal, key removed, no reload; the boundary renders `RecoveryScreen` on a render error and reloads once on a chunk error; the recovery actions |
| `tests/black-box/offline-app.test.ts` | BB-PWA-* | `buildPwaOptions()` invariants; `routeDocumentsTransform`; `UpdateNotice` states and stage suppression |

These checks need a real browser, so they are verified by hand on `vite preview` with Chrome DevTools rather than automated:

- the service worker installs;
- `/`, `/app?scene=triangle` and an unknown path load offline;
- an update shows the notice;
- the manifest is valid and the app can be installed.

## Divergences from the manuscript

These additions go into the roadmap's divergence list:

- **Item 4** (offline as future work) becomes implemented. The roadmap entry is updated to say so.
- **New:** the editor gains a My scenes library, scene and lesson links, and a recovery screen. The manuscript describes saving only as project-file download and upload (§3.4.2).

## Out of scope

- Shareable scene-in-URL and QR codes (roadmap item 8).
- The full example gallery (item 9). The four presets and `PRESET_LINKS` are its seed.
- Thumbnails, cross-device sync, and library import and export beyond per-entry Download.
- Resuming a lesson at its step after a reload. A reload exits the lesson and restores the scene.

## Rehearsal additions (Nov 3)

- On the demo machine, open `/` and `/app` once online and wait for "VAMS now works offline". Then turn networking off and run the whole talk.
- Open each of the four "Start from" links once.
