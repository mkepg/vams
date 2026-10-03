# Site Shell and Design Foundation — Design

**Date:** 2026-10-04
**Status:** Approved
**Scope:** The first piece of the VAMS website overhaul. It turns the single editor screen into a routed, prerendered site, introduces the "Drafting Vellum" design system, and reskins the existing editor onto it without changing its layout or behaviour.

## Context

VAMS is deployed as a single Preact screen: `index.html` mounts the editor directly, so the public URL opens straight into a dense authoring tool. The overhaul adds a landing page, content pages, and a visual redesign. Those later pieces all need the same foundation: routing, prerendered pages that search engines and link previews can read, a token-based design system with two themes, and a new identity. This spec covers that foundation.

Later work builds on it and is out of scope here: the landing page content and presentation mode, deep links and offline support, the editor layout redesign, the Learn and Guide pages, and the About page.

## Goals

1. Serve the editor at `/app` and the site at `/`, with the editor's code downloaded only when `/app` is opened.
2. Prerender every content route to static HTML with per-page title, description, canonical URL and preview tags, plus `sitemap.xml`, `robots.txt` and structured data.
3. Define the Drafting Vellum design tokens with two themes: **vellum** (light, the default) and **blueprint** (dark).
4. Reskin the editor onto the new tokens by reassigning its existing CSS variables. No component markup or layout changes beyond the logo.
5. Replace the pixel wordmark with the vertex-mark logo across the site, the editor and the favicon.
6. Meet a WCAG 2.2 AA baseline on everything this work touches.
7. Keep all existing tests green, and keep generated code byte-for-byte identical.

## Non-goals

- Editor layout, panel or behaviour changes.
- Landing page content beyond a minimal real home page.
- Learn, Guide and About pages. Their routes are added when their content exists.
- Changing the scene's canvas background. It is scene state: it defaults to `#000000` and is emitted as `glClearColor`.
- Changing the canvas text font (Comfortaa).

## 1. Structure and routing

**Router.** `preact-iso` (`LocationProvider`, `Router`, `Route`, `lazy`, `ErrorBoundary`). `src/app/main.tsx` hydrates a new `SiteApp` component and exports a `prerender()` function for the build.

**Routes in this work**

| Path | Component | Prerendered | Indexed |
| --- | --- | --- | --- |
| `/` | `pages/home` | Yes | Yes |
| `/app` | `pages/editor`: a lazily loaded wrapper around the existing editor shell | Yes, as an empty loading shell | No (`noindex`) |
| any other path | `pages/not-found` | Yes, as `/404` | No |

`/learn`, `/guide` and `/about` are added to the route table, sitemap and header together with their content in later work. A route exists only when its page is finished.

**Editor isolation.** `src/app/App.tsx` becomes `EditorApp`, and `pages/editor` imports it through `lazy()`. PixiJS, the Zustand store and all editor features therefore land in a separate chunk that the home page never requests. Prerendering never imports the editor chunk, so editor modules may touch `window`, `document` and `localStorage` at import time as they do today.

**Static output and hosting.** The build emits `dist/index.html`, `dist/app/index.html` and `dist/404.html`. Netlify serves directories directly, so a refresh or deep link at `/app?…` receives the `/app` shell, whose client code boots the editor. `public/_redirects` maps unknown paths to `/404.html` with status 404. `public/_headers` gives `/fonts/*` and hashed `/assets/*` a one-year immutable cache.

**SEO output.** Each route declares its metadata (title, description, canonical path, indexability) in one route table. The prerender step writes the per-page `<title>`, `<meta name="description">`, `<link rel="canonical">` and Open Graph / Twitter tags. `/` also carries JSON-LD of type `SoftwareApplication` (`applicationCategory: EducationalApplication`, `operatingSystem: Web`). A build step writes `sitemap.xml` (indexed routes only) and `robots.txt` (allow all, sitemap link). Absolute URLs use `VITE_SITE_URL`, which defaults to `https://panic-vams.netlify.app` until a custom domain is configured. Switching domains is then a one-variable change.

**Preview image.** One static 1200×630 PNG in `public/og/` (the vertex mark on vellum grid paper with the tagline) for every page in this work. Per-page images come later with their pages.

**Folder layout (Feature-Sliced Design)**

```
src/app/            SiteApp, route table, main.tsx (hydrate + prerender), EditorApp, global styles
src/pages/          home/, editor/, not-found/          ← new layer, between app and widgets
src/widgets/        site-header/, site-footer/          ← new; existing editor widgets unchanged
src/shared/ui/      logo/                               ← vertex mark + wordmark
src/shared/lib/     theme/                              ← theme source of truth (section 2)
```

**Header and footer.** `site-header`: the logo linking to `/`, links to finished pages (in this work, none besides Home), the theme toggle, and an "Open the app" call to action. `site-footer`: project line, authors, institution, repository link, licence. Both are used on content pages only. The editor keeps its own top bar, where the old wordmark becomes the vertex-mark logo, linking to `/`.

**Home page (minimal, real).** Headline, a short description of what VAMS does, the three synchronised views named in one line each, and the "Open the app" call to action. All copy follows the student-facing language rules in `AGENTS.md`. The full landing page replaces it later.

## 2. Design tokens and the editor reskin

**Typography.** Three self-hosted families, all SIL Open Font License, shipped as WOFF2 in `public/fonts/` with their licence files and loaded with `font-display: swap`:

| Token | Family | Use |
| --- | --- | --- |
| `--font-display` | Newsreader | Headlines, long-form prose on content pages |
| `--font-ui` | Chivo | Interface text, controls, dense editor UI |
| `--font-mono` | Chivo Mono | Code, labels, coordinates, data |

Chivo and Chivo Mono share a design family, so interface text and code read as one system. Minecrafter is removed. Comfortaa stays, because the canvas draws text with it.

**Semantic tokens.** CSS custom properties on `:root` (vellum) and `[data-theme='blueprint']`. Starting values, which the contrast checks in section 3 may adjust:

| Token | Vellum | Blueprint | Role |
| --- | --- | --- | --- |
| `--paper` | `#f4f5f2` | `#0e2a4a` | Page background (cool grid white, not cream) |
| `--paper-raised` | `#ffffff` | `#13355b` | Panels, cards |
| `--paper-sunken` | `#e9ebe6` | `#0a2140` | Inputs, wells |
| `--ink` | `#1d2b4f` | `#e6eefb` | Primary text, strokes |
| `--ink-muted` | `#45557a` | `#b3c4e0` | Secondary text |
| `--ink-faint` | `#6b7898` | `#7f95ba` | Tertiary text, disabled (never for essential text) |
| `--rule` | `rgba(29,43,79,.22)` | `rgba(186,214,255,.24)` | Borders, dividers |
| `--grid-major` / `--grid-minor` | `rgba(29,43,79,.10)` / `.04` | `rgba(186,214,255,.10)` / `.04` | Grid-paper backgrounds |
| `--accent` | `#ff5a1f` | `#ff6a2b` | Safety orange: selection, connections from scene to code, the primary call to action |
| `--on-accent` | `#1a0d06` | `#1a0d06` | Text on accent fills |
| `--focus-ring` | `#ff5a1f` | `#ff8a55` | Keyboard focus outline |
| `--code-bg` / `--code-ink` | `#1d2b4f` / `#e6eefb` | `#0a2140` / `#e6eefb` | Code blocks on content pages |
| `--success` / `--danger` | `#15803d` / `#b91c1c` | `#4ade80` / `#f87171` | Status |

Scale tokens: a spacing scale (`--space-1` … `--space-8`, 4 px base), radii (`--radius-s` 2 px, `--radius-m` 4 px; drafting favours near-square corners), and a type scale with a 16 px base on content pages.

The accent is reserved for meaning: selection, scene-to-code connections, and the single primary action on a page. It is not used for decoration.

**Theme source of truth.** `shared/lib/theme` owns the active theme: localStorage key `vams-theme`, values `vellum | blueprint`, default `vellum`. It sets `data-theme` on `<html>`. An inline script in `index.html` applies the stored value before first paint, so pages don't flash the wrong theme. Both the site header toggle and the editor's existing theme button use this module.

The editor store's `theme` field and the `theme` field in `.vams` project files stay, for file compatibility. The store mirrors the shared theme (`blueprint` ↔ `'dark'`, `vellum` ↔ `'light'`) so saved projects keep recording it. Loading a project never changes the displayed theme. The persisted store shape and `version` are unchanged.

**Editor reskin by reassignment.** The editor's existing variables (`--bg-dark-rgb`, `--bg-panel-rgb`, `--bg-bar-rgb`, `--bg-input-rgb`, `--border-rgb`, `--text-main`, `--text-muted`, `--text-dim`, `--accent-blue-rgb`, `--accent-*-light`, `--bg-panel-hover`, `--border-highlight`, `--panel-tab`, `--keyword-fallback`, `--code-content`) are redefined in terms of the new palette for each theme, keeping their names and RGB-triplet format so existing `rgb(var(--…))` usages keep working. Interactive "blue" states map to ink, not orange, so the accent stays meaningful. `$font-mono` and the editor's UI font point at Chivo Mono and Chivo. `--logo-*` variables are removed together with the old logo styles. Old dark-default values move under `[data-theme='blueprint']`, and the light values become the defaults.

**Global styles.** `html { overflow: hidden; font-size: 13px }` and the full-viewport body rules move from global scope to the editor shell (`.app-container`), so content pages scroll and use the 16 px base. Base element resets stay global.

**Canvas.** The canvas area keeps rendering the scene exactly as today. Only the chrome around the canvas follows the theme.

**Logo.** `shared/ui/logo` renders the vertex mark as inline SVG: a `GL_TRIANGLES` outline with three vertex dots, the apex dot in `--accent`. It also renders the "VAMS" wordmark in Newsreader 600, with an optional tagline. Props select mark only, mark and wordmark, or with tagline. Colours come from tokens, so the logo follows the theme. `public/favicon.svg` becomes the mark on vellum. The README screenshots are refreshed separately, after the editor redesign.

## 3. Testing and verification

**Automated (Vitest, `tests/`)** in a new file `tests/black-box/site-shell.test.ts` with IDs `BB-SITE-NN`, covering:
- the route table: each route's metadata is complete, `/app` and `/404` are `noindex`, and only finished routes are listed;
- the sitemap and robots generators: indexed routes only, absolute URLs from `VITE_SITE_URL`;
- the theme module: default `vellum`, toggle persists to `vams-theme`, sets `data-theme` on `<html>`, ignores invalid stored values, and keeps the store's mirror in sync;
- the prerender function: `/` renders with its title, description, canonical URL and JSON-LD; unknown paths render the not-found page.

Existing persistence tests keep passing unchanged, since project files still carry `theme`. The code-generation and algorithm suites must produce identical output.

**Build checks.** `npm run build` produces `dist/index.html`, `dist/app/index.html`, `dist/404.html`, `dist/sitemap.xml` and `dist/robots.txt`. The home page's HTML contains its rendered content (not an empty root), and no PixiJS code is in the home page's initial chunk graph.

**Browser verification** with Chrome DevTools against `npm run preview`:
- `/` loads without requesting the editor chunk; navigating to `/app` loads it, and the editor works as before. Spot-check a primitive, a transform, a texture, a lesson and save/load.
- Refreshing `/app` and visiting an unknown path behave as specified.
- Lighthouse accessibility ≥ 95 on `/` in both themes, with no contrast failures. Keyboard: every interactive element on the site is reachable, visible focus everywhere, and a skip link on content pages.
- Both themes render correctly on `/` and `/app`, with no flash of the wrong theme on load.
- Prefers-reduced-motion: no motion in this work depends on animation.

**Browser floor.** Required layout and function must work in the browsers listed in the thesis manuscript (Chrome 99+, Firefox 101+, Edge 121+). Newer CSS features may add enhancements but must not be required.

**CI.** Lint, build and test pass on Node 20 and 22.

## Risks

| Risk | Mitigation |
| --- | --- |
| Hydration mismatch between prerendered HTML and the client | Prerender and client share one route table and component tree; the theme attribute is applied before hydration by the inline script |
| The editor reskin leaves unreadable combinations in places the variable mapping didn't anticipate | Visual pass over every editor section in both themes; contrast fixes stay in the token layer |
| Removing global `overflow: hidden` changes editor layout | The rules move to `.app-container` verbatim; visual check of the editor at common desktop sizes |
| Font files add weight | WOFF2, Latin subset, only the weights used (Newsreader 400/600 + 400 italic, Chivo 400/600, Chivo Mono 400/700) |

## Divergences from the thesis manuscript

The manuscript describes the evaluated build and is final. This work diverges from it in ways recorded here, not avoided:
- §3.4.2 describes "a single-page Preact application"; the site now has prerendered routes, though the editor itself remains single-page.
- §3.3.3 / Figure 5 describes launch as choosing a curriculum area; launch now opens the home page.
- Figures 10–15 show the previous visual design.
