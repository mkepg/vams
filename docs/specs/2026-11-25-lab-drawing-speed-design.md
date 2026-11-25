# Faster drawing, and a log that always opens

The owner reported two things on 25 Nov 2026: the gallery's jeepney street ran "smoother in the editor than in the Lab by a huge margin", and the Lab's Compiler and Console logs couldn't be opened. Both are fixed here. The owner approved the approach: make the drawing itself faster, and keep the Lab drawing the program's real window size, since drawing at the stage's size would change line widths, point sizes, bitmap text, `glutGet`, reshape and mouse positions against a lab PC.

## Why the Lab was choppier

The editor's Run view and the Lab draw with the same software rasteriser (`src/shared/lib/gl-raster`), both with 4× multisampling. Two things set them apart:

- **Size.** The editor draws at its canvas box's size; the Lab draws the program's window, 800 × 450 for the jeepney, and shrinks it to fit. At a 1280 × 720 browser window the editor drew 536 × 302 and ran at 14.7 frames a second, against the Lab's 7.2.
- **When the Lab draws.** After a frame, the Lab draws the next one only once the page has taken the last, at its next refresh; frames run before then are recorded and dropped (`GLContext.hold`), so a program that steps once a frame keeps a lab PC's pace. A program paced by the clock, as exported VAMS code is, then spins until its next step while the frame it ran waits undrawn. Timing the Lab's worker showed 428 ms of every 3 s spent so.

## What changed

1. **The rasteriser** (`polygons.ts`, `framebuffer.ts`). A profile of the jeepney showed the time in shaded triangles: 275,000 shaded fragments a frame, each through the general fragment path, with arrays made per pixel and vertex colours of mixed array kinds that kept V8 from optimising the loop.
   - A shaded triangle that is untextured and unblended goes through `fillShaded`: the same arithmetic, step for step, on plain numbers.
   - The covered run of a row of a one-colour triangle is written at once (`storeRun`), as words.
   - A pixel whose four samples are all covered is written outright, which averaging four equal samples would give.
   - The deferred average copies a pixel of four equal samples as one word, without making a view a pixel.

   The jeepney went from 44 ms a frame to about 19 ms multisampled, and from 27 ms to 13 ms without, in Node (CPU time, best of five batches). Every pixel is the same: the frame's hash is unchanged, and the drawing batteries compare every pixel with the Intel references.
2. **Drawing the held frame when the page takes the last** (`glut-runtime.ts`). Once the page has taken the last frame, a frame held since is drawn straight away, before the program's next idle call, and the hold is decided again as after any frame. It is the newest frame the program ran, drawn as it would have been. The hold rule itself stays, so BB-LAB-100's pacing holds.

In headless Chrome on the reference laptop, with another job loading the CPU, the jeepney went from 6.3 frames a second in the Lab and 7.7 in the editor to about 19 in both.

3. **The log.** The log is a slim bar while it has nothing in it, and Show log was disabled then, so after a program that compiles cleanly and prints nothing (the jeepney) neither Show log nor the tabs opened it. Now both open it, and an empty tab says why: "No errors or warnings." or "The program hasn't printed anything." after a Run, and what will appear there before one.

## Checks

- ALG-LAB-41: a row run and the deferred average leave what pixel-by-pixel writes leave.
- BB-LAB-108: the log opens empty from Show log or a tab, before and after a clean Run, and each tab says why it is empty.
- BB-LAB-100, the ALG-LAB rasteriser tests, the editor's and the Lab's drawing batteries and VIS-LAB-12's speed check run unchanged.
