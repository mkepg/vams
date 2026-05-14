# Manual Procedure — Cross-Browser Compatibility

> **Where this is referenced in the manuscript.**
> * Chapter 3, §3.10.1 (Table 12, "Cross-Browser Compatibility" row).
> * Chapter 4, §4.2.8 of `chapter-4-testing-results.md`.

The version floors stated in Table 12 are **Chrome ≥ 99**,
**Firefox ≥ 101**, **Edge ≥ 121**. The procedure below covers those
three browsers; results should be filled into §4.2.8 once collected.

## Pre-flight

1. From a clean clone, run `npm install`.
2. Start the dev server: `npm run dev`. Note the local URL Vite picks
   (e.g. `http://localhost:5173/`).
3. Open the URL in each target browser in a private / incognito session
   (so that no cached state from prior runs contaminates the test).

## The 12 representative tasks

Each browser must complete the same 12 tasks in order. These match the
8 modules in Table 12 so that the row-by-row pass/fail matrix in §4.2.8
is meaningful.

| # | Task | Module |
| -- | --- | --- |
| 1  | Place a TRIANGLES primitive by clicking three points on the canvas. | Primitive Creation |
| 2  | Edit one vertex's color via the color picker.                | Primitive Creation |
| 3  | Translate, rotate (45°) and scale (×2) the triangle.         | Transformations |
| 4  | Create a second QUADS and group it with the triangle.        | Hierarchy |
| 5  | Set a `glutKeyboardFunc` handler name.                       | Code Generation |
| 6  | Open the Code panel; confirm the generated code updates live. | Code Generation |
| 7  | Click "Export → C++ Code" and save the file.                 | C++ Code Validation |
| 8  | Start the "Drawing a Triangle" demo lesson; advance 3 steps. | Lesson Engine |
| 9  | Exit the lesson and confirm the user scene is restored.      | Lesson Engine |
| 10 | "Save Project"; reload the page; "Load Project" the file.    | Project Persistence |
| 11 | Toggle dark / light theme; confirm canvas colors update.     | Cross-Browser |
| 12 | Open the dev-tools console; confirm no JS errors.            | Cross-Browser |

## Results Matrix (fill in)

| Task | Chrome ≥ 99 | Firefox ≥ 101 | Edge ≥ 121 |
| --- | --- | --- | --- |
| 1  |  |  |  |
| 2  |  |  |  |
| 3  |  |  |  |
| 4  |  |  |  |
| 5  |  |  |  |
| 6  |  |  |  |
| 7  |  |  |  |
| 8  |  |  |  |
| 9  |  |  |  |
| 10 |  |  |  |
| 11 |  |  |  |
| 12 |  |  |  |

`PASS` / `FAIL` per cell. Notes (slow rendering, layout glitches, etc.)
go in a footnote beneath the table when inserted into §4.2.8.
