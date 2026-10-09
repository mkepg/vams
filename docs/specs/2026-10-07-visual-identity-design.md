# Visual identity: Ink + Cobalt — design

Date: 2026-10-07
Roadmap item: 5 (Must). It also replaces the "Visual direction", "Themes" and "Logo" rows of the shared decisions
Branch: `feat/visual-identity`

## 1. Purpose

The Drafting Vellum identity from SP1 did not work in the editor. A design review of `/app` found these problems:

- One screen renders about 20 font sizes. The stylesheets hold 64 distinct `font-size` values.
- Three accents compete: safety orange, navy fill and the canvas's web blue.
- Bold, letter-spaced, uppercase mono panel headers shout at the same weight.
- Panels nest boxes four levels deep.
- The black canvas sits against beige paper.

The owner compared the build with the editor from before the overhaul and preferred the old one. Measured side by side, the old one was not larger or simpler. It was calmer: neutral greys, one accent, one UI font and quiet headers.

This sub-project replaces the identity across the whole site with a flat, neat direction called **Ink + Cobalt**. It takes its discipline from the owner's own site, Marey (<https://marey.netlify.app/>):

- one flat surface per theme;
- panes separated by 1px lines, with no cards;
- one accent, used only where something is active;
- one sans and one mono font;
- sentence-case labels.

The pre-overhaul pixel wordmark returns as the logo.

The visual language and its shared foundation come first: tokens, fonts, themes and the wordmark, followed by the landing page. **Editor layout and components are a separate sub-project.** That covers the section menu, the lessons button, panel structure and the editor review's layout findings, specified after the owner has discussed it. Here the editor changes only in what flows from the shared tokens, plus the wordmark in its top bar.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Direction | Ink + Cobalt. Neutral blue-black or cool white, with one cobalt accent. The owner chose it from three directions rendered on the real site (Graphite + Yellow, Ink + Cobalt, Carbon + Cyan) |
| Fonts | Bricolage Grotesque (variable) for UI text and headlines. JetBrains Mono (variable) for code and numeric readouts. Both are SIL Open Font License and self-hosted through `@fontsource-variable` packages |
| Logo | The pixel wordmark: "VAMS" in Minecrafter, yellow with a black outline and a cyan offset shadow. It is used everywhere a logo appears: site header, editor top bar, footer, loading screen, favicon and app icons. The triangle vertex mark is retired. The owner confirms that Minecrafter is free to use |
| Themes | Two: `dark` and `light`. A first visit follows the operating system's `prefers-color-scheme`. The theme toggle overrides it and is remembered. Site and editor share the choice, as before |
| Accent rule | The accent marks only what is active or selected. Section 3.3 lists the exact uses |
| Shape | One radius, 3px. Shadows appear only on layers that float above the page: menus, dialogs and toasts |
| Labels | Sentence case everywhere. No uppercase letter-spaced labels and no numbered section labels |
| Texture | No grid paper on page backgrounds. Graph paper stays only inside the two landing figures that show a coordinate plane |

## 3. Tokens

All values live in `src/shared/styles/_tokens.scss`, as now. The `:root` block holds the light theme and `[data-theme='dark']` overrides it.

### 3.1 Palette

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--paper` | `#121419` | `#f7f8fa` | Page and pane background |
| `--paper-raised` | `#191c22` | `#fcfcfd` | Floating layers, selected-free raised areas |
| `--paper-sunken` | `#0e1014` | `#eef0f3` | Code, inputs, wells |
| `--rule` / `--hairline` | `#262a33` | `#dadde3` | Every divider and border |
| `--ink` | `#e6e8ec` | `#141821` | Primary text |
| `--ink-muted` | `#a3a9b5` | `#4f5665` | Secondary text |
| `--ink-faint` | `#8b92a0` | `#656c7b` | Tertiary text. Still at least 4.5:1 on `--paper` |
| `--accent` | `#4762f5` | `#2f4de0` | Accent fills (primary button, selection marks) |
| `--on-accent` | `#ffffff` | `#ffffff` | Text on accent fills |
| `--accent-text` | `#93a6ff` | `#2f4de0` | Accent used as text or a thin line on `--paper` |
| `--accent-tint` | `rgba(71, 98, 245, 0.16)` | `rgba(47, 77, 224, 0.10)` | Selected-row and focus-panel backgrounds |
| `--focus-ring` | `#93a6ff` | `#2f4de0` | Focus outlines |

The success, danger and warning tokens keep their meaning, retuned to sit on the new surfaces at AA contrast. The colour-channel tokens (`--channel-r/g/b`) and the canvas axis colours are unchanged.

### 3.2 Legacy tokens

The editor still reads the pre-SP1 names: `--bg-*-rgb`, `--accent-blue-*`, `--text-main/muted/dim`, `--border-rgb`, `--code-content` and `--gl-fn`. They stay, but they now point at the new palette.

The `--accent-blue-*` family maps to **neutral ink**, not to the accent. Rendering the three candidate directions showed that most of the editor's visual noise came from these tokens tinting cards, chips and readouts. Mapping them to neutrals keeps the accent rare without touching editor components.

Removing the legacy names belongs to the editor sub-project.

### 3.3 Accent uses

The accent appears only on:
- the primary button of a view (one per view);
- focus rings;
- the selected item in a list, tree or tile group;
- a value being scrubbed;
- the lesson's focused panel;
- links in running text;
- the canvas selection outline.

Headlines may colour one word with `--accent-text`, at most one per page: the hero's "program.".

### 3.4 Type

UI text sizes move onto a fixed scale. The minimum rendered size anywhere is 11px.

| Token | Size / line | Use |
| --- | --- | --- |
| `--text-xs` | 11px / 1.4 | Captions, table headers |
| `--text-sm` | 12px / 1.45 | Secondary labels |
| `--text-base` | 13px / 1.5 | Editor UI text, panel headers (weight 600) |
| `--text-md` | 15px / 1.55 | Site body, lesson narration |
| `--text-lg` | 18px / 1.5 | Site lede |
| `--text-xl` | 24px / 1.2 | Site section headings (weight 700, tracking -0.02em) |
| `--text-2xl` | 40–64px fluid / 1.05 | Landing hero (weight 700, tracking -0.03em) |

Code uses JetBrains Mono at 13px / 1.6 in the editor. The current 12.5px is the browser's default monospace, because `.code-content pre` never sets a family; that is fixed here.

This sub-project introduces the scale and applies it to site pages, the shared logo and the code font. Moving the editor's 64 hard-coded sizes onto the scale is part of the editor sub-project.

## 4. Theme mechanics

- `SiteTheme` becomes `'dark' | 'light'`, and the selector becomes `[data-theme='dark']`.
- **Stored values migrate on read.** `'blueprint'` becomes `'dark'` and `'vellum'` becomes `'light'`, then the result is written back under the same key, `vams-theme`.
- **With no stored value, the theme follows `prefers-color-scheme`.**
  - The inline pre-paint script in `index.html` applies the same logic before first paint, so the page never flashes the wrong theme.
  - While no choice is stored, a change to the OS setting is followed live.
- **The toggle stores an explicit choice.** From then on the OS setting is ignored.
- **The editor store keeps its `'dark' | 'light'` field.** `toEditorTheme` becomes the identity. The persisted store stays at version 7, and `.vams` files are unchanged.
- **Browser and app metadata follow the theme.** `theme-color` meta tags are emitted per scheme. The PWA manifest's `theme_color` and `background_color` take the light values, as the manifest allows only one.

## 5. Wordmark

- **Component:** `shared/ui/logo` renders the word "VAMS" as text in Minecrafter. The style is the pre-overhaul one:
  - italic, with 0.08em tracking;
  - yellow fill `#fcee0a` and a 1.5px black outline;
  - a 3px cyan (`#00f0ff`) offset shadow.

  In the dark theme it also gets a soft cyan glow, as before.
- **Accessible name:** the link's accessible name stays "VAMS home" on site pages, and the text itself is "VAMS".
- **Font file:** `public/fonts/Minecrafter.ttf` is restored from history (commit `f8e18ab^`) and preloaded on every route, because the wordmark is in every header. A fallback size adjustment keeps the header from shifting if the font loads late.
- **Hover:** the pre-overhaul glitch animation on hover returns. It is off under `prefers-reduced-motion`.
- **Icons:**
  - The favicon becomes an SVG of the pixel "V" in the wordmark colours. The glyph outline is extracted from the font, not hand-drawn.
  - The PWA icons, the Apple touch icon and the default Open Graph image are regenerated from the new mark and palette.

## 6. Landing page

The content, routes, section ids and stage mode keep their behaviour. The changes are visual, plus punctuation in visible copy.

- **Header:** wordmark on the left; theme toggle and "Open the app" on the right. The button is flat, with an accent fill and no offset shadow.
- **Hero:** the headline is in Bricolage, weight 700, and "program." is coloured with `--accent-text`, not italic. The eyebrow above it is removed. The figure keeps its graph-paper plane and leader line, recoloured to ink and accent.
- **Section labels:** every numbered label (`02 The problem` and the rest) is removed. The headline alone heads each section.
- **Problem:** three statements stay in three columns, divided by a single top rule, without cards.
- **One scene, three views:** unchanged apart from tokens. It is the page's centrepiece and keeps its graph-paper canvas.
- **Curriculum:** the five boxed columns become a horizontal pipeline. Five stops sit on one connecting line, each with its name, one line of description and its GL calls. Below 768px they stack vertically, with the line running down. The Author and Lesson notes become two plain lines, without accent side bars.
- **Under the hood:** the three bordered cards become a two-column list. Claims are on the left; the stack list is on the right, with line breaks instead of separator dots.
- **Team and Try it:** unchanged apart from tokens, with flat buttons.
- **Copy:** visible em dashes and decorative middots are replaced with periods, commas or line breaks. The wording otherwise stays.
- **Stage mode:** inherits all of the above. Slide sizes are checked for projector legibility, with body text at 20px or more at 1280 × 720.

## 7. Editor (token-driven only)

What changes in the editor here:
- every colour and font that flows from the tokens;
- the code panel font (section 3.4);
- the wordmark in the top bar;
- the canvas selection outline, which reads `--accent` instead of its hard-coded `0x0099ff`.

Nothing else is restyled, moved or renamed. The canvas stays black: the clear colour is scene state and changing it would change the generated code.

The editor sub-project takes the rest of the review's findings, together with the owner's topics:
- the lessons button;
- the pipeline sections and section menu;
- the type scale inside panels;
- one selection style;
- one container level;
- code wrapping;
- the primitive grid.

## 8. Testing

- **Unit:**
  - theme resolution: stored value, legacy migration, OS fallback, OS change followed only while unset, toggle stores a choice;
  - the wordmark's text and accessible name;
  - the pre-paint script's logic, run as the same function.
- **Existing tests that name `vellum`, `blueprint` or the vertex mark are updated:** `tests/black-box/site-shell.test.ts`, `tests/black-box/editor-shell.test.ts` and `tests/visual/editor.spec.ts`. Their IDs stay stable.
- **Visual:** the local baselines in `tests/visual/baseline.local` are regenerated after this lands. The VIS-EDITOR tests rename their theme labels from vellum and blueprint to light and dark.
- **Design checks:**
  - the Impeccable detector shows no new findings on changed files;
  - a contrast check confirms every token pair in section 3.1 at AA;
  - a design critique of the landing page is run before merge.
- **Before every commit:** `npm run lint`, `npm run build` and `npm test` pass.

## 9. Roadmap and divergences

- **Shared decisions table:** the roadmap's "Visual direction", "Themes" and "Logo" rows are replaced with this spec's choices.
- **New row:** the editor sub-project joins the priority list as an editor-touching item due by 2026-10-28.
- **Divergence 3** (Figures 10–15 show the old interface) is updated. The pixel wordmark matches the figures again; the rest of the interface still differs.

## 10. Delivery

Each step is complete and shippable on its own:

1. Tokens, fonts, themes with OS default and migration, wordmark, icons. Site and editor both move to Ink + Cobalt. Target: 2026-10-10.
2. Landing page restyle and stage-mode check. Target: 2026-10-15.

The editor sub-project's design discussion can start in parallel with step 1.

## 11. Out of scope

- Editor layout, components, the lessons button, the section menu and the panel type scale (the editor sub-project).
- New landing content or sections, and the About, Learn and Guide pages.
- Any change to lessons, the code generator or the persisted store.

## 12. Amendment, 2026-10-10: Cobalt mist, ink chrome and the ink plate

After the identity shipped, the owner found three problems. The light theme read as one bare white sheet. The top bar blended into the editor. The yellow wordmark was weak on light paper. The owner chose each fix below from rendered options, and an Impeccable critique of the ink bar tuned the values. This section replaces the palette values in 3.1, and it adds to section 5.

### 12.1 Cobalt mist surfaces

Every neutral leans toward the cobalt accent, so both themes carry colour without adding a second hue.

| Token | Dark | Light |
| --- | --- | --- |
| `--paper` | `#10141f` | `#e9edf6` |
| `--paper-raised` | `#171d2b` | `#f6f8fd` |
| `--paper-sunken` | `#0b0e16` | `#dde3f0` |
| `--rule` / `--hairline` | `#29324a` | `#c6cfe2` |
| `--rule-strong` (new) | `#36415e` | `#aeb9d1` |
| `--ink` | `#e4e8f2` | `#121827` |
| `--ink-muted` | `#a2abc2` | `#47506a` |
| `--ink-faint` | `#8a93ab` | `#535c76` |
| `--accent-text`, `--focus-ring` | `#9cadff` | `#2f4de0` |
| `--accent-tint` | `rgba(71, 98, 245, 0.20)` | `rgba(47, 77, 224, 0.12)` |
| `--code-bg` | `#171d2b` | `#f6f8fd` |

`--ink-faint` is darker than the first mist proposal, which measured 4.4:1 on the sunken surface. Every text token still reaches 4.5:1 on every surface, and BB-SITE-23 checks this.

### 12.2 Ink chrome

The editor top bar and the site header are a dark ink bar in both themes:
- `--chrome` is `#1a2238` in light and `#080b12` in dark.
- The `ink-chrome` mixin in `_tokens.scss` maps the page tokens onto the bar's own set, so every control inside draws itself for the dark bar unchanged.

| Token | Value | Use |
| --- | --- | --- |
| `--chrome-raised` | `#212a42` | Buttons on the bar |
| `--chrome-hover` | `#252e48` | Hover, lighter than the bar |
| `--chrome-line` | `#6b7591` | Button and toggle borders, at least 3:1 on the bar |
| `--chrome-sep` | `#3a4563` | The separator in the editor bar |
| `--chrome-lip` | `#34405f` | A 1px inset line along the bar's bottom edge. It separates the bar from the black canvas and disappears over the light columns |
| `--chrome-ink` / `--chrome-muted` / `--chrome-faint` | `#e4e8f2` / `#a2abc2` / `#959eb5` | Text and icons, at least 4.5:1 on the bar and its hover |
| `--chrome-accent` / `--chrome-accent-text` | `#4762f5` / `#9cadff` | The bar's accent in both themes, so "Open the app" is the same button in both |

The site header is 56px tall (10px vertical padding), and the editor bar stays 44px. Menus that open from the bar inherit the bar's colours. The browser `theme-color` and the PWA theme colour follow the bar. BB-SITE-27 checks the bar's contrast and that both bars use the mixin.

### 12.3 Other separations

- The Scene title and the Math & data header are header strips on `--paper-sunken`.
- The code panel sits on `--code-bg`, the brightest surface. The math panel below it sits on `--paper`, under a `--rule-strong` line.
- The inspector groups are raised cards on the page.

### 12.4 Wordmark on ink

The wordmark is unchanged, and it always sits on ink:
- On the bar, it carries a soft cyan glow (`--chrome-glow`) in both themes.
- On light paper (the editor loading screen and the footer), `<Logo plate />` sets it on an ink plate in the bar's colour, with the same lip.
- Dark pages need no plate.

BB-SITE-28 checks this.
