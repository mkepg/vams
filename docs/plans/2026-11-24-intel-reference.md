# One reference: Intel FreeGLUT, every pixel, implementation plan

**Goal:** The Lab and the editor's Run view draw every battery program within 2 of its Intel Iris Xe capture at every pixel, and the editing view follows Intel's rules.

**Architecture:** The capture shims run on the integrated Intel GPU and both reference sets are recorded again there. A strict comparison replaces the edge-blind one. `gl-raster` changes its resolve, points, stipple and polygon split to Intel's, and `gl-geometry` follows for the editing view. A new `scene-gl` module draws the editor's run state through a `GLContext`, and the canvas shows that framebuffer while Run is on.

**Tech stack:** TypeScript, Preact, PixiJS 8, Vitest, Playwright, the course toolchain (MinGW g++, FreeGLUT, GLEW).

**Spec:** [docs/specs/2026-11-24-intel-reference-design.md](../specs/2026-11-24-intel-reference-design.md)

## Global constraints

- Reference renderer: `Intel(R) Iris(R) Xe Graphics`, driver `31.0.101.4502`. `VAMS_CAPTURE_RENDERER` defaults to `Intel`.
- Sample positions, in pixels from the lower-left corner: (0.375, 0.125), (0.875, 0.375), (0.125, 0.625), (0.625, 0.875).
- Strict rule: every pixel within `CHANNEL_TOLERANCE` = 2 in each channel. Editing view: a pixel is an edge pixel when some pixel in its 3 × 3 neighbourhood in the reference differs from it by more than 32 in a channel.
- Named exceptions: a count of pixels and a reason, per scene, in the spec file and in `docs/lab-operations.md`.
- The Lab's jeepney gallery scene keeps at least 24 frames a second in Chrome.
- New test IDs: ALG-LAB-41 and up, ALG-FID-08 and up, BB-RUN-28 and up, VIS-LAB-13 and up. Moved tests keep their numbers.
- AGENTS.md: British English, no banned wording, sentence case, CRLF files, explicit staging, the full check before every commit.

## Review focus

1. **A gradient wrong by more than 2 under the new rule.** It must fail. Pinned in Task 1 (`image-compare` unit test).
2. **A multisampled point whose centre sits on a pixel corner or a sample.** The square covers the samples strictly inside, as Intel does. Pinned in Task 2.
3. **Stipple carried across the vertices of a line strip, multisampled.** The pattern continues from the previous segment's last column. Pinned in Task 2.
4. **Run stopped mid-frame in the editor.** The editing view comes back unchanged, with nothing left of the Run framebuffer. Pinned in Task 6.
5. **A scene with a texture still loading when Run starts.** The Run view draws what the exported program draws with the texture bound. Pinned in Task 6.

---

### Task 1: Capture on Intel, with a strict comparison

**Files:**
- Modify: `tests/fixtures/lab/capture/capture.cpp`, `tests/fixtures/fidelity/capture/capture.cpp` (drop the Optimus and PowerXpress exports; print the 4 sample positions after the renderer line)
- Modify: `scripts/lab/capture-reference.mjs`, `tests/visual/fidelity.spec.ts` (default renderer `Intel`; refuse other sample positions; the manifest records renderer and driver)
- Modify: `tests/helpers/image-compare.ts` (`compareStrict`, `compareEdges`)
- Modify: `tests/visual/lab-drawing.spec.ts` (strict rule, `EXCEPTIONS` map replaces `PARKED`)
- Re-record: `tests/fixtures/lab/reference/*.png`, `manifest.json`; the editor's references in `tests/fixtures/fidelity/reference/`
- Test: `tests/white-box/image-compare.test.ts` (new, or the existing file for the helper)

**Interfaces:**
- Produces: `compareStrict(actual: Image, reference: Image, skip?: (x, y) => boolean): CompareResult`; `compareEdges(actual, reference, skip?)` with the 32 threshold. `CompareResult` is today's `{ ok, failures, examples }`.

- [ ] Write tests: a reference gradient 0..255 across 256 pixels and an actual one shifted by 3 fails `compareStrict` with 256 failures and fails `compareEdges`; the same with a hard black/white edge whose edge column differs by 100 fails `compareStrict` with the column's count and passes `compareEdges`.
- [ ] Run them, see them fail, implement, see them pass.
- [ ] Change the shims and the recorder; record both reference sets on Intel (`VAMS_GLUT_TOOLCHAIN=C:/Users/gomez/repos/THESIS/openglcpp/mingw32 node scripts/lab/capture-reference.mjs`, and `FIDELITY_RECORD=1 npx playwright test fidelity`). Expected: every line names Intel Iris Xe.
- [ ] Commit `test(render): record the references on Intel and compare every pixel`.

### Task 2: Intel's points, stipple and resolve in `gl-raster` and `gl-geometry`

**Files:**
- Modify: `src/shared/lib/gl-raster/framebuffer.ts` (resolve: plain average of the 4 samples, rounded as Intel rounds; `(sum + 2) >> 2` is the first candidate since 2 of 4 white gives 128)
- Modify: `src/shared/lib/gl-raster/points.ts` (multisampled square)
- Modify: `src/shared/lib/gl-geometry/index.ts` (`pointTriangles` square; stipple by major-axis column: restore `fragmentColumns` from f953a45^, `advanceStipple` counts columns), `src/shared/lib/gl-raster/lines.ts`, `assembly.ts`
- Test: `tests/algorithm/gl-context.test.ts`, `gl-geometry.test.ts`

- [ ] ALG-LAB-36 is rewritten for Intel: 2 of 4 samples white over black resolve to 128; 1 of 4 to 64; 3 of 4 to 191. ALG-LAB-41: an 8-pixel multisampled point at (16.3, 16.6) covers exactly the samples with |dx| < 4 and |dy| < 4. ALG-LAB-42: a stippled multisampled line strip with pattern 0x00FF factor 1 starts its second segment at the counter its first left, counted in columns. ALG-FID-01 and ALG-FID-05 return to squares and columns; ALG-FID-08: a point centred on a pixel corner covers a whole square of pixels.
- [ ] See them fail, implement, see them pass. Run the Lab battery (`LAB_RUNTIME_LOCAL=1 npx playwright test lab-drawing`) and note which scenes still fail.
- [ ] Commit `fix(render): resolve, points and stipple as Intel draws them`.

### Task 3: Polygon split, edges and bitmap text

**Files:**
- Modify: `src/shared/lib/gl-raster/assembly.ts` (quad and polygon split), `polygons.ts` (tie rule if needed), `bitmap.ts` (glyph offset), `src/shared/lib/gl-geometry/index.ts` (`polygonTriangles` split to match)
- Test: `tests/algorithm/gl-context.test.ts`

- [ ] For each scene still failing, read the diff image and find the cause. For a quad: ALG-LAB-43 draws a smooth quad with 4 distinct colours and checks the pixel at its centre against the value from the Intel capture of `blend`. For text: ALG-LAB-44 checks the raster position of the font that differs.
- [ ] See each fail, implement, see each pass. Re-run the battery until every scene passes the strict rule, or the left-over pixels have a cause that can't be modelled; those go into `EXCEPTIONS` with the reason.
- [ ] Commit `fix(render): split polygons and place text as Intel does`.

### Task 4: A bigger battery

**Files:**
- Create: `tests/fixtures/lab/programs/*.cpp` for the spec's list (primitive modes, point and line sizes, stipple factors, shading, polygon mode, blending, scissor and viewport, transforms, all bitmap fonts, texture filters and wraps), each aliased and multisampled where both apply
- Re-record: their references
- Modify: `tests/visual/lab-drawing.spec.ts` only if a program needs an `EXCEPTIONS` entry

- [ ] Write the programs in the course style (`glutInitDisplayMode`, `glutInitWindowSize`, the `x.bat` flags). Record them on Intel.
- [ ] Run the battery. Fix `gl-raster` for each failure (ALG-LAB-45 and up for each rule found), until every program passes or carries a named exception.
- [ ] Commit `test(lab): check every part of the 2D set against Intel`.

### Task 5: The editing view under the edge rule

**Files:**
- Modify: `tests/visual/fidelity.spec.ts` (editing view uses `compareEdges`), `src/shared/engine/pixi/primitives/rendering/meshRenderer.ts` only if the editing view still differs away from edges

- [ ] Run `npx playwright test fidelity`. Every scene's editing view passes `compareEdges`.
- [ ] Commit `test(render): check the editing view against Intel away from its edges`.

### Task 6: The editor's Run view through `gl-raster`

**Files:**
- Create: `src/features/callbacks/lib/scene-gl.ts`
- Modify: `src/features/callbacks/model/run-controller.ts` (draws each frame through `scene-gl` into a framebuffer), `src/widgets/canvas/VamsCanvas.tsx` or `ProgramWindow.tsx` (shows the framebuffer while running, hides the PixiJS view)
- Modify: `tests/visual/fidelity.spec.ts` (a Run pass per scene under `compareStrict`; a scene without a callback gets a test-only idle rule that changes nothing)
- Test: `tests/black-box/run-mode.test.ts`, `tests/algorithm/scene-gl.test.ts` (new)

**Interfaces:**
- Consumes: `GLContext` from `@/shared/lib/gl-raster`; the run state from `features/callbacks/model/runtime.ts`; the texture pixels from `features/textures`.
- Produces: `drawScene(gl: GLContext, scene: RunScene): void`, where `RunScene` is the objects, callbacks state, settings and textures the generator reads.

- [ ] ALG-RUN-01 (new prefix): `drawScene` for a scene of one smooth triangle issues the same GL calls, in order, as `generateAppOutput`'s `display()` for it (a recording `GLContext` stub). ALG-RUN-02: the same for a textured quad, a VBO strip, a display-list group and text. BB-RUN-28: while Run is on the canvas shows the framebuffer; stopping shows the editing view unchanged. BB-RUN-29: a texture still loading at Run draws once it loads, as the exported program would.
- [ ] See them fail, implement, see them pass. Run `npx playwright test fidelity`: every scene's Run view passes `compareStrict`.
- [ ] Commit `feat(editor): draw Run with the Lab's renderer so it matches the lab PCs`.

### Task 7: Docs and speed

**Files:**
- Modify: `docs/lab-operations.md` (reference machine, the rule, exceptions, how to record), `docs/specs/2026-10-28-render-fidelity-design.md` (dated note), `tests/README.md` (new tests in the map)

- [ ] Measure the jeepney in the Lab in Chrome (frames a second, foreground tab). Expected: 24 or more.
- [ ] Commit `docs(lab): name Intel as the reference and record the rule`.
