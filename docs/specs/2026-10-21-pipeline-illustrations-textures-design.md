# Pipeline illustrations and texture controls — design

Date: 2026-10-21
Part of: [the lesson content project](2026-10-15-lesson-content-design.md). This is its editor work. The lesson text stays in that spec.

## Purpose

The owner asked for this while approving the Pipeline lessons (2026-10-21): "for the pipeline consider redesigning the diagram and stuff and later on the texture samples it should also be replaced with better texture sample and better quick gradients, also the texture section in the scene and settings rail should be rethink or fix".

The Pipeline lessons are about to be rewritten, and they lean on three illustrations: the Diagram, Raster vs vector, and the "Which Stage?" pictures. The owner's view of today's Diagram is that it:
- looks generic;
- isn't tied to the student's scene;
- doesn't move;
- lists GL calls that VAMS never emits (`glVertex3f`, `glCullFace`, `glFogf`, `glDepthFunc`, `glStencilFunc`).

The owner's problems with the texture controls:
- They are split across two places: you add images in Settings and apply them in Scene.
- They are cramped and cut off ("Tiling …", "GL_CLAMP_TO_EDG").
- The samples look amateur.
- The UV editor is hard to use.

## Owner decisions (2026-10-21)

| Question | Decision |
| --- | --- |
| Diagram layout | **Strip and focus.** A row of seven small drawings sits above one large drawing of the chosen stage. Beside it are one sentence, the line from the student's program, and a link to the same stage in Math. |
| Which shape the illustrations draw | The selected shape; else the first shape in the scene; else a built-in triangle with red, green and blue corners |
| Raster vs vector | **Side by side.** The exact shape with its corner coordinates on the left, its pixels on the right. Under both: a "Pixels across" choice and a `GLUT_MULTISAMPLE` switch. |
| "Which Stage?" pictures | Large, on the canvas. Each is that stage's drawing from the new diagram, without the stage name. The question and the answers stay in the lesson bar. |
| Diagram / Raster vs vector / Playground switch | Moves to the canvas header, next to View. It shows in the Pipeline section in **both Author and Lesson mode**, and lessons still set it per step. |
| Texture samples | **The teaching set:** UV grid, Sprite sheet, Pixel fox, Brick wall, Coloured edges. It replaces today's three samples. The "material set" (wood, stone, grass, metal) was declined. |
| Quick Gradients | **Painted previews:** each gradient is a small picture of the selected shape already painted in it. The presets are RGB corners, Black to white, Sunset, Ocean and Neon. |
| Where images are picked, uploaded and removed | In the shape's **Texture group**. Settings loses its Texture library. |
| Texture group | As in the approved mock (picker, Filter and Wrap, UV editor, Exact values), with the exact values behind a disclosure |
| Schedule | One branch for this editor work, landing by the Oct 28 freeze: Pipeline illustrations first, then textures, with a checkpoint for each. The Pipeline lessons are written at the same time on `feat/lesson-content`. |

Approved mocks (kept locally, not committed):
- `pipeline-directions.html` (option A);
- `raster-vector.html` (option A);
- `texture-samples.html` (sets A and C);
- `texture-group.html`.

## 1. The Pipeline illustrations

### The switch

- The **Diagram · Raster vs vector · Playground** switch leaves the lesson bar. It moves to the canvas header, beside View.
- It shows whenever the active section is Pipeline, in Author and in Lesson mode. Today the illustrations show only in Lesson mode (`showsIllustration` in `core/store/illustration.ts`); that changes.
- Playground is the normal canvas.
- Lesson steps keep calling `setPipelineMode` and `setActivePipelineStage`, so existing lessons still drive it.
- Leaving the Pipeline section shows the normal canvas, as today.

### The shape the illustrations draw

- **Which shape:** the selected shape; if nothing is selected, the first drawable shape in the scene; if there is none, the demo triangle.
  - A group or text node isn't drawable, so the rule falls through to the next candidate.
- **The demo triangle:** corners (−0.5, −0.5), (0.5, −0.5) and (0, 0.5), coloured red, green and blue.
  - It's posed so that every stage looks different: scaled 1.5, turned 20° and moved 0.2 right, so one corner crosses the right edge of the default viewing volume and gets clipped.
  - It's drawn against the default volume (−1..1) and a black background, as in `pipeline-directions.html`.
- **Real geometry:** the illustrations use the shape's real data: its vertices, its colours, its transform, its primitive type, and the scene's viewing volume (`glOrtho` limits).
- **Updates:** they update when the scene changes.
- **Framing:**
  - Every drawing is framed in world units on the viewing volume, plus a 20% margin on each side. The margin keeps clipped parts and the transform's starting point visible.
  - Parts of the shape beyond the margin are simply cut off at the frame.
  - The dashed rectangle in stages 1–3 and the solid one in stage 4 are the viewing volume, not a fixed −1..1.
- **The pixel grid:**
  - Stages 5–7 and the Raster side use a grid laid over the viewing volume. Its pixels across are taken from the volume's width, and its rows from the volume's shape.
  - Stages 5–7 use 24 pixels across, not the window's real resolution, which is too fine to see. The sentence for stage 5 says the real window has many more.

### The Diagram (Strip and focus)

**Layout**
- **The strip:** a row of seven small drawings of the shape, one per stage, each with its number and short name: Specify, Transform, Assemble, Clip, Raster, Shade, Output. The chosen one is marked in cobalt with an underline.
- **The focus:** below the strip, the chosen stage drawn large. Beside it:
  - "Stage N of 7" and the stage's full name;
  - one sentence about what happens, using the shape's own numbers where it helps (for example "moved 0.20 right, turned 20°");
  - "In your program" and the matching line from the generated code;
  - a link, "See it in Math: ‹stage› ›", that opens the Math pane at the matching journey stage.

**The seven stages**

The names stay as the lessons teach them. The Math stage and the program line for each are:

| # | Stage | Drawing | Math stage | Program line |
| --- | --- | --- | --- | --- |
| 1 | Vertex specification | The shape's corners as labelled dots (v0, v1, …), before its transform, inside the dashed −1..1 window | Stored | The shape's first `glVertex2f` |
| 2 | Vertex processing | The untransformed outline, faint, beside the transformed corners | Transformed | The shape's `glTranslatef` |
| 3 | Primitive assembly | Corners joined into the shape's primitive, filled with the accent tint | Assembled | The shape's `glBegin(GL_…)` |
| 4 | Clipping | The viewing volume drawn solid; parts outside it dashed; the clipped polygon filled, with its new corners | Projected | `glOrtho(…)` |
| 5 | Rasterisation | A pixel grid with the fragments the shape covers, and its outline over them | Rasterised | `glutInitWindowSize(…)` |
| 6 | Fragment processing | The fragments coloured: vertex colours blended, or the texture when the shape has one | Coloured | The shape's first `glColor3f`, or its `glBindTexture` when textured |
| 7 | Per-sample operations | The finished fragments over the background colour | Coloured | `glutSwapBuffers()` |

**What goes away**
- The "Key GL calls" lists, and the IN / OUT tags.
- Every name VAMS never emits.

**Behaviour**
- **No stage chosen** (`activePipelineStage` is null, as at the start and end of "From Vertex to Pixel"):
  - No strip drawing is marked.
  - The focus shows the finished result (stage 7's drawing), under the heading "From vertex to pixel" and one sentence: seven stages turn your shape into pixels; pick one to see what it does.
  - Clicking the chosen stage again no longer clears it. Only lessons set null.
- **Picking a stage:** click a strip drawing to choose it. Left and right arrow keys move between stages when the strip has focus; from null, the right arrow chooses stage 1.
- **Program line:** clicking the line opens it in the code panel with the explanation strip, as the recap's call links do.
- **Motion:**
  - When the focus changes stage, the large drawing animates the change from the stage before. For example, the corners move to their transformed places, and the fragments appear row by row.
  - Each animation runs once, in about 0.5 s.
  - With `prefers-reduced-motion`, the drawing appears in its final state.

### Raster vs vector (side by side)

- **Left, "Vector":** the shape's exact outline, filled with the accent tint, with its transformed corner coordinates printed beside each corner. A line of text: three corners and straight edges; the edge stays exact at any zoom.
- **Right, "Raster":** the same shape as pixels.
  - "Pixels across" offers 8, 16, 24 and 48.
  - The `GLUT_MULTISAMPLE` switch tests four points per pixel, so edge pixels come out partly filled.
  - Both controls are view state for the illustration only. They don't change the scene or the generated code: the program always turns multisampling on in `glutInitDisplayMode`.
  - The right side redraws as they change.
- Both sides are drawn at the same size and position, so "on the left / on the right" narration still works.

### "Which Stage?" on the canvas

- A step whose exercise has a `visualArtifact` shows that stage's large drawing on the canvas, instead of the small box in the lesson bar.
- The drawing is the Diagram's focus drawing, without the strip, the stage name, the sentence or the program line.
- It uses the demo triangle in its fixed pose, against the default volume, so every student sees the same quiz and no two stages look alike.
- The question and the answers stay in the lesson bar, with no picture there.
- While such a step is showing, the canvas header's switch is hidden. The quiz drawing wins over whatever `pipelineMode` is set, so the stage names can't be read off the Diagram mid-quiz.
- The seven `visualArtifact` values stay as they are, and each maps to its stage.

## 2. Textures

### Samples

The teaching set replaces today's samples. All of them are drawn by code (as `features/textures/lib/sample-textures.ts` does today), tile cleanly, and look as in `texture-samples.html`, set A.

| Id | Name | Size | Teaches |
| --- | --- | --- | --- |
| `sample-uv-grid` (new) | UV grid | 256 × 256 | Labelled corners (0,0 · 1,0 · 0,1 · 1,1) and a large letter F, so a flipped or stretched `glTexCoord2f` is obvious |
| `sample-atlas` (kept) | Sprite sheet | 256 × 256 | Four icons in a 2 × 2 grid: red heart top-left, gold coin top-right, blue gem bottom-left, green star bottom-right (the same corners as today's heart, coin, diamond and crate). One icon is UVs 0 to 0.5. |
| `sample-pixel` (kept) | Pixel fox | 64 × 64, drawn as a 16 × 16 sprite in 4 × 4 blocks | `GL_NEAREST` keeps it crisp; `GL_LINEAR` blurs it |
| `sample-bricks` (kept) | Brick wall | 256 × 256 | Tiles seamlessly, for `GL_REPEAT` with UVs past 1 |
| `sample-edges` (new) | Coloured edges | 256 × 256 | Each edge a different colour, so `GL_CLAMP_TO_EDGE` visibly smears them |

The three kept ids get new pictures under the same ids. Saved scenes, share links, the Textured quad preset and the Textures lessons keep working. The sprite sheet keeps the 2 × 2 layout that the atlas lessons' UVs rely on.

### Quick Gradients

- They stay where they are: in Appearance, when the colour mode is Per vertex.
- **Previews, not labels:** the text buttons become small previews of the selected shape, drawn with its own outline and painted with each preset, with the name underneath.
- **Clicking a preview:** sets each vertex's colour the way the buttons do today, spreading the colours along the shape's wider axis (by vertex order when the shape is flat).

| Name | Colours |
| --- | --- |
| RGB corners | `#ff0000`, `#00ff00`, `#0000ff` |
| Black to white | `#000000`, `#ffffff` |
| Sunset | `#ff5e3a`, `#ffd166`, `#c9184a` |
| Ocean | `#03045e`, `#0077b6`, `#90e0ef` |
| Neon | `#f72585`, `#7209b7`, `#4cc9f0` |

### The Texture group

The shape's **Texture** group in Scene holds everything about textures, in this order.

**1. Image** (`glTexImage2D`)
- **The grid:** four columns of square tiles: None, the five samples, the student's uploads, and an Upload tile with a dashed border.
- **Applying:** clicking a tile applies it to the selected shape, and None removes the texture.
- **The chosen tile** has a cobalt outline.
- **Removing an upload:** each upload has a small × that removes it, which detaches it from every shape, as `removeUploadedTexture` does today.
- **The name line:** under the grid, one line gives the chosen image's name, its size and "sample" or "uploaded", and wraps rather than truncating.

**2. Filter and Wrap**
- Two short switches sit side by side: Filter (NEAREST · LINEAR) and Wrap (REPEAT · CLAMP).
- One code line below shows the `glTexParameteri(…)` call for the control last changed, filter by default. It wraps at the comma and is never cut off.

**3. UV coordinates** (`glTexCoord2f`)
- **The stage:** the texture, repeated when Wrap is REPEAT, with the 0..1 square dashed in amber.
- **The shape:** the shape's outline in white, over a slight darkening, with a numbered handle at each corner. The numbers match the vertex numbers used everywhere else.
- **Dragging** a handle edits that vertex's UV, as today.
- **Zoom:** "− · Fit · +" buttons on the stage. Shift + drag and Shift + scroll still pan and zoom.
- **Presets** under the stage:
  - **Fit** resets the UVs to the shape's default mapping, as Reset does today.
  - **Tile 2 × 2** sets the default mapping times 2.
  - **Flip U** maps each u to 1 − u.
  - **Flip V** maps each v to 1 − v.

  Each preset is one undo step.

**4. Exact values**
- A disclosure, closed by default, with the vertex count at its right.
- Opened, it shows today's u, v table with editable numbers.

**Settings and other references to the library**
- Settings loses the Texture library group.
- Focus requests for `texture-library` (lessons, the help, the inspector focus map) go to the selected shape's Texture group. They go to the Scene panel when no shape is selected.
- The help text and the product plan stop describing a library in Settings.

### The current Textures lessons

The Textures lessons are rewritten later, in the content project. Until then they keep working with this group:
- narration that says to use the Texture library in Settings is reworded to name the Texture group;
- narration that names a sample or an icon follows the new pictures:
  - "Tiling Bricks" becomes "Brick wall", "Texture Atlas" becomes "Sprite sheet", and "Pixel Art" becomes "Pixel fox";
  - the "Green Crate" becomes the green star, in the same bottom-right corner;
- focus targets move as above;
- success checks don't change.

These rewordings are made on this branch, since they follow the pictures it ships. The full rewrite stays on `feat/lesson-content`.

## 3. Constraints

- **Look:**
  - Build on `_tokens.scss` and keep both themes consistent; add tokens there if needed.
  - Type does the work: no pills, chips or cards beyond what the mocks show.
  - Icons are drawn.
  - Numbers use tabular figures.
- **Accuracy:** every program line the illustrations show must come from the generated code, found the way the code panel finds lines (`code-outline.ts`).
- **Data flow:** the illustrations only read state. The only things they keep of their own are view settings: pixels across, the multisample switch, and the UV zoom.
- **Scope:** 2D only, and the generator's output doesn't change, except where texture names appear in its comments.
- **Wording:** student-facing text never uses the banned words, and uses British spelling.
- **Sizes:** works from 1280 down to 960 CSS px wide; rail panels stay at their current width.
- **Motion:** reduced motion is respected everywhere.
- **Architecture:** FSD layering. The drawings are pure functions of state plus a renderer, so tests can check their geometry without a browser.

## 4. Tests

- **Pure geometry:**
  - choosing the shape;
  - the transformed corners;
  - clipping a polygon against the viewing volume;
  - which pixels a shape covers, with and without multisampling;
  - the program line chosen for each stage.
- **Samples:** each generator returns its stated size; the ids are stable; the old ids still resolve.
- **Gradients and UV presets:** the colours each preset sets on 3-, 4- and 6-vertex shapes; Fit, Tile 2 × 2, Flip U and Flip V on a quad, and each one being a single undo step.
- **Switch and focus:**
  - the switch shows only in Pipeline, in both modes;
  - a `texture-library` focus lands on the Texture group;
  - Settings has no texture group.
- **Lessons:** the existing Pipeline and Textures lessons still run, and the lesson rule tests still pass.
- **Visual (Playwright, per-machine baselines):** the Diagram, Raster vs vector, a "Which Stage?" step, and the Texture group, in both themes at 1280 px.

New tests take the next free ID in their file.

## 5. Delivery

- **Branch:** `feat/pipeline-textures-ui`. It merges by Oct 28.
- **Order:** four steps. After each, screenshots go beside the mock in both themes at 1280 px, and the owner signs off.
  1. The switch in the canvas header, the shape choice, and the Diagram.
  2. Raster vs vector, and "Which Stage?" on the canvas.
  3. The samples and Quick Gradients.
  4. The Texture group, removing the library from Settings, keeping the Textures lessons working, and the doc updates.
- **Lesson content:** the Pipeline lessons are written at the same time on `feat/lesson-content`, against steps 1 and 2.

## Calls made while writing (not asked one by one)

- **Sample ids:** the old ids keep their meaning with new pictures, rather than migrating saved scenes to new ids.
- **Demo triangle in "Which Stage?":** the quiz pictures use the posed demo triangle, not the student's shape, so the quiz is the same for everyone and every stage looks different. The same pose is the empty-scene fallback.
- **The switch during the quiz:** it's hidden on quiz steps, and the quiz drawing wins over the switch.
- **Framing:** drawings are framed on the viewing volume plus 20%, and stages 5–7 use 24 pixels across.
- **No stage chosen:** with none chosen, the Diagram shows the finished result with an introduction, and clicking the chosen stage no longer clears it.
- **Textures lesson wording:** the narration that names samples and icons is reworded on this branch, so lessons match the new pictures the day they ship.
- **Math stage for Clipping:** Clipping links to Math's Projected stage, and both Shade and Output link to Coloured, since Math has six stages to the Diagram's seven.
- **Rasterisation's program line:** it's `glutInitWindowSize`, since the window size sets the pixel grid. `glViewport` appears only when the reshape callback is set.
- **Textured shapes:** a textured shape's Shade stage shows its texture.
- **Gradient preset colours:** the exact colours are my choice.
- **Code line under Filter and Wrap:** the single line follows the control last changed, as the mock shows one line.
- **Exact values:** the disclosure starts closed and doesn't remember being opened.

## Left to the builder

- How the drawings are rendered (SVG or canvas), as long as both themes and the mocks' look hold.
- The exact animation for each stage change.
- How the canvas header fits the switch beside View at 960 px.
- How the "Which Stage?" step tells the canvas which drawing to show.
- Where the illustration view settings live (component state or the runtime slice), as long as they aren't persisted with the scene.
