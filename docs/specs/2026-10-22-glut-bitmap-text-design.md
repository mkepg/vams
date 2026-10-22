# Bitmap text drawn as GLUT draws it

## Purpose

The generated program draws a TEXT object with `glRasterPos2f` and `glutBitmapCharacter(GLUT_BITMAP_9_BY_15, c)`, but the canvas draws it as smooth Comfortaa letters that scale, rotate and centre with the object. The canvas should show what the compiled program shows, because the generated code is the only code. The "Rendering Text in OpenGL" lesson teaches GLUT_BITMAP_9_BY_15 as "a picture 9 pixels wide and 15 tall", and the canvas should agree with it. The owner chose an exact match to GLUT on 2026-10-22 and made three further calls, recorded below.

Two bugs go with the old drawing: a fresh tab draws the text in a fallback serif until Comfortaa loads, and after a reload the last letter can be clipped ("MORAYT").

## How GLUT draws it (freeglut `fg_font.c`, `fg_font_data.c`)

- `glRasterPos2f(x, y)` transforms the point by the modelview and projection matrices. If the point falls outside the clip volume, the raster position is invalid and nothing is drawn until the next `glRasterPos2f`, so the whole line is skipped. If it is inside, its window position and the current colour are kept.
- `glutBitmapCharacter` calls `glBitmap(9, 16, 0, 4, 9, 0, bits)`. Each glyph is a 1-bit bitmap 9 pixels wide and 16 rows tall (rows stored bottom first, most significant bit leftmost). The glyph's bottom-left is 4 pixels below the raster position, and the raster position then moves 9 pixels right. Glyphs are in window pixels: `glScalef`, `glRotatef` and `glOrtho` do not change their size or turn them. Parts outside the window are clipped.
- The glyph data is the X `-misc-fixed-medium-r-normal--15-140-75-75-C-90-iso8859-1` font as shipped in freeglut, under the XFree86 (MIT) licence. It is copied into the repository with that notice.

## Decisions

1. **Exact GLUT drawing** (owner). The canvas draws each line with the freeglut 9×15 glyphs at one window pixel per glyph pixel, crisp (nearest-pixel), never scaled or rotated. A line whose raster position is outside the program window is not drawn at all. The same drawing is used in the editor and in Run.
2. **Lines are spaced in pixels** (owner). The code keeps one `glRasterPos2f` per line, so the lesson question "how many glRasterPos2f calls?" still holds. The step between lines is worked out so the lines start 17 window pixels apart: `step = 17 / (pixelsPerUnitY × |scaleY|)`, where `pixelsPerUnitY` is `glutInitWindowSize` height divided by the viewing volume's height, and `scaleY` is the text's own scale multiplied by every enclosing group's. The step is written into the code rounded to 4 decimals, and the canvas uses the same rounded number. When the window changes size, the number in the code changes, as `glutInitWindowSize` already does. With a scale of 0, the step is 0.
3. **Text starts at its position** (owner). Line 1's raster position is the text's origin, `glRasterPos2f(0.0f, 0.0f)`, and the letters run right from it, sitting on that baseline. Line n is n − 1 steps lower. Today the lines are centred on the origin both ways; that goes.
4. **Rotate and Scale stay, with a note** (owner). The text keeps Translate, Rotate and Scale, and the code keeps its `glRotatef` and `glScalef`. Text's inspector gets one line of help, in British spelling and silent about gaps: "Bitmap letters are always 9 × 15 pixels and never turn or stretch. Rotate only moves where each line starts." (Builder's wording call: with decision 2, Scale does not move the lines either.)

## Behaviour

- **Editor.** The glyphs are drawn inside the object's own container, so text keeps its place in the drawing order. Each frame, each line's sprite is placed at the window position of its raster position, rounded down to a whole pixel, with the object's rotation, scale and the world's flip cancelled out. A text being dragged, or moved by a rule in Run, therefore keeps its pixel-sized letters.
- **Run.** Rules that move, rotate or scale the text move its raster positions as the compiled program would; the letters stay 9 × 15. Recolour rules redraw the glyphs in the new colour. Run's Keep proportions view moves the raster positions with the view, and the glyphs stay pixel-sized.
- **Hit area and selection.** Clicking on any drawn glyph cell (with the usual padding) selects the text. The selection outline is the axis-aligned box around the drawn lines, so it does not turn with the object. A text with no line drawn (all off-window, or empty) keeps a small hit area at its origin so it can still be found and dragged back.
- **Math panel ring and journey.** The ring and the journey follow line 1's raster position, which is now the origin `(0, 0)`.
- **Fonts.** The canvas no longer depends on Comfortaa for text, so the fallback-serif and clipped-letter bugs go with it.
- **Text inside a group.** Found while building: a group's children were drawn by calling `draw_<name>()`, but text and groups have no draw function of their own, so a group holding text or another group generated a program that did not compile. Their blocks now go inline inside the group, as `draw()` already does for top-level text and groups.

## Content that moves

- The Draw It Yourself capstone (`primitives-lessons.ts`) adds `My scene` at (0, 0.8) as a centred title. It moves left so the label still reads as centred in the default window.
- `manuscript/avp-demo/source/gen.cjs` (outside git): the route text's translate moves to the band's left end and its 0.3 scale goes, then all five beats are regenerated.

## Constraints

- Lands before the Oct 28 freeze, on `feat/glut-bitmap-text`.
- Product rules: generated code stays a pure function of state; no banned words in the note; FSD layering (the font data and line maths in `shared/lib`, the sprites in `shared/engine/pixi`).
- No store version bump: no saved field changes.
- `npm run lint`, `npm run build`, `npm test` pass; the visual suite is re-run and only intended changes are re-recorded, checked pixel by pixel.
- The manuscript is final: the change in how text looks and where it starts goes in the roadmap's divergence list.

## Non-goals

- No other GLUT fonts, no `glutBitmapString`, no stroke fonts.
- No change to the text panel's controls beyond the note.

## Left to the builder

- How the glyph textures are built and cached (one texture per line and colour, nearest-pixel).
- The exact hit padding and the size of the empty-text hit area.
