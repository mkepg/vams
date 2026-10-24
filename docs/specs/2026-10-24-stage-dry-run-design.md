# Stage dry run fixes

## Purpose

Before the Oct 28 editor freeze, the whole expo talk was run against the production build at 1920 × 1080, 1366 × 768 and 1280 × 720, in both themes. The run covered the seven slides in stage mode, the gallery, the jeepney street in the editor (Run, Space, selecting an object, the code and the math) and the "Place the Point" lesson. The live part of the talk is not fixed yet, so the fixes favour whatever the presenter is likely to do with the gallery's lead scene.

The slides fit every size with no sideways scroll, and the browser logged no errors or warnings. Four things looked rough on stage. This change fixes them.

## Fixes

| What the audience saw | Fix |
|---|---|
| The scene list cut names such as "Front…" and "Rear …" to make room for action buttons that were invisible | The actions sit over the end of the row. Only the row showing them (hover, or keyboard focus inside it) gives up room for them; a button that keeps focus after a click does not hold them open. Every row keeps its height. |
| Choosing an object in a large scene left the code where it was, so its `draw_` function stayed folded far down the panel | When the selection changes and none of the object's lines is on screen, the code scrolls them to the top: its `draw_` function, or for a group or text its inline lines in `draw()`. An edit that moves the lines does not scroll. Run's branch, a lesson's highlight, and changed values that scroll in the same update keep their place. Inline draws now nest in the code outline, so a group or text inside a group owns its own lines and its code opens when it is chosen. |
| After a key in Run, the code scrolled 2,000 lines over about a second and arrived after the 700 ms flash had ended and the branch had folded again | A scroll longer than two screens jumps instead of gliding. The last branch Run fired stays unfolded, unlit, until Run stops. |
| The slide "Built like the thing it teaches" said "More than 270 automated tests" | It says "More than 1,600". |

Stepping past the last slide now opens the jeepney street (`/app?scene=jeepney-street`) instead of the starter triangle, so the clicker lands on a scene that runs.

## Tests

- BB-RUN-25: the Run snapshot keeps `lastFired` after the flash clears and drops it on Stop; the code panel shows the held branch unfolded without the flash class.
- BB-CODE-40: `scrollBehavior` glides within two screens and jumps beyond, and always jumps with reduced motion; `revealTop` centres lines that fit.
- BB-CODE-41: a new selection scrolls an off-screen `draw_` function to the top; reselecting with it on screen, or editing, does not scroll; an edit's leftover marks do not stop the next selection; a group follows to its inline lines.
- WB-CODE-33: inside `draw()`, each nested group or text owns the lines that move it.
- BB-HOME-17 now expects the jeepney street after the last slide.
- The visual suite passes against the existing baselines (111 checks).

## Left as it is

- Idle rules step once per display frame, as GLUT's idle callback runs as often as it can. On a 60 Hz projector the jeep takes about 3½ seconds to drive off; a faster display drives it faster.
- The jeepney street takes about 2 s to draw on a cold load (the lesson about 1.5 s). Opening the scene once before the talk, as the rehearsal checklist says, keeps it warm.
