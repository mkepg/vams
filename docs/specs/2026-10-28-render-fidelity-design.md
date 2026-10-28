# Render fidelity: the canvas draws what the program draws

## Intent

VAMS promises that the canvas shows what the generated C++ draws when a student compiles it on a lab PC. The code panel is exact. The canvas is not: it draws with PixiJS's vector strokes, which approximate OpenGL. For triangles and polygons the approximation is good, but for lines, points, stipple and flat shading it shows something the program never draws. A student who learns "Dotted" from the canvas, or flat shading from a FLAT polygon, learns the wrong picture.

This spec makes the canvas draw by OpenGL 1.5's own rules, in the same window pixels the program uses. Every difference left over is measured and small.

## How it was checked (2026-10-28)

Seven test scenes were drawn in the built editor (Chrome, device scale 1, axes and grid off, black background). Each scene's **Export C++ code** was then compiled with the course's own toolchain, the one on the lab PCs: `openglcpp/mingw32`, g++ 11.3, FreeGLUT and GLEW. The programs ran on the owner's PC (NVIDIA). A capture shim read each program's first frame with `glReadPixels`, and the two images were compared pixel by pixel.

The exported program asks for `GLUT_MULTISAMPLE`, and the driver gave it **4 samples**. That makes OpenGL's *multisample* rasterisation rules the ones to match (OpenGL 1.5 specification, section 3.2.1 and the multisample subsections of 3.3, 3.4 and 3.5). Under those rules points are squares, lines are rectangles and polygons are their exact outlines, all with coverage-weighted edges. PixiJS already runs with antialiasing on, which is multisampling in WebGL, so the editor's edges are of the same kind.

| Scene | Pixels that differ | What the comparison shows |
| --- | --- | --- |
| Smooth triangle, three colours | 0.25%, all on edges | Matches. The colours blend the same way, and only edge coverage differs. |
| Smooth quad, four colours | grip only | Matches, including the diagonal the quad is split along (0-1-3, 1-2-3), which is NVIDIA's. |
| Bitmap text, 9×15 | grip only | Matches. |
| FLAT pentagon, five colours | **31%** | VAMS blends all five colours. OpenGL fills it with the first vertex's colour. |
| Line strip, width 4.5, stipple `(2, 0xAAAA)` | 2.2% | OpenGL draws clear dashes, 2 px on and 2 px off. VAMS's round caps fill the gaps, so the line looks almost solid. |
| Line, width 3, red to green | (in the line scene) | OpenGL draws it 3 px wide. VAMS draws any line with more than one colour at 1 px. |
| Points, size 8 | 0.09% | OpenGL draws 8 × 8 squares. VAMS draws 8.8 × 8.8 squares, offset. |
| Line loop width 3 and points, in an object scaled 2.5 × 0.6 and turned 20° | 1.1% | OpenGL keeps lines 3 px wide and points 8 px square. VAMS scales both with the object: the long sides get thinner, the short sides fatter, and the points become bars. |

"Grip only" means the 68 pixels of the program window's resize grip, which sat inside the screenshot. Everything else in those scenes matched.

The code was read alongside the comparison. The causes are all in `src/shared/engine/pixi/primitives/rendering/`:

- **Points:** `graphicsRenderer.ts` draws them at a fixed `desiredPx = 8.8`. The generator emits `glPointSize(8.0f)`.
- **Strokes:** lines are PixiJS strokes with `cap: 'round'` and `join: 'round'`. OpenGL lines have no caps and no joins.
- **Stipple:** it is emulated with stroked dashes, and each dash gets round caps of half the line width. A width-1 "Dotted" (`0x5555`) therefore draws as a solid line.
- **Multicoloured lines:** they go to the mesh path in `meshRenderer.ts` as `line-list`/`line-strip`, which WebGL always draws 1 px wide.
- **FLAT shading:** nothing reads `shading` for drawing. Uniformly coloured objects use the Graphics path, and the rest use a smooth vertex-colour mesh.
- **Scaling:** stroke width and point size are set in world units, and the object's container scale then applies to them as well.

One more difference was found in the code: the generator writes colours with two decimals (`0.36f` for `#5b`), so the program's byte can be one more or one less than the canvas's. That is invisible, and is accepted (see "Not changed").

## Goals

- For every primitive VAMS offers, in Author mode and in Run mode, the canvas at device scale 1 matches the exported program on the reference machine: exact away from edges (within 2 per channel), with only edge pixels free to differ.
- Line width and point size are in window pixels whatever the object's transform, as `glLineWidth` and `glPointSize` are.
- Stipple draws the pattern bit by bit, as OpenGL counts it, so every preset in the Line style panel looks on the canvas the way the program draws it.
- FLAT shading draws each primitive in its provoking vertex's colour. SMOOTH shading blends, for lines as well as polygons.
- Gaps in fidelity can't come back unnoticed: a reference battery from the course toolchain is committed, and a check compares the canvas against it.

## Non-goals

- Replacing PixiJS. Polygons, textures and text already match. Picking, selection, the grid, overlays and sharp drawing on high-DPI screens stay as they are.
- Matching the canvas pixel for pixel on high-DPI screens. Above device scale 1 the canvas draws more pixels than a lab PC's window has. The shapes, widths and colours are right, only finer. The check runs at scale 1.
- Smoothing, `GL_LINE_SMOOTH`, `GL_POINT_SMOOTH` and anything the generator does not emit.
- Changing generated code, lesson text or the code panel.

## Anti-goals

- The editor changes before the expo. The editor freeze (Oct 28) holds, and this work starts after Nov 4.
- The canvas gets slower to drag or to Run. Rebuilding geometry must stay within one frame for the gallery scenes.
- A screenshot of a student's scene changes in a way the reference battery doesn't explain.
- A student-facing word changes. This is a drawing change only.

## Decisions (made on the owner's behalf; the owner delegated them on 2026-10-28)

1. **Keep PixiJS, and draw lines and points as triangle meshes built by OpenGL's multisample rules.** Polygons keep their current meshes, which match. WebGL's multisampling then covers edges the way the driver does. Rewriting the canvas as a software rasteriser was the alternative. It was rejected for the editor because it would lose sharpness on high-DPI screens and the existing picking, for no gain where the canvas already matches.
2. **One pure geometry module, `src/shared/lib/gl-geometry/`,** with no imports outside its folder. It turns a primitive, its vertices in window coordinates, and the GL state (point size, line width, stipple, shade model) into a list of coloured triangles. The editor's renderer uses it, and so can the Lab's rasteriser in multisample mode (see below).
3. **The rules it follows,** from the OpenGL 1.5 specification:
   - **Points:** a square of side `size`, centred on the vertex, in the vertex's colour (3.3.3).
   - **Lines:** each segment is a rectangle of width `w` centred on the segment, exactly as long as the segment, with no caps (3.4.4). `GL_LINE_STRIP` and `GL_LINE_LOOP` segments are independent rectangles with no joins, so a sharp corner shows the notch the program shows.
   - **Stipple:** a segment has `max(|dx|, |dy|)` fragments in window pixels. Fragment `i` is drawn when bit `⌊s / factor⌋ mod 16` of the pattern is set, where `s` is the stipple counter. The counter resets at `glBegin` and before every `GL_LINES` segment, carries on through a strip or loop, and goes up by one per fragment (3.4.2). Each run of drawn fragments becomes one rectangle piece of the segment. This was measured on the reference machine, not just read from the specification. On the 9° segment of the stipple scene, the dashes repeat every 4.000 px along x, which is the major-axis count. Counting along the segment's length would give 3.946 px.
   - **Shading:** with SMOOTH, colours interpolate along a line and across a polygon. With FLAT, each primitive takes its provoking vertex's colour (Table 2.12): the second vertex of a `GL_LINES` segment; vertex `i+1` of strip and loop segment `i`, and the first vertex for a loop's closing segment; the last vertex of each triangle in `GL_TRIANGLES`, `GL_TRIANGLE_STRIP` and `GL_TRIANGLE_FAN`; the last vertex of each quad in `GL_QUADS` and `GL_QUAD_STRIP`; and the first vertex of a `GL_POLYGON`.
   - **Polygon triangulation** stays as it is (quads split 0-1-3 and 1-2-3), since it matched. FLAT polygons get duplicated vertices so each triangle carries one colour.
4. **Lines and points are built in window space.** The object's full transform, its group's and the view are applied to the vertices first, then the geometry is built at its pixel width, and it is drawn in a container with no scale. Polygons, text and textures stay in object space as now. A transform change (dragging, a Run idle rule) rebuilds only the lines and points it touches.
5. **The Line style panel's stipple preview** draws its strip with the same module, so the preview and the canvas can't disagree.
6. **The reference battery is the one the Lab uses.** The capture shim, the course-toolchain build script and the comparison helper from the Lab plan (Task 10) are built here first, and the Lab reuses them. Images are committed as final assets in `tests/fixtures/fidelity/`.
7. **Comparison rule:**
   - A pixel whose 3 × 3 neighbourhood in the reference image is not all one colour is an edge pixel, and it may differ by any amount.
   - Every other pixel must be within 2 of the reference in each channel.
   - This allows for the different multisample positions of the driver and the browser, and for the two-decimal colours, and nothing else. It replaces the tolerance wording in the [Lab spec](2026-10-28-vams-lab-design.md)'s Testing section (line ends, point edges, stipple starts), which this measurement showed to be too narrow under multisampling.
8. **Order:** this is built after Nov 4 and **before the Lab**. It is smaller (about a week). It fixes what students already see, and it produces the battery and the geometry module the Lab needs.

### Effect on the Lab plan

The Lab's programs mostly ask for `GLUT_SINGLE | GLUT_RGB` (no multisampling), but anything exported from the editor asks for `GLUT_MULTISAMPLE`. The Lab plan's rasteriser (Task 8) therefore needs both modes:
- **Aliased rules** when the display mode has no `GLUT_MULTISAMPLE`, as the plan already says.
- **Multisample rules** with 4 samples at the standard positions when it does, using `gl-geometry` for points, lines and stipple.

The plan is amended in the same change as this spec.

## Not changed

- **The generator's two-decimal colours.** Being one byte out in a channel can't be seen, and three decimals would make the code students read harder to read. The comparison's ±2 covers it.
- **The point size.** The generator always emits `glPointSize(8.0f)`, and the canvas now draws 8 px. There is no point size control, and adding one is not part of this work.

## Testing

Test IDs use a new `FID` module: `ALG-FID-NN` for the geometry, `BB-FID-NN` for the renderer, `VIS-FID-NN` for the reference comparisons.

- **Geometry, in Vitest and CI (`tests/algorithm/gl-geometry.test.ts`):** the expected triangles are written by hand from the rules above, never taken from the code.
  - A point is a `size × size` square on its vertex.
  - A segment is a rectangle with no caps, and strip segments don't join.
  - Width is unchanged by any object scale or rotation.
  - The stipple runs for `(1, 0x5555)`, `(1, 0x00FF)`, `(2, 0xAAAA)`, `(4, 0xAAAA)` and `(2, 0x0FFF)` on horizontal, vertical and 30° segments, with the counter carrying through a strip and resetting between `GL_LINES` segments.
  - The FLAT colour of every primitive type follows Table 2.12.
  - The SMOOTH colour at a segment's midpoint is the mean of its two ends.
- **Renderer, in Vitest (`tests/black-box/render-fidelity.test.ts`):**
  - The Graphics path is no longer used for points, lines or stipple.
  - A FLAT object's mesh carries one colour per primitive.
  - A rebuild after a transform change touches only that object's lines and points.
- **Reference battery (`tests/visual/fidelity.spec.ts`, run locally like the visual suite, with references in `tests/fixtures/fidelity/`):**
  - the seven scenes above;
  - the six Line style presets at widths 1 and 4.5;
  - FLAT and SMOOTH versions of every primitive type;
  - a textured quad with `GL_NEAREST` and `GL_LINEAR`, the harness pointing the program's image path at the sample's PNG;
  - S-1 to S-7 from `tests/reports/manual-compile-procedure.md`;
  - the first frame of the five gallery scenes.

  Every comparison passes the rule in decision 7. The resize grip is hidden in the captures.
- The visual suite's editor baselines are re-recorded only where a scene contains lines, points, stipple or FLAT shading, and each re-recorded image is looked at once.
- lint, build and `npm test` pass.

## Also record

- The roadmap's list of differences from the manuscript ([website overhaul roadmap](2026-10-04-website-overhaul-roadmap.md), "Divergences from the thesis manuscript") gains: the canvas now draws points, lines, stipple and flat shading by OpenGL 1.5's rules, checked against FreeGLUT on the course toolchain.
- `tests/reports/manual-compile-procedure.md` points to the automated battery for the visual comparison it describes.

## Left to the builder

- How rebuilt geometry reaches PixiJS: a reused `MeshGeometry` with updated buffers, or new meshes.
- Where hit areas come from once lines live in window space. They must pick at least as well as today's padded boxes.
- The exact file split inside `gl-geometry`.
