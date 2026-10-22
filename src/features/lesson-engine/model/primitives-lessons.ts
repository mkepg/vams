import type { Lesson } from '@/core/types/lesson';
import type { VamsState } from '@/core/store/types';
import type { PendingVertex, PrimitiveType, SceneNode, SpecialKey, MouseButton, MouseState, RuleAction } from '@/core/types/scene';
import { useVamsStore } from '@/core/store';
import { isCallbackValid, newRuleId } from '@/core/callbacks/callbacks-model';

const TRIANGLE: PendingVertex[] = [{ x: 0, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }];
const SQUARE: PendingVertex[] = [{ x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: -0.5 }];
const ZIGZAG: PendingVertex[] = [{ x: -0.75, y: -0.25 }, { x: -0.25, y: 0.25 }, { x: 0.25, y: -0.25 }, { x: 0.75, y: 0.25 }];
const HEXAGON: PendingVertex[] = [0, 60, 120, 180, 240, 300].map((deg) => ({
  x: Math.round(Math.cos((deg * Math.PI) / 180) * 50) / 100,
  y: Math.round(Math.sin((deg * Math.PI) / 180) * 50) / 100,
}));
const STRIP: PendingVertex[] = [{ x: -0.8, y: -0.3 }, { x: -0.6, y: 0.3 }, { x: -0.2, y: -0.3 }, { x: 0, y: 0.3 }, { x: 0.4, y: -0.3 }];
const FAN: PendingVertex[] = [{ x: 0, y: -0.4 }, ...[160, 125, 90, 55, 20].map((deg) => ({
  x: Math.round(Math.cos((deg * Math.PI) / 180) * 70) / 100,
  y: Math.round((Math.sin((deg * Math.PI) / 180) * 0.7 - 0.4) * 100) / 100,
}))];
const QUAD_STRIP: PendingVertex[] = [
  { x: -0.75, y: -0.3 }, { x: -0.75, y: 0.3 }, { x: 0, y: -0.3 }, { x: 0, y: 0.3 }, { x: 0.75, y: -0.3 }, { x: 0.75, y: 0.3 },
];

const FILLED: PrimitiveType[] = ['TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN', 'QUADS', 'QUAD_STRIP', 'POLYGON'];
const LINE_TYPES: PrimitiveType[] = ['LINES', 'LINE_STRIP', 'LINE_LOOP'];

const firstOfType = (state: VamsState, type: SceneNode['type']) => state.objects.find((o) => o.type === type);
const now = () => useVamsStore.getState();

/** Clears the scene and adds one shape, selected; returns it. */
function show(type: PrimitiveType, vertices: PendingVertex[]): SceneNode | undefined {
  for (const o of [...now().objects]) now().deleteObject(o.id);
  now().addCustomObject(type, vertices);
  return now().objects[0];
}

/** Adds a white triangle named Triangle, unselected; returns it. */
function addTriangle(): SceneNode {
  now().addCustomObject('TRIANGLES', TRIANGLE);
  const t = now().objects[0];
  now().updateObjectName(t.id, 'Triangle');
  now().selectObject(null);
  return now().objects.find((o) => o.id === t.id)!;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const isGreen = (hex: string) => { const [r, g, b] = rgb(hex); return r < 50 && g > 200 && b < 50; };
const isMagenta = (hex: string) => { const [r, g, b] = rgb(hex); return r > 200 && g < 50 && b > 200; };
/** A channel as glColor3f prints it: two decimals. */
const printed = (value: number) => Math.round(value * 100) / 100;
const multicolour = (o: SceneNode) => new Set(o.vertices.map((v) => v.color.toLowerCase())).size > 1;
const isFilled = (o: SceneNode) => FILLED.includes(o.type as PrimitiveType);
const isLine = (o: SceneNode) => LINE_TYPES.includes(o.type as PrimitiveType);
/** A line with a visible dash pattern or more than a pixel of width. */
const styledLine = (o: SceneNode) =>
  isLine(o) && ((!!o.lineStipple && o.lineStipple.pattern !== 0xffff) || (o.lineWidth ?? 1) > 1);

const rule = (objectId: string, trigger: Parameters<VamsState['addCallbackRule']>[1]['trigger'], action: RuleAction) => ({
  id: newRuleId(),
  objectId,
  trigger,
  action,
});
const exists = (state: VamsState, id: string) => state.objects.some((o) => o.id === id);
const mouseRule = (state: VamsState, button: MouseButton, st: MouseState, type: RuleAction['type']) =>
  isCallbackValid(state.callbacks, 'mouse') &&
  state.callbacks.mouse.rules.some(
    (r) => r.trigger.kind === 'mouse' && r.trigger.button === button && r.trigger.state === st && r.action.type === type && exists(state, r.objectId),
  );
const dragRule = (state: VamsState) =>
  isCallbackValid(state.callbacks, 'motion') &&
  state.callbacks.motion.rules.some((r) => r.action.type === 'moveToPointer' && exists(state, r.objectId));
/** Special-key translate rules for one key, moving along one axis in one direction. */
const arrowMoves = (state: VamsState, key: SpecialKey, axis: 'dx' | 'dy', sign: number) =>
  state.callbacks.special.rules.filter(
    (r) =>
      r.trigger.kind === 'special' && r.trigger.key === key && r.action.type === 'translate' &&
      Math.sign(r.action[axis]) === sign && r.action[axis === 'dx' ? 'dy' : 'dx'] === 0 && exists(state, r.objectId),
  );
const drives = (state: VamsState, a: [SpecialKey, 'dx' | 'dy', number], b: [SpecialKey, 'dx' | 'dy', number]) =>
  isCallbackValid(state.callbacks, 'special') &&
  arrowMoves(state, ...a).some((r) => arrowMoves(state, ...b).some((l) => l.objectId === r.objectId));

/** The capstone's filled shape: the first with two corner colours, else the first filled one. */
const capstoneShape = (state: VamsState) => state.objects.find((o) => isFilled(o) && multicolour(o)) ?? state.objects.find(isFilled);
const firstCorner = (state: VamsState) => capstoneShape(state)?.vertices[0];
const cornerChannel = (state: VamsState, i: number) => printed(rgb(firstCorner(state)?.color ?? '#ffffff')[i] / 255);

export const PRIMITIVES_LESSONS: Record<string, Lesson> = {
  'poc-demo-1': {
    id: 'poc-demo-1',
    title: 'Your First Triangle',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: 'What does it take to draw a triangle in OpenGL? Three corners between two calls. Watch the code as one appears.',
      },
      {
        narration: 'Here it is. In its draw function, glBegin(GL_TRIANGLES) opens the shape and glEnd() closes it.',
        action: (state) => state.addCustomObject('TRIANGLES', TRIANGLE),
        codeChangeFocus: ['glBegin(', 'glEnd('],
      },
      {
        narration: "Between them is one glVertex2f per corner: its x and y measured from the shape's centre. The glTranslatef above moves that centre into place.",
        codeChangeFocus: ['glVertex2f'],
      },
      {
        narration: 'Before each corner, glColor3f sets its colour as red, green and blue from 0.0 to 1.0. All three corners are white: 1.00 each.',
        codeChangeFocus: ['glColor3f'],
      },
      {
        narration: "We're about to hide the triangle in Scene. What happens to its code?",
        focusPanel: 'scene-hierarchy',
        predict: {
          options: [
            { id: 'gone', label: 'It disappears from the code', why: 'A hidden shape is left out of the program: no draw function, and no call to it in draw().' },
            { id: 'black', label: 'It stays, drawn in black', why: 'Hidden shapes are not drawn in another colour; they are left out.' },
            { id: 'comment', label: 'It stays, commented out', why: 'The program only holds what it draws, so nothing is kept as a comment.' },
          ],
          correctId: 'gone',
        },
        action: (state) => {
          const t = state.objects[0];
          if (t) state.toggleObjectVisibility(t.id);
        },
      },
      {
        narration: 'The eye button in Scene shows it again, and draw() calls its draw function once more.',
        focusPanel: 'scene-hierarchy',
        action: (state) => {
          const t = state.objects[0];
          if (t && !t.visible) state.toggleObjectVisibility(t.id);
        },
      },
      {
        narration: "That's every shape in OpenGL 1.x: a glBegin, a colour and a position for each corner, and a glEnd.",
        recap: {
          points: [
            'A shape is its corners between glBegin and glEnd.',
            'Each corner is a glColor3f followed by a glVertex2f.',
            'A hidden shape is left out of the program.',
          ],
          calls: ['glBegin', 'glVertex2f', 'glEnd'],
        },
      },
    ],
  },
  'primitives-demo-1': {
    id: 'primitives-demo-1',
    title: 'The Geometry Alphabet: Points to Polygons',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: 'glBegin takes a mode, and the mode decides how the corners are joined.',
      },
      {
        narration: 'GL_POINTS draws each corner as a dot of its own. The code makes them 8 pixels wide with glPointSize(8.0f), then sets the size back to 1.',
        action: () => { show('POINTS', ZIGZAG); },
        codeChangeFocus: ['glPointSize', 'GL_POINTS'],
      },
      {
        narration: "Next, GL_LINES with the same four corners. How many lines will you see?",
        predict: {
          options: [
            { id: 'two', label: 'Two', why: 'GL_LINES takes the corners in pairs: 1 to 2, then 3 to 4.' },
            { id: 'three', label: 'Three', why: 'Joining every corner to the next is GL_LINE_STRIP.' },
            { id: 'four', label: 'Four', why: 'Closing the shape back to the first corner is GL_LINE_LOOP.' },
          ],
          correctId: 'two',
        },
        action: () => { show('LINES', ZIGZAG); },
      },
      {
        narration: 'Two separate lines. A fifth corner would be left out, since it has no partner.',
        codeChangeFocus: ['GL_LINES'],
      },
      {
        narration: 'GL_LINE_STRIP joins each corner to the next: three lines from four corners.',
        action: () => { show('LINE_STRIP', ZIGZAG); },
        codeChangeFocus: ['GL_LINE_STRIP'],
      },
      {
        narration: 'GL_LINE_LOOP does the same, then joins the last corner back to the first.',
        action: () => { show('LINE_LOOP', ZIGZAG); },
        codeChangeFocus: ['GL_LINE_LOOP'],
      },
      {
        narration: 'The filled modes. GL_TRIANGLES fills one triangle from every three corners.',
        action: () => { show('TRIANGLES', TRIANGLE); },
        codeChangeFocus: ['GL_TRIANGLES'],
      },
      {
        narration: 'GL_QUADS fills a four-sided shape from every four corners.',
        action: () => { show('QUADS', SQUARE); },
        codeChangeFocus: ['GL_QUADS'],
      },
      {
        narration: 'Now GL_POLYGON with six corners. How many shapes will it fill?',
        predict: {
          options: [
            { id: 'one', label: 'One', why: 'GL_POLYGON joins all its corners into a single filled shape.' },
            { id: 'two', label: 'Two', why: 'Two triangles from six corners is GL_TRIANGLES.' },
            { id: 'six', label: 'Six', why: 'Six is the number of corners, not of shapes.' },
          ],
          correctId: 'one',
        },
        action: () => { show('POLYGON', HEXAGON); },
      },
      {
        narration: 'One hexagon. A GL_POLYGON must be convex: if a corner points inwards, OpenGL may fill it wrongly.',
        codeChangeFocus: ['GL_POLYGON'],
      },
      {
        narration: 'Seven modes, one pattern: corners between glBegin and glEnd, and the mode decides what they make.',
        recap: {
          points: [
            'The mode in glBegin decides how the corners are joined.',
            'GL_POINTS and the line modes draw dots and outlines; GL_TRIANGLES, GL_QUADS and GL_POLYGON fill.',
          ],
          calls: ['glBegin', 'glVertex2f'],
        },
      },
    ],
  },
  'primitives-demo-6': {
    id: 'primitives-demo-6',
    title: 'Strips and Fans',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: 'Shapes that touch share corners. Strips and fans reuse them, so the same shape needs fewer glVertex2f calls.',
      },
      {
        narration: 'This GL_TRIANGLE_STRIP has five corners. How many triangles will it fill?',
        predict: {
          options: [
            { id: 'three', label: 'Three', why: 'The first two corners start the strip; every corner after that adds a triangle: 5 − 2 = 3.' },
            { id: 'one', label: 'One', why: 'One triangle would use only three of the corners.' },
            { id: 'five', label: 'Five', why: 'Each triangle needs three corners, and the first two only start the strip.' },
          ],
          correctId: 'three',
        },
        action: () => { show('TRIANGLE_STRIP', STRIP); },
      },
      {
        narration: 'Each corner makes a triangle with the two before it. GL_TRIANGLES would need nine corners for the same three triangles.',
        codeChangeFocus: ['GL_TRIANGLE_STRIP'],
      },
      {
        narration: 'GL_TRIANGLE_FAN: the first corner is the centre, and each new corner makes a triangle with the centre and the corner before.',
        action: () => { show('TRIANGLE_FAN', FAN); },
        codeChangeFocus: ['GL_TRIANGLE_FAN'],
      },
      {
        narration: 'Six corners, four triangles. Fans suit round shapes such as circles and pie slices.',
      },
      {
        narration: 'Last, GL_QUAD_STRIP with six corners. How many quads?',
        predict: {
          options: [
            { id: 'two', label: 'Two', why: 'The first pair starts the strip, and each new pair adds a quad: (6 − 2) ÷ 2 = 2.' },
            { id: 'three', label: 'Three', why: 'Three quads would need eight corners.' },
            { id: 'one', label: 'One', why: 'One quad uses only four of the corners.' },
          ],
          correctId: 'two',
        },
        action: () => { show('QUAD_STRIP', QUAD_STRIP); },
      },
      {
        narration: 'GL_QUAD_STRIP takes the corners in pairs, bottom then top, and joins each pair to the pair before into a quad.',
        codeChangeFocus: ['GL_QUAD_STRIP'],
      },
      {
        narration: 'Fewer corners means less to send. That matters most when a shape has hundreds of them.',
        recap: {
          points: [
            'In a strip or a fan, each new corner adds a triangle.',
            'A fan shares its first corner; GL_QUAD_STRIP adds a quad for each new pair.',
          ],
          calls: ['glBegin', 'glVertex2f'],
        },
      },
    ],
  },
  'primitives-demo-2': {
    id: 'primitives-demo-2',
    title: 'Painting with Barycentrics',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: 'Every corner has its own colour. All three of these are white. What happens when they differ?',
        focusPanel: 'appearance-panel',
        action: (state) => state.addCustomObject('TRIANGLES', TRIANGLE),
      },
      {
        narration: "We're about to make the top corner red and leave the other two white. What will the inside look like?",
        focusPanel: 'appearance-panel',
        predict: {
          options: [
            { id: 'blend', label: 'Red fading into white', why: 'OpenGL mixes the corner colours across the face.' },
            { id: 'split', label: 'A red third and a white rest', why: 'There are no sharp borders: each pixel mixes all three corners.' },
            { id: 'red', label: 'All red', why: 'Only one corner is red; the other two pull their part of the face towards white.' },
          ],
          correctId: 'blend',
        },
        action: (state) => {
          const t = state.objects[0];
          if (t) state.updateVertexColor(t.id, t.vertices[0].id, '#ff0000');
        },
      },
      {
        narration: 'Each pixel inside mixes the corner colours by how close it is to each corner. This mixing is called barycentric interpolation.',
      },
      {
        narration: 'With red, green and blue corners, the middle of the triangle is a mix of all three.',
        focusPanel: 'appearance-panel',
        action: (state) => {
          const t = state.objects[0];
          if (t?.vertices.length === 3) {
            state.updateVertexColor(t.id, t.vertices[1].id, '#00ff00');
            now().updateVertexColor(t.id, t.vertices[2].id, '#0000ff');
          }
        },
      },
      {
        narration: "Math's Coloured stage follows one corner: it keeps its own colour, and pixels further in blend towards the others.",
        pane: 'math',
        mathStage: 'coloured',
      },
      {
        narration: 'The blending comes from glShadeModel(GL_SMOOTH). With GL_FLAT, each triangle would take one colour: that of its last corner.',
        pane: 'code',
        codeChangeFocus: ['glShadeModel'],
      },
      {
        narration: 'glColor3f stays set until the next glColor3f, so the code sets it again before every corner.',
        pane: 'code',
        codeChangeFocus: ['glColor3f'],
      },
      {
        narration: "We're about to write the colours with glColor3ub, which counts from 0 to 255. What does pure red become?",
        focusPanel: 'appearance-panel',
        predict: {
          options: [
            { id: '255', label: '255, 0, 0', why: "glColor3ub's 255 is glColor3f's 1.0." },
            { id: '1', label: '1, 0, 0', why: 'With glColor3ub, 1 out of 255 is almost black.' },
            { id: '100', label: '100, 0, 0', why: 'glColor3ub counts to 255, not 100.' },
          ],
          correctId: '255',
        },
        action: (state) => {
          const t = state.objects[0];
          if (t) state.updateObjectColorMode(t.id, 'BYTE');
        },
      },
      {
        narration: 'The picture is the same: glColor3ub(255, 0, 0) and glColor3f(1.00f, 0.00f, 0.00f) are the same red. Emission in Appearance switches between them.',
        pane: 'code',
        codeChangeFocus: ['glColor3ub'],
      },
      {
        narration: 'Colours belong to corners, and the face between them is blended.',
        recap: {
          points: [
            'Each corner has its own colour, and glShadeModel(GL_SMOOTH) blends them across the face.',
            'glColor3f takes 0.0 to 1.0; glColor3ub takes 0 to 255.',
          ],
          calls: ['glColor3ub', 'glShadeModel'],
        },
      },
    ],
  },
  'primitives-demo-3': {
    id: 'primitives-demo-3',
    title: 'Styling Lines (Width & Stipple)',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: 'Lines can be thicker than a pixel, and dashed. Here is a square outline drawn with GL_LINE_LOOP.',
        focusPanel: 'line-style-panel',
        action: (state) => state.addCustomObject('LINE_LOOP', SQUARE),
      },
      {
        narration: 'glLineWidth(5.00f) makes it 5 pixels wide. After the shape, the code sets the width back to 1, so other lines stay thin.',
        focusPanel: 'line-style-panel',
        action: (state) => {
          const o = state.objects[0];
          if (o) state.updateLineWidth(o.id, 5);
        },
        codeChangeFocus: ['glLineWidth'],
      },
      {
        narration: 'Dashes come from a stipple pattern of 16 bits, read from the lowest bit up. A 1 draws a pixel and a 0 skips one.',
        focusPanel: 'line-style-panel',
      },
      {
        narration: 'glLineStipple(1, 0x00FF): eight 1 bits and eight 0 bits, so 8 pixels drawn, then 8 skipped, all along the line.',
        focusPanel: 'line-style-panel',
        action: (state) => {
          const o = state.objects[0];
          if (o) state.updateLineStipple(o.id, { factor: 1, pattern: 0x00ff });
        },
        codeChangeFocus: ['glLineStipple'],
      },
      {
        narration: "We're about to set the stipple factor to 2. What happens to the dashes?",
        focusPanel: 'line-style-panel',
        predict: {
          options: [
            { id: 'longer', label: 'Dashes and gaps get twice as long', why: 'The factor repeats each bit, so each dash and each gap is 16 pixels.' },
            { id: 'more', label: 'There are twice as many dashes', why: 'The pattern is unchanged; each bit just lasts longer.' },
            { id: 'thinner', label: 'The line gets thinner', why: 'Thickness comes from glLineWidth; the factor only stretches the pattern.' },
          ],
          correctId: 'longer',
        },
        action: (state) => {
          const o = state.objects[0];
          if (o) state.updateLineStipple(o.id, { factor: 2, pattern: 0x00ff });
        },
      },
      {
        narration: 'Stippling is switched on with glEnable(GL_LINE_STIPPLE) before the shape and off with glDisable after it, so the next line is solid again.',
        pane: 'code',
        codeChangeFocus: ['GL_LINE_STIPPLE'],
      },
      {
        narration: 'Width and stippling stay set until you change them, so after the shape the code switches stippling off and sets the width back to 1.',
        recap: {
          points: [
            'glLineWidth sets a line\'s thickness in pixels.',
            'glLineStipple(factor, pattern) dashes it: each 1 bit draws, each 0 skips, and the factor repeats every bit.',
          ],
          calls: ['glLineWidth', 'glLineStipple'],
        },
      },
    ],
  },
  'primitives-demo-4': {
    id: 'primitives-demo-4',
    title: 'Rendering Text in OpenGL',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: 'OpenGL has no call for text. GLUT adds one, which draws characters from a bitmap font.',
        focusPanel: 'text-node-panel',
        action: (state) => state.addTextObject('Hello', 0, 0),
      },
      {
        narration: 'Text does not use glBegin. glRasterPos2f sets the raster position: the spot where the next character is drawn.',
        pane: 'code',
        codeChangeFocus: ['glRasterPos2f'],
      },
      {
        narration: 'A loop then passes each character to glutBitmapCharacter, which draws it and moves the raster position along.',
        pane: 'code',
        codeChangeFocus: ['glutBitmapCharacter'],
      },
      {
        narration: 'GLUT_BITMAP_9_BY_15 names the font: every character is a picture 9 pixels wide and 15 tall.',
        pane: 'code',
      },
      {
        narration: "We're about to add a second line, OpenGL!. How many glRasterPos2f calls will the text need?",
        focusPanel: 'text-node-panel',
        predict: {
          options: [
            { id: 'two', label: 'Two', why: 'Each line starts at its own raster position, one line lower.' },
            { id: 'one', label: 'One', why: 'glutBitmapCharacter moves along a line, but never down to the next one.' },
            { id: 'twelve', label: 'One per character', why: 'Each character moves the position along by itself.' },
          ],
          correctId: 'two',
        },
        action: (state) => {
          const t = firstOfType(state, 'TEXT');
          if (t) state.updateTextContent(t.id, 'Hello\nOpenGL!');
        },
      },
      {
        narration: 'The colour comes from the glColor3f before glRasterPos2f. OpenGL takes the colour when the raster position is set, so it must come first.',
        pane: 'code',
        codeChangeFocus: ['glColor3f'],
      },
      {
        narration: 'Bitmap text is quick to add, which makes it a good fit for labels and scores.',
        recap: {
          points: [
            'glRasterPos2f sets where a line of text starts.',
            'glutBitmapCharacter draws one character and moves along; the colour is set before glRasterPos2f.',
          ],
          calls: ['glRasterPos2f', 'glutBitmapCharacter'],
        },
      },
    ],
  },
  'primitives-demo-5': {
    id: 'primitives-demo-5',
    title: 'Hooking Up Callbacks',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: "A program that only draws can't react. A GLUT callback is a function of yours that GLUT calls when a key is pressed, the mouse moves or the window changes size.",
        focusPanel: 'callbacks-panel',
      },
      {
        narration: "Here is a keyboard callback, onKey, with one rule: when D is pressed, move the triangle 0.10 to the right.",
        focusPanel: 'callbacks-panel',
        action: () => {
          const triangle = addTriangle();
          now().setCallbackHandler('keyboard', 'onKey');
          now().addCallbackRule('keyboard', rule(triangle.id, { kind: 'keyboard', key: 'd' }, { type: 'translate', dx: 0.1, dy: 0 }));
        },
      },
      {
        narration: "In the code, onKey switches on key. Case 'd' and 'D' change state_Triangle.x, and glutPostRedisplay asks GLUT for a new frame.",
        pane: 'code',
        codeChangeFocus: ["case 'd'"],
      },
      {
        narration: 'glutKeyboardFunc(onKey) in main() registers it: from then on, GLUT calls onKey for every key typed.',
        pane: 'code',
        codeChangeFocus: ['glutKeyboardFunc'],
      },
      {
        narration: 'The keyboard callback gets the keys that type a character. Which callback gets the arrow keys?',
        focusPanel: 'callbacks-panel',
        predict: {
          options: [
            { id: 'special', label: 'glutSpecialFunc', why: 'Arrow keys type no character, so GLUT sends them to glutSpecialFunc as GLUT_KEY_LEFT, GLUT_KEY_UP and so on.' },
            { id: 'keyboard', label: 'glutKeyboardFunc', why: 'glutKeyboardFunc only receives keys that type a character.' },
            { id: 'mouse', label: 'glutMouseFunc', why: 'glutMouseFunc is for mouse buttons; arrows are keys.' },
          ],
          correctId: 'special',
        },
        action: (state) => {
          const t = state.objects[0];
          if (!t) return;
          state.setCallbackHandler('special', 'onSpecial');
          now().addCallbackRule('special', rule(t.id, { kind: 'special', key: 'right' }, { type: 'translate', dx: 0.1, dy: 0 }));
        },
      },
      {
        narration: 'Clicks go to glutMouseFunc with the button, GLUT_LEFT_BUTTON, GLUT_MIDDLE_BUTTON or GLUT_RIGHT_BUTTON, and its state: GLUT_DOWN when pressed, GLUT_UP when released. This rule puts the triangle back where it started on a left click.',
        focusPanel: 'callbacks-panel',
        action: (state) => {
          const t = state.objects[0];
          if (!t) return;
          state.setCallbackHandler('mouse', 'onMouse');
          now().addCallbackRule('mouse', rule(t.id, { kind: 'mouse', button: 'left', state: 'down' }, { type: 'reset' }));
        },
        codeChangeFocus: ['GLUT_LEFT_BUTTON'],
      },
      {
        narration: 'Drags go to glutMotionFunc, which GLUT calls while a button is held and the mouse moves. This rule moves the triangle to the pointer.',
        focusPanel: 'callbacks-panel',
        action: (state) => {
          const t = state.objects[0];
          if (!t) return;
          state.setCallbackHandler('motion', 'onMotion');
          now().addCallbackRule('motion', rule(t.id, { kind: 'motion' }, { type: 'moveToPointer' }));
        },
        codeChangeFocus: ['glutMotionFunc'],
      },
      {
        narration: 'Handlers get x and y in window pixels, counted down from the top. windowToWorld turns them into your coordinates with glutGet(GLUT_WINDOW_WIDTH) and glutGet(GLUT_WINDOW_HEIGHT).',
        pane: 'code',
        codeChangeFocus: ['glutGet'],
      },
      {
        narration: 'Press Run on the canvas, then try D, →, a click and a drag. Esc stops, and your scene is just as you built it.',
      },
      {
        narration: 'Every callback works the same way: write the function, then register it in main().',
        recap: {
          points: [
            'A callback is your function; a glut…Func call in main() registers it.',
            'Keys go to glutKeyboardFunc or glutSpecialFunc, clicks to glutMouseFunc and drags to glutMotionFunc.',
          ],
          calls: ['glutKeyboardFunc', 'glutSpecialFunc', 'glutMouseFunc', 'glutMotionFunc'],
        },
      },
    ],
  },
  'primitives-demo-7': {
    id: 'primitives-demo-7',
    title: 'When the Window Changes Size',
    type: 'demo',
    section: 'Primitives',
    steps: [
      {
        narration: 'A window can be resized at any time. When it is, GLUT calls a reshape callback with the new width and height in pixels.',
        focusPanel: 'callbacks-panel',
        action: () => { addTriangle(); },
      },
      {
        narration: 'Here Reshape is switched on: glutReshapeFunc(onReshape) in main() registers it.',
        focusPanel: 'callbacks-panel',
        action: (state) => state.setCallbackHandler('reshape', 'onReshape'),
        codeChangeFocus: ['glutReshapeFunc'],
      },
      {
        narration: "glViewport(0, 0, width, height) tells OpenGL to draw into the whole window. Without your own reshape, GLUT does this for you; with one, it's your job.",
        pane: 'code',
        codeChangeFocus: ['glViewport'],
      },
      {
        narration: 'Stretch keeps the viewing volume as it is and fills the window with it. If you drag the window wider, what happens to the triangle?',
        focusPanel: 'callbacks-panel',
        predict: {
          options: [
            { id: 'wider', label: 'It gets wider', why: 'The same −1 to 1 box is spread across more pixels sideways, so the shape stretches.' },
            { id: 'same', label: 'It keeps its shape', why: 'That is Keep proportions, which widens the box to match the window.' },
            { id: 'smaller', label: 'It gets smaller', why: 'The box fills the whole window, so nothing shrinks.' },
          ],
          correctId: 'wider',
        },
        action: (state) => state.setReshapeMode('stretch'),
      },
      {
        narration: "Keep proportions widens the viewing volume to match the window's shape instead, so a square stays square. The code works out the aspect ratio and moves the edges glOrtho uses.",
        focusPanel: 'callbacks-panel',
        action: (state) => state.setReshapeMode('keep'),
        codeChangeFocus: ['aspect'],
      },
      {
        narration: "Press Run, then drag the program window's corner. Try it with Stretch too.",
      },
      {
        narration: 'A reshape callback keeps your picture right in a window of any size.',
        recap: {
          points: [
            'glutReshapeFunc registers the function GLUT calls when the window changes size.',
            'glViewport sets the drawing area; Keep proportions also widens the viewing volume.',
          ],
          calls: ['glutReshapeFunc', 'glViewport'],
        },
      },
    ],
  },
  'primitives-exercise-1': {
    id: 'primitives-exercise-1',
    title: 'Quad Assembly',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'Build two shapes out of quads. Add is the first panel on the rail.',
      },
      {
        narration: 'Add a GL_QUADS shape: one quad, four corners.',
        goals: [{ label: 'A GL_QUADS shape', check: (state) => state.objects.some((o) => o.type === 'QUADS' && o.vertices.length >= 4) }],
        task: 'Add a GL_QUADS shape',
        hints: [
          'In Add, pick Quads, then click the canvas four times.',
          'Click the corners in order around the shape, then press Enter.',
        ],
        solve: (state) => state.addCustomObject('QUADS', SQUARE),
      },
      {
        narration: 'How your code does it: glBegin(GL_QUADS), then four glVertex2f. Every four corners make one quad.',
        pane: 'code',
        codeChangeFocus: ['GL_QUADS'],
      },
      {
        narration: 'Now a quad strip with two quads side by side.',
        goals: [{ label: 'A GL_QUAD_STRIP with two quads', check: (state) => state.objects.some((o) => o.type === 'QUAD_STRIP' && o.vertices.length >= 6) }],
        task: 'Add a quad strip with two quads',
        hints: [
          'Pick Quad strip, then click the corners in pairs, bottom then top, from left to right.',
          'Six corners make two quads.',
        ],
        solve: (state) => state.addCustomObject('QUAD_STRIP', QUAD_STRIP),
      },
      {
        narration: 'The strip needs six glVertex2f for its two quads, where GL_QUADS would need eight: the middle pair is shared.',
        pane: 'code',
        codeChangeFocus: ['GL_QUAD_STRIP'],
      },
      {
        narration: 'Two ways to make quads, and the shared corners make the difference.',
        recap: {
          points: ['GL_QUADS takes the corners in fours.', 'GL_QUAD_STRIP adds a quad for each new pair of corners.'],
          calls: ['glBegin', 'glVertex2f'],
        },
      },
    ],
  },
  'primitives-exercise-2': {
    id: 'primitives-exercise-2',
    title: 'Neon Gradient',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'A white triangle. Give it a neon gradient.',
        focusPanel: 'appearance-panel',
        action: (state) => state.addCustomObject('TRIANGLES', TRIANGLE),
      },
      {
        narration: 'Colour one corner bright green and another bright magenta.',
        focusPanel: 'appearance-panel',
        goals: [
          { label: 'A green corner', check: (state) => !!firstOfType(state, 'TRIANGLES')?.vertices.some((v) => isGreen(v.color)) },
          { label: 'A magenta corner', check: (state) => !!firstOfType(state, 'TRIANGLES')?.vertices.some((v) => isMagenta(v.color)) },
        ],
        task: 'Colour one corner green and one magenta',
        hints: [
          'Select the triangle. In Appearance, choose Per vertex.',
          'Type 00FF00 into one corner and FF00FF into another.',
        ],
        solve: (state) => {
          const t = firstOfType(state, 'TRIANGLES');
          if (!t) return;
          state.updateVertexColor(t.id, t.vertices[0].id, '#00ff00');
          now().updateVertexColor(t.id, t.vertices[1].id, '#ff00ff');
        },
      },
      {
        narration: 'How your code does it: a glColor3f before each glVertex2f, and glShadeModel(GL_SMOOTH) blends them across the face.',
        pane: 'code',
        codeChangeFocus: ['glColor3f'],
      },
      {
        narration: 'Now write the same colours as whole numbers from 0 to 255.',
        focusPanel: 'appearance-panel',
        goals: [{ label: 'Colours as glColor3ub', check: (state) => firstOfType(state, 'TRIANGLES')?.colorMode === 'BYTE' }],
        task: 'Switch the colours to glColor3ub',
        hints: ['Emission is in Appearance, above the colours.', 'Pick glColor3ub.'],
        solve: (state) => {
          const t = firstOfType(state, 'TRIANGLES');
          if (t) state.updateObjectColorMode(t.id, 'BYTE');
        },
      },
      {
        narration: 'The same picture: green is now glColor3ub(0, 255, 0).',
        pane: 'code',
        codeChangeFocus: ['glColor3ub'],
      },
      {
        narration: 'Your gradient is three colours and the blending OpenGL does between them.',
        recap: {
          points: [
            "Each corner's glColor3f or glColor3ub comes just before its glVertex2f.",
            'Smooth shading blends the corner colours across the face.',
          ],
          calls: ['glColor3ub', 'glShadeModel'],
        },
      },
    ],
  },
  'primitives-exercise-3': {
    id: 'primitives-exercise-3',
    title: 'Dotted Outline',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'A square outline. Make it thick and dotted.',
        focusPanel: 'line-style-panel',
        action: (state) => state.addCustomObject('LINE_LOOP', SQUARE),
      },
      {
        narration: 'First, the dots.',
        focusPanel: 'line-style-panel',
        goals: [{ label: 'Dotted', check: (state) => firstOfType(state, 'LINE_LOOP')?.lineStipple?.pattern === 0x5555 }],
        task: 'Make the outline dotted',
        hints: ['Select the outline. Line Style is in Appearance.', 'Switch on Line stipple, then pick Dotted.'],
        solve: (state) => {
          const o = firstOfType(state, 'LINE_LOOP');
          if (o) state.updateLineStipple(o.id, { factor: 1, pattern: 0x5555 });
        },
      },
      {
        narration: 'Dotted is 0x5555, which is 0101 0101 0101 0101 in binary: one pixel on, one off.',
        pane: 'code',
        codeChangeFocus: ['glLineStipple'],
      },
      {
        narration: 'Make the line at least 3 pixels wide, and space the dots out with a stipple factor of 3.',
        focusPanel: 'line-style-panel',
        goals: [
          { label: 'At least 3 px wide', check: (state) => (firstOfType(state, 'LINE_LOOP')?.lineWidth ?? 0) >= 3 },
          { label: 'Stipple factor 3', check: (state) => firstOfType(state, 'LINE_LOOP')?.lineStipple?.factor === 3 },
        ],
        task: 'Widen the line and set the factor to 3',
        hints: ['Line width is above Line stipple.', 'Stipple factor is below the pattern bits.'],
        solve: (state) => {
          const o = firstOfType(state, 'LINE_LOOP');
          if (!o) return;
          state.updateLineWidth(o.id, 4);
          now().updateLineStipple(o.id, { factor: 3, pattern: o.lineStipple?.pattern ?? 0x5555 });
        },
      },
      {
        narration: 'How your code does it: glLineWidth sets the width, and the first number in glLineStipple is the factor, so each bit now lasts 3 pixels.',
        pane: 'code',
        codeChangeFocus: ['glLineWidth', 'glLineStipple'],
      },
      {
        narration: 'Two calls before the shape decide how every one of its lines looks.',
        recap: {
          points: ['glLineStipple(factor, pattern) makes dashes and dots.', 'glLineWidth sets the thickness in pixels.'],
          calls: ['glLineStipple', 'glLineWidth'],
        },
      },
    ],
  },
  'primitives-exercise-4': {
    id: 'primitives-exercise-4',
    title: 'Hello World!',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: "Label your scene. Add text that says Hello World.",
        focusPanel: 'text-node-panel',
        goals: [{ label: 'Says Hello World', check: (state) => state.objects.some((o) => o.type === 'TEXT' && !!o.textContent?.toLowerCase().replace(/\s+/g, ' ').includes('hello world')) }],
        task: 'Add text that says Hello World',
        hints: ['In Add, type into Create New Text, then press Enter.'],
        solve: (state) => state.addTextObject('Hello World', 0, 0),
      },
      {
        narration: 'How your code does it: glRasterPos2f places the text, and glutBitmapCharacter draws each character in GLUT_BITMAP_9_BY_15.',
        pane: 'code',
        codeChangeFocus: ['glutBitmapCharacter'],
      },
      {
        narration: 'Now put Hello and World on two lines.',
        goals: [{ label: 'Two lines', check: (state) => !!firstOfType(state, 'TEXT')?.textContent?.includes('\n') }],
        task: 'Put the text on two lines',
        hints: ['Select the text. Edit Selected Text is at the top of its inspector.', 'Press Enter between Hello and World.'],
        solve: (state) => {
          const t = firstOfType(state, 'TEXT');
          if (t) state.updateTextContent(t.id, 'Hello\nWorld');
        },
      },
      {
        narration: 'Now there are two glRasterPos2f calls, one per line, the second one line lower.',
        pane: 'code',
        codeChangeFocus: ['glRasterPos2f'],
      },
      {
        narration: 'Text is placed once per line and drawn a character at a time.',
        recap: {
          points: ['glRasterPos2f sets where each line starts.', 'glutBitmapCharacter draws the characters one by one.'],
          calls: ['glRasterPos2f', 'glutBitmapCharacter'],
        },
      },
    ],
  },
  'primitives-exercise-5': {
    id: 'primitives-exercise-5',
    title: 'Hooking up the Mouse',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'Make the triangle jump to wherever you click.',
        focusPanel: 'callbacks-panel',
        action: () => { addTriangle(); },
      },
      {
        narration: 'Switch on Mouse and give it a rule: when the left button goes down, move the triangle to the pointer.',
        focusPanel: 'callbacks-panel',
        goals: [{ label: 'Left button down moves it to the pointer', check: (state) => mouseRule(state, 'left', 'down', 'moveToPointer') }],
        task: 'Move the triangle on a left click',
        hints: [
          'In Callbacks, switch Mouse on, then press Add rule.',
          'Set When to Left button down and Do to Move to pointer, then press Done.',
        ],
        solve: (state) => {
          const t = state.objects[0];
          if (!t) return;
          if (!isCallbackValid(state.callbacks, 'mouse')) state.setCallbackHandler('mouse', 'onMouse');
          now().addCallbackRule('mouse', rule(t.id, { kind: 'mouse', button: 'left', state: 'down' }, { type: 'moveToPointer' }));
        },
      },
      {
        narration: 'How your code does it: the mouse handler checks button == GLUT_LEFT_BUTTON && state == GLUT_DOWN, then windowToWorld turns the pixel into your coordinates.',
        pane: 'code',
        codeChangeFocus: ['GLUT_LEFT_BUTTON'],
      },
      {
        narration: 'Now make the right button put the triangle back where it started.',
        focusPanel: 'callbacks-panel',
        goals: [{ label: 'Right button down resets it', check: (state) => mouseRule(state, 'right', 'down', 'reset') }],
        task: 'Reset the triangle on a right click',
        hints: ['Add another Mouse rule: When Right button down, Do Reset.'],
        solve: (state) => {
          const t = state.objects[0];
          if (t) state.addCallbackRule('mouse', rule(t.id, { kind: 'mouse', button: 'right', state: 'down' }, { type: 'reset' }));
        },
      },
      {
        narration: 'Last, let it be dragged: Motion fires while a button is held and the mouse moves.',
        focusPanel: 'callbacks-panel',
        goals: [{ label: 'A drag moves it to the pointer', check: dragRule }],
        task: 'Make the triangle follow a drag',
        hints: ['Switch Motion on, then Add rule.', 'Set Do to Move to pointer.'],
        solve: (state) => {
          const t = state.objects[0];
          if (!t) return;
          if (!isCallbackValid(state.callbacks, 'motion')) state.setCallbackHandler('motion', 'onMotion');
          now().addCallbackRule('motion', rule(t.id, { kind: 'motion' }, { type: 'moveToPointer' }));
        },
      },
      {
        narration: 'Press Run: click, right-click and drag. glutMotionFunc gets only x and y: GLUT calls it only while a button is held, and does not say which.',
        recap: {
          points: [
            'glutMouseFunc gets the button, GLUT_DOWN or GLUT_UP, and the pixel.',
            'glutMotionFunc gets the pointer while a button is held.',
          ],
          calls: ['glutMouseFunc', 'glutMotionFunc'],
        },
      },
    ],
  },
  'primitives-exercise-6': {
    id: 'primitives-exercise-6',
    title: 'Drive with the Arrow Keys',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: 'Arrow keys type no character, so GLUT sends them to a separate callback, glutSpecialFunc. Drive the triangle with them.',
        focusPanel: 'callbacks-panel',
        action: () => { addTriangle(); },
      },
      {
        narration: 'Switch on Special keys, then add two rules: → moves the triangle right and ← moves it left.',
        focusPanel: 'callbacks-panel',
        goals: [
          { label: 'Special keys on', check: (state) => isCallbackValid(state.callbacks, 'special') },
          { label: '→ and ← move it right and left', check: (state) => drives(state, ['right', 'dx', 1], ['left', 'dx', -1]) },
        ],
        task: 'Drive it left and right',
        hints: [
          'In Callbacks, switch Special keys on, then press Add rule.',
          '→ Right: Translate with dx 0.1. ← Left: Translate with dx −0.1.',
        ],
        solve: (state) => {
          const t = state.objects[0];
          if (!t) return;
          if (!isCallbackValid(state.callbacks, 'special')) state.setCallbackHandler('special', 'onSpecial');
          now().addCallbackRule('special', rule(t.id, { kind: 'special', key: 'right' }, { type: 'translate', dx: 0.1, dy: 0 }));
          now().addCallbackRule('special', rule(t.id, { kind: 'special', key: 'left' }, { type: 'translate', dx: -0.1, dy: 0 }));
        },
      },
      {
        narration: 'How your code does it: the handler switches on key, with case GLUT_KEY_RIGHT and case GLUT_KEY_LEFT.',
        pane: 'code',
        codeChangeFocus: ['GLUT_KEY_RIGHT', 'GLUT_KEY_LEFT'],
      },
      {
        narration: 'Add up and down: ↑ moves it up and ↓ moves it down.',
        focusPanel: 'callbacks-panel',
        goals: [{ label: '↑ and ↓ move it up and down', check: (state) => drives(state, ['up', 'dy', 1], ['down', 'dy', -1]) }],
        task: 'Drive it up and down',
        hints: ['↑ Up: Translate with dx 0 and dy 0.1. ↓ Down: dx 0 and dy −0.1.'],
        solve: (state) => {
          const t = state.objects[0];
          if (!t) return;
          state.addCallbackRule('special', rule(t.id, { kind: 'special', key: 'up' }, { type: 'translate', dx: 0, dy: 0.1 }));
          now().addCallbackRule('special', rule(t.id, { kind: 'special', key: 'down' }, { type: 'translate', dx: 0, dy: -0.1 }));
        },
      },
      {
        narration: 'GLUT_KEY_UP and GLUT_KEY_DOWN join the switch. Press Run and drive with all four arrows; Esc stops.',
        pane: 'code',
        codeChangeFocus: ['GLUT_KEY_UP', 'GLUT_KEY_DOWN'],
      },
      {
        narration: 'Four arrows, one handler, one case each.',
        recap: {
          points: ['Arrow keys go to glutSpecialFunc as GLUT_KEY_LEFT, GLUT_KEY_RIGHT, GLUT_KEY_UP and GLUT_KEY_DOWN.'],
          calls: ['glutSpecialFunc'],
        },
      },
    ],
  },
  'primitives-exercise-7': {
    id: 'primitives-exercise-7',
    title: 'Draw It Yourself',
    type: 'exercise',
    section: 'Primitives',
    steps: [
      {
        narration: "The section's last exercise: build a small scene of your own, then write one shape's code by hand.",
      },
      {
        narration: 'Build three things: a filled shape with at least two corner colours, a dashed or thick line, and a label.',
        goals: [
          { label: 'A filled shape with two colours', check: (state) => state.objects.some((o) => isFilled(o) && multicolour(o)) },
          { label: 'A dashed or thick line', check: (state) => state.objects.some(styledLine) },
          { label: 'A label', check: (state) => state.objects.some((o) => o.type === 'TEXT' && !!o.textContent?.trim()) },
        ],
        task: 'Build the three parts',
        hints: [
          'Add a filled shape, then colour its corners with Per vertex in Appearance.',
          'Add a line shape, then use Line width or Line stipple in Appearance.',
          'Add text with Create New Text.',
        ],
        solve: (state) => {
          if (!state.objects.some((o) => isFilled(o) && multicolour(o))) {
            now().addCustomObject('TRIANGLES', TRIANGLE);
            const t = now().objects[0];
            ['#ff0000', '#00ff00', '#0000ff'].forEach((c, i) => now().updateVertexColor(t.id, t.vertices[i].id, c));
          }
          if (!now().objects.some(styledLine)) {
            now().addCustomObject('LINE_STRIP', ZIGZAG);
            now().updateLineWidth(now().objects[0].id, 4);
          }
          if (!now().objects.some((o) => o.type === 'TEXT' && !!o.textContent?.trim())) now().addTextObject('My scene', -0.15, 0.8);
        },
      },
      {
        narration: 'Now write your filled shape. It starts with glBegin and its mode.',
        task: 'Name the mode',
        hints: ['The mode matches the tile you picked in Add.', "It is in the shape's draw function in the code panel."],
        exercise: {
          kind: 'code',
          template: 'glBegin({0});',
          blanks: [{ answer: (state) => `GL_${capstoneShape(state)?.type ?? 'TRIANGLES'}`, wrong: "that's not your shape's mode" }],
        },
      },
      {
        narration: "The first corner's colour, as red, green and blue from 0 to 1.",
        task: "Fill in the first corner's colour",
        hints: ['Each value is the colour value from 0 to 255, divided by 255.', 'The first glColor3f or glColor3ub after glBegin has the numbers.'],
        exercise: {
          kind: 'code',
          template: 'glColor3f({0}, {1}, {2});',
          blanks: [
            { answer: (state) => cornerChannel(state, 0), wrong: "that's not its red" },
            { answer: (state) => cornerChannel(state, 1), wrong: "that's not its green" },
            { answer: (state) => cornerChannel(state, 2), wrong: "that's not its blue" },
          ],
        },
      },
      {
        narration: "The first corner's position.",
        task: "Fill in the first corner's x and y",
        hints: ['It is the first glVertex2f after glBegin.'],
        exercise: {
          kind: 'code',
          template: 'glVertex2f({0}, {1});',
          blanks: [
            { answer: (state) => printed(firstCorner(state)?.x ?? 0), wrong: "that's not its x" },
            { answer: (state) => printed(firstCorner(state)?.y ?? 0), wrong: "that's not its y" },
          ],
        },
      },
      {
        narration: 'The other corners follow the same pattern. Close the shape.',
        task: 'Name the call',
        hints: ['It is the partner of glBegin.'],
        exercise: {
          kind: 'code',
          template: '{0}();',
          blanks: [{ answer: () => 'glEnd', wrong: 'not the call that closes the shape' }],
        },
      },
      {
        narration: 'You wrote a shape by hand. Next, Buffers: sending those corners to the graphics card once instead of every frame.',
        recap: {
          points: [
            'A shape is glBegin with a mode, then a glColor3f and a glVertex2f per corner, then glEnd.',
            'Lines take glLineWidth and glLineStipple; text takes glRasterPos2f and glutBitmapCharacter.',
            'Callbacks registered in main() make the program react.',
          ],
          calls: ['glBegin', 'glColor3f', 'glVertex2f'],
        },
      },
    ],
  },
};
