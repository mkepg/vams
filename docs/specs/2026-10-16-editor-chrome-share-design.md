# Editor chrome and sharing — design

Date: 2026-10-16
Roadmap: "Next projects", item 3 in [the overhaul roadmap](2026-10-04-website-overhaul-roadmap.md) (Should item 8, "Shareable scene links and QR code"), widened by the owner to the editor's top bar and canvas
Builds on: [the editor rail redesign](2026-10-14-editor-rail-design.md) and [the code and math rework](2026-10-15-code-math-rework-design.md)

## Purpose

Students and the expo audience both need to share a scene. A student sends their work to a classmate or instructor, or moves it to another computer. On stage, the audience scans a QR code and sees the scene on their phones. Neither is possible today: a scene leaves the editor only as a downloaded project file.

While designing Share the owner asked for two more changes in the same pass (2026-10-16):

1. **A more polished top bar.** Today everything sits at the right, the middle is empty, nothing names the scene, Learn and File are boxed while five icons are bare, and the File menu repeats itself ("Export scene JSON" runs the same action as "Save project file").
2. **A canvas that looks part of the site.** Today it is a black slab with hard edges, with four differently styled overlays floating on the scene, axis labels clipped at the edges and crowded into the empty-scene card, and the empty-scene card in the code font. The owner wants it to look like a real OpenGL program's window.

## Owner decisions (2026-10-16)

| Question | Decision |
| --- | --- |
| Who Share is for | Both: students sharing their scenes, and the expo audience |
| What a phone shows | A read-only scene view: the scene drawn in its window and the generated C++, with a note that editing needs a computer |
| Uploaded images | Carried by a stored short link on Cloudflare (Workers KV, free plan, no card) |
| Which shares are stored | Only those that need it: scenes with uploaded images, or too big for a scannable QR. Other scenes get a link that carries the scene itself. Replaced: every scene is stored, see Amendments after review, checkpoint 2 |
| How long stored shares last | 90 days |
| Large images | Shrunk in the shared copy to at most 512 px on the longest side; a stored scene is at most 1 MB |
| Opening a link on a computer | Straight into the editor; any work in progress is backed up to My scenes first |
| Top bar layout | B: logo, File, Learn, then the scene name and save state; undo, redo, settings, help and Share on the right |
| Top bar scope | Scene name and save state, one button style, a tidy File menu, fewer icons |
| Scene name and save state | The working scene has a name and its own My scenes entry, auto-saved after each edit |
| The top bar during a lesson | The lesson's title and step; Share shares the lesson link |
| Canvas | B: the program's window on a stage, under a header like the side panels' |
| Window title bar | A: quiet, in VAMS's style: "VAMS Preview" and the window size, no drawn buttons |
| Share dialog | A: link and QR side by side |
| QR in the talk | A large QR to the site on the closing "Try it" slide |
| Code panel folding | Fixed in place on 2026-10-16 (0eed75a, a fold gutter). CodeMirror 6 is an option after the expo |

## Rulings made in this spec

Each is a call the owner did not make in so many words. The cost if wrong is beside it.

1. **Link compression uses fflate** (MIT), not the browser's `CompressionStream`, because Table 4's browser floor includes Firefox 101, which lacks it. Cost: about 8 KB.
2. **QR codes are made by uqr** (MIT, SVG output). Cost: a few KB; swapping the library is one module.
3. **A link carries the scene when the whole URL is at most 1,000 characters.** Past that, the QR gets too dense to scan off a projector. Cost: one constant.
4. **Phones are told apart by width:** a window narrower than 960 px gets the scene view, which is the editor's own minimum width. Cost: one constant.
5. **Stored ids are 8 random base62 characters** (about 2 × 10¹⁴ ids), from `crypto.getRandomValues`. Cost: one constant.
6. **Abuse limits** (replaced by the setup amendment: Pages has no rate-limit binding): at most 10 new shares per minute per visitor, through Cloudflare's rate-limiting binding for Workers. The function stores nothing but the scene: no IP address, no account. If the binding turns out to be unavailable on the free plan, a Cloudflare WAF rate-limiting rule on `/api/share` does the same job. Cost: one config block.
7. **Saving a new scene name is a persisted-store change**, so the store version goes from 9 to 10 with a migration that gives an existing save the name "Untitled scene" and a new My scenes entry id. Nobody's saved scene is lost. Cost: one migration step.
8. **The pipeline lesson views** (the pipeline diagram, vector vs raster) are explanations, not the program's output, so they sit on the stage without the window frame. Cost: a wrapper class.
9. **The window's inner size is the canvas size** everywhere it is used: `glutInitWindowSize`, the journey's Rasterised stage and the follow ring. The canvas is about 30 px smaller each way than today. Cost: none in logic; the visual baselines are retaken.
10. **The theme toggle moves into the settings menu** as Light, Dark and System, beside the View items. Cost: one more click to change theme.

## 1. Build order

Three build steps. Each ships complete or not at all ([the roadmap's rule](2026-10-04-website-overhaul-roadmap.md#priority-list)).

| Step | Contents | Lands by |
| --- | --- | --- |
| 1 | Top bar (§2) and canvas window (§3) | Oct 28 (editor) |
| 2 | Share: links, storage and dialog (§4), opening links and the scene view (§5) | Oct 28 for the editor parts (dialog, link handling); Nov 2 for the function and the scene view |
| 3 | The closing-slide QR (§6) | Nov 2 (site) |

The lesson blocks from [the lesson content spec](2026-10-15-lesson-content-design.md) are also editor code due Oct 28. If time runs short, step 2's server side slips to Nov 2 rather than any lesson block being cut.

The owner sees each step at a checkpoint before the next starts: real-editor screenshots at 1280 px, dark and light, at 2× (device scale factor 2).

## 2. Top bar

Layout, left to right: **logo · File · Learn · | scene name · save state** … **undo · redo | settings · help · Share**.

### Left

- **File** is a quiet text menu button. Its items:
  - New workspace
  - My scenes…
  - Open project file…
  - Save project file
  - Export C++ code

  "Export scene JSON" is removed: it ran the same action as Save project file.
- **Learn** is a quiet text button with its icon, opening the Learn drawer as today.
- **The scene name** follows a 1 px divider.
  - It reads "Untitled scene" for a new scene.
  - Clicking it turns it into a text field in place; Enter or blur saves, Esc cancels. Names follow My scenes' rules (`normalizeSceneName`, 80 characters at most).
  - A long name ends in "…" and never pushes the right-hand buttons.
- **The save state** sits beside the name, small and muted: "Saving…" while a save is pending, then "Saved". A failed save reads "Not saved" in the warning colour, with a tooltip saying the browser refused storage.

### Right

- **Undo and redo** as today, as quiet 30 px icon buttons.
- **Settings (⚙)**, one menu holding:
  - Theme: Light, Dark, System (radio items);
  - View: Coordinate axes, Gridlines, Coordinate tracker (today's checkboxes);
  - Keyboard shortcuts.

  Amended: the View items moved to the canvas header and Settings keeps Theme and Keyboard shortcuts (checkpoint 1).

  The separate theme button is removed.
- **Help (?)** as today.
- **Share** is the bar's one cobalt button, with its icon and the word.

### One button style

Every icon button is a quiet 30 px square; Learn and File are quiet text buttons. Hover and focus use the chrome tokens. Only Share has a filled background. The 44 px bar, the logo and the ink chrome stay as they are. Tokens extend `_tokens.scss`; font sizes come from `--text-*` tokens only.

### The working scene and My scenes

- The store gains a persisted `sceneId` and `sceneName`.
- Edits auto-save the scene to its own My scenes entry (`kind: 'saved'`) about one second after the last change. So the working scene appears in My scenes by name, and renaming in the bar renames the entry.
- Starting a new workspace, opening a project file, opening an entry from My scenes, opening a prepared scene and opening a shared link each switch `sceneId` and `sceneName` to the scene now open. The existing backups to My scenes still happen first.
- The store version goes to 10 (ruling 7).

### During a lesson

- The name slot reads the lesson's title and step, for example "Transforms 1 · Step 3 of 8". It is not editable and shows no save state.
- Lesson scenes never write to My scenes. The student's own scene comes back when they leave the lesson, as today.

### During Run

The bar stays inert as today. Share is disabled too. Amended: a disabled-looking Run now answers a click and explains itself (checkpoint 1).

## 3. Canvas window

### Header

A 36 px header, aligned with the side panels' headers so one line runs across the three columns.

- **Left:** "Canvas", then the viewing volume in mono, `x −1…1 · y −1…1`, from `viewportLimits`. This replaces the "Viewport: (-1, 1)" plate, which showed only the x range.
- **Right:**
  - the cursor readout `X 0.42  Y −0.18`, shown only when the coordinate tracker is on;
  - Run, or Stop while running. Its "Add a shape to run your program" tip hangs below the button and no longer covers the scene. Amended: the tip is replaced by a panel opened on click, and the header gains a View menu (checkpoint 1).
- **While placing vertices,** the header's middle reads "Click to place a vertex · Enter finish · Backspace undo · Esc cancel" with `<kbd>` keys. This replaces the banner that floated on the scene.

### Stage and window

- **The stage** is the area under the header: the theme's sunken surface with a faint dot grid, and 14 px of padding.
- **The window** fills the stage: 8 px corner radius, a 1 px border, a soft shadow. Every value comes from tokens, in both themes. Amended: the window floats, moves and resizes (checkpoint 1).
- **Title bar:** 26–28 px, quiet ink.
  - On the left, "VAMS Preview", the title the generated `glutCreateWindow` gives the window.
  - On the right, the size in mono, for example `586 × 610`, the values the generated `glutInitWindowSize` uses.
  - During Run, a small green dot and "running" sit beside the title.
- **The scene** inside the window is the program's clear colour (black by default). The window's inner size is the canvas size everywhere (ruling 9).
- **Axis labels** are inset so none is clipped at an edge.
- **The empty-scene card** uses the UI font. The tick labels behind it are hidden while it shows.
- **Pipeline lesson views** render on the stage without the window frame (ruling 8).

### What does not change

The rendering, the scene, the gizmos, the follow ring and every interaction stay as they are. The VIS-EDITOR and VIS-CM screenshot baselines are retaken.

## 4. Share: links, storage and the dialog

### The shared scene

A shared scene is a versioned payload, `{ v: 1, name, objects, callbacks, viewportLimits, canvasBackgroundColor, textures }`.

- **Textures** lists the textures the objects use:
  - sample textures by id only, since they are drawn by code;
  - uploaded images as data URLs, after shrinking (below).
- **Left out:** selection, interaction mode, pending vertices, theme, learning settings and the other UI state in a project file.
- **Code:** one pure module builds the payload from state and one validates and reads it back. Both are tested, and the reader rejects anything malformed.

### Link that carries the scene

`https://vams.pages.dev/app#s=<data>`.

- **What `<data>` is:** the payload as JSON, deflated with fflate (ruling 1), then base64url-encoded.
- **Why the hash:** it never reaches the server and has no length limit there.
- **When it's used:** for any scene without uploaded images whose whole URL is at most 1,000 characters (ruling 3).
- **What it costs:** nothing to store. It works offline and never expires.

### Stored short link

`https://vams.pages.dev/s/<id>`, used when a scene has uploaded images or its carrying link would pass 1,000 characters.

- **Shrinking images:** every uploaded image is shrunk in the shared copy to at most 512 px on its longest side. Images of 64 px or less on both sides are kept as they are, so pixel art keeps hard edges; larger ones are resampled smoothly. The student's own scene is never changed.
- **Size cap:** a payload over 1 MB after shrinking cannot be stored.
- **`POST /api/share`,** a Cloudflare Pages Function in `functions/api/share`:
  - it takes the JSON payload;
  - it checks the size, the version and the shape (the same validation rules as the client, kept in a module both import);
  - it applies the rate limit (ruling 6);
  - it stores the payload in Workers KV under a new id (ruling 5), with a 90-day `expirationTtl`;
  - it returns `{ id, expiresAt }`.
  - Errors return JSON `{ error }` with 400 (bad payload), 413 (too large), 429 (rate limited) or 503 (storage unavailable or over the daily limit).
- **`GET /api/share/<id>`** returns the payload, or 404 when it is missing or expired.
- **`/s/<id>`** is served the app (a `_redirects` rewrite to the `/app` document). The app then fetches `/api/share/<id>`.
- **Configuration:** `wrangler.toml` holds the KV binding (the rate-limit binding was dropped, see the setup amendment). Creating the namespace needs the owner's Cloudflare login once (`wrangler login`); everything after that is scripted.

### When storing fails

A share that needs storing can fail: offline, rate-limited, over the free daily limit, or with the server down. Amended: every share is stored, so this applies to every scene (checkpoint 2).

- If the scene, without its uploaded images, fits a carrying link, that link is used. An amber note says the uploaded images are left out.
- Otherwise the dialog says "Couldn't make a link right now." and offers Save project file.

### During a lesson

Share gives the existing `https://vams.pages.dev/app?lesson=<id>` link, and the dialog's title reads "Share this lesson".

### The dialog (layout A)

A modal dialog 440 px wide, on the shared focus trap. Esc and Done close it, and focus returns to Share.

- **Title:** "Share ‘<scene name>’".
- **Sentence:** "Anyone with the link opens a copy of this scene. On a phone it opens as a view."
- **Link field** (read-only, mono) and **Copy link** (primary).
  - While a stored link is being made, the field reads "Making your link…" and Copy is disabled.
  - Copying shows the toast "Link copied".
- **Notes,** one line each with a small green or amber dot:
  - "This link carries your scene and never expires." or "Stored for 90 days, until <date>.";
  - "Your uploaded image is shared at 512 px." when any image was shrunk;
  - "Your uploaded images are left out." on the fallback.
- **QR code** to the right: 132 px, SVG, dark modules on white with a quiet zone, in both themes. Under it, **Download QR** saves a PNG named after the scene.
- **Footer:** "Save project file instead" (the File menu's Save) and **Done**.

Student-facing text follows AGENTS.md: it never says "coming soon", "not supported", "future", "deferred", "3D" or "lighting".

## 5. Opening a shared link

### On a computer

A window 960 px wide or wider (ruling 4) opens both link kinds straight into the editor, like `?scene=` links today:

- The scene opens through `replaceScene`, which first backs up any work to My scenes with the new backup reason `'shared-link'`.
- The shared scene becomes the working scene, with its own My scenes entry named after the shared scene's name.
- The toast reads "Opened ‘<name>’". When a backup was made, it adds "Your previous scene is in My scenes." and a My scenes button.
- The `#s=` hash or the `/s/<id>` path is replaced with `/app` before the scene is applied, so a reload never applies it twice.
- When a link can't open, the editor opens as usual with one of these messages:
  - an expired or unknown id: "That shared scene has expired or can't be found. Ask for a new link.";
  - damaged data: "That link is incomplete. Ask for it again.";
  - offline: "Connect to the internet to open this shared scene."

### On a phone: the scene view

A window narrower than 960 px gets the scene view, a read-only page:

- **Top:** the logo and the scene's name. The theme follows the device and can be toggled.
- **The scene:** the canvas window from §3 ("VAMS Preview" and its size), fitted to the screen's width, drawing the scene with the editor's renderer. Amended: the window keeps its 4:3 shape (checkpoint 2).
- **Code:** a "Scene | Code" switch shows the generated C++, read-only, with the code panel's colouring and a Copy button. The code is built by the same pure generator from the shared scene.
- **Closing note:** "Editing needs a computer. Open this link there." It has **Copy link** and a quiet "Open in the editor anyway", which opens the editor as on a computer.
- **Storage:** the view never writes. The visitor's own saved scene, My scenes and progress stay untouched, because the view renders from the shared payload alone, outside the persisted store.
- **Code split:** the scene view is a lazy-loaded chunk, like the editor.

### Offline

The service worker gains:
- `/api/` on its navigation denylist;
- a rule that serves the cached `/app` document for `/s/<id>`, so an offline visitor sees the editor with the offline message, not the 404 page.

## 6. The closing-slide QR

The landing page's last section, "Try it", gains a QR code to `https://vams.pages.dev`, large enough to scan from the back of a room in stage mode, with the address written beside it.

- It is rendered at build time to SVG, so the prerendered page carries it.
- It needs no network.

## 7. Tests

Each new test takes the next free number in its file.

- **White-box:**
  - building and reading the shared payload, including round-trips, malformed input, missing textures and version checks;
  - the 1,000-character rule;
  - image shrinking: the 512 px bound and the small-image passthrough;
  - the id generator;
  - the function's handlers with an in-memory KV and rate limiter (400, 413, 429, 503, 404, TTL);
  - the store migration from 9 to 10.
- **Black-box:**
  - the top bar's layout and menus;
  - renaming;
  - the save state's transitions;
  - the lesson title;
  - the canvas header, title bar and size;
  - the Share dialog in each state (carrying link, stored, shrunk, fallback, failure, lesson);
  - opening each link kind on a computer and in the scene view;
  - each error message;
  - the view writing nothing to storage.
- **Visual:** VIS-EDITOR and VIS-CM are retaken. A new VIS-SHARE suite captures the dialog, the scene view at 390 px and the closing slide.

## 8. Documents

- **Help content:**
  - the top bar and the canvas window in the workspace tour;
  - a new "Sharing a scene" topic;
  - the File menu's items.
- **The product plan:**
  - Workspace Layout gains the top bar's contents and the canvas window;
  - a new "Sharing" section covers both link kinds, the 90-day storage and the scene view;
  - the shared decision "Framework … no server needs" becomes "one Pages Function and one KV namespace, for shared scenes".
- **The roadmap:**
  - Should item 8 and "Next projects" item 3 are marked complete;
  - CodeMirror 6 goes under "Below the line";
  - two divergences are added: the editor now uses a server-side function for sharing, and the canvas is drawn as a framed program window.
- **tests/README.md:** the new files and the count.

## Amendments after review

The owner reviewed the build at two points and during setup, and changed the design below. Where the sections above say otherwise, this section wins.

### Checkpoint 1 (2026-10-16)

- **A quieter grid, with a Grid numbers option (store version 11).** The grid draws minor lines, five between each labelled line, so the labelled lines stand out. The numbers sit inside the canvas, and a Grid numbers option hides them. It is off whenever Coordinate axes is off. Saves older than version 11 get the option switched on. Reason: the full-strength grid and the edge labels competed with the scene.
- **A movable window, in style D, with real GLUT semantics.** The program window floats, centred on the stage. Its title bar moves it, and its right edge, bottom edge and corner resize it. The scene stretches to fill the window, as GLUT's default viewport does, and `glutInitWindowSize` shows the new size. Minimise, maximise and restore work, double-clicking the title bar maximises, and the close button stops a running program and leaves a chip on the stage that brings the window back, as does Run. The generated code gains no `glutInitWindowPosition` line, because moving the window must not change the program. Reason: a frame that behaves like a window teaches what GLUT's window calls do.
- **The View menu beside Run; Settings keeps Theme and Keyboard shortcuts.** The four view options (Coordinate axes, Gridlines, Grid numbers, Coordinate tracker) sit in the canvas header, next to what they change. Reason: they describe the canvas, and the top bar's Settings was the wrong place to look.
- **Run explains itself on click.** When Run can't start it looks dimmed but responds. A small panel says "Run needs a callback" with an Open Callbacks button, or "Add a shape first" with an Add a shape button. The in-window note is removed. Reason: a disabled control cannot say why, and a note inside the program window looked like part of the program.

### Checkpoint 2 (2026-10-17)

- **Always the short stored link.** Share stores every scene, with or without uploaded images, and shows `/s/<id>`. The carried link `/app#s=...` is the fallback when storing fails; with uploaded images it leaves them out, and if even that is too long the dialog offers Save project file. Reason: the carried link's QR code is version 23 (113 modules) and reads from about a third of the distance of a stored link's (version 3, 33 modules), which matters on a stage.
- **The phone view stays 4:3.** The scene view keeps the window's shape. Reason: filling the screen would stretch the scene.

### Setup

- **No rate-limit binding.** Cloudflare Pages doesn't support one, and the site has no zone of its own for a WAF rule. The free plan's daily KV write limit caps storage instead, and the function returns 503 when it is reached.
- **The `/app/` rewrite target.** `public/_redirects` rewrites `/s/*` to `/app/`. The trailing slash matters: `/app` would redirect and lose the id.

### Closing look

- **The Try it QR code takes the right half in stage mode,** up to 460 px, so it can be scanned from the back of a room. Below 1100 px wide it sits under the preset links.
