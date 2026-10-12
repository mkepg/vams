# Functional callbacks — design

Date: 2026-10-12
Roadmap item: 13 (Should) in [the overhaul roadmap](2026-10-04-website-overhaul-roadmap.md)
Deadline: merged before the Oct 28 editor freeze

## Purpose

Today the Callbacks group registers a handler name per GLUT event. The generator emits the `glut*Func` registration and an empty handler with a comment such as "Add your keyboard logic here". Nothing in VAMS shows what a handler does.

This work lets students define what each callback does, in the GUI, as a short list of rules. The generator turns the rules into real handler bodies, and a **Run** state on the canvas plays the program's events live: keys, clicks, drags, window resizes and idle frames. Run never writes scene state. When it stops, the canvas returns to the scene as built.

Teaching comes first: students see how an event handler changes program state and asks GLUT to redraw. The same feature gives the Nov 4 talk a live moment: press an arrow key, the shape moves, and the line of C++ that moved it lights up.

Out of scope: typed C++ in handlers, timers (`glutTimerFunc`), keyframes, rules that create or delete objects, and handlers for keys other than those listed below.

## Owner decisions (2026-10-12)

| Question | Decision |
| --- | --- |
| Purpose | Both teaching and the expo, teaching first |
| How behaviours are defined | Rules per callback, built from menus. Each rule becomes real lines in its handler |
| Actions | Transform (translate, rotate, scale), move to pointer, reset, colour, and visibility |
| Arrow keys | A sixth callback, Special keys (`glutSpecialFunc`) |
| Idle | Per-frame rules, run beside the saved animations in `_vams_idle()` |
| Reshape | No rules. A choice: Keep proportions or Stretch |
| Editing during Run | Paused. Stop or Esc ends the run and restores the scene |
| Run button | On the canvas, top-right. The Callbacks group also has a "Try it" link |
| Lessons | The callbacks demo and the mouse exercise use rules and Run; a new exercise, "Drive with the Arrow Keys". The course grows to 46 lessons |
| Rule layout | One summary line per rule; clicking a line opens its form under it |
| Code feedback during Run | The handler branch that fired flashes in the code panel |
| Run look | A cobalt strip with Stop, a cobalt ring, and a readout of the last GLUT call with its arguments |
| Reshape during Run | A drag handle resizes the program window inside the canvas |
| Approach | One rule model with two readers: a pure generator and a pure runtime |

## 1. Rule model

### Callbacks

Six callbacks, in this order everywhere (panel, generated code, `main()` registrations):

| Kind | Label | GLUT call | Handler signature | Default name |
| --- | --- | --- | --- | --- |
| `keyboard` | Keyboard | `glutKeyboardFunc` | `void name(unsigned char key, int x, int y)` | `onKey` |
| `special` | Special keys | `glutSpecialFunc` | `void name(int key, int x, int y)` | `onSpecial` |
| `mouse` | Mouse | `glutMouseFunc` | `void name(int button, int state, int x, int y)` | `onMouse` |
| `motion` | Motion | `glutMotionFunc` | `void name(int x, int y)` | `onMotion` |
| `reshape` | Reshape | `glutReshapeFunc` | `void name(int width, int height)` | `onReshape` |
| `idle` | Idle | `glutIdleFunc` (through `_vams_idle`) | `void name()` | `onIdle` |

### Types (in `core/types/scene.ts`)

```ts
export type GlutCallbackKind = 'keyboard' | 'special' | 'mouse' | 'motion' | 'reshape' | 'idle';
export type RuleCallbackKind = Exclude<GlutCallbackKind, 'reshape'>;

export type SpecialKey = 'up' | 'down' | 'left' | 'right';
export type MouseButton = 'left' | 'middle' | 'right';
export type MouseState = 'down' | 'up';

export type RuleTrigger =
  | { kind: 'keyboard'; key: string }          // one of a–z, 0–9, ' '; letters stored lower case
  | { kind: 'special'; key: SpecialKey }
  | { kind: 'mouse'; button: MouseButton; state: MouseState }
  | { kind: 'motion' }
  | { kind: 'idle' };

export type RuleAction =
  | { type: 'translate'; dx: number; dy: number }
  | { type: 'rotate'; degrees: number }
  | { type: 'scale'; sx: number; sy: number }
  | { type: 'moveToPointer' }
  | { type: 'reset' }
  | { type: 'setColor'; color: string }        // '#rrggbb'
  | { type: 'visibility'; mode: 'show' | 'hide' | 'toggle' };

export interface CallbackRule {
  id: string;
  objectId: string;
  trigger: RuleTrigger;
  action: RuleAction;
}

export type ResizeMode = 'keep' | 'stretch';

export interface RuleCallback { handlerName: string; rules: CallbackRule[] }
export interface ReshapeCallback { handlerName: string; resize: ResizeMode }

export interface CallbacksState {
  keyboard: RuleCallback;
  special: RuleCallback;
  mouse: RuleCallback;
  motion: RuleCallback;
  reshape: ReshapeCallback;
  idle: RuleCallback;
}
```

A callback is **registered** when its trimmed handler name is non-empty. It is **valid** when the name is a C++ identifier (`/^[A-Za-z_][A-Za-z0-9_]*$/`) and not reserved. Reserved names are `main`, `init`, `display`, `draw`, `update_buffers`, `windowToWorld`, `_vams_idle`, the view globals `viewMinX`, `viewMaxX`, `viewMinY` and `viewMaxY`, any name starting with `draw_`, `animate_`, `state_` or `initial_`, any per-object generated prefix (`vbo_`, `cbo_`, `ebo_`, `uvbo_`, `verts_`, `colors_`, `uvs_`, `indices_`, `tex_`, `baseX_` and the like), and C++ keywords (the list lives beside the regex). An invalid name is flagged in the panel, and that callback is left out of the generated code and of Run until it is fixed.

### Triggers and actions

| Callback | Trigger fields | Allowed actions |
| --- | --- | --- |
| Keyboard | key: a–z, 0–9 or Space. Letters match both cases | all except Move to pointer |
| Special keys | ↑ ↓ ← → | all except Move to pointer |
| Mouse | button (left, middle, right) and state (Down, Up) | all |
| Motion | none: every drag movement | all |
| Idle | none: every frame | all except Move to pointer |

Action values and limits (the form clamps, the sanitizer clamps):

| Action | Fields | Default | Limits |
| --- | --- | --- | --- |
| Translate | dx, dy | 0.10, 0.00 | −10 to 10, step 0.01 |
| Rotate | degrees | 15 (Idle: 1) | −360 to 360, step 1 |
| Scale | sx, sy | 1.10, 1.10 | 0.10 to 10, step 0.01 |
| Move to pointer | none | | top-level objects only |
| Reset | none | | |
| Set colour | colour | the object's first vertex colour | `#rrggbb` |
| Visibility | Show, Hide or Toggle | Toggle | |

Targets:

- Any object can be a target, including groups and text, since every object has a `state_<name>`.
- Move to pointer lists only top-level objects. A child's position is relative to its group, so the pointer's world position would place it wrongly.
- Set colour lists only objects that draw vertices or text, so groups are left out.
- Actions on a group move, hide or reset its children with it, because the children are drawn inside the group's matrix and visibility check.

Objects hidden in the editor are left out of the generated program, so rules that target them are left out of the handler bodies and are skipped by Run.

Rules run in list order. Rules sharing a trigger (two rules on the D key) are grouped into one branch, in the order they appear. Each callback holds up to **8 rules**.

### Store

The callbacks slice keeps its name and file. Its actions are as follows; every one that changes data pushes history:

- `setCallbackHandler(kind, name)`: sets the handler name. On an unregistered callback, it creates an empty one, or one with `resize: 'keep'` for Reshape. The current signature stays, so lessons and tests keep working.
- `clearCallback(kind)`: removes the callback: the name, its rules, and the resize choice, which goes back to `'keep'`.
- `addCallbackRule(kind, rule)`: ignored at 8 rules, or when the trigger's kind doesn't match `kind`.
- `updateCallbackRule(kind, ruleId, patch)`.
- `removeCallbackRule(kind, ruleId)`.
- `setReshapeMode(mode)`.
- `getRegisteredCallbacks()`: returns the valid registered callbacks in the table order above.

Rule ids use the same id helper the texture slice uses (`crypto.randomUUID` with a fallback).

Undo history snapshots gain `callbacks`, so undo and redo restore the callbacks along with the objects. Today a snapshot holds the objects and the selection only.

When an object is deleted, every rule that targets it, or targets one of its deleted descendants, is removed in the same history step. Undo restores both. Renaming an object changes nothing in the rules, since they hold the id. The generated code picks up the new name.

### Saving

- **Browser storage.** The persisted store goes from `version: 7` to `version: 8` and gains a `migrate` function. A version 7 `callbacks` record, a name per kind, becomes `{ handlerName, rules: [] }` for each rule kind and `{ handlerName, resize: 'stretch' }` for Reshape. Stretch matches what the old stub did, `glViewport` only. `special` starts empty. `callbacksBackup`, the copy a lesson keeps, migrates the same way. No other persisted field changes.
- **Project files.** `VAMS_PROJECT_SCHEMA_VERSION` goes from 8 to 9. `sanitizeCallbacks`:
  - accepts both the old string form (migrated as above) and the new form;
  - drops rules whose object id does not exist or whose trigger or action is malformed;
  - clamps values to the limits above and keeps at most 8 rules per callback.
- **Lesson reset.** Lessons that reset callbacks, and the lesson-runner defaults, use the new empty shape.

## 2. Generated code

Scenes with no registered callbacks generate exactly the same program as today, character for character. The only exception is the empty-handler comment described below, which only exists when a callback is registered. The C++ below is the contract. Numbers use the existing `toFixed(2)` float style for rule values and `toFixed(4)` for view bounds.

### Object state

`struct ObjectState` gains fields **only when the scene has a colour or visibility rule**:

```cpp
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
    float r, g, b;
    bool useColor;
    bool visible;
};
```

With these fields present, every initializer gets `, 0.0f, 0.0f, 0.0f, false, true` added at the end.

A **Reset** rule adds one line per targeted object, after the `state_` lines:

```cpp
const ObjectState initial_Triangle = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
```

A Reset action is `state_Triangle = initial_Triangle;`.

### Visibility and colour in drawing

- **Visibility.** For an object targeted by a visibility rule, its draw code is wrapped as `if (state_<name>.visible) { … }`. In `draw()` that is the `draw_<name>();` call, or the inlined group or text block. Inside a group's children list it is the child's call.
- **Colour, immediate mode and text.** For an object targeted by a Set colour rule, each `glColor3f(…)` or `glColor3ub(…)` line in its draw code is guarded as `if (!state_<name>.useColor) glColor3f(…);`. One line before `glBegin` (for text, before `glRasterPos2f`) reads `if (state_<name>.useColor) glColor3f(state_<name>.r, state_<name>.g, state_<name>.b);`.
- **Colour, vertex array and VBO modes.** The line that enables `GL_COLOR_ARRAY` becomes:

  ```cpp
  if (state_Triangle.useColor) glColor3f(state_Triangle.r, state_Triangle.g, state_Triangle.b);
  else glEnableClientState(GL_COLOR_ARRAY);
  ```

  The matching disable stays unconditional, since disabling an array that is off is harmless. The other array setup lines stay as they are.

### Action lines

Each action becomes these lines inside its branch (`S` is `state_<name>`):

| Action | C++ |
| --- | --- |
| Translate | `S.x += 0.10f;` and `S.y += 0.00f;` (a zero component is still written, so the line count is predictable) |
| Rotate | `S.rotation += 15.00f;` |
| Scale | `S.scaleX *= 1.10f;` and `S.scaleY *= 1.10f;` |
| Move to pointer | `S.x = wx;` and `S.y = wy;` |
| Reset | `S = initial_<name>;` |
| Set colour | `S.r = 1.00f;`, `S.g = 0.50f;`, `S.b = 0.00f;`, `S.useColor = true;` |
| Show, Hide, Toggle | `S.visible = true;`, `S.visible = false;`, `S.visible = !S.visible;` |

### Handlers

Handlers appear where the stubs are today, in the table order, each preceded by `// <Label> callback: <GLUT call>`.

Keyboard, one branch per key in the order keys first appear:

```cpp
// Keyboard callback: glutKeyboardFunc
void onKey(unsigned char key, int x, int y)
{
    switch (key) {
    case 'd':
    case 'D':
        state_Triangle.x += 0.10f;
        state_Triangle.y += 0.00f;
        break;
    case ' ':
        state_Triangle.visible = !state_Triangle.visible;
        break;
    }
    glutPostRedisplay();
}
```

Digits and Space get one `case` label. Letters get the lower- and upper-case labels.

Special keys, with labels `GLUT_KEY_UP`, `GLUT_KEY_DOWN`, `GLUT_KEY_LEFT` and `GLUT_KEY_RIGHT`:

```cpp
// Special keys callback: glutSpecialFunc
void onSpecial(int key, int x, int y)
{
    switch (key) {
    case GLUT_KEY_RIGHT:
        state_Triangle.x += 0.10f;
        state_Triangle.y += 0.00f;
        break;
    }
    glutPostRedisplay();
}
```

Mouse, one `if` per button and state pair in the order they first appear:

```cpp
// Mouse callback: glutMouseFunc
void onMouse(int button, int state, int x, int y)
{
    if (button == GLUT_LEFT_BUTTON && state == GLUT_DOWN) {
        float wx, wy;
        windowToWorld(x, y, &wx, &wy);
        state_Square.x = wx;
        state_Square.y = wy;
    }
    glutPostRedisplay();
}
```

The branch declares `float wx, wy;` and calls `windowToWorld` once, at its top, only when it contains a Move to pointer rule. The buttons are `GLUT_LEFT_BUTTON`, `GLUT_MIDDLE_BUTTON` and `GLUT_RIGHT_BUTTON`, and the states `GLUT_DOWN` and `GLUT_UP`.

Motion and Idle have no branches. Their rule lines sit directly in the body, with the pointer conversion at the top when needed:

```cpp
// Motion callback: glutMotionFunc
void onMotion(int x, int y)
{
    float wx, wy;
    windowToWorld(x, y, &wx, &wy);
    state_Square.x = wx;
    state_Square.y = wy;
    glutPostRedisplay();
}
```

A registered callback with no rules has the body `    // No rules yet: add them in the Callbacks group` followed by `    glutPostRedisplay();`.

`_vams_idle()` is unchanged. It calls the animators, then `update_buffers()`, then the Idle handler, whose body ends in `glutPostRedisplay()`.

### Reshape

Stretch:

```cpp
// Reshape callback: glutReshapeFunc
void onReshape(int width, int height)
{
    // Stretch: the viewing volume fills the window, whatever its shape
    glViewport(0, 0, width, height);
    glutPostRedisplay();
}
```

Keep proportions. The numbers come from the saved viewing volume: `cx` and `cy` are its centre, and `halfW` and `halfH` are its half extents.

```cpp
// Reshape callback: glutReshapeFunc
void onReshape(int width, int height)
{
    // Keep proportions: widen the viewing volume to match the window's shape
    glViewport(0, 0, width, height);
    float aspect = (float)width / (float)(height > 0 ? height : 1);
    float cx = 0.0000f, cy = 0.0000f;
    float halfW = 1.0000f, halfH = 1.0000f;
    if (aspect >= halfW / halfH) halfW = halfH * aspect;
    else halfH = halfW / aspect;
    viewMinX = cx - halfW;
    viewMaxX = cx + halfW;
    viewMinY = cy - halfH;
    viewMaxY = cy + halfH;
    glutPostRedisplay();
}
```

### The view globals and `windowToWorld`

When the scene has a Keep proportions reshape or a Move to pointer rule, the program:

- declares the view after the state block:

  ```cpp
  // --- View (the glOrtho bounds, updated by the reshape callback) ---
  float viewMinX = -1.0000f, viewMaxX = 1.0000f, viewMinY = -1.0000f, viewMaxY = 1.0000f;
  ```

- has `display()` call `glOrtho(viewMinX, viewMaxX, viewMinY, viewMaxY, -1.0, 1.0);` in place of the literal bounds;
- adds a helper when a Move to pointer rule exists, placed before the handlers:

  ```cpp
  // Convert a window pixel (GLUT's origin is top-left) to world coordinates
  void windowToWorld(int x, int y, float* wx, float* wy)
  {
      int w = glutGet(GLUT_WINDOW_WIDTH);
      int h = glutGet(GLUT_WINDOW_HEIGHT);
      *wx = viewMinX + (viewMaxX - viewMinX) * x / (float)(w > 0 ? w : 1);
      *wy = viewMaxY - (viewMaxY - viewMinY) * y / (float)(h > 0 ? h : 1);
  }
  ```

### Registrations

`main()` registers the callbacks in the table order, adding `glutSpecialFunc(name);` between Keyboard and Mouse. Idle is still registered as `glutIdleFunc(_vams_idle)`.

### Where the code lives

- Handler bodies, the state fields, the view globals and `windowToWorld` are generated in `features/code-generation/model/generator/handlers.ts`, plus small changes in `state.ts`, `render.ts`, `buffers.ts` and `code-generator.ts`. The generator reads only the `core` types.
- A pure helper, `locateHandlerBranch(code, handlerName, trigger)`, also in `code-generation`, returns the 0-based line numbers of the branch for a trigger: from its first `case` or `if` line through its `break;` or closing brace. For Motion and Idle it returns the handler body. For Reshape (`trigger` is `null`) it returns the handler body. Run uses it to flash lines.

## 3. The Callbacks group

The group stays in scene settings, with panel id `callbacks-panel` and title "Callbacks".

**The note** at the top reads:

> Each callback's rules become the body of its handler in the generated code. Press Run on the canvas to try them: keys, clicks and drags go to your handlers, and your scene is unchanged when you stop.

It ends with a **Try it** link-styled button that starts Run. It is disabled under the same conditions as the Run button.

**Each callback row** keeps the icon, label, description, `GlHint`, the On/Off toggle and the handler name input:

- Special keys uses the `ArrowRightLeft` icon and the description "Fires on arrow keys."
- Turning a callback **On** registers it with the default name. **Off** calls `clearCallback`, and Undo brings everything back.
- The name error reads "Use a C++ name VAMS doesn't already use, like onKey." when a name is invalid or reserved.

**Rules** (rule callbacks only, shown while the callback is registered):

- **The list.** Each rule is one summary line: a key-cap or trigger chip, then the action sentence:
  - Keyboard: `D` / `Space`. Special keys: `↑ ↓ ← →`. Mouse: `Left down`, `Right up`. Motion: `Drag`. Idle: `Frame`.
  - Sentences: `Translate Triangle (0.10, 0.00)`, `Rotate Triangle 15°`, `Scale Triangle (1.10, 1.10)`, `Move Square to the pointer`, `Reset Triangle`, `Colour Triangle #ff8000` (with a swatch), `Show Triangle`, `Hide Triangle`, `Toggle Triangle`.

  The line is a button. Its accessible name is the full sentence, for example "Rule: when D is pressed, translate Triangle by 0.10, 0.00. Edit".
- **The form.** Clicking a line opens its form directly under it. Only one form is open at a time. The form's fields:
  - **When**: the trigger, absent for Motion and Idle.
  - **Do**: the action.
  - **Object**: the target, filtered as described in section 1.
  - The action's value fields: `NumberField`s for numbers, the existing colour picker for colour, a segmented control for visibility.

  It ends with **Delete** and **Done** buttons. Edits apply as they are made. Done and Esc close the form and return focus to the line.
- **Adding.** **+ Add rule** appends a rule and opens its form. The new rule targets the first top-level object in the Scene list. Its trigger is the first one not yet used: for Keyboard D, then A, W, S; for Special keys →, ←, ↑, ↓; for Mouse left down. Its action is Translate (0.10, 0.00), or Rotate 1° for Idle.
- **Limits.** At 8 rules the button is disabled and reads "8 rules is the limit". With no objects in the scene it is disabled and reads "Add a shape first".
- **Picking a target.** The group lives in scene settings, which show only while nothing is selected, so targets are picked from the Object menu, never by selecting on the canvas.

**Reshape** shows a segmented control, **Keep proportions** | **Stretch**, under its name. It has no rules.

The rule line, form and list are new components in `features/callbacks/ui/`. They use the shared controls (`Button`, `NumberField`, `Select`, `Segmented`, `GlHint`) and the tokens. No new raw font sizes, no uppercase (BB-SHELL-22/23).

## 4. Run

### Starting and stopping

- **The Run button.** It sits on the canvas, top-right: a primary small button with a Play icon labelled "Run".
  - It is enabled when the scene has at least one object and at least one valid registered callback or saved animation. Otherwise it is disabled, with the tooltip "Add a callback or an animation to run".
  - The animation preview's code overlay moves down to clear it.
- **Starting.** Run starts from the button or from "Try it". Starting Run stops a playing animation preview.
- **Stopping.** These stop Run:
  - the strip's **Stop** button, or **Esc**;
  - any change to scene state, including undo and redo (the same store watch the animation controller uses: objects, callbacks, selection, `appMode`, `activeSection`, `past` and `future`);
  - leaving the editor (the controller's cleanup runs on unmount).
- **What Stop restores.**
  - The live display objects go back to their saved transforms through `renderBridge.resync()`.
  - Colour and visibility overrides are cleared.
  - The view goes back to the editor's viewport transform.
  - The window frame is removed.
  - Focus returns to the Run button.
- **Not a third mode.** Run is a transient canvas state in Author and Lesson mode alike. It is not a mode, and `appMode` does not change.

### While running

- **Paused editing.**
  - The top bar's actions, the editor column (lesson card, Scene list, inspector) and the math panel get the `inert` attribute.
  - The code panel stays readable and scrollable.
  - A transparent run surface covers the canvas, so no canvas editing gesture (select, drag, vertex placement) reaches the editor.
- **The strip.** A cobalt strip runs across the top of the canvas and a 3px cobalt ring surrounds it. The strip reads **Running**, then "Keys, clicks and drags go to your handlers · Esc stops", then the **Stop** button. The text uses `--text-sm`; Stop is a small secondary button on the strip.
- **The call readout.** It sits at the bottom of the canvas in mono `--text-sm`. It shows the last GLUT call to a registered handler, with real arguments in GLUT's own terms:
  - `onKey('d', 412, 230)`, with `' '` for Space;
  - `onSpecial(GLUT_KEY_RIGHT, 412, 230)`;
  - `onMouse(GLUT_LEFT_BUTTON, GLUT_DOWN, 412, 230)`;
  - `onMotion(412, 230)`;
  - `onReshape(640, 360)`.

  Idle calls are not shown, since they happen every frame. Before any call, it reads "Waiting for an event". `x` and `y` are integer pixels from the program window's top-left corner, with y pointing down as in GLUT. Keyboard and Special keys report the pointer's last position over the window, or `0, 0` before it has moved.
- **Accessibility.**
  - The strip's "Running" is announced once through a polite live region. The readout is not a live region, because it changes on every drag.
  - On start, focus moves to the run surface. Its `tabindex` is 0 and its label is "Running program. Keys, clicks and drags go to your handlers. Press Escape to stop."
  - Tab and Shift+Tab are not captured, so Stop is reachable.

### Events

Run listens on the run surface and the window (keys) while it is active, and reproduces GLUT's dispatch:

- **Keys.**
  - Captured in the capture phase. `preventDefault` stops scrolling and browser shortcuts. Editor shortcuts never see the keys.
  - A printable key in the Keyboard set (`a–z`, `A–Z`, `0–9`, Space) calls the Keyboard handler with that character. Letters keep the case typed, and rules match either case.
  - The four arrows call the Special keys handler.
  - Esc stops Run and is never delivered. Other keys are ignored.
  - Key repeat is delivered, as GLUT does by default.
- **Mouse.** `pointerdown` and `pointerup` on the run surface call the Mouse handler with the button and state. The run surface captures the pointer between down and up.
- **Motion.** `pointermove` while any button is down calls the Motion handler, at most once per animation frame (the last position wins).
- **Reshape.**
  - At start, Run calls the Reshape handler once with the window's size, as GLUT does when the window opens.
  - Afterwards it calls it whenever the size changes through the drag handle, at most once per animation frame.
  - With no Reshape handler, the window behaves like Stretch, as GLUT's default does.
- **Idle.** Once per animation frame, Run runs the equivalent of `_vams_idle()`: the saved animations' per-frame steps, then the Idle rules. Then it draws, the way a vsync-limited GLUT program steps idle once per displayed frame.

### The program window

During Run the canvas acts as the program window:

- It starts at the canvas's full size, matching `glutInitWindowSize`.
- A drag handle in its bottom-right corner (a 24px handle, `aria-label="Resize the program window"`) resizes it from 200×150 up to the full canvas. Arrow keys on the focused handle resize it in 10px steps. Those keys are not delivered to handlers, since focus is on the handle and not on the run surface.
- Outside the window, the canvas shows `--paper-sunken` and draws nothing.
- Inside, the scene is drawn with the run view:
  - **Keep proportions:** the bounds the generated reshape handler computes.
  - **Stretch, or no Reshape handler:** the saved viewing volume stretched to the window.

### The runtime (pure)

`features/callbacks/model/runtime.ts` holds pure functions over a run state:

```ts
interface RunObjectState {
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  r: number; g: number; b: number; useColor: boolean; visible: boolean;
}
interface RunState {
  objects: Record<string, RunObjectState>;     // by object id, from the saved transforms
  initial: Record<string, RunObjectState>;     // for Reset
  view: { minX: number; maxX: number; minY: number; maxY: number };
  window: { width: number; height: number };
  animationStatics: Record<string, { baseX?: number; baseY?: number; baseSX?: number; baseSY?: number; t: number }>;
}
```

- `createRunState(objects, viewportLimits, windowSize)`.
- `dispatch(state, callbacks, event)`: returns the next state and the matched rules. `event` is a key, special, mouse, motion, reshape or idle event. Pointer coordinates are converted with the same formula as `windowToWorld`.
- `stepAnimations(state, objects)`: mirrors `generateIdleBody` for each saved animation, including its `static` base values, which are captured on the first frame, and its per-frame `t` step.
- Every action changes the state exactly as its generated C++ line does. A parity test checks each action and each animation against the generator's output.

Note what follows from this. A saved Slide or Orbit animation sets `x` every frame, so it overrides a Translate rule on the same object, just as it would in the compiled program. Run shows that faithfully.

### The Run controller

`features/callbacks/model/run-controller.ts` is a singleton modelled on the animation controller:

- It is exposed through `useSyncExternalStore`, with the snapshot `{ running, lastCall, fired, window, canvas }`. `fired` is `{ kind, handlerName, trigger, seq }` for the last non-idle event that reached a handler (`trigger` is the matched rule's trigger, or `null` when no rule matched), or `null`.
- It owns the frame loop, the event listeners and the store watch.
- It never calls a scene-state setter. It pushes the run state to the canvas through the render bridge.
- `fired` clears 700ms after the last event.

`shared/engine/render-bridge.ts` gains:

- `setAppearance(id, { color: string | null; visible: boolean })`. The scene renderer redraws that object with one flat colour, or hides it.
- `setView(view, windowRect)`. It sets the world transform to map `view` onto `windowRect` inside the canvas, and masks the canvas outside `windowRect`.
- `resync()` also clears appearance overrides and restores the editor's viewport transform.

### Code panel feedback

`SceneCodePanel` gains an optional `flashBranch?: { handlerName: string; trigger: RuleTrigger | null; seq: number } | null` prop. When it is present, the panel runs `locateHandlerBranch` on the code it shows and passes the lines to `CodeViewer` as `changedLines`, which already highlights those lines and scrolls them into view. While a branch flashes it wins over the lesson's own changed lines.

The panel's parent, the `code-math-column` widget, reads the run controller and passes `fired` down, so `code-generation` never imports `callbacks`.

### Placement

- The Run button, strip, readout, window frame and run surface are rendered by `features/callbacks/ui/RunOverlay.tsx`.
- `widgets/canvas` places it in `CanvasOverlays`.
- The editor page applies `inert` from the controller's snapshot.

## 5. Lessons

Lessons stay data. They use the store actions above.

**primitives-demo-5, "Hooking Up Callbacks"** (5 steps, was 4):

1. "A graphics window isn't much fun if it can't react. GLUT uses callbacks: functions it calls when a key is pressed, the mouse moves or the window changes size." Focus: `callbacks-panel`.
2. Action: add a `GL_TRIANGLES` object named "Triangle" (the same store action the Add row uses; a lesson starts with an empty scene), register Keyboard as `onKey`, and add the rule D → Translate Triangle (0.10, 0.00). Narration: "Let's register a keyboard handler, onKey, with one rule: when D is pressed, move the triangle 0.10 to the right."
3. "Find onKey in the Code Panel. The rule became a case in a switch on key, and it changes state_Triangle.x. glutPostRedisplay asks GLUT to draw the next frame."
4. "Now find glutKeyboardFunc(onKey) in main(). That line tells GLUT which function to call when a key is pressed."
5. "Press Run on the canvas, then press D. The triangle moves and its case lights up in the Code Panel. Press Esc to stop: your scene is just as you built it."

**primitives-exercise-5, "Hooking up the Mouse"** (3 steps):

1. "We need the program to respond to mouse clicks. Open the Callbacks group." Focus: `callbacks-panel`.
2. "Add any shape, then register a Mouse callback and give it a rule: when the left button goes down, move the shape to the pointer." Success: the Mouse callback is valid and has a rule with trigger left and down and action Move to pointer.
3. "Press Run and click around the canvas. Each click calls your handler, which converts the pixel to world coordinates with windowToWorld."

The old closing line, "You've mastered the Primitives section!", moves to the new last exercise.

**primitives-exercise-6, "Drive with the Arrow Keys"** (new, 3 steps, after exercise 5):

1. "Arrow keys have no ASCII code, so GLUT sends them to a separate callback, glutSpecialFunc. Add any shape, then switch on Special keys." Focus: `callbacks-panel`. Success: the scene has an object and the Special keys callback is valid.
2. "Add two rules: → translates a shape right (a positive dx) and ← translates it left (a negative dx)." Success: Special keys has a `right` rule with Translate `dx > 0` and a `left` rule with Translate `dx < 0`. Both target the same object.
3. "Press Run and drive it with the arrow keys. You've mastered the Primitives section!"

**Catalog.** `catalog.ts` changes:

- primitives-demo-5 goes to 5 steps;
- primitives-exercise-6 is added after exercise 5 with 3 steps;
- the Primitives summary stays.

The course has 46 lessons. `/learn`, About and the home page read the count from the catalog.

The lesson snapshot, backup and restore keep callbacks in the new shape.

## 6. Help and copy

- **The GLUT Callbacks help article.** It is rewritten for six callbacks, rules, Reshape modes and Run. Its table gains a Special keys row ("An arrow key", `glutSpecialFunc`). The old callout about compiling is replaced with: "Run plays your handlers on the canvas. The exported program runs the same handlers when you compile it." The keywords gain `special`, `arrow`, `run`, `rule` and `glutspecialfunc`.
- **The "Working with the Canvas" help article** gains a paragraph on Run: the button, Esc, the window handle and the call readout.
- **The scene settings help term.** It is unchanged.
- **Banned words.** Every new student-facing string avoids the banned words ("coming soon", "not yet", "not supported", "unsupported", "future", "deferred", "3D", "lighting"). A test scans the callbacks UI copy, the new help text, the lesson narration and the generated comments.

## 7. Product plan amendment

`docs/product-plan.md` changes:

- **Stage 2 Covers.** Add `glutSpecialFunc` to the callback registrations.
- **Stage 2 Goal 5.** "Students can register GLUT callbacks, give them rules built from menus, see the handler bodies those rules produce in the generated code, and play the handlers on the canvas with Run."
- **Stage 2 Callback Panel Behavior.** Replaced with a summary of sections 1, 3 and 4 of this spec: the six callbacks, the rules, Reshape's choice, the generated bodies, the note, and Run, which never writes scene state and is not a mode.
- **Stage 2 Demos 5 and Exercises 5–6.** As in section 5.
- **Stage 2 Acceptance Criteria.**
  - "Registering a callback inserts the `glut*Func` call and empty handler body" becomes "Registering a callback inserts the `glut*Func` call and a handler whose body is generated from its rules".
  - "Callbacks panel includes the required informational framing note" stays.
  - Add "Run plays keyboard, special key, mouse, motion, reshape and idle handlers on the canvas and restores the saved scene when it stops".
- **The View row of the persisted state table.** "registered callback names" becomes "callbacks: handler names, rules and the reshape mode".

## 8. Manuscript divergences

These join the roadmap's divergence list as items 13 and 14:

13. §3.4.1 says "there is no concept of playback or event-driven behavior engine in the implementation, nor is there any retained state of the simulation". The editor now has Run: a transient, event-driven state that keeps a temporary copy of each object's state while it runs. It never writes scene state, and the code and math panels still draw from the store. During Run the canvas shows the running program, not the saved scene.
14. Algorithm 2 ends the program with "callback function skeletons", and §3.4.2's callbacks panel registers names only. Handlers now have generated bodies built from rules, a sixth callback (`glutSpecialFunc`) exists, and Reshape offers two behaviours.

## 9. Tests

**New `tests/black-box/callbacks.test.ts`, suite `BB-CB`:**

1. Registering each of the six callbacks emits its `glut*Func` registration in the table order, with the handler signature from section 1.
2. A registered callback with no rules generates the "No rules yet" body.
3. A Keyboard rule on `d` generates `case 'd':` and `case 'D':` with the translate lines and `break;`. A Space rule generates `case ' ':`.
4. Two rules on the same key share one branch, in list order.
5. Special keys rules generate `GLUT_KEY_*` cases.
6. A Mouse rule generates the `button == … && state == …` branch. A Move to pointer rule adds `windowToWorld`, the view globals and `glOrtho(viewMinX, …)`.
7. Each action generates the lines in section 2's table.
8. A colour or visibility rule adds the five struct fields and initializers. Without one, the struct is unchanged.
9. Visibility wraps the draw call. Colour guards the vertex colour lines in immediate mode and the colour array in VBO mode.
10. A Reset rule adds `initial_<name>`, and the action reads `state_<name> = initial_<name>;`.
11. Reshape Keep proportions and Stretch generate the bodies in section 2.
12. A scene with no callbacks generates the same program as before this change. The test compares against a stored fixture captured before the change.
13. An invalid or reserved handler name is flagged and left out of the code.
14. Deleting an object removes its rules, and undo restores them.
15. Adding a 9th rule is ignored. A rule whose trigger kind doesn't match its callback is ignored.
16. `locateHandlerBranch` returns the right lines for a key case, a special case, a mouse branch, Motion, Idle and Reshape.
17. No banned word appears in the callbacks copy, the help text, the new narration or the generated comments.

**New `tests/white-box/callbacks-runtime.test.ts`, suite `WB-CB`:**

1. Each action changes the run state exactly as its generated C++ line does: parity with section 2's table.
2. Keyboard dispatch matches either case. Unmatched keys change nothing.
3. Mouse dispatch matches button and state. Move to pointer converts pixels with the `windowToWorld` formula, including the y flip.
4. Keep proportions computes the same view as the generated reshape body, for a wide, a tall and a square window.
5. `stepAnimations` matches `generateIdleBody` over 120 frames for each of the four motions, including the static base capture.
6. A Slide animation overrides a Translate rule on x in the same frame, as the compiled program does.

**New `tests/black-box/run-mode.test.ts`, suite `BB-RUN`:**

1. Run is disabled with no object, or with neither a valid callback nor an animation.
2. Starting Run calls Reshape once with the window size. The readout shows `onReshape(w, h)`.
3. Pressing D during Run moves the target's display object, shows `onKey('d', x, y)`, and sets `fired` to the Keyboard handler with the `d` trigger. The code panel given that `flashBranch` highlights the `case 'd'` branch.
4. Run never writes the store. The persisted `vams-storage` value and an exported `.vams` file are byte-identical before Run, during Run after events, and after Stop.
5. Stop, Esc and an undo each end Run and restore every display object's saved transform, appearance and view.
6. During Run the editor column and the top-bar actions are `inert`, and the Delete and Ctrl+Z shortcuts do nothing.
7. The window handle resizes the window within 200×150 and the canvas size. It fires Reshape, and keyboard resizing moves in 10px steps.
8. Esc and Tab are never delivered to the Keyboard handler.

**Persistence (added to existing suites with the next free ids):**

- WB-PERSIST: a version 7 persisted store migrates to version 8 with names kept, `rules: []`, Reshape `stretch`, and `callbacksBackup` migrated.
- BB-PERSIST:
  - A schema 8 `.vams` file loads into the new shape.
  - A schema 9 round trip keeps rules.
  - Rules pointing at missing objects are dropped, and out-of-range values are clamped.

**Lessons:**

- BB-LESSON:
  - The Hooking Up Callbacks demo's step 2 produces the `onKey` handler with `case 'd':`.
  - Exercise 5 succeeds only with a left-down Move to pointer rule.
  - Exercise 6 succeeds only with the → and ← translate rules.
- The catalog parity test covers the new step counts and the new lesson. The tests that count 45 lessons now count 46.

**Updated tests.** Tests that read `state.callbacks.<kind>` as a string read `.handlerName`. Test ids and intent stay the same, and BB-GEN-09 covers six kinds.

**Visual (`tests/visual/editor.spec.ts`, not part of `npm test`):**

- VIS-EDITOR-14: the Callbacks group with Special keys on, two rules and one open form, light, 1280.
- VIS-EDITOR-15: Run active after pressing →, with the strip, the readout, the window handle and the flashed lines in the code panel, light, 1280.
- VIS-EDITOR-16: the same as 15, dark.

**Compile check.** During delivery, a generated program covering every action, all six callbacks and both Reshape modes is syntax-checked with `g++ -fsyntax-only` against minimal stub headers. This check is done by hand and is not part of CI, the same as the existing manual compile procedure.

## 10. Docs

- In the roadmap, item 13 is marked complete with links to this spec and the plan, and divergences 13 and 14 are added.
- `tests/README.md` lists BB-CB, WB-CB and BB-RUN.
- `docs/product-plan.md` is amended as in section 7.

## 11. Delivery

The work happens on `feat/functional-callbacks` and merges before Oct 28. In order:

1. The rule model, store, migration and sanitizer.
2. The generator and `locateHandlerBranch`.
3. The Callbacks group UI.
4. The runtime and the parity tests.
5. The render bridge additions and the Run controller.
6. The Run overlay, the paused editing and the code panel flash.
7. Lessons, help, the product plan, divergences and docs.
