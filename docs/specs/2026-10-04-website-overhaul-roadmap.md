# VAMS website overhaul — roadmap

Date: 2026-10-04
Deadline: CS Expo stage presentation, **2026-11-04**

This is the umbrella document for the overhaul. Each sub-project has its own design spec in `docs/specs/` and implementation plan in `docs/plans/`. This file records the goals, the decisions shared by every sub-project, the priority order, and where each sub-project stands.

## Goals

The live site (then <https://panic-vams.netlify.app/>, now <https://vams.pages.dev/>) used to open straight into the editor. No page presented the project, and help content was spread across the README, the help center and the welcome card.

The overhaul has three goals:

1. **Expo narrative.** At the CS Expo the site *is* the presentation. The presenter steps through the landing page as the talk (problem, product, evidence, team), then opens the live editor for the demo. The audience is expert, and the talk is on a projector.
2. **Student usefulness.** Students are the long-term daily users. The site should be easier to navigate and learn from.
3. **Visual redesign** across the whole site, editor included.

## Shared decisions

| Decision | Choice |
| --- | --- |
| Audience | Students day to day; the expert expo audience sets the priorities |
| Visual direction | **Ink + Cobalt** (replaced Drafting Vellum on 2026-10-07): flat neutral surfaces, 1px dividers, one cobalt accent used only for active and selected things. Type: Bricolage Grotesque (UI and headlines), JetBrains Mono (code). See [the visual identity spec](2026-10-07-visual-identity-design.md) |
| Themes | `dark` and `light`. A first visit follows the operating system; the toggle overrides it and is remembered. One choice is shared by the site and the editor |
| Logo | The pixel wordmark: "VAMS" in Minecrafter, yellow with a black outline and a cyan offset shadow. A pixel "V" is the favicon |
| Framework | Preact + Vite. preact-iso routing; the editor is lazy-loaded on `/app`; content pages are prerendered at build time with per-page metadata. Next.js was considered and rejected: migration risk before the expo, and no server needs at the time. Sharing later added one Pages Function and one KV namespace for shared scenes ([editor chrome and sharing](2026-10-16-editor-chrome-share-design.md)) |
| Pages | Home `/`, editor `/app`, About `/about`, Learn `/learn`, Guide `/guide`. The header links only finished pages |
| Accessibility | WCAG 2.2 AA in every sub-project |
| Analytics | None for now |
| Editor freeze | No large editor changes after **2026-10-28**, so a late regression cannot break the live demo |

The product rules in `AGENTS.md` and [docs/product-plan.md](../product-plan.md) still apply to every sub-project. Changing one needs the owner's approval and a written amendment to the product plan.

## Priority list

**The expo is the finish line.** Work runs top-down through one list, and whatever is complete by the deadline ships. Every shipped item must be complete: no half-built features and no dead navigation links.

- Editor-touching items land by the Oct 28 freeze.
- Items that don't touch the editor can land until Nov 2.
- Nov 3 is for rehearsal only.

### Must

| # | Item | Status |
| --- | --- | --- |
| 1 | **SP1 Site shell:** routing and prerendering, design tokens, editor reskin, logo, SEO extras, accessibility baseline, custom domain | Code complete, merged to `main` locally on 2026-10-04 ([spec](2026-10-04-site-shell-design.md), [plan](../plans/2026-10-04-site-shell.md)). Not yet deployed. Custom domain pending (owner to buy) |
| 2 | **SP2 Landing page and stage mode** | Complete (2026-10-04): [spec](2026-10-04-landing-stage-design.md), [plan](../plans/2026-10-04-landing-stage.md) |
| 3 | **SP3 Demo readiness:** lesson and scene links, My scenes library with backups, crash recovery screen, offline installable app | Complete (2026-10-06): [spec](2026-10-06-demo-readiness-design.md), [plan](../plans/2026-10-06-demo-readiness.md) |
| 4 | **SP5 Editor layout redesign:** a shared control set, then the top bar, left rail, canvas overlays, right sidebar, lesson bar and dialogs. Includes the lesson-narration and `focusPanel` updates the new layout forces. Due by Oct 28 | Complete (2026-10-06): [spec](2026-10-06-editor-redesign-design.md), [plan](../plans/2026-10-06-editor-redesign.md) |
| 5 | **Visual identity: Ink + Cobalt.** Tokens, fonts, themes, the pixel wordmark and the landing page restyle | Complete (2026-10-07): [spec](2026-10-07-visual-identity-design.md), [plan](../plans/2026-10-07-visual-identity.md) |
| 6 | **Editor refinement:** one editor with a pipeline-ordered inspector in every section, lessons as a guide card with fading focus, a Learn drawer with progress, and the editor review's layout findings. Due by Oct 28 | Complete (2026-10-09): [spec](2026-10-07-editor-refinement-design.md), [plan](../plans/2026-10-07-editor-refinement.md) |
| 7 | **About page** | Complete (2026-10-10): [spec](2026-10-10-about-page-design.md), [plan](../plans/2026-10-10-about-page.md) |

### Should

8. Shareable scene links and QR code. Complete (2026-10-17) with the editor chrome and sharing project
9. Example gallery of curated scenes
10. `/learn` page (replaces the SP4 Learn hub): the course map outside the editor, reusing the Learn drawer's course data and progress. By Nov 2. The Guide page follows it. Complete (2026-10-10): [spec](2026-10-10-learn-page-design.md), [plan](../plans/2026-10-10-learn-page.md)
11. Polish the demo lesson(s)
12. Screenshot regression checks, a safety net for SP5. Done with SP5 (`npm run test:visual`)
13. Functional callbacks: keyboard, mouse, motion, reshape and idle behaviours defined in the GUI, with generated handler bodies and a canvas Run mode that never writes scene state. Needs its own spec and a product plan amendment, since the plan specifies empty stubs. Touches the editor. Complete (2026-10-12): [spec](2026-10-12-functional-callbacks-design.md), [plan](../plans/2026-10-12-functional-callbacks.md)
- **Editor rail redesign:** a labelled rail of four panels (Add, Scene, Settings, Callbacks) in place of the long left column, the lesson as a bar under the canvas, one Code / Math pane, the two Run fixes most likely to show on stage, and the first-visit tour (item 15). Due by Oct 28. Complete (2026-10-15): [spec](2026-10-14-editor-rail-design.md), [plan](../plans/2026-10-14-editor-rail.md)

### Could

14. Glossary
15. First-visit editor tour (by Oct 28). Complete (2026-10-15) with the editor rail redesign
16. "Explain this line" for generated code (by Oct 28). Complete (2026-10-16) with the code and math rework
17. Ctrl+K search
18. Instructor page

### Next projects (planned 2026-10-14)

Four projects, in this order. Each has its own spec and plan.

1. **Editor rail redesign:** the rail, its panels, the lesson bar, the Code | Math switch, the first-visit tour (item 15) and the two Run issues most likely to show on stage. Due by the Oct 28 freeze. Complete (2026-10-15): [spec](2026-10-14-editor-rail-design.md), [plan](../plans/2026-10-14-editor-rail.md).
2. **Code and math rework:** what the code and math panels contain and how they explain it, including item 16. Built straight after the rail merges; whatever misses the Oct 28 freeze waits. Complete (2026-10-16): [spec](2026-10-15-code-math-rework-design.md), [plan](../plans/2026-10-15-code-math-rework.md). The owner's four problems with the panels today:
   - **The code is a wall.** The student's own part (their shape's draw function and its state) is buried in 60–100 lines of boilerplate.
   - **Lines aren't explained.** A student cannot ask what a line does; the hover notes appear only while the scene is empty.
   - **The math feels disconnected.** The math cards do not clearly relate to what the student just did, or to the code line that uses those numbers.
   - **The math is just numbers.** The cards show results (a matrix, a table) but not the working: how a vertex goes from the student's values to the screen, step by step.
3. **Share link and QR code** (item 8). Complete (2026-10-17): [spec](2026-10-16-editor-chrome-share-design.md), [plan](../plans/2026-10-16-editor-chrome-share.md). It also redesigned the top bar and drew the canvas as the program's window.
4. **Lesson content:** more, deeper and better lessons, including item 11 and the `task` and `pane` text the lesson bar uses. Lesson data may land until Nov 2. The owner's concern, in their words: "I feel a lack of content for each lesson, it lacks quantity and quality as well as depth." Item 11 also covers tidying the lessons shown on stage.

### Below the line

These don't start before the expo:

- SP6 editor behaviour changes, starting with a walkthrough. Ideas are parked until then.
- SP7, the full curriculum expansion.
- Analytics.
- Switch the code panel to CodeMirror 6, only if time allows after the expo (owner, 2026-10-16). The panel's folds were fixed in place first.

New ideas join this list in priority order.

## Known issues carried forward

These issues already exist on the `main` from before the overhaul. They are worth fixing before the demo:

- PixiJS logs a shader warning when a texture is attached.

The site is hosted on Cloudflare Pages at <https://vams.pages.dev/> since 2026-10-12, built from `main` on every push. The old address <https://panic-vams.netlify.app/> forwards there with a 301 from the static site in `deploy/netlify-forward/`, which `netlify.toml` publishes only when those files change. One deployment check is outstanding: the real 404 status on Cloudflare (`curl -I https://vams.pages.dev/nope`).

Rehearsal checklist (Nov 3):

- On the demo machine, open `/` and `/app` once online and wait for "VAMS now works offline". Then turn networking off and run the whole talk.
- Open each "Start from" link on slide 07 once.
- Present fullscreen and test the F key.
- Dismiss the editor welcome dialog on the demo machine.
- Step through every slide at the projector's real resolution.
- Pick the browser zoom on the projector; the editor holds together from 1280 down to 960 CSS px wide.
- Run `npm run test:visual` on the demo machine after the last change, against a baseline taken right after SP5.

### Functional callbacks (2026-10-12)

Small issues left open when item 13 shipped. None loses student work or makes the generated C++ fail through the editor's own controls. Items 1 and 2 are the most likely to show in the live demo.

Run mode:

1. Fixed 2026-10-15 (editor rail redesign): The Running strip covers the top ~30px of the program window and takes clicks there, so a shape near the top edge is hidden during Run. Fix by starting the window below the strip.
2. Fixed 2026-10-15 (editor rail redesign): A selected object's outline and handles stay at the saved pose while a rule moves the object.
3. The Math panel's cursor readout shows editor coordinates during Run, not `windowToWorld`'s.
4. The code panel can re-scroll within the 700 ms branch flash, and a repeat of the same call does not restart the flash.
5. Motion is delivered on the next frame, so it can arrive after an immediate Mouse Up. GLUT keeps the order, and the two differ for a pair such as Mouse Up → Reset with Motion → Move to pointer.
6. A second mouse button pressed while one is held never reaches the Mouse handler (Pointer Events report only the first down and the last up).
7. When Run stops because the store changed, focus moves to the Run button even if it was elsewhere.
8. A File menu open when Run starts stays open, inert, until Stop.
9. A theme change after a window resize during Run can clear Run's colour overrides. The top bar is inert during Run, so this is hard to reach.
10. The window handle ignores `pointercancel` and lacks `touch-action: none`.
11. The handle is 24px; the design spec says a 16px grip. The readout's inset hardcodes the 24px.
12. Fixed 2026-10-15 (editor rail redesign): "Try it" keeps the tooltip "Add a callback to run" when a Pipeline illustration is the reason it is disabled.

Callbacks panel and generated code:

13. When a rule's target stops being eligible (for example, a Move to pointer target that is later grouped), the Object menu shows the first option while the rule keeps its target. The summary line and the code stay correct.
14. The Do menu offers Set colour when the only objects are groups, and choosing it does nothing.
15. After rules for D, A, W and S, a new rule defaults to D again. The generator merges the two into one `case`.
16. Delete in a rule form drops focus to the page, and undo or redo can reopen a rule's form.
17. Rule summary lines lack `font: inherit`.
18. The handler comment "No rules yet" appears when every rule targets a hidden object.
19. Handler names such as `rand`, `abort`, `clock`, `near`, `far`, or names starting with `GL_` or `GLUT_` are accepted but clash with library declarations or macros when compiled.
20. The store's add and update actions do not lower-case keys or reject NaN. An upper-case key beside its lower-case twin would emit a duplicate `case`, and NaN would emit `NaNf`. Only direct store writes can do this; the editor's fields and the file loader already normalise.
21. Fallback rule ids from the sanitizer are not de-duplicated.

Lessons:

22. Exercise 6 step 2 passes if the handler name is cleared after the rules are added, and it accepts any tiny move.

Tests:

23. BB-CB-12 rewrites `tests/fixtures/no-callbacks-program.cpp` when the file is missing, so deleting the fixture makes the no-callbacks guarantee pass vacuously. Write it only behind an environment flag.
24. Missing tests: editing and removing a rule in the store; the v7 → v8 upgrade through a real rehydrate (only the pure function is tested); text, vertex-array and group-child recolour and visibility paths; Set colour excluding groups and Done returning focus; lesson checks on rules whose object was deleted; top-bar and Math panel inertness and flash-over-lesson precedence during Run; the real renderer's `setAppearance`, `setView` and `resync`.
25. WB-PERSIST-07's undo-history fixture predates the `callbacks` field.
26. WB-CB-1 cannot tell show from hide, and its values never exercise rounding. Pointer-mapping parity is checked against hand-worked numbers, and the test C++ interpreter skips every `gl*` call.
27. The Run visual baselines include the Math panel's cursor readout and do not wait for the code panel to finish scrolling.

Code tidiness:

28. The recolour line is repeated four times in `buffers.ts` and `render.ts`.
29. Fixed 2026-10-13: the animator's `baseX_`-style reserved prefixes went with the Animation section.
30. Replaced drawables are never destroyed (an older leak the Run code repeats), and the renderer's register effect disables `exhaustive-deps`.
31. `CallbackRow` subscribes to the whole `callbacks` object, which it needs for duplicate-name checks.
32. `keepProportionsView` returns Infinity at width 0, as the C++ does; the window cannot go below 200px.
33. The call readout embeds the key unescaped; only a–z, 0–9 and space reach it.
34. `const window` shadows the global inside two run-controller methods, and some new imports sit above existing ones.
35. The product plan mixes list punctuation, and roadmap item 13 still says it needs its own spec beside Complete.

### Animation section removed (2026-10-13)

The inspector's Animation group is gone, together with saved per-object animations (rotate, pulse, slide, orbit), their `animate_<name>()` functions and their playback in Run. Idle rules in Callbacks now carry all motion, so the two features no longer overlap. Pulse, slide and orbit have no idle-rule equivalent and were dropped.

- Saves in the browser migrate from store version 8 to 9, which strips the `animation` field. Older `.vams` files still open; the loader ignores the field.
- The Transforms sample scene spins its sun with an `onIdle` rule, "rotate Sun by 2°", so it moves only during Run.
- The lesson "Animation: Transformation Over Time" now registers that kind of idle rule and has the student press Run.
- The Animation section was added after the evaluation study, so removing it creates no manuscript divergence. The "Animation" in the title is still covered by the idle callback.

## Divergences from the thesis manuscript

The thesis manuscript is final and describes the evaluated build. The overhauled build differs from it in the ways below. These differences are accepted and recorded here; they are not reasons to avoid a design. The evaluation study's results are not used as evidence for any design decision.

1. §3.4.2 describes "a single-page Preact application". The site now has prerendered routes, though the editor itself stays a single page.
2. §3.3.3 and Fig. 5 say the user selects a curriculum area on launch. Launch now opens the landing page.
3. Figures 10–15 show the old interface (dark navy, pixel logo, sidebar tabs). The pixel wordmark is back since 2026-10-07; the colours, type and layout still differ.
4. Ch. 6 Rec. 3 frames offline use as future work, and §3.6.2 says students need internet access. The site now works offline after one visit and can be installed as an app (SP3).
5. Ch. 4 reports Algorithm 3 latency "across the eighty-nine measurable steps in the lesson library". Any change to the lesson library changes that count in regenerated reports.
6. The Ch. 4 learning-effectiveness results were measured against the evaluated lessons, and do not cover polished or new lessons.
7. Ch. 6 Rec. 12 recommends expanding the lesson library. Curriculum work delivers part of it early.
8. SP5 renames one panel title, "Position, Rotation, & Scale" to "Object Transform", to match the lesson narration, and wires two `focusPanel` targets (`object-transform`, `text-node-panel`) that never matched a panel. The narration that names screen positions stays true in the new layout.
9. §3.4.2 describes saving only as project-file download and upload. The editor now also keeps a My scenes library and automatic backups in the browser, opens lessons and prepared scenes from links, and shows a recovery screen after a crash (SP3).
10. §3.4.2's five layout regions and its top-bar actions. The lesson bar sits under the canvas, the left column is a rail of four panels (Add, Scene, Settings, Callbacks) that shows one at a time, the code and math column shows code or math with a switch, and the file actions move into a File menu in the top bar (SP5, editor rail redesign).
11. The manuscript describes a tools rail whose panels change with the selected curriculum section, with the Pipeline section's canvas modes as section tools. The editor is now the same in every section: a rail of four panels whose Scene panel holds the scene list and the selected object's pipeline-ordered inspector. Sections become the course map in a Learn drawer, and the Pipeline views appear in the lesson bar during Pipeline lessons (editor refinement, editor rail redesign).
12. The use-case and activity diagrams show lessons reached only inside the editor. The site now has a /learn course map, with progress, that opens any lesson in the editor.
13. §3.4.1 says "there is no concept of playback or event-driven behavior engine in the implementation, nor is there any retained state of the simulation". The editor now has Run: a transient, event-driven state that keeps a temporary copy of each object's state while it runs. It never writes scene state, and the code and math panels still draw from the store. During Run the canvas shows the running program, not the saved scene.
14. Algorithm 2 ends the program with "callback function skeletons", and §3.4.2's callbacks panel registers names only. Handlers now have generated bodies built from rules, a sixth callback (`glutSpecialFunc`) exists, and Reshape offers two behaviours.
15. The evaluated build's math panel had one tab per curriculum section, and its code panel tinted the selected object's lines and explained boilerplate only on an empty scene. The math panel is now a vertex journey through six pipeline stages with the student's numbers. The code panel folds everything but the selected object's code and explains any line on request (code and math rework).

16. The manuscript describes a client-only web application. Sharing a scene stores it through one server-side Pages Function in a key-value store, which keeps a shared scene for 90 days.
17. The manuscript's canvas is a plain drawing area. The canvas is now drawn as the program's window, titled as the generated program titles it, under a header holding the viewing volume, the cursor, the View menu and Run. The window can be moved, resized, minimised and closed like a desktop window.

The following manuscript descriptions may also be crossed by later sub-projects. When one is, it is added to the list above:
- The default canvas background `#000000`. Changing it changes generated code and the replay baseline.
- The canvas text font.
- §1.5's desktop-only input.
- Table 4's browser floor: Chrome 99+, Firefox 101+, Edge 121+.
