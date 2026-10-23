# Run and Callbacks leftovers

## Purpose

When functional callbacks shipped on 2026-10-12, small issues were left open and listed in the roadmap under "Known issues carried forward → Functional callbacks". Several of them could show in the expo's live demo. This change fixes those that still exist on `main`, before the Oct 28 editor freeze.

## Fixed

The numbers are the roadmap's.

Run mode:

- **3. Cursor readout.** While Run is on, the canvas header and the Pipeline math show the pointer as the generated `windowToWorld` computes it, using Run's current viewing volume and window. With Reshape set to Keep proportions, that is the widened volume.
- **4. Branch flash.** A repeat of the same call restarts the flash, so every key press shows. The code panel scrolls to a fired branch once. A repeat of the same branch does not scroll again, so a student who scrolls away during Run is not pulled back.
- **5. Motion order.** Motion still waiting for the next frame is delivered before a Mouse down or up. GLUT reports events in the order they happen.
- **6. Second button.** A second mouse button pressed or released while another is held reaches the Mouse handler. Pointer Events report it as a move whose `buttons` changed.
- **7. Focus after Run.** Run returns focus to the Run button only when focus was in the program window or lost with it. When a store change stops Run, focus stays where it is.

Callbacks panel and generated code:

- **13. Object menu.** A rule whose target is no longer eligible still shows that target in its Object menu, so the menu matches the summary line and the code.
- **14. Do menu.** The Do menu lists only actions that have a target. With only groups in the scene, Set colour is left out.
- **15. New rule trigger.** A new rule takes the first trigger no rule uses yet. The teaching order (D A W S, → ← ↑ ↓, left button first) comes first, then every other key. It repeats a trigger only when every trigger is taken.
- **16. Focus after Delete.** Delete moves focus to the next rule, or to the previous one, or to Add rule. A form whose rule was removed by undo stays closed when redo brings the rule back.
- **17.** Rule summary lines use the panel's font.
- **18. Hidden targets.** When a callback has rules but every rule acts on a hidden object, its handler comment says so instead of "No rules yet".
- **19. Library names.** A handler name that clashes with the program's libraries is refused with the usual message. That covers C and C++ standard functions the headers declare (such as `rand`, `abort`, `clock`, `sin`), the Windows `near` and `far` macros, names starting with `GL_`, `GLU_`, `GLUT_` or `GLEW_`, and OpenGL-style names such as `glClear` or `glutInit`.
- **20. Store guards.** The add and update rule actions lower-case keyboard keys and refuse keys outside the key list. Non-finite numbers become the field's default instead of `NaNf`.
- **21. Rule ids.** Rules loaded from a file get unique ids, even when the file repeats an id or leaves ids out.

Tests:

- **23.** BB-CB-12 writes its fixture only when `WRITE_CALLBACK_FIXTURE=1`. A missing fixture fails the test instead of passing it.

## Already resolved or left as is

- **8.** The File menu closes on any outside press and on Tab, so it can no longer stay open when Run starts.
- **22.** The arrow-keys exercise was rewritten with the lesson content. Its goals check the handler and both rules together.
- **9.** A theme change during Run stays open. The top bar is inert during Run, so a student cannot reach it.
- **24–35** stay on the list. They are tests and tidiness items that a student cannot see.

## Constraints

- Run never writes scene state. The cursor readout is interaction state, outside the store's history and persistence, and Run's store watcher ignores it.
- Student-facing text follows the product rules: British spelling, and silence about gaps.
- New tests take the next free number in their file.
