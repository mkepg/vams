# One reference: Intel FreeGLUT, every pixel

This changes the reference machine that the Lab and the editor are drawn against. It replaces the NVIDIA choice in [render fidelity](2026-10-28-render-fidelity-design.md) ("Point shape", 2026-11-10) and the comparison rule in that design's Testing section. It is the first of four pieces that take the Lab out of "Experimental" (see the end).

## Intent

Students do their graded lab work on the lab PCs, which have Intel graphics only (owner's answer). The Lab and the editor must show what those PCs show for the same program, as real OpenGL and FreeGLUT draw it there. Until now both were matched against an NVIDIA RTX 3060. Intel draws differently in places a student sees: a big anti-aliased point is a square, not a circle; dashes start in different places; a four-cornered shape is shaded along the other diagonal.

## What the owner decided

- **Intel only.** One look everywhere, with no switch for NVIDIA's look.
- **The reference is the owner's laptop's Intel Iris Xe Graphics** (driver 31.0.101.4502, OpenGL 4.6). No lab PC is available to capture on. The docs say so wherever the reference is named.
- **Every pixel.** Every pixel of the Lab's frame is within 2 of the reference in each channel, edges included. A pixel that can't be matched is named in the test, with its reason, and listed in `docs/lab-operations.md`.
- **The editor:** the editing canvas stays on WebGL (sharp on high-resolution screens, quick to pick shapes) and follows Intel's rules. **While Run is on, the canvas draws through the Lab's software renderer**, so the running program matches Intel at every pixel.

## What was measured (2026-11-24)

The 21 Lab battery programs were built with the course toolchain and captured on the Intel Iris Xe, then compared with the NVIDIA references the Lab matches today.

- **Already the same (6):** `display-list`, `points` (not multisampled), `s6-textured-quad`, `s7-indexed-strip`, `textured-quad`, and texture sampling generally.
- **Shading of a quad:** `blend`'s smooth-shaded quad has a different gradient. Intel splits a quad into triangles on the other diagonal.
- **Anti-aliased edges:** one column of half-tone pixels differs along some edges (`s1` to `s5`, the gallery scenes), by up to 73.
- **Stipple:** Intel counts the pattern in pixel columns (or rows) along the major axis, as in aliased drawing, not in distance.
- **Bitmap text:** one font's line of glyphs is placed differently in `bitmap-text`; the other fonts match.
- **Points:** a multisampled point is a square on Intel (the editor's references before 2026-11-10 were Intel and show it).
- **Sample positions:** `glGetMultisamplefv` reports 4 samples at (0.375, 0.125), (0.875, 0.375), (0.125, 0.625) and (0.625, 0.875). These are the positions `gl-raster` already uses (`SAMPLE_OFFSETS`), so the edge differences come from somewhere else: the resolve, the tie rule on shared edges, or polygon setup.
- **The old rule hid all of this.** It let any pixel whose 3 × 3 neighbourhood in the reference was not one colour differ by any amount. A gradient changes at every pixel, and text and dashes are all edges, so under that rule the Intel captures fail at only 721 pixels, almost all in `gallery-solar-system`.

## Goals

- Every Lab battery program draws within 2 of its Intel reference at every pixel, apart from named exceptions.
- The editor's Run view draws every battery scene within 2 of its Intel reference at every pixel, apart from named exceptions.
- The editor's editing view follows Intel's rules (square multisampled points, stipple by pixel column, Intel's quad split) and matches the reference everywhere except anti-aliased edge pixels.
- The battery covers each part of the 2D set, both aliased and multisampled.

## Non-goals

- Matching NVIDIA, AMD or any other GPU.
- Changing what the 2D set contains.
- Capturing on a lab PC.

## Anti-goals

- A check that passes while a gradient, text or dashes are wrong.
- A named exception used to hide a whole feature rather than a few pixels with a known cause.
- The editing canvas losing sharpness or picking.

## Approaches considered (editor)

1. **Run view exact (chosen by the owner).** Editing stays on WebGL with Intel's rules; Run draws through `gl-raster`. Exact where the student watches their program run; editing keeps its sharpness and picking.
2. **Always exact.** The editor always draws through `gl-raster`. Every pixel at all times, but blurry on high-resolution screens, slower on big scenes, and picking needs rework.
3. **Rules only.** WebGL with Intel's rules. Cheapest, but edges follow the viewer's own GPU, so the editor can't promise every pixel.

## Design

### References and the capture shims

- `tests/fixtures/lab/capture/capture.cpp` and `tests/fixtures/fidelity/capture/capture.cpp` drop `NvOptimusEnablement` and `AmdPowerXpressRequestHighPerformance`, so a laptop with switchable graphics runs them on its integrated Intel GPU. `VAMS_CAPTURE_RENDERER` defaults to `Intel`. A capture also records the four sample positions from `glGetMultisamplefv` in the manifest, and the recording fails if they differ from `SAMPLE_OFFSETS`.
- Both reference sets are recorded again on the Iris Xe. The Lab's `manifest.json` names the renderer and driver.

### The comparison rule

- `tests/helpers/image-compare.ts` gets a strict rule: every pixel within `CHANNEL_TOLERANCE` (2) of the reference, with a per-scene list of named exceptions, each a pixel count and a reason. The Lab battery and the editor's Run view use it.
- The editing view keeps an edge allowance, narrowed so it can't swallow gradients or text: a pixel is an edge pixel when some pixel in its 3 × 3 neighbourhood in the reference differs from it by more than 32 in a channel. *(My call: a gradient across a shape changes by a few levels a pixel, and an anti-aliased edge jumps by far more. 32 is an eighth of the range.)* Text and dashes still count as edges here, so the editing view's text and stipple are checked through the Run view.
- A failing comparison writes the frame, the reference and the diff image to `tests/visual/results.local`, as today.

### The software renderer (`src/shared/lib/gl-raster/`)

Fitted to the Intel references until the strict rule passes. What is known to change:

- **Points, multisampled:** a square of side `pointSize` centred on the vertex, covering the samples inside it (OpenGL 1.5 allows this as the point's sample region).
- **Stipple, multisampled:** counted per fragment along the major axis, as in aliased drawing; `advanceStipple` and the distance runs in `gl-geometry` go back to column counting.
- **Quads and polygons:** split as Intel splits them. The capture shows the diagonal; the builder confirms it against a fan of 5 and 6 vertices and a `GL_QUAD_STRIP`.
- **Edges and the resolve:** the builder finds the cause of the half-tone column (resolve rounding, the top-left tie rule, or vertex snapping to the subpixel grid; Intel snaps to 1/256 of a pixel or to 1/16) and models it.
- **Bitmap text:** the glyph offset of the font that differs.

Each change is checked in Vitest with a small case drawn from an Intel capture, as the existing `ALG-FID` and `ALG-LAB` tests do.

### `gl-geometry` (the editing view)

The editing view's triangles follow Intel's rules: square points, stipple counted per pixel column, and Intel's quad split. These revert the 2026-11-10 change (f953a45) where it moved from Intel to NVIDIA, and keep its sharing: the Lab's multisampled lines still call `segmentTriangles`.

### The editor's Run view

- New module `src/features/callbacks/lib/scene-gl.ts`: it draws a run state's frame by calling a `GLContext` in the same order and with the same values as the generated `display()` (`code-generation/model/generator/render.ts`, `textures.ts`, `buffers.ts`). It covers every object kind the generator emits.
- While Run is on, the canvas shows that framebuffer at the program's window size, with the Lab's `FramebufferCanvas` way of scaling (whole device pixels, no smoothing). The PixiJS scene is hidden, not torn down, so stopping Run is instant and the editing view comes back as it was.
- Everything else about Run stays: the event listeners, the handler flash, the live readouts and `windowToWorld`.
- `fidelity.spec.ts` runs each scene twice: editing view under the edge rule, and Run view under the strict rule. A scene without a valid callback gets a test-only idle callback that changes nothing, so it can Run.

### A bigger battery

New Lab programs, each recorded on Intel, so every part of the 2D set is checked aliased and multisampled. The builder writes them in the course's style (`x.bat` flags, `GLUT_SINGLE` or `GLUT_DOUBLE`, with and without `GLUT_MULTISAMPLE`):

- every primitive mode, including `GL_POLYGON` (convex), `GL_TRIANGLE_FAN`, `GL_QUAD_STRIP` and `GL_LINE_LOOP`;
- points of size 1, 2.5, 8 and 20; lines of width 1, 2.5 and 6, with stipple factors 1 and 3;
- smooth and flat shading on triangles, quads and polygons;
- `glPolygonMode` lines and points, front and back;
- blending (`GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA`, additive) over a gradient;
- scissor, viewport changes and a reshape;
- transforms: nested push and pop, rotate by odd angles, non-uniform scale;
- every GLUT bitmap font, at positions with fractions;
- textures with `GL_NEAREST` and `GL_LINEAR`, `GL_REPEAT` and `GL_CLAMP`, `GL_MODULATE` and `GL_REPLACE`.

*(My call: the list is what the course's labs and the editor can produce; anything outside the 2D set is refused at compile time and has nothing to match.)*

### Docs

- `docs/lab-operations.md`: the reference machine, the strict rule, every named exception, and how to record on an Intel GPU.
- `docs/specs/2026-10-28-render-fidelity-design.md`: a dated note that Intel replaced NVIDIA, pointing here.
- The roadmap's list of differences from the manuscript, if the manuscript names the reference GPU.

## Constraints

- The project rules in `AGENTS.md`: British English, no banned wording, sentence case, `--text-*` tokens, CRLF files, stable test IDs, explicit staging.
- The Lab's frame rate must not fall. The jeepney gallery scene runs at about 24 frames a second in Chrome today; it must stay at or above that.
- The editing canvas keeps its current frame rate and picking.

## Left to the builder

- The causes of the edge and text differences, and how to model them.
- The order of the work, and how the battery programs are written.
- Whether a pixel is truly unmatchable. Each named exception carries the investigation that showed it.

## The other three pieces (each designed on its own, in this order)

2. **Behaves like GLUT:** keyboard, mouse, timers, idle, reshape, menus, `glutGet`, console input and exit behave as FreeGLUT does on Intel, checked against the real thing.
3. **Holds up in class:** a room of about 40 students on slow lab PCs and one campus network; the first download, a crashed or endless program, full browser storage, and never losing code.
4. **Clear when refused:** a plain message that names the line and says what to do, when a program uses something outside the 2D set or a header the Lab lacks. The "Experimental" tag comes off when all four are done.
