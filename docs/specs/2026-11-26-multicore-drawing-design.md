# Drawing on several cores

After the rasteriser was made faster ([Faster drawing](2026-11-25-lab-drawing-speed-design.md)), the owner chose to go further by drawing each frame on several CPU cores, keeping every pixel. The other way, drawing with the graphics card, was turned down: its pixels would no longer match the Intel references.

## Approaches

- **Bands of rows, one a thread (chosen).** Every pixel takes the same fragments in the same order whichever thread draws it, so the pixels can't change. Each thread does the whole frame's vertex and triangle set-up and only its own rows' pixels.
- **Interleaved rows.** Would balance the work without measuring it, but every primitive, the clear and the bitmap loops would need a row test. Left out.
- **Tiles with binning.** Less repeated set-up, but a larger change to the rasteriser, for a scene size where set-up is small. Left out.

## How it works

`gl-raster` gains a framebuffer **band** (`Framebuffer.band`), which `fragmentBox` cuts every primitive, clear and bitmap to. A triangle's rows are cut before its row loop, so a band costs only its rows. `GLContext` keeps drawing as data (`DrawCommand`: a primitive, a bitmap or a clear, with the state it was issued in), so the frames it holds back and the frames it shares out are the same records. ALG-LAB-42 checks the pixels against drawing the whole window on one thread, for every kind of drawing, for 1 to 7 bands, with and without multisampling, with held frames, and for every gallery scene.

**The Lab.** The program's worker starts up to three helpers (`lab-raster.ts`), one per core beyond two, before the scope is sealed against starting workers. With a pool, the context's framebuffer, its samples and every texture image live in shared memory, and drawing is queued until the framebuffer is read. Then each helper is posted the commands and its band, and the program's worker draws the first band and waits on `Atomics.wait` for the others. A helper is used only once it has said through shared memory that it has started, so a program that draws early draws on its own thread meanwhile. A helper that fails, or doesn't answer within 10 seconds, is stopped, and the frames after go on without it.

**The editor.** The Run view's page isn't cross-origin isolated, so it can't share memory. Its worker starts up to three band workers, sends each the scene, then asks each for a band of every frame, draws the first band itself meanwhile, and puts the rows together. Each frame of the editor's display() clears the whole window first, so one context serves whatever band it is given (`GLContext.drawRows`).

**Balance.** Equal bands left the program's worker waiting for the helpers, whose rows hold more of the jeepney. Each frame's bands are now cut from the last frame's times (`balanceRows`). Each cut moves half way towards where the bands would cost the same, taking each row of a band to cost the same.

**Serving.** On the live site, `public/_headers` gives `/lab/*` the isolation headers, and the build puts `lab-raster` under `/lab/` with the Lab's other workers. `vite preview` now sends the same headers for `/lab` paths, because no browser routing reaches a script a worker starts.

## Measured

In headless Chrome on the reference laptop (16 logical cores), the jeepney street, timed inside the workers:

| | One thread | Four threads, even bands | Four threads, balanced |
| --- | --- | --- | --- |
| Lab, 800 × 450, frame drawn | 12.7 ms | 8.3 to 8.6 ms | 6.7 ms |
| Editor Run view, frame drawn | 14 to 18 ms | 9 to 12 ms | 8 to 9 ms |

Each band costs more than its share, about 4 to 5 ms against 13 ms for the whole, because each thread sets up every shape. On this laptop the Lab already showed all 60 frames a second on one thread. The gain is for slower PCs and for larger scenes.

## Checks

- ALG-LAB-42: bands, the pool, moving bands and `balanceRows`.
- BB-LAB-119: the pool's helper count, start-up, bands, a helper that fails or never answers, and shared texture images.
- The Lab's and the editor's drawing batteries, VIS-LAB-12's speed check and BB-RUN-28 and 29 run unchanged.
