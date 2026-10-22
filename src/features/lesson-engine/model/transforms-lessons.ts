import type { Lesson } from '@/core/types/lesson';
import type { VamsState } from '@/core/store/types';
import type { PendingVertex, PrimitiveType, SceneNode, TransformState } from '@/core/types/scene';
import { useVamsStore } from '@/core/store';
import { isCallbackValid, newRuleId } from '@/core/callbacks/callbacks-model';

/** A triangle pointing up, its centre at the origin, so a turn shows which way it went. */
const ARROW: PendingVertex[] = [{ x: 0, y: 0.45 }, { x: -0.3, y: -0.225 }, { x: 0.3, y: -0.225 }];
/** A square around (cx, cy), half a side of h. */
const square = (cx: number, cy: number, h: number): PendingVertex[] => [
  { x: cx - h, y: cy - h }, { x: cx + h, y: cy - h }, { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h },
];
/** A triangle pointing up around (cx, cy). */
const arrowAt = (cx: number, cy: number): PendingVertex[] => ARROW.map((v) => ({ x: v.x + cx, y: v.y + cy }));

const DEFAULT_VIEW = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const DRAWABLE = new Set<SceneNode['type']>(['POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP', 'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN', 'QUADS', 'QUAD_STRIP', 'POLYGON']);

const now = () => useVamsStore.getState();
const named = (state: VamsState, name: string) => state.objects.find((o) => o.name === name);
const shapes = (state: VamsState) => state.objects.filter((o) => DRAWABLE.has(o.type));
const groups = (state: VamsState) => state.objects.filter((o) => o.type === 'GROUP');
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
/** An angle in 0..360, so −30 and 330 read the same. */
const turn = (deg: number) => ((deg % 360) + 360) % 360;
const turnedTo = (o: SceneNode | undefined, deg: number) => !!o && near(turn(o.transform.rotate), turn(deg), 2);
const at = (o: SceneNode | undefined, x: number, y: number) =>
  !!o && near(o.transform.translateX, x, 0.03) && near(o.transform.translateY, y, 0.03);

/** Adds a named shape, unselected, in a colour; returns it. */
function addNamed(type: PrimitiveType, vertices: PendingVertex[], name: string, colour?: string): SceneNode {
  now().addCustomObject(type, vertices);
  const id = now().objects[0].id;
  now().updateObjectName(id, name);
  if (colour) now().setAllVertexColors(id, colour);
  now().selectObject(null);
  return now().objects.find((o) => o.id === id)!;
}

/** Changes a named object's transform and selects it. */
function set(name: string, patch: Partial<TransformState>) {
  const o = named(now(), name);
  if (!o) return;
  now().selectObject(o.id);
  now().updateObjectTransform(o.id, patch);
}

/** Groups the named objects and names the group. */
function group(name: string, members: string[]) {
  const ids = members.map((m) => named(now(), m)?.id).filter((id): id is string => !!id);
  now().createGroup(ids);
  const g = groups(now()).find((o) => ids.every((id) => o.children?.includes(id)));
  if (g) now().updateObjectName(g.id, name);
}

/** The group holding both named shapes. */
const groupOf = (state: VamsState, a: string, b: string) => {
  const ids = [named(state, a)?.id, named(state, b)?.id];
  return groups(state).find((g) => ids.every((id) => !!id && g.children?.includes(id)));
};

const idleRule = (objectId: string, degrees: number) => ({
  id: newRuleId(),
  objectId,
  trigger: { kind: 'idle' as const },
  action: { type: 'rotate' as const, degrees },
});
/** An idle rule turns the named object. */
const idleTurns = (state: VamsState, name: string) => {
  const o = named(state, name);
  return (
    !!o &&
    isCallbackValid(state.callbacks, 'idle') &&
    state.callbacks.idle.rules.some((r) => r.objectId === o.id && r.action.type === 'rotate' && r.action.degrees !== 0)
  );
};
function addIdleTurn(name: string, degrees: number) {
  const o = named(now(), name);
  if (!o) return;
  if (!isCallbackValid(now().callbacks, 'idle')) now().setCallbackHandler('idle', 'onIdle');
  now().addCallbackRule('idle', idleRule(o.id, degrees));
}

/** The capstone's shape: the newest shape outside a group. */
const capstoneShape = (state: VamsState) => shapes(state).find((o) => !o.parentId);
const moved = (o: SceneNode | undefined) => !!o && (Math.abs(o.transform.translateX) >= 0.1 || Math.abs(o.transform.translateY) >= 0.1);
const turned = (o: SceneNode | undefined) => !!o && !near(turn(o.transform.rotate), 0, 0.5) && !near(turn(o.transform.rotate), 360, 0.5);
const scaled = (o: SceneNode | undefined) => !!o && (!near(o.transform.scaleX, 1, 0.01) || !near(o.transform.scaleY, 1, 0.01));

export const TRANSFORMS_LESSONS: Record<string, Lesson> = {
  'transforms-demo-1': {
    id: 'transforms-demo-1',
    type: 'demo',
    title: 'Translate, Rotate, Scale',
    section: 'Transforms',
    steps: [
      {
        narration: 'So far every shape stayed where its corners put it. Transforms move, turn and resize a shape without touching its corners. This arrow points up, so you can see which way it turns.',
        focusPanel: 'scene-hierarchy',
        action: () => { addNamed('TRIANGLES', ARROW, 'Arrow', '#facc15'); },
      },
      {
        narration: "The arrow's Transform group holds where it is: Translate, Rotate and Scale. In the code they live in state_Arrow, near the top: x, y, rotation, scaleX and scaleY. Now it is at (0, 0), not turned, at full size.",
        focusPanel: 'object-transform',
        pane: 'code',
        codeChangeFocus: ['ObjectState state_Arrow'],
      },
      {
        narration: 'Its corners are stored around its own centre: glVertex2f(0.0000f, 0.4500f) is the tip, 0.45 above the centre, wherever the arrow goes.',
        pane: 'code',
        codeChangeFocus: ['glVertex2f'],
      },
      {
        narration: 'We will set Translate X to 0.5. What happens to the numbers in glVertex2f?',
        predict: {
          options: [
            { id: 'same', label: 'They stay the same', why: 'The corners are measured from the centre. Only state_Arrow.x changes, and glTranslatef moves every corner by it as they are drawn.' },
            { id: 'add', label: 'Each x grows by 0.5', why: 'That would be editing the corners. A transform leaves them alone.' },
          ],
          correctId: 'same',
        },
        focusPanel: 'object-transform',
        action: () => set('Arrow', { translateX: 0.5 }),
        codeChangeFocus: ['ObjectState state_Arrow'],
      },
      {
        narration: 'glTranslatef(state_Arrow.x, state_Arrow.y, 0.0f) runs before the corners, so OpenGL adds 0.5 to every x as it draws them.',
        pane: 'code',
        codeChangeFocus: ['glTranslatef'],
      },
      {
        narration: 'Next, Rotate 90. Which way will the arrow point?',
        predict: {
          options: [
            { id: 'left', label: 'Left', why: 'Positive angles turn counter-clockwise, so up turns to the left.' },
            { id: 'right', label: 'Right', why: 'That is −90: negative angles turn clockwise.' },
            { id: 'down', label: 'Down', why: 'Pointing down takes 180°.' },
          ],
          correctId: 'left',
        },
        focusPanel: 'object-transform',
        action: () => set('Arrow', { rotate: 90 }),
        codeChangeFocus: ['ObjectState state_Arrow'],
      },
      {
        narration: 'glRotatef(state_Arrow.rotation, 0.0f, 0.0f, 1.0f) turns about the z axis, the one pointing out of the screen, so the arrow turns flat in the window, about its own centre.',
        pane: 'code',
        codeChangeFocus: ['glRotatef'],
      },
      {
        narration: 'Now Scale X becomes 2, with Scale Y left at 1. The arrow points left. What happens to it?',
        predict: {
          options: [
            { id: 'across', label: 'It gets twice as wide across: up and down on screen', why: "Scale acts first, on the arrow's own x axis, which runs across it. After the 90° turn that axis is vertical." },
            { id: 'longer', label: 'It gets twice as long, left to right', why: 'That would be scaling after the turn. glScalef is the call nearest the corners, so it acts on them first.' },
          ],
          correctId: 'across',
        },
        focusPanel: 'object-transform',
        action: () => set('Arrow', { scaleX: 2, scaleY: 1 }),
        codeChangeFocus: ['ObjectState state_Arrow'],
      },
      {
        narration: 'glScalef(state_Arrow.scaleX, state_Arrow.scaleY, 1.0f) is the last call before the corners. The call nearest the corners acts first: scale, then rotate, then translate.',
        pane: 'code',
        codeChangeFocus: ['glScalef'],
      },
      {
        narration: 'Three calls place every shape you draw.',
        recap: {
          points: [
            'glTranslatef moves, glRotatef turns about the z axis, glScalef resizes.',
            'The corners stay put; state_Arrow holds the values the calls read.',
            'The call nearest the corners acts first: scale, then rotate, then translate.',
          ],
          calls: ['glTranslatef', 'glRotatef', 'glScalef'],
        },
      },
    ],
  },

  'transforms-demo-2': {
    id: 'transforms-demo-2',
    type: 'demo',
    title: 'Matrix Representation',
    section: 'Transforms',
    steps: [
      {
        narration: "Behind the three calls, OpenGL keeps one matrix: a grid of numbers that every corner is multiplied by. Math's Transformed stage shows this square's matrix.",
        pane: 'math',
        mathStage: 'transformed',
        focusPanel: 'object-transform',
        action: () => {
          addNamed('QUADS', square(0, 0, 0.3), 'Box', '#38bdf8');
          set('Box', {});
        },
      },
      {
        narration: 'Nothing is applied yet, so it is the identity matrix: 1s down the diagonal, 0s elsewhere. Multiplying by it leaves every corner where it is.',
        pane: 'math',
        mathStage: 'transformed',
      },
      {
        narration: 'We will move the square to (0.3, 0.4). Where in the matrix will 0.3 and 0.4 appear?',
        predict: {
          options: [
            { id: 'column', label: 'In the last column', why: 'A move adds the same amount to every corner, and the last column is the part that is added.' },
            { id: 'diagonal', label: 'On the diagonal', why: 'The diagonal multiplies x and y: that is where scale goes.' },
            { id: 'row', label: 'In the bottom row', why: 'The bottom row stays 0, 0, 1 for every transform in the plane.' },
          ],
          correctId: 'column',
        },
        pane: 'math',
        mathStage: 'transformed',
        action: () => set('Box', { translateX: 0.3, translateY: 0.4 }),
      },
      {
        narration: "The last column now reads 0.3 and 0.4. They are added to every corner's x and y: that is glTranslatef as numbers.",
        pane: 'math',
        mathStage: 'transformed',
      },
      {
        narration: 'Back to (0, 0), and Scale X 1.6, Scale Y 0.8. Where do those go?',
        predict: {
          options: [
            { id: 'diagonal', label: 'On the diagonal', why: 'Scale multiplies x by one factor and y by the other, so the factors sit where x and y meet themselves.' },
            { id: 'column', label: 'In the last column', why: 'That column adds. Scale has to multiply.' },
          ],
          correctId: 'diagonal',
        },
        pane: 'math',
        mathStage: 'transformed',
        action: () => set('Box', { translateX: 0, translateY: 0, scaleX: 1.6, scaleY: 0.8 }),
      },
      {
        narration: 'Rotation mixes x and y. With the scale back to 1 and a 45° turn, the top-left block fills with cos 45° and sin 45°, both about 0.71.',
        pane: 'math',
        mathStage: 'transformed',
        action: () => set('Box', { scaleX: 1, scaleY: 1, rotate: 45 }),
      },
      {
        narration: 'What will the top-left block read at 90°?',
        predict: {
          options: [
            { id: 'quarter', label: '0 and −1 on top, 1 and 0 below', why: 'cos 90° is 0 and sin 90° is 1, so a corner at (1, 0) goes to (0, 1).' },
            { id: 'same', label: 'The 0.71s again', why: 'That was 45°. The numbers follow the angle.' },
            { id: 'identity', label: '1 and 0 on top, 0 and 1 below', why: 'That is the identity: no turn at all.' },
          ],
          correctId: 'quarter',
        },
        pane: 'math',
        mathStage: 'transformed',
        action: () => set('Box', { rotate: 90 }),
      },
      {
        narration: 'All three at once: (0.3, 0.4), 45° and 1.6 by 0.8. OpenGL multiplies T · R · S into this one matrix, and each corner is multiplied by it once. Full 4×4 shows the same numbers in the grid OpenGL keeps.',
        pane: 'math',
        mathStage: 'transformed',
        action: () => set('Box', { translateX: 0.3, translateY: 0.4, rotate: 45, scaleX: 1.6, scaleY: 0.8 }),
      },
      {
        narration: 'One grid of numbers holds the whole transform.',
        recap: {
          points: [
            'A transform is one matrix that every corner is multiplied by.',
            'The last column moves; the diagonal scales; a turn mixes x and y with cos and sin.',
            'M = T · R · S puts all three calls in one matrix.',
          ],
          calls: ['glTranslatef', 'glRotatef', 'glScalef'],
        },
      },
    ],
  },

  'transforms-demo-3': {
    id: 'transforms-demo-3',
    type: 'demo',
    title: 'The Matrix Stack',
    section: 'Transforms',
    steps: [
      {
        narration: 'Before display() draws, it sets up the matrix the transforms go into: glMatrixMode(GL_MODELVIEW) picks it, and glLoadIdentity() on the next line resets it to the identity, every frame.',
        pane: 'code',
        codeChangeFocus: ['GL_MODELVIEW'],
        action: () => {
          addNamed('QUADS', square(0, 0, 0.15), 'Box', '#ef4444');
          set('Box', { translateX: 0.5 });
        },
      },
      {
        narration: 'Each draw function starts with glPushMatrix and ends with glPopMatrix. We will add an arrow on the left. If the box had no glPopMatrix, what would happen to the arrow?',
        predict: {
          options: [
            { id: 'inherit', label: "It would be moved by the box's 0.5 as well", why: "Without the pop, the box's glTranslatef stays on the matrix, and the arrow's corners get it too." },
            { id: 'nothing', label: 'Nothing', why: 'The pop is what puts the matrix back. Without it the next shape starts from where the box left it.' },
          ],
          correctId: 'inherit',
        },
        action: () => {
          addNamed('TRIANGLES', arrowAt(-0.5, 0), 'Arrow', '#ffffff');
        },
      },
      {
        narration: "glPushMatrix saves a copy of the matrix and glPopMatrix puts it back. Each shape's moves apply to its own corners and are gone before the next shape draws.",
        pane: 'code',
        codeChangeFocus: ['glPushMatrix', 'glPopMatrix'],
      },
      {
        narration: "Now the arrow and the box go into a group, Pair. In draw(), Pair pushes the matrix, moves to its centre, then calls both children's draw functions before its own glPopMatrix. The children's x and y are now measured from Pair's centre.",
        focusPanel: 'scene-hierarchy',
        action: () => group('Pair', ['Arrow', 'Box']),
        codeChangeFocus: ['state_Pair'],
      },
      {
        narration: 'We will turn Pair 30°. What happens to the box?',
        predict: {
          options: [
            { id: 'swing', label: "It turns, and swings round Pair's centre", why: "Pair's glRotatef is on the matrix while the box draws, so the box's move and corners are both turned." },
            { id: 'stays', label: 'It stays where it is', why: "The box's own rotation is still 0, but it draws inside Pair's frame." },
            { id: 'spin', label: 'It spins in place', why: "It turns about Pair's centre, not its own, so it moves as well." },
          ],
          correctId: 'swing',
        },
        focusPanel: 'object-transform',
        action: () => set('Pair', { rotate: 30 }),
      },
      {
        narration: "The box's own rotation is still 0. With the box selected, Math's Transformed stage shows the stack while it draws: the identity at the bottom, Pair's frame, then the box on top.",
        pane: 'math',
        mathStage: 'transformed',
        focusPanel: 'scene-hierarchy',
        action: (state) => {
          const box = named(state, 'Box');
          if (box) state.selectObject(box.id);
        },
      },
      {
        narration: 'The stack keeps each shape in its own frame.',
        recap: {
          points: [
            'glMatrixMode(GL_MODELVIEW) and glLoadIdentity start each frame from the identity.',
            'glPushMatrix saves the matrix and glPopMatrix restores it, so moves stay with their shape.',
            "A group's transform stays on the stack while its children draw.",
          ],
          calls: ['glMatrixMode', 'glLoadIdentity', 'glPushMatrix', 'glPopMatrix'],
        },
      },
    ],
  },

  'transforms-demo-5': {
    id: 'transforms-demo-5',
    type: 'demo',
    title: 'Spin or Orbit: Order Matters',
    section: 'Transforms',
    steps: [
      {
        narration: "A sun and two planets, grouped as System. A group's centre is the middle of its children, and here that is where the sun sits.",
        focusPanel: 'scene-hierarchy',
        action: () => {
          addNamed('QUADS', square(0, 0, 0.15), 'Sun', '#facc15');
          addNamed('QUADS', square(0.6, 0, 0.08), 'East', '#38bdf8');
          addNamed('QUADS', square(-0.6, 0, 0.08), 'West', '#ef4444');
          group('System', ['Sun', 'East', 'West']);
        },
      },
      {
        narration: 'We will turn the planet East 45° on its own. What does it do?',
        predict: {
          options: [
            { id: 'spin', label: 'It spins where it is', why: 'Its glRotatef comes after its glTranslatef, so it turns about its own centre.' },
            { id: 'orbit', label: 'It moves round the sun', why: 'That needs a turn that acts before the move, from the group.' },
          ],
          correctId: 'spin',
        },
        focusPanel: 'object-transform',
        action: () => set('East', { rotate: 45 }),
      },
      {
        narration: "In draw_East, glTranslatef comes first and glRotatef second. The call nearest the corners acts first, so the corners turn about the planet's centre, then move out to 0.6.",
        pane: 'code',
        codeChangeFocus: ['glTranslatef(state_East', 'glRotatef(state_East'],
      },
      {
        narration: 'Now we will turn System 90°, with East back at 0°. Where does East go?',
        predict: {
          options: [
            { id: 'above', label: 'Above the sun', why: "System's turn acts before East's move, so the move itself is turned: 0.6 to the right becomes 0.6 up." },
            { id: 'stays', label: 'It stays on the right, turned', why: "That would be a spin. The group turns the planet's position as well as its corners." },
            { id: 'below', label: 'Below the sun', why: 'Positive angles turn counter-clockwise: from the right, that is up.' },
          ],
          correctId: 'above',
        },
        focusPanel: 'object-transform',
        action: () => {
          set('East', { rotate: 0 });
          set('System', { rotate: 90 });
        },
      },
      {
        narration: "System's glRotatef runs before draw_East's glTranslatef, so the planet's whole move is turned. Turning a parent makes its children orbit; turning a child makes it spin.",
        pane: 'code',
        codeChangeFocus: ['glRotatef(state_System'],
      },
      {
        narration: 'We will scale System to 0.5. What happens to the distance between the sun and the planets?',
        predict: {
          options: [
            { id: 'half', label: 'It halves too', why: "System's glScalef acts on everything drawn inside it, the children's moves included." },
            { id: 'same', label: 'It stays 0.6', why: "The planets' own values stay 0.6, but they are drawn through System's matrix." },
          ],
          correctId: 'half',
        },
        focusPanel: 'object-transform',
        action: () => set('System', { scaleX: 0.5, scaleY: 0.5 }),
      },
      {
        narration: 'Where a call sits decides what it acts on.',
        recap: {
          points: [
            'A turn before a move swings the move round; a turn after it only turns the shape.',
            "Turning a parent makes its children orbit the parent's centre.",
            "A parent's scale shrinks its children's moves as well as their size.",
          ],
          calls: ['glTranslatef', 'glRotatef'],
        },
      },
    ],
  },

  'transforms-demo-4': {
    id: 'transforms-demo-4',
    type: 'demo',
    title: 'glOrtho: Changing the View',
    section: 'Transforms',
    steps: [
      {
        narration: 'The other matrix is the projection. At the top of display(), glMatrixMode(GL_PROJECTION) selects it, glLoadIdentity() resets it, and glOrtho fills it from your four numbers.',
        focusPanel: 'ortho-editor',
        pane: 'code',
        codeChangeFocus: ['GL_PROJECTION', 'glOrtho'],
        action: () => { addNamed('TRIANGLES', ARROW, 'Arrow', '#facc15'); },
      },
      {
        narration: 'glOrtho(left, right, bottom, top, −1, 1) names the rectangle of the world the window shows. Now it is −1 to 1 both ways: the same numbers you set in Viewing Volume.',
        focusPanel: 'ortho-editor',
      },
      {
        narration: 'We will widen it to −2 to 2. What happens to the arrow on screen?',
        predict: {
          options: [
            { id: 'smaller', label: 'It looks half as big', why: 'Twice as much world fits in the same window, so everything looks half the size.' },
            { id: 'bigger', label: 'It looks twice as big', why: 'That is a narrower volume: a zoom in.' },
            { id: 'same', label: 'It looks the same', why: "The arrow's numbers stay the same, but the window shows more world around it." },
          ],
          correctId: 'smaller',
        },
        focusPanel: 'ortho-editor',
        action: (state) => state.setViewportLimits({ minX: -2, maxX: 2, minY: -2, maxY: 2 }),
        codeChangeFocus: ['glOrtho'],
      },
      {
        narration: "The arrow's corners and transform did not change, only the view. In Math's Projected stage, glOrtho's formula turns the arrow's world numbers into the −1 to 1 range the window uses.",
        pane: 'math',
        mathStage: 'projected',
        action: (state) => {
          const arrow = named(state, 'Arrow');
          if (arrow) state.selectObject(arrow.id);
        },
      },
      {
        narration: 'Now x from 0 to 2, y from −1 to 1. Where does the arrow appear?',
        predict: {
          options: [
            { id: 'left', label: 'On the left edge', why: "x = 0 is now the left side of the volume, so the arrow's centre is on the window's left edge." },
            { id: 'middle', label: 'In the middle', why: 'The middle of 0 to 2 is 1, not 0.' },
            { id: 'right', label: 'On the right edge', why: 'The right edge is x = 2.' },
          ],
          correctId: 'left',
        },
        focusPanel: 'ortho-editor',
        action: (state) => state.setViewportLimits({ minX: 0, maxX: 2, minY: -1, maxY: 1 }),
        codeChangeFocus: ['glOrtho'],
      },
      {
        narration: 'Last: x from −2 to 2, y still −1 to 1. What happens to the arrow?',
        predict: {
          options: [
            { id: 'squash', label: 'Half as wide as before, the same height', why: 'The x range doubled and the y range did not, so each pixel across covers twice as much world.' },
            { id: 'same', label: 'Nothing changes', why: 'The two ranges no longer match, so x and y are scaled differently.' },
          ],
          correctId: 'squash',
        },
        focusPanel: 'ortho-editor',
        action: (state) => state.setViewportLimits({ minX: -2, maxX: 2, minY: -1, maxY: 1 }),
        codeChangeFocus: ['glOrtho'],
      },
      {
        narration: "Back to −1 to 1. When the window changes shape, a reshape handler can widen glOrtho to keep proportions, as in Primitives' When the Window Changes Size.",
        focusPanel: 'ortho-editor',
        action: (state) => state.setViewportLimits({ ...DEFAULT_VIEW }),
        codeChangeFocus: ['glOrtho'],
      },
      {
        narration: 'glOrtho decides how much of the world you see.',
        recap: {
          points: [
            'glMatrixMode(GL_PROJECTION) and glLoadIdentity set up the projection; glOrtho fills it.',
            'A wider volume zooms out, a narrower one zooms in, a shifted one pans.',
            'Different x and y ranges stretch the picture.',
          ],
          calls: ['glMatrixMode', 'glOrtho'],
        },
      },
    ],
  },

  'transforms-anim-1': {
    id: 'transforms-anim-1',
    type: 'demo',
    title: 'Animation: Transformation Over Time',
    section: 'Transforms',
    steps: [
      {
        narration: 'Animation is a transform that changes a little every frame. Here is a triangle to animate.',
        focusPanel: 'scene-hierarchy',
        action: () => { addNamed('TRIANGLES', ARROW, 'Triangle'); },
      },
      {
        narration: 'GLUT calls an idle function whenever it has nothing else to do: once a frame. We registered onIdle with one rule, turn the triangle by 2°. Find onIdle in the code.',
        focusPanel: 'callbacks-panel',
        action: () => addIdleTurn('Triangle', 2),
        codeChangeFocus: ['void onIdle', 'rotation +='],
      },
      {
        narration: 'Press Run on the canvas. Every frame onIdle adds 2 to state_Triangle.rotation, and glutPostRedisplay asks GLUT to draw again. Press Esc to stop: the scene is just as you built it.',
        focusPanel: 'callbacks-panel',
      },
      {
        narration: 'In onIdle, which line actually makes the triangle move?',
        focusPanel: 'callbacks-panel',
        task: 'Pick the line',
        hints: ['Look for the line that changes a number in state_Triangle.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which line makes the object move each frame?',
          options: [
            { id: 'a', label: 'state_Triangle.rotation += 2.00f;' },
            { id: 'b', label: 'void onIdle()' },
            { id: 'c', label: 'glutPostRedisplay();' },
            { id: 'd', label: 'glutIdleFunc(_vams_idle);' },
          ],
          correctId: 'a',
        },
      },
      {
        narration: 'If the program draws 60 frames a second, how far does the triangle turn in one second?',
        predict: {
          options: [
            { id: '120', label: '120°', why: '2° a frame, 60 frames a second.' },
            { id: '2', label: '2°', why: "That is one frame's turn." },
            { id: '60', label: '60°', why: 'That would be 1° a frame.' },
          ],
          correctId: '120',
        },
        action: (state) => state.setCodePane('code'),
      },
      {
        narration: 'Because the turn is counted per frame, a computer that draws more frames turns the triangle faster. In VAMS, Run draws one step per frame.',
        focusPanel: 'callbacks-panel',
      },
      {
        narration: 'A value changed every frame is an animation.',
        recap: {
          points: [
            'glutIdleFunc registers a function GLUT runs whenever it is free.',
            'Changing a transform value there, then calling glutPostRedisplay, animates the shape.',
          ],
          calls: ['glutIdleFunc', 'glutPostRedisplay'],
        },
      },
    ],
  },

  'transforms-exercise-1': {
    id: 'transforms-exercise-1',
    type: 'exercise',
    title: 'Translate to Position',
    section: 'Transforms',
    steps: [
      {
        narration: 'Move the triangle to (0.5, −0.3). Use the Translate row of its Transform group, or drag it on the canvas.',
        focusPanel: 'object-transform',
        action: () => { addNamed('TRIANGLES', ARROW, 'Triangle'); },
        goals: [{ label: 'At (0.5, −0.3)', check: (state) => at(named(state, 'Triangle'), 0.5, -0.3) }],
        task: 'Move the triangle to (0.5, −0.3)',
        hints: ['Select the triangle, then open its Transform group.', 'Type 0.5 in Translate X and −0.3 in Translate Y.'],
        solve: () => set('Triangle', { translateX: 0.5, translateY: -0.3 }),
      },
      {
        narration: 'Spot on! The first two numbers in state_Triangle are now about 0.5 and −0.3, and glTranslatef reads them as it draws.',
        pane: 'code',
        codeChangeFocus: ['ObjectState state_Triangle', 'glTranslatef'],
      },
      {
        narration: 'Now put its centre on the top-left corner of the view, (−1, 1).',
        focusPanel: 'object-transform',
        goals: [{ label: 'At (−1, 1)', check: (state) => at(named(state, 'Triangle'), -1, 1) }],
        task: 'Move the triangle to (−1, 1)',
        hints: ['The view runs from −1 to 1 on both axes.', 'Translate X −1, Translate Y 1.'],
        solve: () => set('Triangle', { translateX: -1, translateY: 1 }),
      },
      {
        narration: "Most of the triangle is now outside glOrtho's −1 to 1, and that part is clipped. Its corners still exist; they are just not drawn.",
      },
      {
        narration: 'You placed a shape by its numbers.',
        recap: {
          points: [
            "glTranslatef moves a shape by the x and y in its state.",
            'A shape moved past the view is clipped, not lost.',
          ],
          calls: ['glTranslatef'],
        },
      },
    ],
  },

  'transforms-exercise-2': {
    id: 'transforms-exercise-2',
    type: 'exercise',
    title: 'Rotate to Angle',
    section: 'Transforms',
    steps: [
      {
        narration: 'Turn the square to 45°, so it stands on a corner.',
        focusPanel: 'object-transform',
        action: () => { addNamed('QUADS', square(0, 0, 0.35), 'Box', '#38bdf8'); },
        goals: [{ label: 'Turned 45°', check: (state) => turnedTo(named(state, 'Box'), 45) }],
        task: 'Turn the square to 45°',
        hints: ['Select the square and open its Transform group.', 'Type 45 in Rotate, or drag the dial.'],
        solve: () => set('Box', { rotate: 45 }),
      },
      {
        narration: 'Perfect. glRotatef reads 45 from state_Box, with (0, 0, 1) as the axis: a turn about z keeps the square flat in the window.',
        pane: 'code',
        codeChangeFocus: ['ObjectState state_Box', 'glRotatef'],
      },
      {
        narration: 'Now turn it 30° clockwise from 0°.',
        focusPanel: 'object-transform',
        goals: [{ label: 'Turned −30°', check: (state) => turnedTo(named(state, 'Box'), -30) }],
        task: 'Turn the square to −30°',
        hints: ['Clockwise angles are negative.', 'Type −30 in Rotate.'],
        solve: () => set('Box', { rotate: -30 }),
      },
      {
        narration: 'One more: which angle draws the square exactly as −30° does?',
        task: 'Pick the angle',
        hints: ['A full turn is 360°.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which angle gives the same picture as −30°?',
          options: [
            { id: '330', label: '330°' },
            { id: '30', label: '30°' },
            { id: '-330', label: '−330°' },
          ],
          correctId: '330',
        },
      },
      {
        narration: 'Angles turn about the centre, either way.',
        recap: {
          points: [
            'Positive angles turn counter-clockwise, negative ones clockwise.',
            'Angles a full 360° apart draw the same picture.',
          ],
          calls: ['glRotatef'],
        },
      },
    ],
  },

  'transforms-exercise-3': {
    id: 'transforms-exercise-3',
    type: 'exercise',
    title: 'Build a Hierarchy',
    section: 'Transforms',
    steps: [
      {
        narration: 'Two triangles, Left and Right. Group them, so one transform drives both.',
        focusPanel: 'scene-hierarchy',
        action: () => {
          addNamed('TRIANGLES', arrowAt(-0.5, 0), 'Left', '#38bdf8');
          addNamed('TRIANGLES', arrowAt(0.5, 0), 'Right', '#ef4444');
        },
        goals: [{ label: 'One group holds both triangles', check: (state) => !!groupOf(state, 'Left', 'Right') }],
        task: 'Group the two triangles',
        hints: ['Under Scene, press Select several, then pick both triangles.', 'Press Group.'],
        solve: () => {
          const ids = ['Left', 'Right'].map((n) => named(now(), n)?.id).filter((id): id is string => !!id);
          now().createGroup(ids);
        },
      },
      {
        narration: "In draw(), the group pushes the matrix, moves to its centre, and calls draw_Left and draw_Right before its glPopMatrix.",
        pane: 'code',
        codeChangeFocus: ['// Children'],
      },
      {
        narration: 'Turn the group 90°.',
        focusPanel: 'object-transform',
        goals: [{ label: 'Group turned 90°', check: (state) => turnedTo(groupOf(state, 'Left', 'Right'), 90) }],
        task: 'Turn the group 90°',
        hints: ['Select the group in Scene, not one of the triangles.', 'Type 90 in Rotate.'],
        solve: () => {
          const g = groupOf(now(), 'Left', 'Right');
          if (g) {
            now().selectObject(g.id);
            now().updateObjectTransform(g.id, { rotate: 90 });
          }
        },
      },
      {
        narration: "Both triangles swung round the group's centre, though their own rotation is still 0. Now shrink the whole group to half its size.",
        focusPanel: 'object-transform',
        goals: [
          {
            label: 'Group scaled to 0.5',
            check: (state) => {
              const g = groupOf(state, 'Left', 'Right');
              return !!g && near(g.transform.scaleX, 0.5, 0.03) && near(g.transform.scaleY, 0.5, 0.03);
            },
          },
        ],
        task: 'Scale the group to 0.5',
        hints: ['With the group selected, set Scale X to 0.5. The lock keeps Scale Y with it.'],
        solve: () => {
          const g = groupOf(now(), 'Left', 'Right');
          if (g) now().updateObjectTransform(g.id, { scaleX: 0.5, scaleY: 0.5 });
        },
      },
      {
        narration: "The triangles got smaller and closer together: the group's glScalef also scales their moves.",
        pane: 'code',
        codeChangeFocus: ['// Children'],
      },
      {
        narration: 'One transform, two shapes.',
        recap: {
          points: [
            'A group wraps its children between one glPushMatrix and glPopMatrix.',
            "The group's transform applies to every child, their positions included.",
          ],
          calls: ['glPushMatrix', 'glPopMatrix'],
        },
      },
    ],
  },

  'transforms-exercise-4': {
    id: 'transforms-exercise-4',
    type: 'exercise',
    title: 'Set the Viewport Range',
    section: 'Transforms',
    steps: [
      {
        narration: 'Open Viewing Volume and show the world from −2 to 2 on both axes.',
        focusPanel: 'ortho-editor',
        action: () => { addNamed('TRIANGLES', ARROW, 'Arrow', '#facc15'); },
        goals: [
          {
            label: 'Left −2, right 2, bottom −2, top 2',
            check: (state) => {
              const v = state.viewportLimits;
              return near(v.minX, -2, 0.05) && near(v.maxX, 2, 0.05) && near(v.minY, -2, 0.05) && near(v.maxY, 2, 0.05);
            },
          },
        ],
        task: 'Set the volume to −2 to 2',
        hints: ['Viewing Volume is in Settings.', 'Left −2, Right 2, Bottom −2, Top 2.'],
        solve: (state) => state.setViewportLimits({ minX: -2, maxX: 2, minY: -2, maxY: 2 }),
      },
      {
        narration: 'Excellent! The four numbers in glOrtho match what you typed, and the arrow looks half its size.',
        pane: 'code',
        codeChangeFocus: ['glOrtho'],
      },
      {
        narration: 'Now zoom in on the box in the top right: make the view run from 0 to 1 on both axes.',
        focusPanel: 'ortho-editor',
        action: () => { addNamed('QUADS', square(0.5, 0.5, 0.2), 'Target', '#38bdf8'); },
        goals: [
          {
            label: 'Left 0, right 1, bottom 0, top 1',
            check: (state) => {
              const v = state.viewportLimits;
              return near(v.minX, 0, 0.05) && near(v.maxX, 1, 0.05) && near(v.minY, 0, 0.05) && near(v.maxY, 1, 0.05);
            },
          },
        ],
        task: 'Set the volume to 0 to 1',
        hints: ['Set Left and Bottom to 0 first, then Right and Top to 1.'],
        solve: (state) => state.setViewportLimits({ minX: 0, maxX: 1, minY: 0, maxY: 1 }),
      },
      {
        narration: 'The box sits in the middle of the window, much bigger, and the arrow is mostly out of view: a narrow volume is a zoom in.',
        pane: 'code',
        codeChangeFocus: ['glOrtho'],
      },
      {
        narration: 'glOrtho frames the world.',
        recap: {
          points: ["glOrtho's four numbers are the edges of the world the window shows."],
          calls: ['glOrtho'],
        },
      },
    ],
  },

  'transforms-exercise-5': {
    id: 'transforms-exercise-5',
    type: 'exercise',
    title: 'Make It Orbit',
    section: 'Transforms',
    steps: [
      {
        narration: 'A sun and two moons, grouped as System. Make the moons circle the sun, every frame, with one idle rule.',
        focusPanel: 'callbacks-panel',
        action: () => {
          addNamed('QUADS', square(0, 0, 0.15), 'Sun', '#facc15');
          addNamed('QUADS', square(0.6, 0, 0.07), 'Moon', '#e5e7eb');
          addNamed('QUADS', square(-0.6, 0, 0.07), 'Moon 2', '#94a3b8');
          group('System', ['Sun', 'Moon', 'Moon 2']);
        },
        goals: [
          { label: 'Idle is on', check: (state) => isCallbackValid(state.callbacks, 'idle') },
          { label: 'An idle rule turns System', check: (state) => idleTurns(state, 'System') },
        ],
        task: 'Turn System every frame',
        hints: ['Open Callbacks and switch Idle on.', 'Add rule: Do Rotate, Object System.'],
        solve: () => addIdleTurn('System', 1),
      },
      {
        narration: "Press Run: both moons circle the sun. onIdle adds to state_System.rotation, and the group's glRotatef swings every child. Press Esc to stop.",
        pane: 'code',
        codeChangeFocus: ['state_System.rotation +='],
      },
      {
        narration: 'Now make the sun spin on the spot as well.',
        focusPanel: 'callbacks-panel',
        goals: [{ label: 'An idle rule turns Sun', check: (state) => idleTurns(state, 'Sun') }],
        task: 'Spin the sun every frame',
        hints: ['Add a second Idle rule: Do Rotate, Object Sun.'],
        solve: () => addIdleTurn('Sun', 3),
      },
      {
        narration: "Run again. The sun turns by its own rule plus System's, because its glRotatef sits inside System's.",
        pane: 'code',
        codeChangeFocus: ['state_Sun.rotation +='],
      },
      {
        narration: 'Orbits are turns of a parent.',
        recap: {
          points: [
            'A turn on a group makes its children orbit its centre; a turn on a child spins it.',
            'Each Rotate rule adds one line to onIdle, run every frame.',
          ],
          calls: ['glutIdleFunc', 'glRotatef'],
        },
      },
    ],
  },

  'transforms-exercise-6': {
    id: 'transforms-exercise-6',
    type: 'exercise',
    title: 'Write the Transform Calls',
    section: 'Transforms',
    steps: [
      {
        narration: "The section's last exercise: place a shape, then write the calls that draw it there.",
      },
      {
        narration: 'Add any shape, then move it, turn it and resize it.',
        focusPanel: 'object-transform',
        goals: [
          { label: 'A shape moved off the centre', check: (state) => moved(capstoneShape(state)) },
          { label: 'Turned', check: (state) => turned(capstoneShape(state)) },
          { label: 'Scaled', check: (state) => scaled(capstoneShape(state)) },
        ],
        task: 'Move, turn and scale a shape',
        hints: [
          'Add a shape from Add, then open its Transform group.',
          'Give Translate, Rotate and Scale values other than the defaults.',
          'The goals follow the shape you added last.',
        ],
        solve: (state) => {
          let o = capstoneShape(state);
          if (!o) o = addNamed('TRIANGLES', ARROW, 'Arrow', '#facc15');
          now().selectObject(o.id);
          now().updateObjectTransform(o.id, {
            ...(moved(o) ? {} : { translateX: 0.4, translateY: 0.2 }),
            ...(turned(o) ? {} : { rotate: 30 }),
            ...(scaled(o) ? {} : { scaleX: 1.5, scaleY: 1.5 }),
          });
        },
      },
      {
        narration: 'In display(), first pick the matrix the transforms go into, and reset it.',
        task: 'Fill in the mode and the reset',
        hints: ['Transforms go into the modelview matrix.', 'The reset loads the identity.'],
        exercise: {
          kind: 'code',
          template: 'glMatrixMode({0}); {1}();',
          blanks: [
            { answer: () => 'GL_MODELVIEW', wrong: 'not the matrix the transforms go into' },
            { answer: () => 'glLoadIdentity', wrong: 'not the call that resets to the identity' },
          ],
        },
      },
      {
        narration: "In your shape's draw function, save the matrix before the shape changes it.",
        task: 'Name the call',
        hints: ['It pushes a copy onto the stack.'],
        exercise: {
          kind: 'code',
          template: '{0}();',
          blanks: [{ answer: () => 'glPushMatrix', wrong: 'not the call that saves the matrix' }],
        },
      },
      {
        narration: "Move it by your shape's x and y.",
        task: 'Fill in x and y',
        hints: ["Read Translate in the shape's Transform group, or its state line in the code."],
        exercise: {
          kind: 'code',
          template: 'glTranslatef({0}, {1}, 0.0f);',
          blanks: [
            { answer: (state) => capstoneShape(state)?.transform.translateX ?? 0, wrong: "that's not your shape's x" },
            { answer: (state) => capstoneShape(state)?.transform.translateY ?? 0, wrong: "that's not your shape's y" },
          ],
        },
      },
      {
        narration: 'Turn it by your angle, about the z axis.',
        task: 'Fill in the angle and the axis',
        hints: ['The angle is the third number in your state line, or your Rotate value.', 'The axis is (0, 0, 1).'],
        exercise: {
          kind: 'code',
          template: 'glRotatef({0}, 0.0f, 0.0f, {1});',
          blanks: [
            { answer: (state) => capstoneShape(state)?.transform.rotate ?? 0, tolerance: 0.05, wrong: "that's not your shape's angle" },
            { answer: () => 1, wrong: 'the z part of the axis is 1' },
          ],
        },
      },
      {
        narration: 'Scale it by your factors.',
        task: 'Fill in the factors',
        hints: ['Scale X, then Scale Y.'],
        exercise: {
          kind: 'code',
          template: 'glScalef({0}, {1}, 1.0f);',
          blanks: [
            { answer: (state) => capstoneShape(state)?.transform.scaleX ?? 1, wrong: "that's not your Scale X" },
            { answer: (state) => capstoneShape(state)?.transform.scaleY ?? 1, wrong: "that's not your Scale Y" },
          ],
        },
      },
      {
        narration: 'After the corners, put the matrix back for the next shape.',
        task: 'Name the call',
        hints: ['It pops the saved copy off the stack.'],
        exercise: {
          kind: 'code',
          template: '{0}();',
          blanks: [{ answer: () => 'glPopMatrix', wrong: 'not the call that restores the matrix' }],
        },
      },
      {
        narration: 'You wrote the transform calls by hand. Next, Textures: painting pictures onto shapes.',
        recap: {
          points: [
            'Each frame starts from the identity in GL_MODELVIEW.',
            'glPushMatrix, then translate, rotate and scale, then the corners, then glPopMatrix.',
            'The numbers are the ones in your Transform group.',
          ],
          calls: ['glMatrixMode', 'glPushMatrix', 'glTranslatef', 'glRotatef', 'glScalef', 'glPopMatrix'],
        },
      },
    ],
  },
};
