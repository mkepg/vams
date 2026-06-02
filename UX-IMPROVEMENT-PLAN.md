# VAMS UX Improvement Plan

A prioritized plan to improve the usability of VAMS for its primary user: a student
learning the OpenGL 1.5 fixed-function pipeline. Every item below is grounded in the
current code, with file references so the work is actionable.

Audience reminder: most users will be **first-time students**, not power users. The bar
is "a confused learner can find their way without a manual," not "an expert can move fast."

---

## P0 — Fixes that remove confusion or risk

### 1. Fix the keyboard shortcuts (they currently fight each other and break conventions)

**Evidence:**
- [useKeyboardShortcuts.ts:18](src/shared/hooks/useKeyboardShortcuts.ts#L18) maps **Duplicate to `Ctrl+V`**. `Ctrl+V` universally means *paste*; duplicate is conventionally `Ctrl+D`. A student who copies code from elsewhere and hits `Ctrl+V` over the canvas will silently duplicate an object.
- `Delete`/`Backspace` is handled in **two** places — [useKeyboardShortcuts.ts:38](src/shared/hooks/useKeyboardShortcuts.ts#L38) and [useCanvasInteraction.ts:131](src/features/scene-interaction/model/useCanvasInteraction.ts#L131). They duplicate logic and can diverge (the canvas one handles `GROUP` deletion, the hook one doesn't).
- `Backspace` deletes the selected object. On many setups a stray `Backspace` triggers browser back-navigation *and* destroys work.

**Proposal:**
- Consolidate **all** shortcuts into one place (`useKeyboardShortcuts.ts`); remove the duplicate handler from `useCanvasInteraction.ts` (leave only the `VERTEX_PLACE` mode keys there, which are mode-specific).
- Rebind Duplicate to `Ctrl+D`. Reserve `Delete` for deletion; drop `Backspace` as a delete key outside of vertex-placement mode, or keep it but guard against navigation.
- Make the handler route through the same delete path as the canvas (group-aware).

**Effort:** S.

### 2. Make destructive confirmations non-blocking and recoverable

**Evidence:**
- [LeftSidebar.tsx:33](src/widgets/layout/left-sidebar/LeftSidebar.tsx#L33) uses `window.confirm('Leave current lesson? Progress will be lost.')`. Native `confirm()` is jarring, unstyled, blocks the thread, and can't match the app theme.

**Proposal:**
- Replace native dialogs with a themed in-app modal (you already ship `sonner` for toasts — add a small confirm modal component in `shared/ui`).
- For object deletion, fire a toast with an **Undo** action (`undo()` already exists) instead of, or in addition to, any confirm. This turns a scary action into a recoverable one.

**Effort:** S–M.

### 3. Give tabs real labels and meaningful tooltips

**Evidence:**
- [LeftSidebar.tsx:105-109](src/widgets/layout/left-sidebar/LeftSidebar.tsx#L105-L109) labels the sections `Pipe`, `Prims`, `Bufs`, `Trans`, `Texs`, and the `title` attribute just repeats the same abbreviation ([line 129](src/widgets/layout/left-sidebar/LeftSidebar.tsx#L129)).

**Proposal:**
- Use full words (`Pipeline`, `Primitives`, `Buffers`, `Transforms`, `Textures`) — there is room in a vertical rail, and these are curriculum terms students must learn anyway.
- Make `title` a one-line description of what the section teaches (e.g. "Buffers — vertex arrays, VBOs, and memory layout"), not a repeat of the label.

**Effort:** S.

---

## P1 — Onboarding and discoverability (highest leverage for a teaching tool)

### 4. First-run onboarding

**Evidence:** There is no first-run guidance anywhere in `App.tsx` or the widgets. A student opening VAMS sees a top bar, two sidebars full of panels, and an empty canvas with no next step.

**Proposal:**
- A dismissible welcome card (persist "seen" flag in the existing Zustand `persist` store) that explains the three regions: **left = build**, **center = see**, **right = code + math**.
- A 4–5 step coachmark tour highlighting: section tabs, "add a shape", the live code panel, the math panel, and the Lesson launcher.
- An empty-canvas call to action ("Add your first primitive →") rather than a blank viewport.

**Effort:** M.

### 5. Keyboard shortcut cheat sheet

**Evidence:** Shortcuts exist (undo/redo/duplicate/delete) but are completely undiscoverable.

**Proposal:** A `?` / `F1` overlay listing shortcuts, plus a small "Keyboard shortcuts" entry in the existing `EditorPreferencesMenu`. Drives discovery of the features you already built.

**Effort:** S.

### 6. Stop panels from appearing/disappearing under the user

**Evidence:** In `LeftSidebar.tsx`, panels are conditionally mounted on selection — e.g. `ObjectTransformPanel` only renders when something is selected ([line 82](src/widgets/layout/left-sidebar/LeftSidebar.tsx#L82)), and the Pipeline tab shows `ObjectAppearancePanel` only when *nothing* is selected ([line 51](src/widgets/layout/left-sidebar/LeftSidebar.tsx#L51)). The layout jumps as selection changes, and "where did that panel go?" is a common confusion.

**Proposal:** Keep panels mounted but show an **empty state** ("Select an object to edit its transform") instead of unmounting. Stable layout = lower cognitive load. The scene hierarchy already does this well with its "Scene is empty" message ([SceneHierarchyPanel.tsx:274](src/features/scene-hierarchy/ui/SceneHierarchyPanel.tsx#L274)) — extend that pattern.

**Effort:** M.

---

## P2 — Interaction polish

### 7. Remove the 200 ms click delay on hierarchy items

**Evidence:** [SceneHierarchyPanel.tsx:56-59](src/features/scene-hierarchy/ui/SceneHierarchyPanel.tsx#L56-L59) wraps single-click selection in a 200 ms `setTimeout` to disambiguate from double-click-to-rename. Every selection therefore feels laggy.

**Proposal:** Select immediately on single click; trigger rename from the explicit **Rename** button that already exists ([line 181](src/features/scene-hierarchy/ui/SceneHierarchyPanel.tsx#L181)) or `F2` on the selected item. Removes the delay and the click-timer bookkeeping.

**Effort:** S.

### 8. Strengthen canvas selection/placement feedback

**Evidence:** `CanvasOverlays.tsx` shows a vertex-placement banner and coordinate tracker — good. But there's no hover affordance and clicking empty space silently deselects ([useCanvasInteraction.ts:92](src/features/scene-interaction/model/useCanvasInteraction.ts#L92)).

**Proposal:** Hover highlight on hoverable objects, a clearer cursor change in `VERTEX_PLACE` mode, and a subtle "deselected" cue. In vertex-placement mode, show the live in-banner hint that `Enter` commits / `Esc` cancels / `Backspace` removes last (those keys already work — surface them).

**Effort:** M.

### 9. Move inline styles into SCSS

**Evidence:** The rename `<input>` in [SceneHierarchyPanel.tsx:157-168](src/features/scene-hierarchy/ui/SceneHierarchyPanel.tsx#L157-L168) is styled inline with hard-coded colors (`#3b82f6`, `white`) that ignore the theme system (`data-theme` in [App.tsx:16](src/app/App.tsx#L16)). In dark/light mismatch this looks broken.

**Proposal:** Move to the existing `.scss` and use theme tokens. Audit other inline styles while there.

**Effort:** S.

### 10. Accessibility pass

**Proposal:** Icon-only action buttons need `aria-label` (most have `title`, which helps but isn't equivalent); active tab state shouldn't rely on color alone; ensure focus-visible rings and keyboard operability for the hierarchy tree, modals, and the lesson bar. Important for a thesis defense and for any institutional accessibility requirement.

**Effort:** M.

---

## Suggested sequencing

| Phase | Items | Theme |
|-------|-------|-------|
| 1 | 1, 2, 3 | Stop the bleeding — fix confusing/destructive behavior |
| 2 | 4, 5, 6 | Onboarding & discoverability (biggest learning-outcome win) |
| 3 | 7, 8 | Interaction feel |
| 4 | 9, 10 | Consistency & accessibility |

## How to measure success

Because this is a teaching tool, tie UX to learning, not just clicks:
- **Time-to-first-shape** for a brand-new user (target: under ~60 s without help).
- **Task completion** on the existing exercises without resorting to the manuscript.
- **Error/undo rate** — fewer accidental deletes/duplicates after the shortcut fix.
- **Self-reported confidence** in a short post-session survey (fits thesis evaluation).

---

*Generated from a review of the current `main` branch. File references reflect the code at
the time of writing; verify line numbers before implementing.*
