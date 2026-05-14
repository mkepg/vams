# Manual Procedure — `g++` / FreeGLUT Compilation of Generated Code

> **Where this is referenced in the manuscript.**
> * Chapter 3, §3.10.1 (Table 12, "Equivalent C++ OpenGL Code Validation").
> * Chapter 3, §3.10.3 (Algorithm 2, visual-level correctness).
> * Chapter 4, §4.2.5 and §4.4.3 of `chapter-4-testing-results.md`.
>
> **Why this is a manual procedure.** The automated Vitest suite cannot
> shell out to a system C++ toolchain on every developer's machine; doing
> so on CI would require pre-baked Linux/Windows images with FreeGLUT,
> GLEW and a 2-D X server. The procedure below is therefore executed by
> the research team on a designated test workstation, and the resulting
> numbers are inserted into Chapter 4.

---

## Toolchain

| Tool      | Version used | Source                                |
| --- | --- | --- |
| OS        | Windows 11 24H2 / Ubuntu 22.04 (either is fine) | — |
| Compiler  | `g++` 12.x or later | `apt install build-essential` / MSYS2 |
| FreeGLUT  | 3.4.0       | `apt install freeglut3-dev` / `pacman -S mingw-w64-x86_64-freeglut` |
| GLEW      | 2.2.0       | `apt install libglew-dev` / `pacman -S mingw-w64-x86_64-glew` |
| Optional: `stb_image.h` (header-only) | latest | for scenes with textures |

## Scenario Battery

Run the following 7 scenes in V.A.M.S. and "Export → C++ Code" each one.
The first 5 are the source-level scenarios of `ALG-2-01..04`; the last 2
add the texture and indexed-VBO paths.

| ID | V.A.M.S. scene description |
| --- | --- |
| S-1 | Single TRIANGLES primitive at the origin, default scale. |
| S-2 | Two QUADS arranged in a row, with a mouse callback registered. |
| S-3 | A 2-level group: an inner GROUP of {TRIANGLES, QUADS} rotated 45°, plus one TEXT node `"Hello"`. |
| S-4 | LINE_STRIP with `glLineStipple(2, 0xAAAA)` and `glLineWidth(4.5)`. |
| S-5 | TRIANGLES in VBO mode with `bufferUsage = DYNAMIC` (exercises `update_buffers()` and `glutIdleFunc`). |
| S-6 | A textured QUADS using a sample texture (e.g. `samples/checkerboard.png`). |
| S-7 | A TRIANGLE_STRIP using indexed drawing in VERTEX_ARRAY mode. |

## Step-by-step

For each scenario:

1. Open the V.A.M.S. dev server (`npm run dev`).
2. Build the scene per the description in the table.
3. Click **Export → C++ Code**. Save the file as `vams_scene_<ID>.cpp`.
4. Compile:

       g++ vams_scene_<ID>.cpp \
           -o vams_scene_<ID> \
           -lGL -lGLU -lGLEW -lglut

   On Windows / MSYS2, replace the libs with `-lopengl32 -lglu32
   -lglew32 -lfreeglut`. The build is expected to succeed with **zero
   warnings under `-Wall`**.

5. Run the binary; take a screenshot of the rendered window.
6. Take a screenshot of the V.A.M.S. canvas at the same camera /
   viewport.
7. Compare the two screenshots side-by-side. Record the comparison as
   one of: `MATCH`, `MATCH-WITH-NOTE`, `DIVERGE`.
8. Fill in the row in the table below.

## Results Table (fill in)

| ID | Compile  | Run | Visual comparison | Notes |
| --- | --- | --- | --- | --- |
| S-1 |  |  |  |  |
| S-2 |  |  |  |  |
| S-3 |  |  |  |  |
| S-4 |  |  |  |  |
| S-5 |  |  |  |  |
| S-6 |  |  |  |  |
| S-7 |  |  |  |  |

## Computing the metrics in §3.13 / §4.4.3

Let `N` = total scenarios. Let:

* `TP` = scenarios that compiled, ran, and produced a `MATCH` visual.
* `FP` = scenarios that compiled and ran but produced `DIVERGE`.
* `FN` = scenarios that failed to compile or run.

Then:

* `correctnessRate = TP / N`
* `precision       = TP / (TP + FP)`
* `detectionRate   = TP / (TP + FN)`

Quote these three values directly in §4.4.3.
