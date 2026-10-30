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
| Pages | Home `/`, editor `/app`, About `/about`, Learn `/learn`, Gallery `/gallery`, Guide `/guide`. The header links only finished pages |
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
| 1 | **SP1 Site shell:** routing and prerendering, design tokens, editor reskin, logo, SEO extras, accessibility baseline, custom domain | Complete (2026-10-04): [spec](2026-10-04-site-shell-design.md), [plan](../plans/2026-10-04-site-shell.md). Live on Cloudflare Pages since 2026-10-12. Custom domain pending (owner to buy) |
| 2 | **SP2 Landing page and stage mode** | Complete (2026-10-04): [spec](2026-10-04-landing-stage-design.md), [plan](../plans/2026-10-04-landing-stage.md) |
| 3 | **SP3 Demo readiness:** lesson and scene links, My scenes library with backups, crash recovery screen, offline installable app | Complete (2026-10-06): [spec](2026-10-06-demo-readiness-design.md), [plan](../plans/2026-10-06-demo-readiness.md) |
| 4 | **SP5 Editor layout redesign:** a shared control set, then the top bar, left rail, canvas overlays, right sidebar, lesson bar and dialogs. Includes the lesson-narration and `focusPanel` updates the new layout forces. Due by Oct 28 | Complete (2026-10-06): [spec](2026-10-06-editor-redesign-design.md), [plan](../plans/2026-10-06-editor-redesign.md) |
| 5 | **Visual identity: Ink + Cobalt.** Tokens, fonts, themes, the pixel wordmark and the landing page restyle | Complete (2026-10-07): [spec](2026-10-07-visual-identity-design.md), [plan](../plans/2026-10-07-visual-identity.md) |
| 6 | **Editor refinement:** one editor with a pipeline-ordered inspector in every section, lessons as a guide card with fading focus, a Learn drawer with progress, and the editor review's layout findings. Due by Oct 28 | Complete (2026-10-09): [spec](2026-10-07-editor-refinement-design.md), [plan](../plans/2026-10-07-editor-refinement.md) |
| 7 | **About page** | Complete (2026-10-10): [spec](2026-10-10-about-page-design.md), [plan](../plans/2026-10-10-about-page.md) |

### Should

8. Shareable scene links and QR code. Complete (2026-10-17) with the editor chrome and sharing project
9. Example gallery of curated scenes. Complete (2026-10-23): [spec](2026-10-23-example-gallery-design.md). A `/gallery` page of finished scenes that run, led by the jeepney street, each opening in the editor from its scene link. Two more scenes joined on 2026-10-30, rice terraces at dusk (Buffers) and pinwheels in the breeze (Transforms), for seven
10. `/learn` page (replaces the SP4 Learn hub): the course map outside the editor, reusing the Learn drawer's course data and progress. By Nov 2. Complete (2026-10-10): [spec](2026-10-10-learn-page-design.md), [plan](../plans/2026-10-10-learn-page.md)
11. Polish the demo lesson(s)
12. Screenshot regression checks, a safety net for SP5. Done with SP5 (`npm run test:visual`)
13. Functional callbacks: keyboard, mouse, motion, reshape and idle behaviours defined in the GUI, with generated handler bodies and a canvas Run mode that never writes scene state. It came with its own spec and a product plan amendment, since the plan specified empty stubs. Complete (2026-10-12): [spec](2026-10-12-functional-callbacks-design.md), [plan](../plans/2026-10-12-functional-callbacks.md)
- **Editor rail redesign:** a labelled rail of four panels (Add, Scene, Settings, Callbacks) in place of the long left column, the lesson as a bar under the canvas, one Code / Math pane, the two Run fixes most likely to show on stage, and the first-visit tour (item 15). Due by Oct 28. Complete (2026-10-15): [spec](2026-10-14-editor-rail-design.md), [plan](../plans/2026-10-14-editor-rail.md)

### Could

14. Glossary. Complete (2026-10-30): the Help glossary grew to 39 terms and is part of the Guide page
15. First-visit editor tour (by Oct 28). Complete (2026-10-15) with the editor rail redesign
16. "Explain this line" for generated code (by Oct 28). Complete (2026-10-16) with the code and math rework
17. Ctrl+K search. Complete (2026-10-30): a search box in the site header (Ctrl+K, or the Command key and K on a Mac) that finds pages, lessons, scenes, Guide topics and glossary terms. It is on the site pages; the editor keeps its own Help search
18. Instructor page. Complete (2026-10-30): `/teach`, with how the course lines up, the links to hand out, running a lab and a one-hour session plan
- **Guide page.** Complete (2026-10-30): `/guide` shows every Help topic outside the editor, with its contents beside it, from the same data the editor's Help reads

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
   Status: the lesson blocks (goals, hints and Skip, recap, predict then see, fill in the code) landed 2026-10-21. The lesson content follows section by section until Nov 2.
   Editor work for it (2026-10-22): the Pipeline illustrations were redrawn over the student's own shape (Diagram strip, Raster vs vector, Which Stage? on the canvas), the texture samples and Quick Gradients replaced, and every texture control gathered into the shape's Texture group ([spec](2026-10-21-pipeline-illustrations-textures-design.md)).
   Pipeline content (2026-10-22): nine lessons, two of them new (Paint the Background and the Write main() capstone), each with predictions, goals, hints and a recap; the section's `main()` calls are now taught rather than allowlisted.
   Primitives content (2026-10-22): fifteen lessons, three of them new (Strips and Fans, When the Window Changes Size, and the Draw It Yourself capstone); every primitive mode, colour call, line and text call and the input and reshape callbacks are now taught.
   Buffers content (2026-10-22): ten lessons, one of them new (the Build a VBO by Hand capstone); every vertex-array, VBO, usage-hint and mapping name is now taught.
   Transforms content (2026-10-22): twelve lessons, three of them new (Spin or Orbit, Make It Orbit and the Write the Transform Calls capstone); the matrix-mode names are now taught.
   Textures content (2026-10-22): thirteen lessons, four of them new (Mapping with UVs, Textures from Arrays, Clamp the Edges and the Write the Texture Calls capstone). Every OpenGL and GLUT name the generator can emit is now taught, and the untaught allowlist is empty.

### Below the line

These don't start before the expo:

- SP6 editor behaviour changes, starting with a walkthrough. Ideas are parked until then.
- SP7, the full curriculum expansion.
- Analytics.
- Switch the code panel to CodeMirror 6, only if time allows after the expo (owner, 2026-10-16). The panel's folds were fixed in place first.

New ideas join this list in priority order.

## Known issues carried forward

These issues already exist on the `main` from before the overhaul. They are worth fixing before the demo:

- Fixed 2026-10-22: PixiJS logged a shader warning for every shape without a texture (not only textured ones), because the vertex-colour mesh carried UVs its shader never read.

The site is hosted on Cloudflare Pages at <https://vams.pages.dev/> since 2026-10-12, built from `main` on every push. The old address <https://panic-vams.netlify.app/> forwards there with a 301 from the static site in `deploy/netlify-forward/`, which `netlify.toml` publishes only when those files change. Cloudflare returns a real 404 status for unknown pages (`curl -I https://vams.pages.dev/nope`, checked 2026-10-23).

Dry run (2026-10-24): the whole talk ran against the production build at 1920, 1366 and 1280 px wide in both themes, with no layout or console problems. Four rough spots were fixed ([spec](2026-10-24-stage-dry-run-design.md)): names cut short in the scene list, the code not following a new selection, Run's branch arriving after its flash, and the slide's out-of-date test count. Stepping past the last slide now opens the jeepney street.

Editor leftovers (2026-10-30), from earlier reviews' deferred minors:

- A program window the student placed gets its size back when a narrower stage widens again.
- Buffers rows hover in a neutral tint, so a row under the pointer never looks chosen; their notes wrap rather than cut off.
- Generated code indents a group's inline children one level in, and the code outline gives the group the lines after them.
- A group's outline takes in its text child's glyphs.
- During Run, text keeps the line step the program started with through a resize, as the compiled program does.
- The editor warns when the browser stops saving and offers the project file (BB-RECOVER-13).
- During a lesson, a group the student opens leads Math and Help until the next step; before, the step's focus always won.
- Left as they are: glyph widths at fractional display scaling (crisp glyphs there would change their size away from GLUT's window pixels), and the program window's size and pipeline-strip names shortening with an ellipsis on a narrow canvas.

Review of the 2026-10-30 round: a whole-branch review found no critical problems. Five fixes followed. The glossary named `GL_CLAMP` where the code writes `GL_CLAMP_TO_EDGE`. The autosave warning closed for good after one click. Enter in search could open a result other than the one Tab had reached. Ctrl+K opened a hidden search box while the home page was presented. A group's text box ignored the vertical scale of a stretched window. The smaller points it left open were fixed the same day:

- Search opened in the header's dark colours on light pages. It now opens over the page, in the page's colours.
- Search's list always reported itself expanded and announced no result count. It now reports whether anything matched, and a status line reads out the count or the empty message.
- A glossary term found in search opened at the top of the glossary. Each term now has its own anchor.
- Help headings on the Guide page sat at the same level as the topic titles. They now sit one level below.
- BB-INSP-03's title named the old order. It now reads opened group, then focus.
- The rice terraces card says N turns the stars on and off, and the search button shows ⌘ K on a Mac.
- The Teaching page and the Learn page share one section-anchor rule, in the lesson catalogue.
- The footer gives the wordmark and the project's name the same space in both themes.

Rehearsal checklist (presentation, Nov 10):

- On the demo machine, open `/` and `/app` once online and wait for "VAMS now works offline". Then turn networking off and run the whole talk.
- Open each "Start from" link on slide 07 once, and the jeepney street, which stepping past slide 07 opens.
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
3. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): The Math panel's cursor readout shows editor coordinates during Run, not `windowToWorld`'s.
4. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): The code panel can re-scroll within the 700 ms branch flash, and a repeat of the same call does not restart the flash.
5. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): Motion is delivered on the next frame, so it can arrive after an immediate Mouse Up. GLUT keeps the order, and the two differ for a pair such as Mouse Up → Reset with Motion → Move to pointer.
6. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): A second mouse button pressed while one is held never reaches the Mouse handler (Pointer Events report only the first down and the last up).
7. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): When Run stops because the store changed, focus moves to the Run button even if it was elsewhere.
8. No longer reproducible (2026-10-23): the File menu closes on any outside press and on Tab. A File menu open when Run starts stays open, inert, until Stop.
9. Fixed 2026-10-30: A theme change after a window resize during Run can clear Run's colour overrides. The top bar is inert during Run, so this is hard to reach. The renderer now keeps Run's colour and visibility for each object and puts them back after any rebuild (VIS-EDITOR-40).
10. Fixed 2026-10-22 (Run in the program window): the separate Run window and its handle are gone; the program window's own resize grip handles `pointercancel` and has `touch-action: none`.
11. Fixed 2026-10-22 (Run in the program window): Run no longer draws its own handle or readout. The program window is the running program: the scene stays in place, the window's own edges resize it and fire Reshape, and its title bar shows that it runs and the last call.
12. Fixed 2026-10-15 (editor rail redesign): "Try it" keeps the tooltip "Add a callback to run" when a Pipeline illustration is the reason it is disabled.

Callbacks panel and generated code:

13. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): When a rule's target stops being eligible (for example, a Move to pointer target that is later grouped), the Object menu shows the first option while the rule keeps its target. The summary line and the code stay correct.
14. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): The Do menu offers Set colour when the only objects are groups, and choosing it does nothing.
15. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): After rules for D, A, W and S, a new rule defaults to D again. The generator merges the two into one `case`.
16. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): Delete in a rule form drops focus to the page, and undo or redo can reopen a rule's form.
17. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): Rule summary lines lack `font: inherit`.
18. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): The handler comment "No rules yet" appears when every rule targets a hidden object.
19. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): Handler names such as `rand`, `abort`, `clock`, `near`, `far`, or names starting with `GL_` or `GLUT_` are accepted but clash with library declarations or macros when compiled.
20. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): The store's add and update actions do not lower-case keys or reject NaN. An upper-case key beside its lower-case twin would emit a duplicate `case`, and NaN would emit `NaNf`. Only direct store writes can do this; the editor's fields and the file loader already normalise.
21. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): Fallback rule ids from the sanitizer are not de-duplicated.

Lessons:

22. Resolved by the lesson content rewrite (2026-10-22): the arrow-keys exercise checks the handler and both rules together. Exercise 6 step 2 passes if the handler name is cleared after the rules are added, and it accepts any tiny move.

Tests:

23. Fixed 2026-10-23 ([Run and Callbacks leftovers](2026-10-23-run-callbacks-leftovers-design.md)): BB-CB-12 rewrites `tests/fixtures/no-callbacks-program.cpp` when the file is missing, so deleting the fixture makes the no-callbacks guarantee pass vacuously. Write it only behind an environment flag.
24. Fixed 2026-10-30, except where noted: Missing tests: editing and removing a rule in the store; the v7 → v8 upgrade through a real rehydrate (only the pure function is tested); text, vertex-array and group-child recolour and visibility paths; Set colour excluding groups and Done returning focus; lesson checks on rules whose object was deleted; top-bar and Math panel inertness and flash-over-lesson precedence during Run; the real renderer's `setAppearance`, `setView` and `resync`. Added: rule edit and removal (BB-CB-24), a version 7 save through a real rehydrate (BB-PERSIST-11), the recolour and visibility paths (BB-CB-25), rule goals whose object was deleted (BB-LESSON-12), and top-bar and Math panel inertness during Run (BB-SHELL-46). The real renderer is covered in the browser (VIS-EDITOR-40); the flash-over-lesson precedence and Done returning focus still have no test of their own.
25. Fixed 2026-10-30: WB-PERSIST-07's undo-history fixture predates the `callbacks` field.
26. Fixed 2026-10-30 in part: WB-CB-1 cannot tell show from hide, and its values never exercise rounding. It now starts from a hidden object as well as a shown one, with values past the printed precision. Pointer-mapping parity is checked against hand-worked numbers, and the test C++ interpreter skips every `gl*` call.
27. Fixed 2026-10-30: The Run visual baselines include the Math panel's cursor readout and do not wait for the code panel to finish scrolling.

Code tidiness:

28. Fixed 2026-10-30: The recolour line is repeated four times in `buffers.ts` and `render.ts`. One helper, `runColorLine`, writes it.
29. Fixed 2026-10-13: the animator's `baseX_`-style reserved prefixes went with the Animation section.
30. Replaced drawables are never destroyed (an older leak the Run code repeats), and the renderer's register effect disables `exhaustive-deps`. Fixed 2026-10-30 (BB-FID-10).
31. Fixed 2026-10-30: `CallbackRow` subscribes to the whole `callbacks` object, which it needs for duplicate-name checks. It now reads only the values it shows.
32. `keepProportionsView` returns Infinity at width 0, as the C++ does; the window cannot go below 200px. Left as is (2026-10-30): guarding only the runtime would part it from the generated code for a size the editor never reaches.
33. The call readout embeds the key unescaped; only a–z, 0–9 and space reach it. Left as is (2026-10-30).
34. `const window` shadows the global inside two run-controller methods, and some new imports sit above existing ones. Fixed 2026-10-30: no local `window` is left. Lint does not enforce import order, so it was left.
35. Fixed 2026-10-30: The product plan mixes list punctuation, and roadmap item 13 still says it needs its own spec beside Complete.

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
8. SP5 renames one panel title, "Position, Rotation, & Scale" to "Object Transform" (written "Object transform" since the sentence-case pass of 2026-10-30), to match the lesson narration, and wires two `focusPanel` targets (`object-transform`, `text-node-panel`) that never matched a panel. The narration that names screen positions stays true in the new layout.
9. §3.4.2 describes saving only as project-file download and upload. The editor now also keeps a My scenes library and automatic backups in the browser, opens lessons and prepared scenes from links, and shows a recovery screen after a crash (SP3).
10. §3.4.2's five layout regions and its top-bar actions. The lesson bar sits under the canvas, the left column is a rail of four panels (Add, Scene, Settings, Callbacks) that shows one at a time, the code and math column shows code or math with a switch, and the file actions move into a File menu in the top bar (SP5, editor rail redesign).
11. The manuscript describes a tools rail whose panels change with the selected curriculum section, with the Pipeline section's canvas modes as section tools. The editor is now the same in every section: a rail of four panels whose Scene panel holds the scene list and the selected object's pipeline-ordered inspector. Sections become the course map in a Learn drawer, and the Pipeline views appear in the lesson bar during Pipeline lessons (editor refinement, editor rail redesign).
12. The use-case and activity diagrams show lessons reached only inside the editor. The site now has a /learn course map, with progress, that opens any lesson in the editor.
13. §3.4.1 says "there is no concept of playback or event-driven behavior engine in the implementation, nor is there any retained state of the simulation". The editor now has Run: a transient, event-driven state that keeps a temporary copy of each object's state while it runs. It never writes scene state, and the code and math panels still draw from the store. During Run the canvas shows the running program, not the saved scene.
14. Algorithm 2 ends the program with "callback function skeletons", and §3.4.2's callbacks panel registers names only. Handlers now have generated bodies built from rules, a sixth callback (`glutSpecialFunc`) exists, and Reshape offers two behaviours.
15. The evaluated build's math panel had one tab per curriculum section, and its code panel tinted the selected object's lines and explained boilerplate only on an empty scene. The math panel is now a vertex journey through six pipeline stages with the student's numbers. The code panel folds everything but the selected object's code and explains any line on request (code and math rework).

16. The manuscript describes a client-only web application. Sharing a scene stores it through one server-side Pages Function in a key-value store, which keeps a shared scene for 90 days.
17. The manuscript's canvas is a plain drawing area. The canvas is now drawn as the program's window, titled as the generated program titles it, under a header holding the viewing volume, the cursor, the View menu and Run. The window can be moved, resized, minimised and closed like a desktop window.
18. The evaluated lessons were narrated steps with scene actions and two exercise kinds (multiple choice and ordered list). The lesson engine now also supports goal checklists, hints, Skip, predictions, recaps and typed code blanks, and each section gains a capstone as its content lands. The Pipeline section has two exercises the evaluated build lacked, Paint the Background and Write main(), so it has nine lessons where the evaluated build had seven. Primitives gains Strips and Fans, When the Window Changes Size and Draw It Yourself. Buffers gains Build a VBO by Hand. Transforms gains Spin or Orbit, Make It Orbit and Write the Transform Calls. Textures gains Mapping with UVs, Textures from Arrays, Clamp the Edges and Write the Texture Calls.
19. The evaluated canvas filled the space it was given, so its shape followed the layout. The program window now opens, refits and maximises to the viewing volume's shape, so a square draws square; the student's own resize still stretches it, as GLUT does.
20. In the evaluated build the panel drawer below 1100 px covered the left of the canvas. It now takes its place beside the canvas, which narrows to make room.
21. The evaluated canvas drew text in a smooth display font, centred on its position, that scaled and rotated with the object, while the generated code drew GLUT's 9×15 bitmap font. The canvas now draws those same bitmap glyphs in window pixels from the raster position, as the compiled program does. The generated code starts the first line at the text's position, with the lines 17 window pixels apart, where it used to centre them 0.07 units apart. A group holding text or another group now draws it inline; before, it called a `draw_` function the program never declared.
22. The manuscript's prepared content is the lesson library. The site now also has a gallery of seven finished scenes with callbacks, which open in the editor like any prepared scene (example gallery).
23. The evaluated canvas drew points, lines and stipple as vector strokes, ignored FLAT shading, and scaled line widths and point sizes with the object. It now draws them by OpenGL 1.5's multisample rules in window pixels, and a battery of 20 scenes checks it against the exported programs built with the course toolchain (render fidelity). The battery also found three faults in the generated code, now fixed: buffer modes left out the point size, line width and stipple; `init()` switched texturing on for the whole program, so shapes drawn before the first textured one took its colour; and buffer setup left a buffer bound, so a vertex-array shape drawn next drew nothing on the first frame.
24. The manuscript's help is the in-app Help Centre. The same topics are now also a `/guide` page on the site, with a longer glossary, beside a `/teach` page for instructors and a site-wide search (Ctrl+K).

The following manuscript descriptions may also be crossed by later sub-projects. When one is, it is added to the list above:
- The default canvas background `#000000`. Changing it changes generated code and the replay baseline.
- §1.5's desktop-only input.
- Table 4's browser floor: Chrome 99+, Firefox 101+, Edge 121+.
