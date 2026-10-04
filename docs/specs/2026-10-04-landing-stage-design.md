# Landing page and stage mode — design

Date: 2026-10-04
Status: approved in design review, pending spec review
Builds on: [2026-10-04-site-shell-design.md](2026-10-04-site-shell-design.md) (routing, prerender, Drafting Vellum tokens, theme module, logo, site header and footer)

## Purpose

The home page at `/` serves two audiences with one set of content:

1. **The CS Expo stage talk on 2026-11-04.** The presenter steps through the page on a projector as the talk (problem, product, evidence, team), then opens the live editor for the demo. The audience is expert.
2. **Students and visitors,** who scroll the same page to learn what VAMS is before opening the editor.

Stage mode is a presentation layer over the normal scroll page, not a second copy of the content. Students read exactly what was presented.

## Scope

In scope:

- Six new home-page sections after the existing hero: Problem, Three views + live mini-demo, Curriculum + modes, Under the hood, Team, and a Try it closing section (seven sections in total, counting the hero).
- An interactive vertex demo that runs VAMS's real code generator on the page, without PixiJS.
- Stage mode: full-viewport slides, projector-sized type, keyboard and presenter-clicker stepping, a slide indicator, entry by button, key or URL, and a final step into `/app`.
- The structured data on `/` names the team as authors.

Out of scope (later items on the overhaul list): QR code and share links, the About page, deep links into prepared demo scenes (SP3), speaker notes, and build-step reveals within a slide.

## Content

Copy below is the approved direction. The plan may tighten the wording, but not the claims. All copy follows the product's student-facing rules: it never uses "3D", "lighting", "coming soon", "not yet", "future", "deferred", "unsupported" or "not supported". Section names are exactly `Pipeline | Primitives | Buffers | Transforms | Textures`. No section cites study data from the evaluation.

Each section is a `<section>` with an `id` (used for anchors and the stage hash), an `aria-labelledby` heading, and a `data-slide` attribute.

1. **Hero** (`#top`, existing): "Every shape is a *program.*", the existing lede, `HeroFigure`, and "Open the app". Unchanged except for the `data-slide` attribute and stage-mode sizing.
2. **Problem** (`#problem`). Heading: "OpenGL is taught as code you can't see." Three points:
   - **Setup before shapes.** A compiler, a GLUT install and a build script stand between a student and their first triangle.
   - **Cause and effect, delayed.** Every change means edit, compile, run, then work out which line did what.
   - **The math stays hidden.** Coordinates, colour values and matrices are applied out of sight.
3. **Three views** (`#views`). Heading: "One scene, three views." Subhead: "Drag a vertex. The code and the math follow." The section shows the canvas, code and math views as three labelled parts of one interactive figure (see Vertex demo). Caption: "This is VAMS's own code generator, running on this page."
4. **Curriculum** (`#curriculum`). Heading: "Five sections, one pipeline." A numbered row of the five sections, each with a one-line description and its key calls:
   - **Pipeline:** the rendering pipeline, rasterization, normalized device coordinates and the GLUT program structure.
   - **Primitives:** `glBegin` / `glEnd` primitives, colour, line styles, bitmap text and GLUT callbacks.
   - **Buffers:** immediate mode, vertex arrays and VBOs, side by side.
   - **Transforms:** translate, rotate and scale, the matrix stack, and `glOrtho`.
   - **Textures:** texture objects, UV coordinates, filtering and wrapping.
   
   Below the row are the two modes. **Author** means you build freely and the code follows. **Lesson** means guided steps and exercises that check your scene.
5. **Under the hood** (`#under-the-hood`). Heading: "Built like the thing it teaches." Three blocks:
   - **One-way data flow.** Each action updates one store, and the canvas, code and math recompute from it. Views only read.
   - **Code is a pure function of the scene.** The same scene always produces byte-identical C++.
   - **Verified.** More than 270 automated tests; the matrix math is checked against an independent reference implementation.
   
   Footer line: *Preact · TypeScript · Zustand + Immer · PixiJS 8 · Vitest*.
6. **Team** (`#team`). Heading: "Panic@TheCisco." Subline: "BS Computer Science, Software Engineering · FEU Institute of Technology." Credits, names only, no links or photos:

   | Name | Credit |
   | --- | --- |
   | Mikhael Edman P. Gomez | Primary Developer & Designer · Research & Documentation |
   | Justine Jhigz D. Vizco | Thesis Leader · Research, Documentation & QA |
   | Johann Patrick S. Taguiam | Research, Documentation & QA |
   | Elisa V. Malasaga | Thesis Adviser |

7. **Try it** (`#try`). A large "Open the app" link to `/app`, the site URL in mono, and one line: "Runs in your desktop browser. Nothing to install."

## Vertex demo

The demo is an SVG figure in the Views section. It has three parts, laid out side by side on wide screens and stacked on narrow ones:

- **Canvas:** a triangle on grid paper with three draggable vertex handles. The `glOrtho(-1, 1, -1, 1)` axes are drawn and labelled.
- **Code:** the `glBegin(GL_TRIANGLES)` … `glEnd()` block from the generated program, with the selected vertex's `glVertex2f` line highlighted. An orange leader line runs from the selected vertex to its code line on wide screens.
- **Math:** for the selected vertex, the mapping from the figure's pixel position to GL coordinates under the default projection: `x = 2·px / W − 1`, `y = 1 − 2·py / H`, with the numbers filled in.

Behaviour:

- **Pointer drag** moves a vertex. Positions clamp to the visible range [−1, 1] and snap to a 0.05 grid, so the code shows clean values.
- **Keyboard:** each handle is a focusable SVG element (`tabindex="0"`, `role="button"`) whose `aria-label` carries its position, for example "Vertex 1 at x 0.00, y 0.50". An `aria-describedby` hint reads "Arrow keys move the vertex." Arrow keys move the focused vertex by one grid step, and Shift+arrow by four. Focusing a handle selects it.
- **Initial triangle:** (−0.5, −0.5), (0.5, −0.5), (0, 0.5), with per-vertex colours red, green and blue, so the generated block includes `glColor3f` lines as the editor emits them.
- **Prerender:** the figure renders as static SVG and code with the initial triangle, and hydrates into the interactive version.

### `pages/home/model/demo-code.ts`

A pure module with no store, DOM or PixiJS imports.

- `buildDemoScene(vertices)` returns a one-object scene: a `TRIANGLES` `SceneNode` with the three vertices and per-vertex colours, and the default canvas settings.
- `generateDemoCode(vertices)` calls `generateAppOutput` from `features/code-generation` on that scene. It returns `{ lines: string[]; vertexLineIndexes: [number, number, number] }`, where `lines` is the `glBegin` … `glEnd` block and the indexes point at the three `glVertex2f` lines.
- `pixelToGl(px, py, width, height)` and `glToPixel(x, y, width, height)` implement the mapping shown in the math part.

The block must be extracted from the real generator output, never re-implemented. That is the claim the caption makes.

**Failure:** if generation throws or the block can't be found, the demo shows the static initial snippet and the figure stays draggable. The stage must never show an empty panel.

## Stage mode

### Entering and leaving

| Action | Effect |
| --- | --- |
| "Present" button (site footer, home page only) | Enter stage mode at the current section |
| `P` key | Enter stage mode at the current section |
| Opening `/?stage` (optionally with a section hash, e.g. `/?stage#curriculum`) | Start in stage mode at that section, or at the hero |
| `Esc` | Leave stage mode, staying scrolled to the current section |

While stage mode is on, the URL carries `?stage` and the current section's hash, updated with `history.replaceState`. Reloading during a rehearsal returns to the same slide.

### Keys

| Key | Action |
| --- | --- |
| `→`, `↓`, `PageDown`, `Space` | Next slide |
| `←`, `↑`, `PageUp`, `Shift+Space` | Previous slide |
| `Home` / `End` | First / last slide |
| `Enter` or next on the last slide | Navigate to `/app` (client-side). `Enter` acts only when focus is not on a link, button or vertex handle. |
| `T` | Toggle theme (calls the theme module's `toggleTheme`) |
| `F` | Toggle fullscreen (`requestFullscreen` on `<html>`; ignored if unavailable) |

Keys are ignored when:

- focus is in a text input, textarea, select or contenteditable element;
- a modifier other than Shift is held.

When a vertex handle has focus, the arrow keys move the vertex and do not change slides. `PageUp`, `PageDown` and `Space` still change slides, and those are what presenter clickers send.

### Presentation

- `html.stage` is set while stage mode is on, alongside the existing theme attribute. The early inline script in `index.html` adds `stage` when the URL has a `stage` parameter on `/`, so a stage load never flashes the scroll layout.
- In stage mode:
  - every `[data-slide]` section is exactly one viewport tall and centres its content;
  - the site header and footer are hidden;
  - type sizes switch to viewport-height-based stage sizes (display headings about 7–9vh, body about 2.6–3vh, code about 2.2vh);
  - the grid background stays.
- Stepping scrolls the target section into view: smooth under `prefers-reduced-motion: no-preference`, instant otherwise. Mouse-wheel and touch scrolling still work. The current slide is the one whose top is nearest the viewport top after scrolling settles.
- A slide indicator ("03 / 07"), styled as a dimension label, sits in the bottom-right corner while stage mode is on. It is `aria-live="polite"` and announces the slide heading.
- Target projector resolutions: 1920×1080 and 1280×720. 1024×768 (4:3) must still fit every slide without overflow.
- Stage mode follows the active theme (vellum or blueprint). The presenter picks a theme on the day; there is no stage-only palette.
- Leaving `/` removes `html.stage` (effect cleanup), so the editor never inherits it.

### `features/stage-mode/`

- **`model/stage-controller.ts`:** pure logic, testable without a DOM.
  - `nextIndex(current, count)`, `prevIndex(current)` and `keyToAction(event, context)`.
  - `keyToAction` maps a key event and focus context to `'next' | 'prev' | 'first' | 'last' | 'exit' | 'enter-app' | 'theme' | 'fullscreen' | null`.
  - `readStageFromUrl(search, hash)`.
- **`model/useStageMode.ts`:** a hook that owns the `active` and `index` state.
  - It listens for keydown on `window` only while relevant, and enters on `P` even when inactive.
  - It drives scrolling, syncs `html.stage` and the URL, and tracks the current section with an `IntersectionObserver`.
  - It takes the list of section ids from the page.
- **`ui/StageIndicator.tsx`** and **`ui/PresentButton.tsx`**.
- **Public API (`index.ts`):** `useStageMode`, `StageIndicator`, `PresentButton`.

## Architecture

- **`pages/home/ui/HomePage.tsx`:** composes the sections from `pages/home/ui/sections/` (`HeroSection`, `ProblemSection`, `ViewsSection`, `CurriculumSection`, `UnderTheHoodSection`, `TeamSection`, `TryItSection`) and passes their ids to `useStageMode`.
- **`pages/home/ui/VertexDemo.tsx`:** the demo figure. It keeps the three vertices and the selected index in local state, and memoises `generateDemoCode(vertices)`.
- **Static data:** the section list, curriculum entries and team credits live in `pages/home/model/content.ts`, so tests can read them and the JSX stays lean.
- **Site footer:** the footer widget gains an optional slot or prop, used by the home page to show `PresentButton`. Other pages are unaffected.
- **SEO:** `src/app/seo/head.ts` adds an `author` array (`Person` entries for the three members) and `contributor` (the adviser) to the `SoftwareApplication` JSON-LD on `/`. That file keeps relative imports only.
- **Layering:** pages → features → shared, as AGENTS.md requires. `pages/home` importing `features/code-generation` and `features/stage-mode` is a downward import. No PixiJS module may be reachable from `/`'s chunk graph.
- **Styles:**
  - all colours come from `_tokens.scss`, and any new tokens are added there for both themes;
  - stage sizes are SCSS variables or tokens in the home styles;
  - text contrast is at least 4.5:1, and UI boundaries and focus are at least 3:1 with `--focus-ring`.

## Testing

New suite `tests/black-box/home-stage.test.ts`, IDs `BB-HOME-01` onward. Existing IDs stay unchanged.

- **Demo code:**
  - `generateDemoCode` on the initial triangle returns a block that starts with `glBegin(GL_TRIANGLES)` and ends with `glEnd()`.
  - The three indexed lines are the `glVertex2f` lines with the expected values.
  - The block appears verbatim in `generateAppOutput` output for the same scene. This is the "real generator" claim.
- **Demo math:**
  - `pixelToGl` / `glToPixel` round-trip.
  - Corners map to ±1.
  - Clamping and 0.05 snapping hold.
- **Controller:**
  - `keyToAction` covers every key in the table.
  - Keys are ignored in text inputs and with Ctrl, Alt or Meta held.
  - On a focused vertex handle, the arrow keys return `null` but `PageDown` returns `next`.
  - Index math clamps at both ends.
  - Next on the last slide gives `enter-app`.
  - `readStageFromUrl` handles `?stage`, `?stage#curriculum` and an unknown hash.
- **Prerender:**
  - The rendered `/` contains all seven section ids in order, all four team names, and the Under-the-hood stack line.
  - It contains none of the forbidden student-facing words.
- **Head:** the `/` JSON-LD includes the three authors and the adviser.

Browser verification (as in SP1, using headless Chrome):

- Lighthouse accessibility on `/` scores at least 95 in both themes, with no contrast failures.
- A keyboard-only pass through the scroll page and stage mode.
- Screenshots of every slide at 1920×1080 and 1280×720 in both themes, plus 1024×768 in vellum.
- No slide overflows.
- No PixiJS chunk is requested on `/`.
- `/?stage#curriculum` loads straight into stage mode on that slide, with no flash.
- Stepping past the last slide lands in a working editor.

## Risks

- **Generator coupling.** The demo depends on the generator's output format. If the format changes, the BB-HOME test that checks verbatim inclusion fails loudly. That is intended.
- **Generator bundle cost on `/`.** The code-generation model is pure TypeScript and should add little. The plan checks the `/` chunk size before and after and reports the difference.
- **Projector variance.** Contrast and size are checked at fixed resolutions. Rehearse on the real projector by Nov 3 (the list reserves that day).

## Manuscript divergences

No new divergences. The landing page replacing direct entry into the editor is already recorded as divergence 2 in the overhaul notes.
