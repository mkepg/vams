# About page — design

Date: 2026-10-10
Roadmap item: 7 (Must) in [the overhaul roadmap](2026-10-04-website-overhaul-roadmap.md)

## Purpose

The About page serves two audiences:

- **Expo and academic visitors** (judges, faculty, other schools) want the story behind VAMS and a thesis record they can cite.
- **Students** want the practical facts: what VAMS teaches, where it runs, where their work is kept, and how to report a problem.

The home page already has short Team and Under-the-hood slides. The About page does not repeat them. It tells the story, gives students their facts, and closes with the formal thesis record.

Out of scope: an engineering deep dive (the home slide and the README cover it), the thesis panel and course adviser, acknowledgements, a contact email, the Guide page, and any editor change.

## Owner decisions (2026-10-10)

| Question | Decision |
| --- | --- |
| Audience | Expo and academic visitors, and students |
| Content | The story, For students, and the thesis record. No "How it's built" block |
| Thesis date | The year only: 2026 (the title page says February 2026, the approval sheet November 2026) |
| Credits | The three authors and the adviser only, matching the home Team slide |
| Citation | APA 7 and BibTeX, each with a Copy button |
| Story copy | Drafted from the manuscript's background chapter and the project history, then approved by the owner. No study results |
| Reporting problems | GitHub Issues |
| Order | Story, then For students, then the thesis record |
| Layout | Option B: labeled bands, like /learn's sections |
| Entry points | The header switcher (Home, Learn, About), the footer, and a link on the home Team slide |
| Phone header | "Open the app" reads "Open app" at 480px and below |
| About nav icon | None. Learn keeps the only icon |

## Page

Route `/about`, prerendered, indexable, titled "About — VAMS".

Description: "Why VAMS exists, what it teaches, where your work is kept, and the undergraduate thesis behind it, with a citation to copy."

Structure, top to bottom:

1. `<SiteHeader current="/about" />`
2. Intro: an `h1` "About VAMS" and a lede, "A 2D OpenGL 1.5 teaching tool that began as an undergraduate thesis."
3. Three bands. Each band is a `section` labelled by its `h2`: the heading and a one-line summary on the left (2fr), the content on the right (3fr). Bands are separated by a 1px `--rule`. Below 900px a band becomes one column, as /learn's sections do.
4. `<SiteFooter />`

### Band 1: Why VAMS exists

Summary: "From a thesis to a tool students use."

Body (four paragraphs, approved):

> Computer graphics courses ask students to work with vectors, matrices and coordinate systems, and then to picture what those numbers do on screen. Most students can rotate a triangle by 45 degrees on paper. Far fewer can see that rotation before they run the program, and in an OpenGL course running it first means a compiler, a GLUT install and a build script.
>
> VAMS began as our undergraduate thesis at FEU Institute of Technology. The idea was simple: instead of asking students to connect an equation to a picture in their heads, show both at once. You build a scene by hand, and VAMS writes the OpenGL that draws it and shows the math underneath, live.
>
> It is meant as a first step, not a replacement for professional tools. Students learn the pipeline here, then carry the same code and the same math into a real OpenGL project.
>
> After the thesis, we kept building: a guided course of {N} lessons, a redesigned editor, and a site that works offline. VAMS is free and open source under the MIT License.

`{N}` is `LESSON_CATALOG.length` (45 today).

### Band 2: For students

Summary: "What it teaches, where it runs, and where your work is kept."

A definition list of six facts, in two columns on wide screens and one on narrow ones:

| Term | Text |
| --- | --- |
| What it teaches | OpenGL 1.5 in 2D, in five sections that follow the pipeline: Pipeline, Primitives, Buffers, Transforms, Textures. {N} lessons in all. |
| Two modes | Author, where you build freely. Lesson, where guided steps play out and exercises check your scene. |
| Where it runs | A desktop browser: Chrome, Edge or Firefox. Nothing to install. |
| Offline | After your first visit VAMS works without internet, and you can install it as an app from your browser. |
| Your work | Your scene and your lesson progress stay in this browser between visits. My scenes keeps named scenes and your last five backups. To move work to another computer, save a project file. |
| Found a problem? | A link, "Open an issue on GitHub", to `https://github.com/mkepg/vams/issues`. |

The section names are the exact labels `Pipeline | Primitives | Buffers | Transforms | Textures`.

### Band 3: The thesis

Summary: "The record, and how to cite it."

A raised card (`--paper-raised`, 1px `--rule`, `--radius-m`):

- The title as a paragraph styled like a heading: "V.A.M.S: A Geometric Modeling and Animation Studio for Introductory Computer Graphics Courses".
- A definition list:
  - Authors: Mikhael Edman P. Gomez, Johann Patrick S. Taguiam, Justine Jhigz D. Vizco
  - Adviser: Elisa V. Malasaga
  - Degree: BS Computer Science, specialization in Software Engineering
  - Institution: FEU Institute of Technology
  - Year: 2026
- Citation tabs, APA 7 and BibTeX.

APA 7:

```
Gomez, M. E. P., Taguiam, J. P. S., & Vizco, J. J. D. (2026). V.A.M.S: A geometric modeling and animation studio for introductory computer graphics courses [Undergraduate thesis, FEU Institute of Technology].
```

The title is set in italics on the page. The copied text is plain.

BibTeX:

```
@mastersthesis{gomez2026vams,
  author = {Gomez, Mikhael Edman P. and Taguiam, Johann Patrick S. and Vizco, Justine Jhigz D.},
  title  = {{V.A.M.S}: A Geometric Modeling and Animation Studio for Introductory Computer Graphics Courses},
  school = {FEU Institute of Technology},
  type   = {Undergraduate thesis},
  year   = {2026}
}
```

`@mastersthesis` with a `type` field is the standard BibTeX form for a thesis type BibTeX lacks.

### Citation tabs

- A WAI-ARIA tablist with two tabs: "APA 7" (selected first) and "BibTeX".
- Roving `tabindex`. Left and Right arrows, Home and End move between the tabs and select them.
- Each tab panel holds its citation in a `pre` (BibTeX) or `p` (APA) and a **Copy** button.
- Both panels are in the prerendered HTML. The inactive one carries `hidden`.
- Copy calls `navigator.clipboard.writeText(text)`:
  - On success the button reads "Copied" for 2 seconds.
  - On failure (no clipboard API, or a rejected promise) the citation text is selected and the status reads "Press Ctrl+C to copy".
  - Either message is announced through a polite live region.
  - A new copy, or a tab change, resets the button.
- The copied strings are the exact plain-text strings above.

## Entry points

- **Header.** `NAV_LINKS` becomes Home, Learn, About. About has no icon. The About link is current on `/about`.
- **Phone header.** At 480px and below, the CTA's word "the " is hidden: the CTA markup is `Open <span class="site-header__cta-the">the </span>app`. The hidden span leaves the accessibility tree, so the accessible name matches what is shown. The header must still fit a 390px phone with no horizontal scroll on `/`, `/learn`, `/about` and `/404`.
- **Footer.** The links read Learn, About, Source on GitHub, MIT License.
- **Home Team slide.** A paragraph after the team list holds a link "The full story" to `/about`, styled like the curriculum slide's "See every lesson" link. The text and href live in `content.ts` as `TEAM_MORE = { href: '/about', label: 'The full story' }`. The file keeps zero imports.

## Code layout

New FSD page slice `src/pages/about/`:

- `index.ts` exports `AboutPage` as the default.
- `model/copy.ts` exports `ABOUT_COPY` (title, lede, the three bands' headings and summaries, `story(lessons: number): string[]` and `facts(lessons: number): { term: string; text: string; href?: string }[]` (a fact with `href` renders its text as that link) (the lesson count is passed in, so `copy.ts` imports nothing), and the issues URL), `THESIS` (title, authors, adviser, degree, institution, year), and `CITATIONS` (`apa`, `bibtex`).
- `ui/AboutPage.tsx` holds the page.
- `ui/AboutBand.tsx` is one band: `{ id, title, summary, children }`.
- `ui/CitationTabs.tsx` holds the tabs and the copy behaviour.
- `ui/about.scss` uses existing tokens only: `--text-*` font sizes (BB-SHELL-22), and the band rhythm and breakpoints of `learn.scss`.

The page reads the lesson count from the store-free `features/lesson-engine/model/catalog.ts`. It never imports `core/store`, the lesson registry or a lesson file.

The page does not import `pages/home`, since pages never import each other. The author and adviser names are written in `copy.ts`, and a test checks them against `TEAM`.

Wiring:

- `src/app/routes/route-meta.ts` gets the `/about` entry, which puts it in the sitemap.
- `src/app/SiteApp.tsx` gets `<Route path="/about" component={AboutPage} />`.
- In `vite.config.ts`, `additionalPrerenderRoutes` becomes `['/404', '/learn', '/about']`.
- The offline app caches `about/index.html` under its clean URL `about`, the same as `/learn`.

## Student-facing text rules

All copy obeys AGENTS.md:

- No "coming soon", "not supported", "future", "deferred", "3D" or "lighting".
- The section labels are exact.
- No study results from the manuscript.

A test scans every string in `ABOUT_COPY`, `THESIS` and `CITATIONS` for the banned words.

## Tests

`tests/black-box/about-page.test.ts`, suite `BB-ABOUT`:

1. Route metadata: `/about` is indexable, titled "About — VAMS", and in the sitemap and the prerender list.
2. Prerendered `/about` renders the intro, then three bands in order (Why VAMS exists, For students, The thesis), each a `section` labelled by its `h2`, and marks About current in the header.
3. The story and the "What it teaches" fact state the catalog's lesson count, and the five section labels in order.
4. The thesis authors and adviser match the home page's `TEAM` names.
5. The APA and BibTeX strings equal the spec's text exactly.
6. The tabs: APA is selected first; arrow keys, Home and End move and select; the inactive panel is `hidden`; both panels are in the prerendered HTML.
7. Copy success writes the active citation to the clipboard, shows "Copied" and announces it, then resets after 2 seconds.
8. Copy failure (no clipboard API, or a rejected promise) selects the citation text and announces "Press Ctrl+C to copy".
9. The issues link points to `https://github.com/mkepg/vams/issues`.
10. No banned word appears in any About copy.
11. The import walk from `src/pages/about/index.ts` reaches the catalog, and never `core/store`, the registry or a lesson file.

Updated tests:

- BB-SITE-29 (nav links): `NAV_LINKS` is Home, Learn, About.
- New BB-SITE-31: About is current only on `/about`.
- New BB-SITE-32: the footer links run Learn, About, then the others.
- New BB-SITE-33: the CTA's "the " sits in `.site-header__cta-the`, and the stylesheet hides it at 480px and below.
- New BB-HOME-24: the Team slide links to `/about` with "The full story".
- New BB-PWA-09: `about/index.html` is cached under `about`.

Visual (`tests/visual/about.spec.ts`, not part of `npm test`):

- VIS-ABOUT-01: light, 1280, full page.
- VIS-ABOUT-02: dark, 1280, full page.
- VIS-ABOUT-03: light, 390, full page, no horizontal scroll.
- VIS-LEARN-05 also checks `/about`, and that the About link and the CTA are visible at 390px.

Baselines for VIS-HOME and VIS-LEARN are refreshed, since the header and footer change.

## Docs

- In the roadmap, item 7 is marked complete with links to this spec and the plan.
- `tests/README.md` lists the BB-ABOUT and VIS-ABOUT suites.
- `docs/product-plan.md` needs no change: Appendix B is about lessons, and the About page reads only the lesson count.

No new manuscript divergence: the site's prerendered routes (divergence 1) and offline use (divergence 4) are already recorded.
