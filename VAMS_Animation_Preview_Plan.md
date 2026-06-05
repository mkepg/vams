# V.A.M.S. Animation Preview: Implementation Plan

**Feature:** Transformation Playback Preview (with Idle-Callback Demonstration)
**Goal:** Add a visible animation feature that justifies "Animation" in the thesis title without contradicting anything in the manuscript.

---

## 1. The idea in one sentence

Animation in graphics is just transformation over time, so we add a transient preview that animates a selected object's transform across frames, shown as a visual-only overlay on the existing renderer, while never changing the saved scene.

It has two layers:

- **The engine (Option 1):** a playback that animates one object and snaps it back when stopped.
- **The teaching layer (Option 2):** a synced code view showing the GLUT idle callback that produces the same motion, presented inside the existing lesson and demo system.

---

## 2. The rules that keep it defensible

These are hard rules. If a change would break any of them, it does not belong in this feature.

| Manuscript claim | How the feature respects it |
|---|---|
| One-directional data flow | The preview never writes to the scene state. It only updates the on-screen object. |
| No retained simulation state | The animation progress lives in temporary memory, never in the store, and is never saved. |
| No playback engine in the data model | The motion is a visual overlay only. The saved scene has no idea animation is happening. |
| 2D only | All motion is 2D transform animation: rotation, movement, and scaling. |
| Full keyframe animation is future work | This is a minimal single-object preview. No timeline, no keyframes, no export. Those stay future work. |
| The `.vams` project file format | The file format is untouched. A saved project never contains animation data. |

The single decision that makes all of this true: the preview updates only the rendered object, never the application state.

---

## 3. Where it fits

Your stack is Preact for the interface, Zustand for state, and PixiJS for rendering, where the renderer already mirrors each scene object into a matching on-screen display object.

The flow when the user plays:

1. The user clicks Play in the Transforms panel.
2. The preview reads the object's current transform once and stores it as a baseline.
3. A frame loop updates only the rendered object each frame, so the canvas shows motion.

The flow when the user stops:

1. The loop is cancelled.
2. The object is restored to its exact baseline pose.
3. The renderer re-reads from state, so the store is the single source of truth again.

The store and the saved scene sit entirely outside this loop. That separation is the whole defense.

---

## 4. What motions to offer

Each motion is driven by elapsed time and layered on top of the object's saved transform, so stopping always returns to the exact saved pose. Start with four:

1. **Rotate:** spin the object around its pivot.
2. **Pulse:** scale up and down smoothly.
3. **Slide:** move back and forth along one axis.
4. **Orbit:** move on a small circle around its position.

These four are enough to demonstrate animation and map directly onto the three transform operations your Transforms section already teaches (translate, rotate, scale).

---

## 5. What needs to be built

### The renderer lookup

A way to fetch the on-screen display object for a given scene object, so the preview can animate it directly. If the renderer already keeps this mapping internally, just expose a read-only accessor. Do not create a second source of truth.

### The playback controller

The piece that owns the frame loop. Its responsibilities:

- On play: capture the object's current transform as a baseline, then start the loop.
- Each frame: compute the motion from elapsed time and apply it on top of the baseline, updating only the rendered object.
- On stop: cancel the loop, restore the exact baseline, and ask the renderer to re-sync from state.
- On cleanup: always cancel the loop so it never leaks.

It must never call a scene-state setter. This is the rule that protects every claim in section 2.

### The controls

A small control group in the Transforms panel that appears only when exactly one object is selected and the app is in Author Mode. It needs a motion selector (the four options above), a Play and Stop toggle, and a short line of text stating that this is a preview only and nothing is saved. That line quietly reassures both the user and anyone watching a live demo.

---

## 6. The teaching layer (Option 2)

This turns the visual into a teaching moment and ties it to real OpenGL.

### A matching idle-callback snippet

For each of the four motions, show the GLUT idle callback that would produce that same motion in a compiled program. Keep these generated the same deterministic way as your existing code generator, so it is truthful that this code produces this motion. Because the set of motions is small and fixed, this stays honest and consistent.

### A synced highlight

When a preview plays, show that snippet in a small read-only panel beside the canvas, and highlight the exact transform line being animated, reusing your existing code-panel highlighting. The student then sees three things at once: the motion, the transform call, and the idle callback that drives it. This is the same visual-code-math synchronization your whole thesis is built on, now extended to motion.

### A built-in lesson

Add one lesson using your existing lesson system, for example "Animation: Transformation Over Time," with these steps: a short narration that animation is transformation that changes a little each frame, a demo step that auto-plays the rotate preview, the idle-callback snippet with the rotate line highlighted, and a quick exercise asking which line makes the object move. This is the cleanest framing for the defense, because demos and exercises are already documented features you are extending, not new systems you are inventing.

---

## 7. Build order

Build in small, testable slices, matching your milestone style. You can stop after any phase and still have something defensible.

- **Phase 0:** expose the renderer lookup and confirm a way to re-sync the renderer from state.
- **Phase 1:** the playback controller with rotate only, plus a Play and Stop button. Verify stop restores the exact pose. This alone already justifies the title.
- **Phase 2:** add pulse, slide, and orbit, the motion selector, and a speed control.
- **Phase 3:** the matching idle-callback snippets and the synced highlight panel.
- **Phase 4:** the built-in lesson and exercise.
- **Phase 5:** edge-case hardening and polish.

---

## 8. Edge cases to handle

These are exactly what a careful examiner would test.

1. Stop returns the object to its exact saved pose. Verify with a numeric comparison.
2. Selecting another object while playing stops the current preview, so two loops never run.
3. Entering Lesson Mode or switching sections while playing stops the preview.
4. Saving while playing produces the same file as saving while stopped, because state was never changed. This is your strongest defense test.
5. Undo or redo while playing stops the preview first, then runs normally.
6. The frame loop is always cancelled on cleanup so it never leaks.
7. Group objects animate at the group level so children inherit the motion, matching your parent-child model.

---

## 9. Testing

Mirror the black-box and white-box approach from Chapter 3, using your existing naming with the prefix `ANIM`.

Black-box checks: play starts visible motion, stop restores the exact pose, switching objects stops playback, entering Lesson Mode stops playback, saving while playing matches saving while stopped, and each motion type plays distinctly.

White-box checks: the motion progress wraps correctly at the end of a cycle, the baseline is captured and restored exactly, the frame loop is cancelled on stop and cleanup, and the idle-callback snippet generation is deterministic.

Regression: re-run your existing project save-load and undo-redo tests. They should pass unchanged, which is the empirical proof that the architecture claim still holds.

---

## 10. What to leave out

To keep the feature from contradicting your future-work framing, deliberately do not build these. If asked, they are Recommendation 6.

- No multi-keyframe timeline or scrubber.
- No easing-curve editor.
- No video or GIF export.
- No saving animation into the project file.
- No animating several objects at once.

The preview is intentionally single-object and temporary. That restraint is what keeps your roadmap honest.

---

## 11. Defense talking points

- **What it is:** Animation in graphics is transformation over time. The preview animates a selected object's transform across frames and shows the GLUT idle callback that would produce the same motion in a compiled program.
- **Why it does not contradict the manuscript:** It runs as a temporary overlay in the render layer and never changes the saved scene, so one-directional data flow and the absence of retained simulation state both still hold. Saving during playback produces the same file as saving while stopped.
- **Honesty about scope:** It was added after the evaluation as an early version of the animation direction in the recommendations. The 50-student study did not include it, and the full timeline and export system remains future work.
- **Why it belongs in the title:** The tool teaches and now visibly demonstrates the foundations of animation, which is what an introductory course covers.

---

## 12. One honesty reminder

Do not present this preview as part of the evaluated build, and do not fold it into the pre-test and post-test results. Framed as a post-submission demonstration of your roadmap, it strengthens the defense. Framed as something the 50 students tested, it would be a misrepresentation a follow-up question could expose. The transparent version is both safer and more convincing.
