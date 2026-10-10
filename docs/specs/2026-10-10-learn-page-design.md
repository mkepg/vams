# The /learn page

Date: 2026-10-10. Roadmap item 10 ([roadmap](2026-10-04-website-overhaul-roadmap.md)). Due by 2026-11-02; the small editor-side change in §6 lands before the 2026-10-28 freeze.

## 1. Purpose

`/learn` is the course map outside the editor. It serves two readers:

- **Students**, who are the daily users. They should be able to see the whole course in one place, know what each section teaches, see which lessons they have done, and open any lesson in one click.
- **The expo audience.** The header gains its first page link, and the curriculum becomes something a visitor can browse without opening the editor.

The page succeeds when:

- a student who has never opened the editor can read what every section covers and start any lesson from it;
- a returning student sees, without scrolling, what they finished and what comes next;
- the page is prerendered, indexable, works offline after one visit, and adds nothing to the shared bundle beyond its own data and styles.

### Decisions taken in this spec

The owner gave the direction ("the course map outside the editor, reusing the Learn drawer's course data and progress"). The calls below fill in the rest and are open to change in review:

1. The page is a course map with a short introduction per section. It does not have reading pages per lesson or per section; explanatory content belongs to the Guide page, which follows this one.
2. The help-center content stays in the editor. Moving it onto real pages is the Guide page's job.
3. The section introductions reuse the summaries and key calls the home page's curriculum slide already shows, moved into shared course data so both pages read one source.
4. Lessons open through the existing `/app?lesson=<id>` links.
5. "Learn" is the header's first and only nav link.

## 2. Scope

In scope:

- the `/learn` route, page, metadata, sitemap entry and header link;
- a store-free lesson catalog that the page and the progress reader share;
- one link from the home page's curriculum slide to `/learn`;
- the lesson-link change in §6.

Out of scope: the Guide and About pages, a glossary, search, per-lesson pages, instructor features, and any change to lesson content.

## 3. Page content and layout

The page uses the site shell: the ink chrome header, then `main`, then the footer. The header's Learn link carries `aria-current="page"` on `/learn`.

### 3.1 Introduction

- `h1`: **Learn**.
- Lede, one sentence: the course follows the OpenGL pipeline in five sections; demos walk through an idea step by step, and exercises ask the student to build it in the editor.
- A status line that reads from progress (§5):
  - before progress is read, and when nothing is done: "{N} lessons in five sections", where N comes from the catalog;
  - otherwise: "{done} of {N} lessons done".
- **Next up**, one lesson, as a link row (the same row as §3.3):
  - the lesson the student left mid-way, with "Left at step {s} of {n}";
  - otherwise, the first lesson in course order that is not done;
  - when every lesson is done, the line reads "Every lesson is done." and no row is shown.
  - Before progress is read, Next up shows the first lesson of the course. That is also the right answer for a first visit, so the prerendered page is correct for a new student.

### 3.2 Section index

A horizontal list of the five sections, in pipeline order, under the introduction. Each item links to its section's anchor (`#pipeline`, `#primitives`, `#buffers`, `#transforms`, `#textures`) and shows a done mark once every lesson in the section is done. It wraps on narrow screens. It is not sticky. Section targets set `scroll-margin-top` so the sticky header does not cover their headings.

### 3.3 Sections

One `section` per curriculum section, in pipeline order, labelled by its `h2` (exactly `Pipeline`, `Primitives`, `Buffers`, `Transforms`, `Textures`).

From 900px wide, each section is two columns:

- **Left:** the `h2`; the section summary; the key calls as a list of `code` items; the section's count ("{done} of {n} done", or "{n} lessons" before progress is read or when none are done).
- **Right:** two lists, **Demos** then **Exercises**, each under an `h3`, in registry order.

Below 900px the columns stack.

Each lesson is one row, and the whole row is a single link to `/app?lesson=<id>`:

- **Status mark.** It is drawn with CSS or a Lucide icon, never a text glyph:
  - a hollow ring for not started;
  - a filled cobalt dot for in progress;
  - an ink check for done.
- **Title**, from the lesson data.
- **Meta:**
  - "{n} steps" when not started;
  - "Left at step {s} of {n}" when in progress;
  - "Done" when done.
- **Accessible name:** the title, then the status in words, for example "Matrix Representation, done".

Visual rules follow the visual identity spec and its 2026-10-10 amendment:

- Cobalt mist surfaces and 1px rules. Sections are separated by rules and spacing, not by cards.
- Cobalt appears only on the in-progress mark, the Next up row's tint, link hover and focus.
- No eyebrows, section numbers, or icon-and-heading card grids.

The detailed visual pass runs at implementation with the project's design-review workflow, in both themes and at 1280, 960 and 390 CSS px.

### 3.4 Home page link

The home page's curriculum slide gains one link after its mode list: "See every lesson", pointing to `/learn`. Stage mode is otherwise unchanged.

## 4. Data

### 4.1 The catalog

The lesson files import the editor store, and one imports the animation controller. Importing the lesson registry from a site page would pull the store into the bundle that every page shares, which the editor page avoids on purpose by lazy-loading. The page therefore reads a store-free catalog.

New file: `src/features/lesson-engine/model/catalog.ts`, with no imports beyond types.

- `COURSE` moves here from `course.ts`. Each entry gains `summary` and `calls`, taken from the home page's `CURRICULUM.sections`, beside the existing `section` and short `description`. The drawer keeps using `description`.
- `LESSON_CATALOG: readonly LessonEntry[]`, where `LessonEntry = { id, title, type: 'demo' | 'exercise', section, steps }` and `steps` is the step count. The entries follow registry order.
- `catalogFor(section)` returns `{ demos, exercises }` of catalog entries.

Other changes:

- `course.ts` re-exports `COURSE` and keeps `lessonsFor`, so the Learn drawer is unchanged.
- The home page's `CURRICULUM.sections` reads its summaries and calls from `COURSE`. The slide's text does not change.

A parity test keeps the catalog honest. For every registry lesson it compares id, title, type, section, step count and order with the catalog, and fails on any lesson missing from either side. Adding or editing a lesson therefore means updating the catalog in the same change.

### 4.2 Progress without the store

`progress.ts` validates lesson ids against `LESSON_CATALOG` instead of `LESSON_REGISTRY`. This makes it store-free. The key (`vams-lesson-progress`), the shape and the behaviour do not change.

An import-boundary test walks the static imports from `src/pages/learn` and fails if they reach `src/core/store` or any `*-lessons.ts` file.

## 5. Progress, hydration and storage

The page is prerendered without progress, because the build has no localStorage. To hydrate without a mismatch:

- the server render and the first client render both use empty progress;
- progress is read after mount.

`useLessonProgress` gains an opt-in for this, `useLessonProgress({ afterMount: true })`. The drawer keeps today's behaviour.

On `/learn` the page also follows the `storage` event for `vams-lesson-progress`. A student who finishes a lesson in another tab then sees it marked done without reloading.

If storage is blocked or unreadable, progress reads as empty and the page works as it does for a first visit. The persisted editor store stays at version 7.

## 6. Editor-side change

A `/app?lesson=` link that arrives while another lesson is running currently clears it without recording where the student left it. The drawer's Start does record it. After this change, the link path records the running lesson as left, with `recordLessonLeft`, before it clears the lesson state, matching `startLesson`. It still does not ask for confirmation: following a link is the student's explicit choice.

This is the only editor change, and it lands before 2026-10-28.

## 7. Route, metadata, prerender and offline

- `ROUTES` gains `/learn`, which is indexable:
  - title "Learn — VAMS";
  - description: "The VAMS course map: five sections of short OpenGL 1.5 lessons, from the rendering pipeline to textures. Open any lesson in the editor."
- `NAV_LINKS` gains `{ href: '/learn', label: 'Learn' }`, in the same change.
- `SiteApp` routes `/learn` to the Learn page. The page is small, so it is not lazy-loaded.
- Prerender lists `/learn` in `additionalPrerenderRoutes`, so it does not depend on link crawling.
- The sitemap picks the page up from `ROUTES`. The default Open Graph image is reused.
- Offline: the precache glob already includes every prerendered `index.html`, and the route-document transform adds the clean `/learn` URL. A test asserts both entries.

## 8. Accessibility and copy

- WCAG 2.2 AA in both themes. One `h1`, then `h2` per section and `h3` per list. Lists are real lists.
- Every interactive element has a visible focus ring. The page has no motion beyond hover and focus transitions, and none under `prefers-reduced-motion`.
- Student-facing text follows the product rules: the section labels are exact, and the page never uses "coming soon", "not supported", "future", "deferred", "3D" or "lighting". Lesson titles come from the data.

## 9. Testing

New suite `tests/black-box/learn-page.test.ts` (`BB-LEARN-NN`):

1. Every catalog lesson renders once, in its section and list, linking to `/app?lesson=<id>`.
2. The status marks, meta and accessible names are right for not started, in progress and done.
3. Next up is correct for the four cases: first visit, a lesson left mid-way, some lessons done, and all done.
4. The section counts and the index's done marks are right.
5. The prerender (server) output has no progress, and hydrating with stored progress raises no mismatch and then shows it.
6. A `storage` event from another tab updates the page.
7. Blocked or corrupt storage renders the first-visit page.
8. The catalog matches the registry (parity).
9. The page's import graph does not reach the store or any lesson file.
10. The page text contains none of the banned words.

Additions to existing suites:

- `site-shell` checks the route, the nav link, `aria-current`, the sitemap entry and the head metadata.
- `offline-app` checks the precache entries.
- `editor-links` checks that a lesson link records a running lesson as left.
- `home-stage` checks the curriculum slide's `/learn` link.

Visual: `tests/visual/learn.spec.ts` covers light and dark at 1280 and 390, with and without seeded progress.

## 10. Divergence from the manuscript

The evaluated build had no course page outside the editor; lessons were reached only inside it. `/learn` is new after the study and adds a path the manuscript's use-case and activity diagrams do not show: browse the course on a page, then open a lesson in the editor. The implementation adds this as divergence 12 in the roadmap and removes "the use-case and activity diagrams" from its list of descriptions that may be crossed.
