# Visual Identity (Ink + Cobalt) Implementation Plan

**Goal:** Replace Drafting Vellum with the Ink + Cobalt identity across the site and the editor. This covers:
- tokens and fonts;
- `dark` and `light` themes, with the OS as the default;
- the pixel wordmark and the icons;
- the landing page restyle.

**Architecture:**
- **Tokens.** Every colour and font still flows from `src/shared/styles/_tokens.scss`. The `:root` block becomes the light theme and `[data-theme='dark']` the dark theme. The legacy editor variable names stay, re-pointed at the new palette.
- **Theme state** stays in `src/shared/lib/theme/theme.ts`. It gains legacy migration and an OS fallback, and the inline pre-paint script in `index.html` mirrors its logic.
- **The wordmark** is text in the Minecrafter font, rendered by `src/shared/ui/logo`.
- **The editor** changes only where tokens reach it, plus:
  - the code font;
  - the canvas selection colour, which now reads `--accent`;
  - the wordmark in its top bar.

**Tech Stack:** Preact 10 + preact/compat, preact-iso, Vite 7 prerender, SCSS, `@fontsource-variable/bricolage-grotesque` 5, `@fontsource-variable/jetbrains-mono` 5, PixiJS 8, Vitest 4 + happy-dom 20, Playwright 1.63 (local visual suite), Python `fontTools` 4 (one-off favicon extraction, not a project dependency).

**Spec:** [docs/specs/2026-10-07-visual-identity-design.md](../specs/2026-10-07-visual-identity-design.md)

## Global Constraints

- **Branch:** `feat/visual-identity`. Merge into `main` when Task 6 is done, then delete the branch.
- **Commits:**
  - Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`), with an optional scope.
  - No `Co-Authored-By` trailer and no "Generated with" line.
  - Commit text describes the engineering only.
- **Staging:**
  - Stage explicit paths and read `git diff --staged` before committing. Never `git add -A` or `git add .`.
  - Never stage `.gitignore`: it carries an unrelated local edit.
  - Never `git add -f`.
- **Before every commit:** `npm run lint`, `npm run build` and `npm test` all pass. Then run `git checkout -- tests/reports` and never commit `tests/reports/*.json`.
- **Test IDs:**
  - Format `{SUITE}-{MODULE}-{NN}`. Existing IDs keep their numbers.
  - New tests take the next free number: BB-SITE-21+, BB-SHELL-20+, BB-HOME-20+, VIS-HOME-01+.
  - Tests live in `tests/`.
- **Student-facing text** never uses "coming soon", "not supported", "future", "deferred", "3D" or "lighting".
- **Section labels are exactly** `Pipeline | Primitives | Buffers | Transforms | Textures`.
- **Persistence:** the persisted store stays at `version: 7`. The editor store's `theme` field stays `'dark' | 'light'`. `.vams` files are unchanged.
- **Theme names:**
  - The only theme values are `'dark'` and `'light'`.
  - The theme storage key stays `vams-theme`.
  - `'blueprint'` migrates to `'dark'` and `'vellum'` to `'light'`.
- **Palette (exact):**

  | Token | Dark | Light |
  | --- | --- | --- |
  | `--paper` | `#121419` | `#f7f8fa` |
  | `--paper-raised` | `#191c22` | `#fcfcfd` |
  | `--paper-sunken` | `#0e1014` | `#eef0f3` |
  | `--rule`, `--hairline` | `#262a33` | `#dadde3` |
  | `--ink` | `#e6e8ec` | `#141821` |
  | `--ink-muted` | `#a3a9b5` | `#4f5665` |
  | `--ink-faint` | `#8b92a0` | `#656c7b` |
  | `--accent` | `#4762f5` | `#2f4de0` |
  | `--on-accent` | `#ffffff` | `#ffffff` |
  | `--accent-text` | `#93a6ff` | `#2f4de0` |
  | `--accent-tint` | `rgba(71, 98, 245, 0.16)` | `rgba(47, 77, 224, 0.10)` |
  | `--focus-ring` | `#93a6ff` | `#2f4de0` |

- **Wordmark (exact):**
  - Minecrafter, italic, `letter-spacing: 0.08em`.
  - Fill `#fcee0a`, a 1.5px `#000` outline, and a 3px `#00f0ff` offset shadow.
  - The dark theme adds a `0 0 15px rgba(0, 240, 255, 0.4)` glow.
- **Accent rule:** the accent appears only on:
  - the primary button of a view;
  - focus rings;
  - the selected item;
  - a value being scrubbed;
  - the lesson's focused panel;
  - links in running text;
  - the canvas selection outline;
  - the hero word "program.".
- **Shape:** one radius, 3px. Shadows only on menus, dialogs and toasts.
- **Labels:** sentence case everywhere on site pages, with no uppercase letter-spaced labels. Editor panel labels are left to the editor refinement sub-project.
- **Never run `taskkill /IM node.exe`.** Stop only processes you started, by the PID listening on your port.

## Review Focus

Five conditions the spec implies but no happy-path test reaches. Each has a test in the task that owns the code:

1. **A returning student whose browser stored `'blueprint'`.** Expected: the site opens dark on first paint, with no flash, and the value is rewritten to `'dark'`. Tests: BB-SITE-01 and BB-SITE-21 (Task 1).
2. **Storage that throws** (private mode, blocked). Expected: the theme still resolves from the OS and the toggle still applies for the visit. Test: BB-SITE-02 (Task 1).
3. **The OS switches to dark mode while the student has chosen light.** Expected: nothing changes, because an explicit choice wins. Test: BB-SITE-04 (Task 1).
4. **A palette token pair that drops below AA after a later edit.** Expected: the build's test run fails. Test: BB-SITE-23 (Task 2).
5. **Minecrafter loading late on a slow link.** Expected: the header height does not jump. The wordmark box is fixed in `em`, and the face uses `font-display: block` with a preload. Test: BB-SITE-25 (Task 3).

---

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `src/shared/lib/theme/theme.ts`, `index.ts` | modify | Theme values, migration, OS fallback, live follow |
| `src/shared/lib/theme/css-color.ts` | new | Read a `#rrggbb` custom property as a number for PixiJS |
| `src/shared/lib/theme/useSiteTheme.ts` | unchanged | Reads through `getActiveTheme` |
| `index.html` | modify | Pre-paint script, per-scheme `theme-color`, Minecrafter preload |
| `src/app/SiteApp.tsx` | modify | Starts `followSystemTheme` |
| `src/app/pwa/pwa-options.ts` | modify | Manifest colours |
| `src/features/theme-toggle/ui/ThemeToggleButton.tsx` | modify | `'dark'` instead of `'blueprint'` |
| `src/widgets/layout/top-bar/TopBar.tsx` | modify | Toaster theme, wordmark |
| `src/shared/styles/_tokens.scss` | rewrite | Palette, type scale, fonts, legacy names, logo tokens |
| `src/app/styles/fonts.ts`, `package.json`, `package-lock.json` | modify | Bricolage Grotesque and JetBrains Mono |
| `src/app/styles/global.scss` | modify | Minecrafter `@font-face` |
| `src/shared/ui/code-viewer/code-viewer.scss` | modify | Code font, size and dark syntax selector |
| `src/shared/engine/selection-overlay.ts`, `src/shared/engine/pixi/primitives/rendering/drawableFactory.ts`, `src/shared/engine/pixi/hooks/useSceneRenderer.ts` | modify | Selection outline in `--accent`, redrawn on theme change |
| `src/shared/ui/logo/Logo.tsx`, `logo.scss`, `index.ts` | rewrite | Pixel wordmark |
| `public/fonts/Minecrafter.ttf` | restore | From `f8e18ab^` |
| `src/widgets/site-header/ui/SiteHeader.tsx`, `src/widgets/site-footer/ui/SiteFooter.tsx`, `src/pages/editor/ui/EditorLoading.tsx`, `editor-loading.scss` | modify | Use the wordmark |
| `public/favicon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `scripts/og/og-default.html`, `public/og/og-default.png` | regenerate | Icons and preview image |
| `src/pages/home/**`, `src/app/styles/site-page.scss`, `src/widgets/site-header/ui/site-header.scss`, `src/widgets/site-footer/ui/site-footer.scss` | modify | Landing restyle |
| `tests/black-box/site-shell.test.ts`, `editor-shell.test.ts`, `offline-app.test.ts`, `home-stage.test.ts` | modify | Updated and new tests |
| `tests/visual/editor.spec.ts`, `tests/visual/home.spec.ts` | modify, new | Theme labels; stage-mode type sizes |
| `docs/specs/2026-10-04-website-overhaul-roadmap.md` | modify | Item 5 status |

Tasks 1–4 are delivery step 1 (target 2026-10-10). Task 5 is step 2 (target 2026-10-15). Task 6 closes the branch.

---

### Task 1: Themes are `dark` and `light`, following the OS until the student chooses

**Files:**
- Modify: `src/shared/lib/theme/theme.ts`, `src/shared/lib/theme/index.ts`, `index.html:6-21`, `src/app/SiteApp.tsx`, `src/app/pwa/pwa-options.ts:3-5`, `src/features/theme-toggle/ui/ThemeToggleButton.tsx`, `src/widgets/layout/top-bar/TopBar.tsx:16`
- Test: `tests/black-box/site-shell.test.ts` (BB-SITE-01…05 and 19 rewritten; BB-SITE-21 new), `tests/black-box/offline-app.test.ts` (BB-PWA values)

**Interfaces:**
- Produces:
  - `type SiteTheme = 'dark' | 'light'`;
  - `THEME_STORAGE_KEY = 'vams-theme'`;
  - `DEFAULT_THEME: SiteTheme = 'light'`, used only where no window exists;
  - `isSiteTheme(v: unknown): v is SiteTheme`;
  - `readStoredTheme(): SiteTheme | null`;
  - `systemTheme(): SiteTheme`;
  - `resolveTheme(): SiteTheme`;
  - `getActiveTheme(): SiteTheme`;
  - `applyTheme(t: SiteTheme): void`;
  - `setTheme(t: SiteTheme): void`;
  - `toggleTheme(): SiteTheme`;
  - `subscribeTheme(l: (t: SiteTheme) => void): () => void`;
  - `followSystemTheme(): () => void`;
  - `toEditorTheme(t: SiteTheme): 'dark' | 'light'`, now the identity.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/site-shell.test.ts`, replace the imports block at lines 5–19 and the five describes BB-SITE-01…05 (lines 21–65) with:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readStoredTheme,
  resolveTheme,
  getActiveTheme,
  setTheme,
  toggleTheme,
  subscribeTheme,
  followSystemTheme,
  toEditorTheme,
  THEME_STORAGE_KEY,
} from '@/shared/lib/theme';

/** A controllable prefers-color-scheme query. */
function mockScheme(initiallyDark: boolean) {
  let dark = initiallyDark;
  const listeners = new Set<() => void>();
  const query = {
    get matches() { return dark; },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => query as unknown as MediaQueryList);
  return {
    set(next: boolean) {
      dark = next;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

function resetTheme() {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
}

afterEach(() => vi.restoreAllMocks());

describe('BB-SITE-01: Stored themes resolve, and legacy names migrate', () => {
  beforeEach(resetTheme);
  it('reads dark and light, and rewrites blueprint and vellum under the same key', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'blueprint');
    expect(readStoredTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'vellum');
    expect(readStoredTheme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});

describe('BB-SITE-02: With no usable stored value the theme follows the OS', () => {
  beforeEach(resetTheme);
  it('ignores unknown values and survives storage that throws', () => {
    mockScheme(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'toString');
    expect(readStoredTheme()).toBeNull();
    expect(resolveTheme()).toBe('dark');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(resolveTheme()).toBe('dark');
    expect(getActiveTheme()).toBe('dark');
  });
});

describe('BB-SITE-03: setTheme persists and applies the theme', () => {
  beforeEach(resetTheme);
  it('stores the value and sets data-theme on <html>', () => {
    setTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getActiveTheme()).toBe('dark');
  });
});

describe('BB-SITE-04: The OS is followed live only until the student chooses', () => {
  beforeEach(resetTheme);
  it('applies OS changes while unset, then ignores them after a toggle', () => {
    const scheme = mockScheme(false);
    const seen: string[] = [];
    const unsubscribe = subscribeTheme((theme) => seen.push(theme));
    const stop = followSystemTheme();
    scheme.set(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(toggleTheme()).toBe('light');
    scheme.set(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(seen).toEqual(['dark', 'light']);
    stop();
    expect(scheme.listenerCount()).toBe(0);
    unsubscribe();
  });
});

describe('BB-SITE-05: Site themes are the editor store values', () => {
  it('maps each theme to itself', () => {
    expect(toEditorTheme('dark')).toBe('dark');
    expect(toEditorTheme('light')).toBe('light');
  });
});
```

Replace BB-SITE-19 (lines 225–231) with the version below, and add BB-SITE-21 directly after it:

```ts
describe('BB-SITE-19: The early theme script matches the theme module', () => {
  it('reads the same storage key and sets the editor class on /app', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(html).toContain("classList.add('route-editor')");
    expect(html).toContain("'(prefers-color-scheme: dark)'");
  });
});

describe('BB-SITE-21: The pre-paint script resolves the same theme as the module', () => {
  const html = readFileSync('index.html', 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
  const cases: { stored: string | null; osDark: boolean }[] = [
    { stored: null, osDark: false },
    { stored: null, osDark: true },
    { stored: 'dark', osDark: false },
    { stored: 'light', osDark: true },
    { stored: 'blueprint', osDark: false },
    { stored: 'vellum', osDark: true },
    { stored: 'nonsense', osDark: true },
  ];
  for (const { stored, osDark } of cases) {
    it(`stored=${stored} osDark=${osDark}`, () => {
      localStorage.clear();
      if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
      mockScheme(osDark);
      delete document.documentElement.dataset.theme;
      new Function(script)();
      const painted = document.documentElement.dataset.theme;
      delete document.documentElement.dataset.theme;
      expect(painted).toBe(resolveTheme());
    });
  }
});
```

In `tests/black-box/offline-app.test.ts`:
- In BB-PWA's manifest expectation, set `theme_color: '#f7f8fa'` and `background_color: '#f7f8fa'`.
- In BB-PWA-07, replace the single `theme-color` expectation with:

```ts
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<meta name="theme-color" content="#f7f8fa" media="(prefers-color-scheme: light)" />');
    expect(html).toContain('<meta name="theme-color" content="#121419" media="(prefers-color-scheme: dark)" />');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/site-shell.test.ts tests/black-box/offline-app.test.ts`
Expected: FAIL. `resolveTheme` and `followSystemTheme` are not exported, `readStoredTheme()` returns `'vellum'`, and the meta tags are missing.

- [ ] **Step 3: Implement the theme module**

Replace `src/shared/lib/theme/theme.ts` with:

```ts
export type SiteTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'vams-theme';
/** Used only where no window exists (prerendering). In the browser the OS decides. */
export const DEFAULT_THEME: SiteTheme = 'light';

const DARK_QUERY = '(prefers-color-scheme: dark)';

type ThemeListener = (theme: SiteTheme) => void;
const listeners = new Set<ThemeListener>();

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === 'dark' || value === 'light';
}

/** Theme names written by builds before Ink + Cobalt. */
function migrateLegacy(value: string | null): SiteTheme | null {
  if (value === 'blueprint') return 'dark';
  if (value === 'vellum') return 'light';
  return null;
}

/** The student's explicit choice, or null when none is stored. Legacy names are rewritten in place. */
export function readStoredTheme(): SiteTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isSiteTheme(stored)) return stored;
    const migrated = migrateLegacy(stored);
    if (migrated) window.localStorage.setItem(THEME_STORAGE_KEY, migrated);
    return migrated;
  } catch {
    return null;
  }
}

export function systemTheme(): SiteTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return DEFAULT_THEME;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** The stored choice, else the operating system's scheme. */
export function resolveTheme(): SiteTheme {
  return readStoredTheme() ?? systemTheme();
}

export function getActiveTheme(): SiteTheme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const applied = document.documentElement.dataset.theme;
  return isSiteTheme(applied) ? applied : resolveTheme();
}

export function applyTheme(theme: SiteTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

function notify(theme: SiteTheme) {
  listeners.forEach((listener) => listener(theme));
}

export function setTheme(theme: SiteTheme): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable (private mode, quota); the theme still applies for this visit.
    }
  }
  applyTheme(theme);
  notify(theme);
}

export function toggleTheme(): SiteTheme {
  const next: SiteTheme = getActiveTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Follows OS scheme changes while the student has not chosen a theme. Returns the unsubscribe. */
export function followSystemTheme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (readStoredTheme() !== null) return;
    const next: SiteTheme = query.matches ? 'dark' : 'light';
    applyTheme(next);
    notify(next);
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** The editor store and `.vams` files record the theme as 'dark' | 'light', the same names. */
export function toEditorTheme(theme: SiteTheme): 'dark' | 'light' {
  return theme;
}
```

In `src/shared/lib/theme/index.ts`, add `systemTheme`, `resolveTheme` and `followSystemTheme` to the export list from `'./theme'`.

- [ ] **Step 4: Update the pre-paint script and the meta tags**

In `index.html`, replace the line `<meta name="theme-color" content="#1d2b4f" />` with:

```html
   <meta name="theme-color" content="#f7f8fa" media="(prefers-color-scheme: light)" />
   <meta name="theme-color" content="#121419" media="(prefers-color-scheme: dark)" />
```

Replace the inline script's `try { … } catch (e) { … }` block (the lines that set `root.dataset.theme`) with:

```js
       var theme = null;
       try {
         var stored = localStorage.getItem('vams-theme');
         if (stored === 'blueprint') stored = 'dark';
         else if (stored === 'vellum') stored = 'light';
         if (stored === 'dark' || stored === 'light') theme = stored;
       } catch (e) {}
       if (!theme) {
         try {
           theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
         } catch (e) {
           theme = 'light';
         }
       }
       root.dataset.theme = theme;
```

Keep the two `classList.add` lines after it unchanged.

- [ ] **Step 5: Wire live following, the toggle, the Toaster and the manifest**

`src/app/SiteApp.tsx`: add `import { useEffect } from 'react';` and `import { followSystemTheme } from '@/shared/lib/theme';`. Make this the first line of the `SiteApp` body:

```tsx
  useEffect(() => followSystemTheme(), []);
```

`src/features/theme-toggle/ui/ThemeToggleButton.tsx`: rename `isBlueprint` to `isDark` and compute it as `theme === 'dark'`. Leave the rest unchanged.

`src/widgets/layout/top-bar/TopBar.tsx:16`: change the Toaster prop to `theme={theme}`. `useSiteTheme()` already returns `'dark' | 'light'`.

`src/app/pwa/pwa-options.ts` lines 3–5:

```ts
/** The light paper from src/shared/styles/_tokens.scss; a manifest allows one colour. */
export const PWA_THEME_COLOR = '#f7f8fa';
export const PWA_BACKGROUND_COLOR = '#f7f8fa';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/site-shell.test.ts tests/black-box/offline-app.test.ts`
Expected: PASS.

Run: `grep -rn "blueprint\|vellum" src --include=*.ts --include=*.tsx --include=*.html index.html`
Expected: no matches outside comments. The stylesheets are handled in Task 2.

- [ ] **Step 7: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/lib/theme/theme.ts src/shared/lib/theme/index.ts index.html src/app/SiteApp.tsx src/app/pwa/pwa-options.ts src/features/theme-toggle/ui/ThemeToggleButton.tsx src/widgets/layout/top-bar/TopBar.tsx tests/black-box/site-shell.test.ts tests/black-box/offline-app.test.ts
git diff --staged
git commit -m "feat(theme): dark and light themes that follow the OS until the student chooses"
```

---

### Task 2: Ink + Cobalt tokens and fonts

**Files:**
- Rewrite: `src/shared/styles/_tokens.scss`
- Modify: `src/app/styles/fonts.ts`, `package.json`, `package-lock.json`, `src/shared/ui/code-viewer/code-viewer.scss:202-210,411`, `src/pages/home/ui/home.scss:138-139`, `src/pages/home/ui/vertex-demo.scss:162-163`
- Test: `tests/black-box/site-shell.test.ts` (BB-SITE-22, BB-SITE-23 new), `tests/black-box/editor-shell.test.ts` (BB-SHELL-17 description only)

**Interfaces:**
- Consumes: `[data-theme='dark']` from Task 1.
- Produces:
  - CSS custom properties: `--font-logo`, `--text-xs|sm|base|md|lg|xl|2xl` with `--lh-xs|sm|base|md|lg|xl|2xl`, and `--accent-tint`;
  - `--logo-fill`, `--logo-stroke`, `--logo-depth`, `--logo-glow`, used by Task 3;
  - every existing token name, unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/site-shell.test.ts`:

```ts
const TOKENS = readFileSync('src/shared/styles/_tokens.scss', 'utf8');

/** `--name: #rrggbb;` declarations inside one top-level block. */
function block(selector: string): Record<string, string> {
  const start = TOKENS.indexOf(`${selector} {`);
  const body = TOKENS.slice(start, TOKENS.indexOf('\n}\n', start));
  const values: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) values[m[1]] = m[2].toLowerCase();
  return values;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PALETTE = {
  dark: { '--paper': '#121419', '--paper-raised': '#191c22', '--paper-sunken': '#0e1014', '--rule': '#262a33', '--ink': '#e6e8ec', '--ink-muted': '#a3a9b5', '--ink-faint': '#8b92a0', '--accent': '#4762f5', '--on-accent': '#ffffff', '--accent-text': '#93a6ff', '--focus-ring': '#93a6ff' },
  light: { '--paper': '#f7f8fa', '--paper-raised': '#fcfcfd', '--paper-sunken': '#eef0f3', '--rule': '#dadde3', '--ink': '#141821', '--ink-muted': '#4f5665', '--ink-faint': '#656c7b', '--accent': '#2f4de0', '--on-accent': '#ffffff', '--accent-text': '#2f4de0', '--focus-ring': '#2f4de0' },
};

describe('BB-SITE-22: The tokens declare the Ink + Cobalt palette for both themes', () => {
  it('matches the spec values and no longer names the old themes', () => {
    const light = block(':root');
    const dark = block("[data-theme='dark']");
    for (const [token, value] of Object.entries(PALETTE.light)) expect(light[token], token).toBe(value);
    for (const [token, value] of Object.entries(PALETTE.dark)) expect(dark[token], token).toBe(value);
    expect(TOKENS).not.toMatch(/blueprint|vellum/i);
    expect(TOKENS).toContain("'Bricolage Grotesque Variable'");
    expect(TOKENS).toContain("'JetBrains Mono Variable'");
  });
});

describe('BB-SITE-23: Text and focus tokens meet WCAG AA on every surface', () => {
  for (const [theme, selector] of [['light', ':root'], ['dark', "[data-theme='dark']"]] as const) {
    it(`${theme} theme`, () => {
      const t = block(selector);
      const surfaces = ['--paper', '--paper-raised', '--paper-sunken', '--code-bg'];
      for (const fg of ['--ink', '--ink-muted', '--ink-faint', '--accent-text', '--success', '--danger']) {
        for (const bg of surfaces) expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(t['--on-accent'], t['--accent'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--focus-ring'], t['--paper'])).toBeGreaterThanOrEqual(3);
      expect(contrast(t['--field-line'], t['--paper'])).toBeGreaterThanOrEqual(3);
      expect(contrast(t['--field-line'], t['--field-bg'])).toBeGreaterThanOrEqual(3);
    });
  }
});
```

`readFileSync` is already imported in this file (line 180). If the linter flags the use before that import line, move `import { readFileSync } from 'node:fs';` to the top import block.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/site-shell.test.ts -t "BB-SITE-2[23]"`
Expected: FAIL. The token values are still Drafting Vellum, and the dark block is missing.

- [ ] **Step 3: Swap the font packages**

```bash
npm uninstall @fontsource/chivo @fontsource/chivo-mono @fontsource/newsreader
npm install @fontsource-variable/bricolage-grotesque@^5.3.0 @fontsource-variable/jetbrains-mono@^5.3.0
grep -h "font-family" node_modules/@fontsource-variable/bricolage-grotesque/index.css node_modules/@fontsource-variable/jetbrains-mono/index.css | sort -u
ls node_modules/@fontsource-variable/bricolage-grotesque/files | grep latin-wght-normal
ls node_modules/@fontsource-variable/jetbrains-mono/files | grep latin-wght-normal
```

Expected: the family names `'Bricolage Grotesque Variable'` and `'JetBrains Mono Variable'`, and the files `bricolage-grotesque-latin-wght-normal.woff2` and `jetbrains-mono-latin-wght-normal.woff2`. If a family name differs, use the printed name everywhere this plan writes it.

Replace `src/app/styles/fonts.ts` with:

```ts
// Self-hosted variable fonts: Bricolage Grotesque for UI and headlines, JetBrains Mono for code.
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/jetbrains-mono';
```

- [ ] **Step 4: Rewrite the tokens**

Replace the whole of `src/shared/styles/_tokens.scss` with:

```scss
@font-face {
  font-family: 'Comfortaa';
  src: url('/fonts/Comfortaa-Light.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}

$font-display: 'Bricolage Grotesque Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
$font-ui: 'Bricolage Grotesque Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
$font-mono: 'JetBrains Mono Variable', ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace;
$header-height: 3.7rem;

/* Ink + Cobalt. :root is the light theme; [data-theme='dark'] overrides it. */
:root {
  color-scheme: light;

  --font-display: #{$font-display};
  --font-ui: #{$font-ui};
  --font-mono: #{$font-mono};
  --font-logo: 'Minecrafter', system-ui, sans-serif;

  /* Type scale. Nothing renders below --text-xs. */
  --text-xs: 11px;   --lh-xs: 1.4;
  --text-sm: 12px;   --lh-sm: 1.45;
  --text-base: 13px; --lh-base: 1.5;
  --text-md: 15px;   --lh-md: 1.55;
  --text-lg: 18px;   --lh-lg: 1.5;
  --text-xl: 24px;   --lh-xl: 1.2;
  --text-2xl: clamp(2.5rem, 5vw, 4rem); --lh-2xl: 1.05;

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
  /* One radius everywhere. */
  --radius-s: 3px;
  --radius-m: 3px;

  --paper: #f7f8fa;
  --paper-raised: #fcfcfd;
  --paper-sunken: #eef0f3;
  --ink: #141821;
  --ink-muted: #4f5665;
  --ink-faint: #656c7b;
  --rule: #dadde3;
  --grid-major: rgba(20, 24, 33, 0.08);
  --grid-minor: rgba(20, 24, 33, 0.035);
  --accent: #2f4de0;
  --accent-rgb: 47, 77, 224;
  --on-accent: #ffffff;
  --accent-text: #2f4de0;
  --accent-tint: rgba(47, 77, 224, 0.10);
  --focus-ring: #2f4de0;
  --code-bg: #fcfcfd;
  --code-ink: #141821;
  --code-fn: #2f4de0;
  --success: #166534;
  --danger: #b91c1c;

  /* The pixel wordmark is the same in both themes, apart from the dark theme's glow. */
  --logo-fill: #fcee0a;
  --logo-stroke: #000000;
  --logo-depth: #00f0ff;
  --logo-glow: 0 0 0 transparent;

  /* Editor variables, reassigned onto the palette (names and RGB-triplet format unchanged).
     The accent-blue family maps to neutral ink so the accent stays rare. */
  --bg-dark-rgb: 238, 240, 243;
  --bg-panel-rgb: 247, 248, 250;
  --bg-bar-rgb: 247, 248, 250;
  --bg-input-rgb: 252, 252, 253;
  --border-rgb: 218, 221, 227;
  --text-main: #141821;
  --text-muted: #4f5665;
  --text-dim: #656c7b;
  --accent-blue-rgb: 79, 86, 101;
  --accent-green-rgb: 21, 128, 61;
  --accent-red-rgb: 185, 28, 28;
  --bg-panel-hover: #eef0f3;
  --accent-blue-light: #141821;
  --accent-red-light: #b91c1c;
  --accent-green-light: #15803d;
  --accent-blue-text: #141821;
  --accent-red-text: #b91c1c;
  --accent-green-text: #166534;
  --border-highlight: #656c7b;
  --panel-tab: #eef0f3;
  --keyword-fallback: #141821;
  --code-content: #141821;

  --well-rgb: 238, 240, 243;
  --shadow-rgb: 20, 24, 33;
  --on-accent-blue: #ffffff;
  --on-accent-light: #ffffff;
  --warning: #b45309;
  --warning-rgb: 180, 83, 9;
  --warning-strong: #92400e;
  --code-changed-rgb: 180, 83, 9;
  --code-changed-light: #92400e;
  --code-match-rgb: 133, 77, 14;
  --code-match-light: #854d0e;
  --channel-r: #b91c1c;
  --channel-g: #166534;
  --channel-b: #1d4ed8;
  --hue-sky: #075985;
  --hue-sky-rgb: 7, 89, 133;
  --hue-violet: #6d28d9;
  --hue-violet-rgb: 109, 40, 217;
  --gl-fn: #4f5665;
  --gl-fn-rgb: 79, 86, 101;

  /* Shared control set (editor). Field lines keep 3:1 against paper and field. */
  --control-h: 28px;
  --control-h-lg: 32px;
  --field-bg: #fcfcfd;
  --field-line: #7d8390;
  --hairline: #dadde3;
  --live: var(--accent);
  --live-tint: var(--accent-tint);
  --gl-hint: #4f5665;
  --switch-thumb-on: #ffffff;
  /* Canvas overlay plate: the GL canvas is dark in both themes, so the plate
     and its axis colours are fixed and identical for both themes. */
  --canvas-plate: rgba(14, 16, 20, 0.85);
  --canvas-plate-line: rgba(230, 232, 236, 0.18);
  --canvas-x: #f87171;
  --canvas-y: #4ade80;
}

[data-theme='dark'] {
  color-scheme: dark;

  --paper: #121419;
  --paper-raised: #191c22;
  --paper-sunken: #0e1014;
  --ink: #e6e8ec;
  --ink-muted: #a3a9b5;
  --ink-faint: #8b92a0;
  --rule: #262a33;
  --grid-major: rgba(230, 232, 236, 0.07);
  --grid-minor: rgba(230, 232, 236, 0.03);
  --accent: #4762f5;
  --accent-rgb: 71, 98, 245;
  --on-accent: #ffffff;
  --accent-text: #93a6ff;
  --accent-tint: rgba(71, 98, 245, 0.16);
  --focus-ring: #93a6ff;
  --code-bg: #0f1115;
  --code-ink: #e6e8ec;
  --code-fn: #93a6ff;
  --success: #4ade80;
  --danger: #f87171;

  --logo-glow: 0 0 15px rgba(0, 240, 255, 0.4);

  --bg-dark-rgb: 14, 16, 20;
  --bg-panel-rgb: 18, 20, 25;
  --bg-bar-rgb: 18, 20, 25;
  --bg-input-rgb: 15, 17, 21;
  --border-rgb: 38, 42, 51;
  --text-main: #e6e8ec;
  --text-muted: #a3a9b5;
  --text-dim: #8b92a0;
  --accent-blue-rgb: 163, 169, 181;
  --accent-green-rgb: 21, 128, 61;
  --accent-red-rgb: 185, 28, 28;
  --bg-panel-hover: #0e1014;
  --accent-blue-light: #e6e8ec;
  --accent-red-light: #f87171;
  --accent-green-light: #4ade80;
  --accent-blue-text: #e6e8ec;
  --accent-red-text: #f87171;
  --accent-green-text: #4ade80;
  --border-highlight: #8b92a0;
  --panel-tab: #0e1014;
  --keyword-fallback: #e6e8ec;
  --code-content: #e6e8ec;

  --well-rgb: 14, 16, 20;
  --shadow-rgb: 0, 0, 0;
  --on-accent-blue: #ffffff;
  --on-accent-light: #121419;
  --warning: #b45309;
  --warning-rgb: 180, 83, 9;
  --warning-strong: #92400e;
  --code-changed-rgb: 245, 158, 11;
  --code-changed-light: #fbbf24;
  --code-match-rgb: 251, 191, 36;
  --code-match-light: #fbbf24;
  --channel-r: #f87171;
  --channel-g: #4ade80;
  --channel-b: #60a5fa;
  --hue-sky: #7dd3fc;
  --hue-sky-rgb: 125, 211, 252;
  --hue-violet: #a78bfa;
  --hue-violet-rgb: 167, 139, 250;
  --gl-fn: #a3a9b5;
  --gl-fn-rgb: 163, 169, 181;

  --field-bg: #0f1115;
  --field-line: #6b7280;
  --hairline: #262a33;
  --live: var(--accent);
  --live-tint: var(--accent-tint);
  --gl-hint: #a3a9b5;
  --switch-thumb-on: #ffffff;
  /* Canvas overlay plate: the GL canvas is dark in both themes, so the plate
     and its axis colours are fixed and identical for both themes. */
  --canvas-plate: rgba(14, 16, 20, 0.85);
  --canvas-plate-line: rgba(230, 232, 236, 0.18);
  --canvas-x: #f87171;
  --canvas-y: #4ade80;
}
$bg-dark: rgb(var(--bg-dark-rgb));
$bg-panel: rgb(var(--bg-panel-rgb));
$bg-bar: rgb(var(--bg-bar-rgb));
$bg-input: rgb(var(--bg-input-rgb));
$border-color: rgb(var(--border-rgb));
$text-main: var(--text-main);
$text-muted: var(--text-muted);
$text-dim: var(--text-dim);
$accent-blue: rgb(var(--accent-blue-rgb));
$accent-green: rgb(var(--accent-green-rgb));
$accent-red: rgb(var(--accent-red-rgb));
$accent-blue-text: var(--accent-blue-text);
$accent-green-text: var(--accent-green-text);
$accent-red-text: var(--accent-red-text);
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
@mixin scrollbar {
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background-color: rgba(var(--border-rgb), 0.8);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;
    &:hover {
      background-color: var(--text-muted);
    }
  }
}
```

In `tests/black-box/editor-shell.test.ts`, change only the BB-SHELL-17 `it` description to `'declares the plate tokens identically for light and dark'`.

- [ ] **Step 5: Code font and theme selectors**

In `src/shared/ui/code-viewer/code-viewer.scss`, inside `.code-content { … }`:
- set `font-size: 13px;` and `line-height: 1.6;`, replacing `12.5px` and `20px`;
- add this rule. A `<pre>` takes the browser's default monospace unless told to inherit.

```scss
    pre,
    code {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
    }
```

In the same file, change `[data-theme='blueprint'] & {` to `[data-theme='dark'] & {`. Change the comment above it to read `(dark values below)`.

Delete the two-line blocks that end with `[data-theme='blueprint'] .hero-figure__fill { fill: var(--grid-major); }` (in `src/pages/home/ui/home.scss`) and `[data-theme='blueprint'] .vertex-demo__fill { fill: var(--grid-major); }` (in `src/pages/home/ui/vertex-demo.scss`). The cobalt tint reads cleanly on dark paper.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/site-shell.test.ts tests/black-box/editor-shell.test.ts`
Expected: PASS.

Run: `grep -rn "blueprint\|vellum" src index.html`
Expected: no matches.

- [ ] **Step 7: Look at it**

Run: `npx vite --port 5173 --strictPort`. In Chrome, open `/` and `/app` in both themes using the toggle. Check:
- the UI text is Bricolage and the code panel is JetBrains Mono (DevTools, Computed, rendered font);
- neither page has an orange accent left.

Stop the server by its PID (`netstat -ano | grep :5173`, then `taskkill //PID <pid> //F`).

- [ ] **Step 8: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/styles/_tokens.scss src/app/styles/fonts.ts package.json package-lock.json src/shared/ui/code-viewer/code-viewer.scss src/pages/home/ui/home.scss src/pages/home/ui/vertex-demo.scss tests/black-box/site-shell.test.ts tests/black-box/editor-shell.test.ts
git diff --staged
git commit -m "feat(design): Ink + Cobalt tokens with Bricolage Grotesque and JetBrains Mono"
```

---

### Task 3: The pixel wordmark everywhere

**Files:**
- Restore: `public/fonts/Minecrafter.ttf`
- Rewrite: `src/shared/ui/logo/Logo.tsx`, `src/shared/ui/logo/logo.scss`, `src/shared/ui/logo/index.ts`
- Modify: `src/app/styles/global.scss`, `index.html`, `src/widgets/site-header/ui/SiteHeader.tsx`, `src/widgets/layout/top-bar/TopBar.tsx`, `src/widgets/site-footer/ui/SiteFooter.tsx`, `src/widgets/site-footer/ui/site-footer.scss`, `src/pages/editor/ui/EditorLoading.tsx`, `src/pages/editor/ui/editor-loading.scss`
- Test: `tests/black-box/site-shell.test.ts` (BB-SITE-13, BB-SITE-14 rewritten; BB-SITE-24, BB-SITE-25 new)

**Interfaces:**
- Consumes: `--font-logo`, `--logo-fill`, `--logo-stroke`, `--logo-depth` and `--logo-glow` from Task 2.
- Produces: `default function Logo({ className?, title? = 'VAMS' })`. The `variant` prop and `VertexMark` are removed.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/site-shell.test.ts`, replace BB-SITE-13 and BB-SITE-14 (lines 149–171) with:

```ts
describe('BB-SITE-13: The wordmark exposes an accessible name and its text', () => {
  it('renders VAMS as text inside a named image', () => {
    const host = document.createElement('div');
    render(h(Logo, {}), host);
    const logo = host.querySelector('.vams-logo')!;
    expect(logo.getAttribute('role')).toBe('img');
    expect(logo.getAttribute('aria-label')).toBe('VAMS');
    expect(host.querySelector('.vams-logo__word')?.textContent).toBe('VAMS');
    expect(host.querySelector('svg')).toBeNull();
    render(null, host);
  });
});

describe('BB-SITE-14: The wordmark text is hidden from assistive technology', () => {
  it('keeps the name on the wrapper only, and accepts a custom name', () => {
    const host = document.createElement('div');
    render(h(Logo, { title: 'VAMS home' }), host);
    expect(host.querySelector('.vams-logo')!.getAttribute('aria-label')).toBe('VAMS home');
    expect(host.querySelector('.vams-logo__word')!.getAttribute('aria-hidden')).toBe('true');
    render(null, host);
  });
});
```

Append:

```ts
describe('BB-SITE-24: Every header, footer and loading screen shows the wordmark', () => {
  it('has no vertex mark left and names the header link VAMS home', () => {
    for (const file of [
      'src/widgets/site-header/ui/SiteHeader.tsx',
      'src/widgets/layout/top-bar/TopBar.tsx',
      'src/widgets/site-footer/ui/SiteFooter.tsx',
      'src/pages/editor/ui/EditorLoading.tsx',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('<Logo');
      expect(source, file).not.toContain('VertexMark');
    }
    expect(readFileSync('src/widgets/site-header/ui/SiteHeader.tsx', 'utf8')).toContain('aria-label="VAMS home"');
  });
});

describe('BB-SITE-25: The wordmark font is preloaded and cannot shift the header', () => {
  it('preloads Minecrafter, blocks on it briefly, and sizes the word in em', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<link rel="preload" href="/fonts/Minecrafter.ttf" as="font" type="font/ttf" crossorigin />');
    const global = readFileSync('src/app/styles/global.scss', 'utf8');
    expect(global).toMatch(/font-family: 'Minecrafter';[\s\S]*?font-display: block;/);
    const logo = readFileSync('src/shared/ui/logo/logo.scss', 'utf8');
    expect(logo).toMatch(/height: 1em;/);
    expect(logo).toMatch(/prefers-reduced-motion: no-preference/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/site-shell.test.ts -t "BB-SITE-(13|14|24|25)"`
Expected: FAIL. The logo still renders an SVG, and nothing preloads Minecrafter.

- [ ] **Step 3: Restore the font and declare it**

```bash
git show f8e18ab^:public/fonts/Minecrafter.ttf > public/fonts/Minecrafter.ttf
ls -l public/fonts/Minecrafter.ttf
```

Expected: 22616 bytes.

Add to the top of `src/app/styles/global.scss`, after the `@use` line:

```scss
/* The wordmark face. block: a moment of blank logo beats a fallback that jumps when the font lands. */
@font-face {
  font-family: 'Minecrafter';
  src: url('/fonts/Minecrafter.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
```

In `index.html`, after the `apple-touch-icon` link, add:

```html
   <link rel="preload" href="/fonts/Minecrafter.ttf" as="font" type="font/ttf" crossorigin />
```

- [ ] **Step 4: Rewrite the logo**

`src/shared/ui/logo/Logo.tsx`:

```tsx
import './logo.scss';

interface LogoProps {
  className?: string;
  /** Accessible name. */
  title?: string;
}

/** The pixel wordmark: "VAMS" set in Minecrafter. Size it with the parent's font-size. */
export default function Logo({ className, title = 'VAMS' }: LogoProps) {
  const classes = ['vams-logo', className].filter(Boolean).join(' ');
  return (
    <span className={classes} role="img" aria-label={title}>
      <span className="vams-logo__word" aria-hidden="true">VAMS</span>
    </span>
  );
}
```

`src/shared/ui/logo/index.ts`:

```ts
export { default } from './Logo';
```

`src/shared/ui/logo/logo.scss`:

```scss
@keyframes vams-logo-glitch {
  0% { transform: skew(0deg); }
  20% { transform: skew(-2deg); }
  40% { transform: skew(2deg); }
  60% { transform: skew(-1deg); }
  80% { transform: skew(1deg); }
  100% { transform: skew(0deg); }
}

.vams-logo {
  display: inline-flex;
  align-items: center;
  line-height: 1;

  &__word {
    display: inline-block;
    /* A fixed box: the header keeps its height whether or not the font has loaded. */
    height: 1em;
    font-family: var(--font-logo);
    font-size: 1.75em;
    font-style: italic;
    font-weight: normal;
    line-height: 1;
    letter-spacing: 0.08em;
    white-space: nowrap;
    color: var(--logo-fill);
    -webkit-text-stroke: 1.5px var(--logo-stroke);
    paint-order: stroke fill;
    text-shadow: 3px 3px 0 var(--logo-depth), var(--logo-glow);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:hover > .vams-logo .vams-logo__word,
  .vams-logo:hover .vams-logo__word {
    animation: vams-logo-glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite;
    text-shadow: 4px 4px 0 var(--logo-depth), -2px -2px 0 #ff00ff, 0 0 20px var(--logo-depth);
  }
}
```

- [ ] **Step 5: Use the wordmark everywhere**

- **`src/widgets/site-header/ui/SiteHeader.tsx`:** change `<Logo variant="full" />` to `<Logo />`. The link keeps `aria-label="VAMS home"`.
- **`src/widgets/layout/top-bar/TopBar.tsx`:** change `<Logo variant="full" title="VAMS" />` to `<Logo />`.
- **`src/widgets/site-footer/ui/SiteFooter.tsx`:**
  - Change the import to `import Logo from '@/shared/ui/logo';`.
  - Replace the brand `div` with the block below. It removes the separator middots from the footer copy.
  - Replace the credits paragraph text with `An undergraduate thesis project, FEU Institute of Technology. Gomez, Taguiam and Vizco.`

```tsx
      <div className="site-footer__brand">
        <Logo />
        <p>Visual Animation Modeling Simulator</p>
      </div>
```

  - Replace the links paragraph with:

```tsx
      <p className="site-footer__links">
        <a href={REPO_URL} rel="noopener">Source on GitHub</a>
        <span>MIT License</span>
      </p>
```

  - In `site-footer.scss`, add `&__links { display: flex; gap: var(--space-4); }` next to the existing `&__links` rule, merged into it. Add `&__brand .vams-logo { font-size: 0.8rem; }`.
- **`src/pages/editor/ui/EditorLoading.tsx`:** import `Logo` from `'@/shared/ui/logo'` and render `<Logo className="editor-loading__logo" />` in place of `<VertexMark size={56} />`.
- **`editor-loading.scss`:**
  - delete the four `background-image` lines and the `background-size` line;
  - add `&__logo { font-size: 1.75rem; }`;
  - change `&__label` to `font-family: var(--font-ui); font-size: var(--text-sm); color: var(--ink-muted);`, removing `letter-spacing` and `text-transform`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/site-shell.test.ts`
Expected: PASS.

Run: `grep -rn "VertexMark\|vams-logo__mark\|vams-logo__vertex" src tests`
Expected: no matches.

- [ ] **Step 7: Look at it**

Start `npx vite --port 5173 --strictPort`. Check the header on `/` and the top bar on `/app` in both themes:
- yellow word, black outline, cyan offset, glow only in dark;
- hovering shows the glitch;
- with DevTools emulating `prefers-reduced-motion: reduce`, hovering does nothing.

Stop the server by its PID.

- [ ] **Step 8: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add public/fonts/Minecrafter.ttf src/shared/ui/logo src/app/styles/global.scss index.html src/widgets/site-header/ui/SiteHeader.tsx src/widgets/layout/top-bar/TopBar.tsx src/widgets/site-footer/ui/SiteFooter.tsx src/widgets/site-footer/ui/site-footer.scss src/pages/editor/ui/EditorLoading.tsx src/pages/editor/ui/editor-loading.scss tests/black-box/site-shell.test.ts
git diff --staged
git commit -m "feat(brand): bring back the pixel wordmark as the logo everywhere"
```

---

### Task 4: Icons, preview image, and the editor's accent selection

**Files:**
- Regenerate: `public/favicon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `scripts/og/og-default.html`, `public/og/og-default.png`
- Create: `src/shared/lib/theme/css-color.ts`
- Modify: `src/shared/lib/theme/index.ts`, `src/shared/engine/selection-overlay.ts:54`, `src/shared/engine/pixi/primitives/rendering/drawableFactory.ts:65`, `src/shared/engine/pixi/hooks/useSceneRenderer.ts`
- Test: `tests/black-box/editor-shell.test.ts` (BB-SHELL-20, BB-SHELL-21 new)

**Interfaces:**
- Produces: `readCssColor(name: string, fallback: number): number`, exported from `@/shared/lib/theme`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/black-box/editor-shell.test.ts`:

```ts
import { readCssColor } from '@/shared/lib/theme';

describe('BB-SHELL-20: Canvas colours are read from the theme tokens', () => {
  it('parses a #rrggbb custom property and falls back otherwise', () => {
    const root = document.documentElement;
    root.style.setProperty('--accent', '#4762f5');
    expect(readCssColor('--accent', 0)).toBe(0x4762f5);
    root.style.setProperty('--accent', 'rgb(1, 2, 3)');
    expect(readCssColor('--accent', 0x123456)).toBe(0x123456);
    root.style.removeProperty('--accent');
    expect(readCssColor('--missing', 0xabcdef)).toBe(0xabcdef);
  });
});

describe('BB-SHELL-21: The canvas selection outline uses the accent, not a fixed blue', () => {
  it('has no hard-coded selection colour left in the engine', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of ['src/shared/engine/selection-overlay.ts', 'src/shared/engine/pixi/primitives/rendering/drawableFactory.ts']) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('0x0099ff');
      expect(source, file).toContain("readCssColor('--accent'");
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/editor-shell.test.ts -t "BB-SHELL-2[01]"`
Expected: FAIL. `readCssColor` is not exported.

- [ ] **Step 3: Implement `readCssColor` and use it**

`src/shared/lib/theme/css-color.ts`:

```ts
/** Reads a `#rrggbb` custom property from <html> as a number for PixiJS, or returns the fallback. */
export function readCssColor(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(raw);
  return match ? parseInt(match[1], 16) : fallback;
}
```

Add `export { readCssColor } from './css-color';` to `src/shared/lib/theme/index.ts`.

- In `src/shared/engine/selection-overlay.ts`, add `import { readCssColor } from '@/shared/lib/theme';` and change line 54 to `const lineColor = readCssColor('--accent', 0x4762f5);`.
- In `drawableFactory.ts`, add the same import and change `color: 0x0099ff,` to `color: readCssColor('--accent', 0x4762f5),`.
- In `src/shared/engine/pixi/hooks/useSceneRenderer.ts`, inside `useSceneRenderer`, add `const theme = useVamsStore((s) => s.theme);` near the other store reads. Add `theme` to the dependency arrays of:
  - the selection effect, whose deps end `[selectedObjectId, objects, worldRef, overlayRef]`, so that a theme change redraws the outline;
  - the scene-build effect, whose deps begin `pixiReady, objects, selectedObjectId`, so that group outlines are redrawn too.

`EditorApp` writes the store's `theme` from `subscribeTheme`, which fires after `data-theme` is applied, so the effect reads the new token.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/editor-shell.test.ts`
Expected: PASS.

- [ ] **Step 5: Favicon from the font's own "V"**

Work in a scratch directory outside the repository:

```bash
SCRATCH="$TEMP/vams-favicon"; mkdir -p "$SCRATCH"
cat > "$SCRATCH/favicon.py" <<'EOF'
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

font = TTFont(sys.argv[1])
glyphs = font.getGlyphSet()
name = font.getBestCmap()[ord('V')]
bounds = BoundsPen(glyphs); glyphs[name].draw(bounds)
x0, y0, x1, y1 = bounds.bounds
pen = SVGPathPen(glyphs); glyphs[name].draw(pen)
d = pen.getCommands()
# Fit the glyph into 40 units of height, centred in a 64 x 64 tile, flipped to SVG's y-down.
s = 40 / (y1 - y0)
w = (x1 - x0) * s
tx = (64 - w) / 2 - x0 * s - 1.5
ty = 52  # baseline: the glyph spans y 12..52
glyph = f'transform="translate({tx:.2f} {ty:.2f}) skewX(-8) scale({s:.5f} {-s:.5f})"'
print(f'''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="10" fill="#121419"/>
  <g transform="translate(3 3)"><path {glyph} d="{d}" fill="#00f0ff"/></g>
  <path {glyph} d="{d}" fill="#fcee0a" stroke="#000" stroke-width="{1.5 / s:.2f}" paint-order="stroke"/>
</svg>''')
EOF
python -I "$SCRATCH/favicon.py" public/fonts/Minecrafter.ttf > public/favicon.svg
```

Open `public/favicon.svg` in Chrome. Check that the yellow "V" sits centred on the dark tile with its cyan offset, and that nothing is cropped. If it is off-centre, adjust `tx` and `ty` in the script and rerun. Only the SVG is committed.

- [ ] **Step 6: App icons from the favicon**

```bash
npx --yes @vite-pwa/assets-generator@^1 --preset minimal-2023 public/favicon.svg
rm -f public/pwa-64x64.png public/favicon.ico
ls -l public/pwa-192x192.png public/pwa-512x512.png public/maskable-icon-512x512.png public/apple-touch-icon-180x180.png
```

Open each PNG and check the mark is centred and uncropped.

- [ ] **Step 7: The preview image**

Replace `scripts/og/og-default.html` with:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  @font-face { font-family: 'Minecrafter'; src: url('../../public/fonts/Minecrafter.ttf') format('truetype'); }
  @font-face { font-family: 'Bricolage'; font-weight: 200 800; src: url('../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2') format('woff2'); }
  html, body { margin: 0; }
  body {
    width: 1200px; height: 630px; box-sizing: border-box; padding: 96px 104px;
    display: flex; flex-direction: column; justify-content: center; gap: 36px;
    background: #121419; color: #e6e8ec;
  }
  .word {
    font-family: 'Minecrafter', sans-serif; font-style: italic; font-size: 168px; line-height: 1; letter-spacing: .08em;
    color: #fcee0a; -webkit-text-stroke: 4px #000; paint-order: stroke fill;
    text-shadow: 8px 8px 0 #00f0ff, 0 0 40px rgba(0, 240, 255, .4);
  }
  .tag { margin: 0; font-family: 'Bricolage', sans-serif; font-weight: 600; font-size: 44px; letter-spacing: -.02em; }
  .tag span { color: #93a6ff; }
  .rule { width: 160px; height: 4px; background: #4762f5; }
</style>
</head>
<body>
  <div class="word">VAMS</div>
  <div class="rule"></div>
  <p class="tag">See the OpenGL behind <span>every shape.</span></p>
</body>
</html>
```

Render it:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1200,630 --screenshot="$(pwd -W 2>/dev/null || pwd)/public/og/og-default.png" \
  "file:///$(pwd -W 2>/dev/null || pwd)/scripts/og/og-default.html"
ls -l public/og/og-default.png
```

Expected: a PNG under 1 MB. Open it and confirm both fonts rendered, not fallbacks.

- [ ] **Step 8: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/lib/theme/css-color.ts src/shared/lib/theme/index.ts src/shared/engine/selection-overlay.ts src/shared/engine/pixi/primitives/rendering/drawableFactory.ts src/shared/engine/pixi/hooks/useSceneRenderer.ts tests/black-box/editor-shell.test.ts public/favicon.svg public/pwa-192x192.png public/pwa-512x512.png public/maskable-icon-512x512.png public/apple-touch-icon-180x180.png scripts/og/og-default.html public/og/og-default.png
git diff --staged --stat
git commit -m "feat(brand): pixel V icons, a new preview image, and the canvas selection in the accent"
```

Delivery step 1 is complete here, with a target of 2026-10-10.

---

### Task 5: Landing page restyle

**Files:**
- Modify:
  - `src/pages/home/ui/sections/SectionHeading.tsx`, `HeroSection.tsx`, `ProblemSection.tsx`, `CurriculumSection.tsx`, `UnderTheHoodSection.tsx`, `sections.scss`;
  - `src/pages/home/ui/home.scss`, `HeroFigure.tsx`, `home-stage.scss`;
  - `src/pages/home/model/content.ts:107-110`;
  - `src/app/styles/site-page.scss`;
  - `src/widgets/site-header/ui/site-header.scss`, `src/widgets/site-footer/ui/site-footer.scss`.
- Test: `tests/black-box/home-stage.test.ts` (BB-HOME-15 updated; BB-HOME-20, BB-HOME-21 new). `tests/visual/home.spec.ts` (VIS-HOME-01, new).

**Interfaces:**
- Consumes: the tokens from Task 2, including `--text-*` and `--accent-tint`.
- Produces: the class names `.pipeline`, `.pipeline__stop`, `.pipeline__dot`, `.pipeline__name`, `.pipeline__summary`, `.pipeline__calls`, `.hood`, `.hood-stack` (now a `<ul>`) and `.home__accent`. They replace `.curriculum-list*`, `.home__eyebrow`, `.home-section__eyebrow` and `.home-section__sheet`.

- [ ] **Step 1: Write the failing tests**

In `tests/black-box/home-stage.test.ts`, BB-HOME-15, replace `expect(html).toContain(UNDER_THE_HOOD.stack.join(' · '));` with:

```ts
    for (const item of UNDER_THE_HOOD.stack) expect(html).toContain(`<li>${item}</li>`);
```

Append:

```ts
describe('BB-HOME-20: Sections carry no eyebrows, sheet numbers or decorative separators', () => {
  it('renders headlines alone and keeps em dashes and middots out of visible copy', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    expect(html).not.toContain('home-section__eyebrow');
    expect(html).not.toContain('home__eyebrow');
    expect(html).not.toContain('curriculum-list__number');
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<head>[\s\S]*?<\/head>/, '')
      .replace(/<dl class="vertex-demo__math"[\s\S]*?<\/dl>/g, '')
      .replace(/<[^>]+>/g, ' ');
    expect(visible).not.toContain('—');
    expect(visible).not.toContain('·');
  });
});

describe('BB-HOME-21: The hero colours one word and the curriculum is a five-stop pipeline', () => {
  it('uses an accent span, not italics, and lists the five sections in order', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    expect(html).toContain('<span class="home__accent">program.</span>');
    expect(html).not.toMatch(/<em>program\.<\/em>/);
    const names = [...html.matchAll(/<h3 class="pipeline__name">([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(names).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
  });
});
```

Before relying on the `vertex-demo__math` exclusion in BB-HOME-20, check how that element renders:

```bash
grep -n "vertex-demo__math" src/pages/home/ui/VertexDemo.tsx
```

It is the `<dl>` holding the NDC formulas, where `·` means multiplication. If its tag differs from `<dl class="vertex-demo__math"`, adjust the regex to the rendered tag.

Create `tests/visual/home.spec.ts`:

```ts
/**
 * VISUAL TEST SUITE — VIS-HOME
 * Stage-mode legibility on a projector-sized window. Not part of `npm test`.
 */
import { test, expect } from '@playwright/test';

const BODY = [
  '.home__lede',
  '.home-section__subhead',
  '.problem-list > li',
  '.pipeline__summary',
  '.mode-list dd',
  '.hood-list dd',
  '.team-list dd',
  '.try-note',
];

test('VIS-HOME-01: Stage mode body text is at least 20px at 1280 x 720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?stage');
  await page.evaluate(() => document.fonts.ready);
  for (const selector of BODY) {
    const sizes = await page.$$eval(selector, (els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    expect(sizes.length, selector).toBeGreaterThan(0);
    for (const size of sizes) expect(size, selector).toBeGreaterThanOrEqual(20);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/black-box/home-stage.test.ts -t "BB-HOME-(15|20|21)"`
Expected: FAIL. The page still has eyebrows, `<em>` and `curriculum-list`.

- [ ] **Step 3: Markup**

**`SectionHeading.tsx`:** the body becomes the block below. Remove the `SECTIONS` import and the `index` lookup. Update the doc comment to `/** Title strip shared by every section after the hero: the heading, then an optional subhead. */`.

```tsx
  return (
    <header className="home-section__head">
      <h2 id={`${id}-title`} className="home-section__title">
        {title}
      </h2>
      {subhead && <p className="home-section__subhead">{subhead}</p>}
    </header>
  );
```

**`HeroSection.tsx`:**
- delete the `<p className="home__eyebrow">…</p>` line;
- change `<em>program.</em>` to `<span className="home__accent">program.</span>`;
- replace the lede's `No compiler, no setup: just the concept.` with `No compiler, no setup. Just the concept.`

**`HeroFigure.tsx`:** the caption becomes `Fig. 1. A triangle in VAMS and the OpenGL calls that draw it. The selected vertex and its line of code stay linked.`

**`ProblemSection.tsx`:** unchanged markup.

**`CurriculumSection.tsx`:** replace the `<ol className="curriculum-list">…</ol>` with:

```tsx
      <ol className="pipeline">
        {CURRICULUM.sections.map((section) => (
          <li key={section.name} className="pipeline__stop">
            <span className="pipeline__dot" aria-hidden="true" />
            <h3 className="pipeline__name">{section.name}</h3>
            <p className="pipeline__summary">{section.summary}</p>
            <ul className="pipeline__calls" aria-label={`Key calls in ${section.name}`}>
              {section.calls.map((call) => (
                <li key={call}>
                  <code>{call}</code>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
```

**`UnderTheHoodSection.tsx`:** replace the `<dl>` and the stack paragraph with:

```tsx
      <div className="hood">
        <dl className="hood-list">
          {UNDER_THE_HOOD.blocks.map((block) => (
            <div key={block.term}>
              <dt>{block.term}</dt>
              <dd>{block.text}</dd>
            </div>
          ))}
        </dl>
        <ul className="hood-stack" aria-label="Built with">
          {UNDER_THE_HOOD.stack.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
```

**`content.ts`, lines 107–110:** the separator middots become commas.

```ts
  program: 'BS Computer Science, Software Engineering. FEU Institute of Technology',
  members: [
    { name: 'Mikhael Edman P. Gomez', credit: 'Primary Developer & Designer, Research & Documentation', role: 'member' },
    { name: 'Justine Jhigz D. Vizco', credit: 'Thesis Leader, Research, Documentation & QA', role: 'member' },
```

The other two members are unchanged.

- [ ] **Step 4: Site frame, header and footer**

**`src/app/styles/site-page.scss`:**
- Remove the `background-image` and `background-size` declarations from `.site-page`.
- Change the header comment to `/* Shared frame for the content pages: one flat surface. */`.

**`src/widgets/site-header/ui/site-header.scss`:**

In `.site-header`:
- `border-bottom: 1px solid var(--rule);`
- `font-family: var(--font-ui);`
- `font-size: var(--text-base);`
- delete `letter-spacing` and `text-transform`.

`&__home`: delete the `text-transform` and `letter-spacing` lines.

`&__link`: hover becomes `border-bottom-color: var(--rule);`.

`&__theme`: `border: 1px solid var(--rule); border-radius: var(--radius-m);`, with hover `border-color: var(--ink-faint);`.

`&__cta` becomes:

```scss
  &__cta {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 var(--space-4);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    text-decoration: none;
    border-radius: var(--radius-s);
    transition: filter 120ms ease;
    &:hover { filter: brightness(1.08); }
  }
```

In the reduced-motion block, `.site-header__cta` becomes `{ transition: none; }`.

**`src/widgets/site-footer/ui/site-footer.scss`:**
- `border-top: 1px solid var(--rule); font-family: var(--font-ui); font-size: var(--text-sm);`
- `strong` keeps `font-family: var(--font-display)`.

- [ ] **Step 5: Hero styles (`home.scss`)**

- Delete the whole `&__eyebrow { … }` block in `.home`.
- `&__title`:

```scss
  &__title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-2xl);
    line-height: var(--lh-2xl);
    letter-spacing: -0.03em;
    text-wrap: balance;
  }
  &__accent { color: var(--accent-text); }
```

- `&__lede`: `font-size: var(--text-lg); line-height: var(--lh-lg);`.
- `&__cta`:

```scss
  &__cta {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 0 var(--space-5);
    background: var(--accent);
    color: var(--on-accent);
    font-family: var(--font-ui);
    font-weight: 600;
    font-size: var(--text-md);
    text-decoration: none;
    border-radius: var(--radius-s);
    transition: filter 120ms ease;
    /* The arrow is decoration; the second declaration gives it empty alt text where supported. */
    &::after {
      content: '→';
      content: '→' / '';
      margin-left: var(--space-3);
      transition: transform 120ms ease;
    }
    &:hover { filter: brightness(1.08); &::after { transform: translateX(3px); } }
  }
```

- **Reduced-motion block:** replace its `.home__cta { … }` rule with `.home__cta { transition: none; &::after { transition: none; } &:hover::after { transform: none; } }`.
- **`.hero-figure__scene`:** add the graph-paper plane. Graph paper stays only inside the two coordinate figures.

```scss
  &__scene {
    width: 100%; height: auto; overflow: visible;
    background-image:
      linear-gradient(var(--grid-major) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-major) 1px, transparent 1px),
      linear-gradient(var(--grid-minor) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-minor) 1px, transparent 1px);
    background-size: 40px 40px, 40px 40px, 10px 10px, 10px 10px;
  }
```

- **`&__code`:**
  - `border: 1px solid var(--rule); border-radius: var(--radius-s); background: var(--code-bg); color: var(--code-ink);`
  - delete the `box-shadow`.
- **`&__hl`:**
  - `background: var(--accent-tint); color: var(--ink); box-shadow: inset 2px 0 0 var(--accent);`
- **`&__caption`:**
  - `font-family: var(--font-ui); font-size: var(--text-sm); letter-spacing: normal;`

- [ ] **Step 6: Section styles (`sections.scss`)**

**`.home-section`:**
- `border-top: 1px solid var(--rule);`
- delete the `&__eyebrow` and `&__sheet` blocks.
- `&__title`:

```scss
  &__title {
    max-width: 24ch;
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(var(--text-xl), 3vw, 2.25rem);
    line-height: var(--lh-xl);
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
```

- `&__subhead`: `font-size: var(--text-lg);`.

**`.problem-list`:**
- remove `counter-reset`, `counter-increment` and the `&::before` block;
- the list gets `padding-top: var(--space-5); border-top: 1px solid var(--rule);`;
- `> li` loses its `padding-top` and `border-top` and keeps `font-size: var(--text-md); line-height: var(--lh-md); color: var(--ink-muted);`;
- `strong`: `font-family: var(--font-display); font-weight: 700; font-size: var(--text-xl); letter-spacing: -0.01em;`.

**Curriculum:** replace the whole `.curriculum-list { … }` block with:

```scss
/* Five stops on one line, in pipeline order. The line runs down instead below 768px. */
.pipeline {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;
  &::before {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    top: 6px;
    border-top: 1px solid var(--rule);
  }
  &__stop {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-6);
  }
  &__dot {
    position: absolute;
    top: 0;
    left: 0;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 1px solid var(--ink-faint);
    background: var(--paper);
  }
  &__name {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 700;
    line-height: var(--lh-xl);
    letter-spacing: -0.01em;
  }
  &__summary {
    margin: 0;
    font-size: var(--text-md);
    line-height: var(--lh-md);
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
      padding: 0.1em 0.4em;
      border: 1px solid var(--rule);
      border-radius: var(--radius-s);
      background: var(--code-bg);
      color: var(--code-ink);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }
  }
}

@media (max-width: 767px) {
  .pipeline {
    grid-template-columns: minmax(0, 1fr);
    &::before { left: 6px; right: auto; top: 6px; bottom: 6px; border-top: 0; border-left: 1px solid var(--rule); }
    &__stop { padding: 0 0 0 var(--space-6); }
  }
}
```

**`.mode-list`:**
- `> div` loses its left border and padding;
- `dt` becomes `font-family: var(--font-ui); font-weight: 700; letter-spacing: normal; text-transform: none;`;
- `dd` keeps its rule.

**Under the hood:** replace `.hood-list { … }` and `.hood-stack { … }` with:

```scss
.hood {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--space-7);
}

.hood-list {
  display: grid;
  gap: var(--space-5);
  margin: 0;
  dt {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: var(--lh-lg);
  }
  dd {
    margin: var(--space-2) 0 0;
    font-size: var(--text-md);
    line-height: var(--lh-md);
    color: var(--ink-muted);
  }
}

.hood-stack {
  margin: 0;
  padding: 0 0 0 var(--space-5);
  border-left: 1px solid var(--rule);
  list-style: none;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 2;
  color: var(--ink-muted);
}
```

**`.team-list`:**
- `> div` becomes `border-top: 1px solid var(--rule);`;
- `dt`: `font-weight: 700;`;
- `dd`: `font-family: var(--font-ui); font-size: var(--text-sm); letter-spacing: normal;`.

**`.try-url`:** `border-bottom: 1px solid var(--rule);`.

**`.try-presets`:**
- `font-family: var(--font-ui);`;
- delete the `li + li::before` block and give `&__list` `gap: 0.4rem var(--space-5);`.

**The 900px media query:**
- replace `.hood-list` with `.hood` in the one-column list;
- delete the `.curriculum-list` block in it.

- [ ] **Step 7: Stage mode (`home-stage.scss`)**

At 720p one rem is 15.84px, so body copy needs at least 1.3rem to reach 20px.

**Delete:**
- the `.home__eyebrow, .home-section__eyebrow` rule;
- the `.home__eyebrow` line inside the `max-aspect-ratio` block;
- the `.problem-list > li::before` line.

**Change:**
- `.home__lede, .home-section__subhead` → `font-size: 1.3rem; line-height: 1.5;`
- `.problem-list > li` → `font-size: 1.3rem; line-height: 1.5;`
- `.mode-list dd` → `font-size: 1.3rem;`
- `.hood-list dd` → `font-size: 1.3rem;`
- `.team-list dd` → `font-size: 1.3rem;`
- `.try-note` → `font-size: 1.3rem;`

**Replace the five `.curriculum-list…` lines with:**

```scss
  .pipeline { gap: var(--space-4); }
  .pipeline__stop { gap: var(--space-2); }
  .pipeline__name { font-size: 1.625rem; }
  .pipeline__summary { font-size: 1.3rem; line-height: 1.4; }
  .pipeline__calls code { font-size: 0.875rem; }
```

**Section comments:** renumber the slide comments (`/* 02 Problem */` and the rest) to plain names (`/* Problem */`), so the stylesheet no longer suggests numbered labels.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/black-box/home-stage.test.ts`
Expected: PASS.

Run: `npx playwright test tests/visual/home.spec.ts`
Expected: VIS-HOME-01 passes. If a selector is under 20px, raise that rule in the stage block, not the base styles.

- [ ] **Step 9: Look at it**

Start `npx vite --port 5173 --strictPort`. Check `/` at 1440, 1024, 768 and 390 wide, in both themes:
- The pipeline is a horizontal line of five dots at 768 and wider, and runs vertically below that.
- No orange remains.
- The accent appears only on "program.", the CTA buttons, the code highlight and focus rings.

Then check `/?stage` at 1280 × 720 and step through every slide with the arrow keys. Nothing should overflow a slide. Stop the server by its PID.

- [ ] **Step 10: Full checks and commit**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/pages/home src/app/styles/site-page.scss src/widgets/site-header/ui/site-header.scss src/widgets/site-footer/ui/site-footer.scss tests/black-box/home-stage.test.ts tests/visual/home.spec.ts
git diff --staged --stat
git commit -m "feat(home): flat Ink + Cobalt landing page with a pipeline curriculum"
```

Delivery step 2 is complete here, with a target of 2026-10-15.

---

### Task 6: Visual suite, design review, roadmap, merge

**Files:**
- Modify: `tests/visual/editor.spec.ts`, `docs/specs/2026-10-04-website-overhaul-roadmap.md`

- [ ] **Step 1: Rename the editor visual themes**

In `tests/visual/editor.spec.ts`:
- `type Theme = 'light' | 'dark';`, with the default parameter `'light'`;
- every `'blueprint'` argument becomes `'dark'`;
- each screenshot name and test title swaps `vellum` for `light` and `blueprint` for `dark`. For example, `VIS-EDITOR-01: Transforms scene, light, 1280` with `transforms-light-1280.png`.

The IDs stay the same.

- [ ] **Step 2: Regenerate the local baselines**

```bash
rm -f tests/visual/baseline.local/*vellum* tests/visual/baseline.local/*blueprint*
npx playwright test --update-snapshots
npx playwright test
```

Expected: the second run passes. Open the new baselines and check:
- the editor in both themes: wordmark, fonts, neutral panels, and a cobalt selection outline on the canvas;
- the lesson column.

The baselines stay local; `*.local` is ignored.

- [ ] **Step 3: Design review**

- Run the design anti-pattern detector over the changed stylesheets and components, and confirm it reports no new findings.
- Run a design critique of the landing page in both themes and fix every P0 or P1 finding before merge. Fixes are committed as `fix(home): …` or `fix(design): …`, with lint, build and test passing.
- Confirm BB-SITE-23 still passes. It is the contrast check for every token pair.

- [ ] **Step 4: Roadmap status**

In `docs/specs/2026-10-04-website-overhaul-roadmap.md`, change item 5's status to:

`Complete (2026-10-15): [spec](2026-10-07-visual-identity-design.md), [plan](../plans/2026-10-07-visual-identity.md)`

Use the actual completion date.

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add tests/visual/editor.spec.ts docs/specs/2026-10-04-website-overhaul-roadmap.md
git diff --staged
git commit -m "test(visual): light and dark editor baselines; mark the visual identity complete"
```

- [ ] **Step 5: Merge**

```bash
git checkout main
git merge --no-ff feat/visual-identity -m "Merge branch 'feat/visual-identity'"
npm run lint && npm run build && npm test
git checkout -- tests/reports
git branch -d feat/visual-identity
```

Pushing to `origin` is the owner's call. Ask before pushing.
