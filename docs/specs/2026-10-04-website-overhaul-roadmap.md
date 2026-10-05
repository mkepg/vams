# VAMS website overhaul — roadmap

Date: 2026-10-04
Deadline: CS Expo stage presentation, **2026-11-04**

This is the umbrella document for the overhaul. Each sub-project has its own design spec in `docs/specs/` and implementation plan in `docs/plans/`. This file records the goals, the decisions shared by every sub-project, the priority order, and where each sub-project stands.

## Goals

The live site (<https://panic-vams.netlify.app/>) used to open straight into the editor. No page presented the project, and help content was spread across the README, the help center and the welcome card.

The overhaul has three goals:

1. **Expo narrative.** At the CS Expo the site *is* the presentation. The presenter steps through the landing page as the talk (problem, product, evidence, team), then opens the live editor for the demo. The audience is expert, and the talk is on a projector.
2. **Student usefulness.** Students are the long-term daily users. The site should be easier to navigate and learn from.
3. **Visual redesign** across the whole site, editor included.

## Shared decisions

| Decision | Choice |
| --- | --- |
| Audience | Students day to day; the expert expo audience sets the priorities |
| Visual direction | **Drafting Vellum**: cool grid paper, navy ink, a safety-orange accent, dimension lines and leader lines from vertex to code. Type: Newsreader (display), Chivo (text), Chivo Mono (labels and code) |
| Themes | `vellum` (light) is the default; `blueprint` (dark) is the toggle. One choice is shared by the site and the editor |
| Logo | Vertex mark: a `GL_TRIANGLES` outline with one orange selected vertex, plus "VAMS" in Newsreader. The mark alone is the favicon |
| Framework | Preact + Vite. preact-iso routing; the editor is lazy-loaded on `/app`; content pages are prerendered at build time with per-page metadata. Next.js was considered and rejected: migration risk before the expo, and no server needs |
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
| 4 | **SP5 Editor layout redesign:** a shared control set, then the top bar, left rail, canvas overlays, right sidebar, lesson bar and dialogs. Includes the lesson-narration and `focusPanel` updates the new layout forces. Due by Oct 28 | Not started |
| 5 | **About page** | Not started |

### Should

6. Shareable scene links and QR code
7. Example gallery of curated scenes
8. SP4 Learn hub and Guide pages
9. Polish the demo lesson(s)
10. Screenshot regression checks, a safety net for SP5

### Could

11. Glossary
12. First-visit editor tour (by Oct 28)
13. "Explain this line" for generated code (by Oct 28)
14. Ctrl+K search
15. Instructor page

### Below the line

These don't start before the expo:

- SP6 editor behaviour changes, starting with a walkthrough. Ideas are parked until then.
- SP7, the full curriculum expansion.
- Analytics.

New ideas join this list in priority order.

## Known issues carried forward

These issues already exist on the `main` from before the overhaul. They are worth fixing before the demo:

- The Undo and Redo buttons never re-enable after an edit. Keyboard undo still works.
- A number-input focus handler throws when it can't find its input.
- PixiJS logs a shader warning when a texture is attached.
- Lighthouse findings on `/app`: the scene-tree list structure, the icon-only add-text button, and the unlabelled transform number inputs.

One deployment check is outstanding: the real 404 status on Netlify.

Rehearsal checklist (Nov 3):

- On the demo machine, open `/` and `/app` once online and wait for "VAMS now works offline". Then turn networking off and run the whole talk.
- Open each "Start from" link on slide 07 once.
- Present fullscreen and test the F key.
- Dismiss the editor welcome dialog on the demo machine.
- Step through every slide at the projector's real resolution.

## Divergences from the thesis manuscript

The thesis manuscript is final and describes the evaluated build. The overhauled build differs from it in the ways below. These differences are accepted and recorded here; they are not reasons to avoid a design. The evaluation study's results are not used as evidence for any design decision.

1. §3.4.2 describes "a single-page Preact application". The site now has prerendered routes, though the editor itself stays a single page.
2. §3.3.3 and Fig. 5 say the user selects a curriculum area on launch. Launch now opens the landing page.
3. Figures 10–15 show the old interface (dark navy, pixel logo, sidebar tabs).
4. Ch. 6 Rec. 3 frames offline use as future work, and §3.6.2 says students need internet access. The site now works offline after one visit and can be installed as an app (SP3).
5. Ch. 4 reports Algorithm 3 latency "across the eighty-nine measurable steps in the lesson library". Any change to the lesson library changes that count in regenerated reports.
6. The Ch. 4 learning-effectiveness results were measured against the evaluated lessons, and do not cover polished or new lessons.
7. Ch. 6 Rec. 12 recommends expanding the lesson library. Curriculum work delivers part of it early.
8. SP5 changes lesson narration that names screen positions, and any `focusPanel` targets the redesign moves.
9. §3.4.2 describes saving only as project-file download and upload. The editor now also keeps a My scenes library and automatic backups in the browser, opens lessons and prepared scenes from links, and shows a recovery screen after a crash (SP3).

The following manuscript descriptions may also be crossed by later sub-projects. When one is, it is added to the list above:
- §3.4.2's five layout regions and the top bar's actions.
- The default canvas background `#000000`. Changing it changes generated code and the replay baseline.
- `focusPanel` targeting in Algorithm 3.
- The canvas text font.
- §1.5's desktop-only input.
- Table 4's browser floor: Chrome 99+, Firefox 101+, Edge 121+.
- The use-case and activity diagrams.
