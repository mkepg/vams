/**
 * What each line of the generated program does, for the code panel's explanation strip and its
 * notes. Keyed by line pattern; templates are filled from the scene. Pure. Notes and explanations
 * are panel UI: the generator and Copy never include them.
 */
import type { InspectorGroupId } from '@/core/inspector/groups';
import type { JourneyStageId } from '@/core/inspector/journey-stage';
import type { PrimitiveType, SceneNode, ViewportLimits } from '@/core/types/scene';
import type { TextureAsset } from '@/core/types/textures';
import { assemblyFor } from '@/entities/scene/model/primitive-assembly';
import { fmt, short } from '@/shared/lib/format-number';
import { sanitizeName } from './generator/utils';
import type { CodeOutline, OutlineLine } from './code-outline';

export interface ValueRow {
  /** The argument or field, as the strip names it: `x`, `angle`, `usage`. */
  arg: string;
  /** Where the value comes from in the code: `state_Triangle.x`, or the literal's meaning. */
  source: string;
  value: string;
  /** The control that sets it, as the UI labels it. */
  control: string | null;
}

export interface ControlLink {
  label: string;
  group: InspectorGroupId;
  /** The object whose control it is; selected first when it is not the selection. */
  objectId: string | null;
}

export interface LineExplanation {
  signature: string;
  text: string;
  values: ValueRow[];
  /** The journey stage that works this line's numbers. */
  stage: JourneyStageId | null;
  control: ControlLink | null;
}

export type NotePart = string | { value: string; ref: string };

export interface ExplainScene {
  objects: readonly SceneNode[];
  viewportLimits: ViewportLimits;
  canvasBackgroundColor: string;
  canvas: { width: number; height: number };
  textures: readonly TextureAsset[];
}

interface Ctx {
  t: string;
  line: OutlineLine;
  index: number;
  outline: CodeOutline;
  scene: ExplainScene;
}

interface Entry {
  test: RegExp;
  explain: (m: RegExpExecArray, ctx: Ctx) => LineExplanation;
}

const byCode = (scene: ExplainScene, name: string | null | undefined) =>
  name ? scene.objects.find((o) => sanitizeName(o.name) === name) : undefined;
const nameOf = (scene: ExplainScene, code: string) => byCode(scene, code)?.name ?? code;
const objectOf = (ctx: Ctx, code?: string) => byCode(ctx.scene, code ?? ctx.line.object);

const plain = (signature: string, text: string, stage: JourneyStageId | null = null, control: ControlLink | null = null): LineExplanation => ({
  signature, text, values: [], stage, control,
});
const link = (label: string, group: InspectorGroupId, node?: SceneNode): ControlLink => ({ label, group, objectId: node?.id ?? null });

/** The comma-separated arguments of `fn(...)` on this line, without a float's trailing f. */
function argsOf(t: string, fn: string): string[] {
  const open = t.indexOf(`${fn}(`) + fn.length + 1;
  return t.slice(open, t.lastIndexOf(')')).split(',').map((a) => a.trim().replace(/^(-?[\d.]+)f$/, '$1'));
}
const num = (a: string) => fmt(Number(a));

const TRANSFORM_FIELDS = {
  x: { prop: 'translateX', control: 'Translate X' },
  y: { prop: 'translateY', control: 'Translate Y' },
  rotation: { prop: 'rotate', control: 'Rotate' },
  scaleX: { prop: 'scaleX', control: 'Scale X' },
  scaleY: { prop: 'scaleY', control: 'Scale Y' },
} as const;
type TransformField = keyof typeof TRANSFORM_FIELDS;

function fieldRow(arg: string, code: string, field: TransformField, node: SceneNode | undefined): ValueRow {
  const { prop, control } = TRANSFORM_FIELDS[field];
  const raw = node?.transform[prop];
  const value = raw === undefined ? '—' : field === 'rotation' ? `${short(raw)}°` : field.startsWith('scale') ? short(raw) : fmt(raw);
  return { arg, source: `state_${code}.${field}`, value, control };
}

/** The generator writes a set width with two decimals and the reset after the object as `1.0f`. */
const lineWidthText = (t: string) =>
  t.startsWith('glLineWidth(1.0f)') ? 'Puts the line width back to 1 pixel for the next object.' : 'Sets how thick lines are drawn, in pixels.';

const RULE_OF = (type: string) => assemblyFor(type as PrimitiveType, 0, 1).note;

const ARRAYS: Record<string, { what: string; stage: JourneyStageId; control: [string, InspectorGroupId] }> = {
  VERTEX: { what: 'positions', stage: 'stored', control: ['Buffers', 'buffers'] },
  COLOR: { what: 'colours', stage: 'coloured', control: ['Appearance', 'appearance'] },
  TEXTURE_COORD: { what: 'texture coordinates', stage: 'coloured', control: ['Texture', 'texture'] },
};
const HANDLE_WHAT: Record<string, string> = { vbo: 'positions', cbo: 'colours', uvbo: 'texture coordinates', ebo: 'indices' };
const CALLBACK_KIND: Record<string, string> = { Keyboard: 'keyboard', Special: 'arrow key', Mouse: 'mouse', Motion: 'mouse motion', Reshape: 'reshape', Idle: 'idle' };

function limitRows(scene: ExplainScene, names: [string, string, string, string]): ValueRow[] {
  const v = scene.viewportLimits;
  return (['left', 'right', 'bottom', 'top'] as const).map((arg, k) => ({
    arg, source: names[k], value: fmt([v.minX, v.maxX, v.minY, v.maxY][k]), control: 'Viewing volume',
  }));
}

const ENTRIES: Entry[] = [
  // --- Includes ---
  { test: /^#include <GL\/glew\.h>/, explain: () => plain('#include <GL/glew.h>', 'Loads GLEW, which finds the buffer functions (glGenBuffers, glBufferData, glMapBuffer) in the graphics driver. It must come before freeglut.h.') },
  { test: /^#include <GL\/freeglut\.h>/, explain: () => plain('#include <GL/freeglut.h>', 'Loads FreeGLUT, which opens the window, runs the main loop and calls your callbacks.') },
  { test: /^#include <cmath>/, explain: () => plain('#include <cmath>', 'Loads C++’s maths functions, such as sin and cos.') },
  { test: /^#include <iostream>/, explain: () => plain('#include <iostream>', 'Loads C++ input and output, which the texture loader uses.') },
  { test: /^#define STB_IMAGE_IMPLEMENTATION/, explain: () => plain('#define STB_IMAGE_IMPLEMENTATION', 'Tells stb_image.h to include its code here, not just its declarations.') },
  { test: /^#include "stb_image\.h"/, explain: () => plain('#include "stb_image.h"', 'Loads stb_image, which reads image files for textures.', 'coloured') },

  // --- Data ---
  { test: /^struct ObjectState/, explain: () => plain('struct ObjectState', 'Describes what every object keeps from frame to frame: its position, rotation and scale, and its colour and visibility when a callback changes them.', 'transformed') },
  {
    test: /^ObjectState state_(\w+) = /,
    explain: (m, ctx) => {
      const node = objectOf(ctx, m[1]);
      const drawer = node && (node.type === 'GROUP' || node.type === 'TEXT') ? 'draw()' : `draw_${m[1]}()`;
      return {
        signature: `ObjectState state_${m[1]}`,
        text: `${nameOf(ctx.scene, m[1])}’s starting position, rotation and scale. ${drawer} reads them every frame, and callbacks can change them while the program runs.`,
        values: (Object.keys(TRANSFORM_FIELDS) as TransformField[]).map((f) => fieldRow(f, m[1], f, node)),
        stage: 'transformed',
        control: link('Transform', 'transform', node),
      };
    },
  },
  { test: /^const ObjectState initial_(\w+) = /, explain: (m, ctx) => plain(`const ObjectState initial_${m[1]}`, `A copy of ${nameOf(ctx.scene, m[1])}’s starting values, kept so a Reset rule can put it back.`, 'transformed', link('Callbacks', 'callbacks')) },
  {
    test: /^float viewMinX/,
    explain: (_m, ctx) => ({
      signature: 'float viewMinX, viewMaxX, viewMinY, viewMaxY',
      text: 'The viewing volume’s edges, kept in variables so the reshape callback can widen them when the window changes shape.',
      values: limitRows(ctx.scene, ['viewMinX', 'viewMaxX', 'viewMinY', 'viewMaxY']),
      stage: 'projected',
      control: link('Viewing volume', 'viewing-volume'),
    }),
  },
  {
    test: /^GLfloat verts_(\w+)\[\] = \{(.*)\};$/,
    explain: (m, ctx) => ({
      signature: `GLfloat verts_${m[1]}[]`,
      text: `${nameOf(ctx.scene, m[1])}’s vertex positions, two floats (x, y) per vertex, packed in one C array.`,
      values: [{ arg: 'vertices', source: `verts_${m[1]}`, value: `${m[2].split(',').length / 2}`, control: 'Vertices' }],
      stage: 'stored',
      control: link('Buffers', 'buffers', objectOf(ctx, m[1])),
    }),
  },
  { test: /^GLfloat colors_(\w+)\[\]/, explain: (m, ctx) => plain(`GLfloat colors_${m[1]}[]`, `${nameOf(ctx.scene, m[1])}’s vertex colours, three floats (red, green, blue) per vertex, in the same order as the positions.`, 'coloured', link('Appearance', 'appearance', objectOf(ctx, m[1]))) },
  { test: /^GLfloat uvs_(\w+)\[\]/, explain: (m, ctx) => plain(`GLfloat uvs_${m[1]}[]`, `${nameOf(ctx.scene, m[1])}’s texture coordinates, two floats (u, v) per vertex.`, 'coloured', link('Texture', 'texture', objectOf(ctx, m[1]))) },
  {
    test: /^GLuint indices_(\w+)\[\] = \{(.*)\};$/,
    explain: (m, ctx) => ({
      signature: `GLuint indices_${m[1]}[]`,
      text: 'The order to draw the vertices in. Each number is a position in the arrays above, so a corner two shapes share is stored once.',
      values: [{ arg: 'indices', source: `indices_${m[1]}`, value: `${m[2].split(',').length}`, control: 'Deduplicate vertices' }],
      stage: 'stored',
      control: link('Buffers', 'buffers', objectOf(ctx, m[1])),
    }),
  },
  { test: /^GLuint (vbo|cbo|ebo|uvbo)_(\w+) = 0;$/, explain: (m, ctx) => plain(`GLuint ${m[1]}_${m[2]}`, `A name for the GPU buffer that holds ${nameOf(ctx.scene, m[2])}’s ${HANDLE_WHAT[m[1]]}. It starts at 0; glGenBuffers in init() gives it a real name.`, 'stored', link('Buffers', 'buffers', objectOf(ctx, m[2]))) },
  { test: /^GLuint tex_(\w+) = 0;$/, explain: (m, ctx) => plain(`GLuint tex_${m[1]}`, `A name for ${nameOf(ctx.scene, m[1])}’s texture. It starts at 0; glGenTextures in init() gives it a real name.`, 'coloured', link('Texture', 'texture', objectOf(ctx, m[1]))) },
  { test: /^void (\w+)\(\);$/, explain: (m) => plain(`void ${m[1]}();`, `Tells the compiler that ${m[1]}() exists, so code above its definition can call it.`) },

  // --- Functions ---
  { test: /^void draw_(\w+)\(\)$/, explain: (m, ctx) => plain(`void draw_${m[1]}()`, `Draws ${nameOf(ctx.scene, m[1])}. It saves the matrix, moves the object into place, sends its vertices, and restores the matrix for the next object.`, 'transformed', link('Transform', 'transform', objectOf(ctx, m[1]))) },
  { test: /^void draw\(\)$/, explain: () => plain('void draw()', 'Draws the scene by calling each object’s draw function. Groups and text are drawn here directly.') },
  { test: /^void update_buffers\(\)$/, explain: () => plain('void update_buffers()', 'Runs every frame to refresh the buffers whose usage hint is DYNAMIC or STREAM.', 'stored') },
  { test: /^void display\(\)$/, explain: () => plain('void display()', 'GLUT calls display() whenever the window needs redrawing. It clears the frame, sets up the view, draws the scene and shows the result.', 'rasterised') },
  { test: /^void windowToWorld\(/, explain: () => plain('void windowToWorld(x, y, wx, wy)', 'Turns a mouse position in window pixels into scene coordinates, using the viewing volume. GLUT counts y from the top of the window; the scene counts it from the bottom.', 'projected') },
  { test: /^void init\(\)$/, explain: () => plain('void init()', 'Runs once, before the main loop. It uploads buffers to the GPU and loads textures, so drawing never repeats that work.', 'stored') },
  { test: /^void _vams_idle\(\)$/, explain: () => plain('void _vams_idle()', 'GLUT calls this whenever it has nothing else to do, about once a frame. It refreshes the changing buffers and calls your idle callback.') },
  { test: /^int main\(/, explain: () => plain('int main(argc, argv)', 'Where the program starts. It sets up GLUT, opens the window, registers the callbacks and hands control to the main loop.') },
  { test: /^void (\w+)\(unsigned char key, int x, int y\)$/, explain: (m) => plain(`void ${m[1]}(key, x, y)`, `GLUT calls ${m[1]} when a key is pressed: key is the character, and x and y are where the mouse was.`, null, link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(int key, int x, int y\)$/, explain: (m) => plain(`void ${m[1]}(key, x, y)`, `GLUT calls ${m[1]} when an arrow key is pressed; key names the arrow.`, null, link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(int button, int state, int x, int y\)$/, explain: (m) => plain(`void ${m[1]}(button, state, x, y)`, `GLUT calls ${m[1]} when a mouse button goes down or up, with the button, its state and the mouse position.`, null, link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(int x, int y\)$/, explain: (m) => plain(`void ${m[1]}(x, y)`, `GLUT calls ${m[1]} when the mouse moves with a button held, with the mouse position.`, null, link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(int width, int height\)$/, explain: (m) => plain(`void ${m[1]}(width, height)`, `GLUT calls ${m[1]} when the window changes size, with its new width and height.`, 'projected', link('Callbacks', 'callbacks')) },
  { test: /^void (\w+)\(\)$/, explain: (m) => plain(`void ${m[1]}()`, `GLUT calls ${m[1]} whenever nothing else is happening, about once a frame.`, null, link('Callbacks', 'callbacks')) },

  // --- Callback branches and state changes ---
  { test: /^case '(.)':$/, explain: (m) => plain(`case '${m[1]}':`, `The lines below run when the key pressed is ${m[1] === ' ' ? 'Space' : m[1]}.`, null, link('Callbacks', 'callbacks')) },
  { test: /^case GLUT_KEY_(\w+):$/, explain: (m) => plain(`case GLUT_KEY_${m[1]}:`, `The lines below run when the ${m[1].toLowerCase()} arrow key is pressed.`, null, link('Callbacks', 'callbacks')) },
  { test: /^if \(button == GLUT_(\w+)_BUTTON && state == GLUT_(UP|DOWN)\) \{$/, explain: (m) => plain('if (button == … && state == …)', `The lines inside run when the ${m[1].toLowerCase()} mouse button goes ${m[2].toLowerCase()}.`, null, link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.(x|y) \+= (-?[\d.]+)f;$/, explain: (m, ctx) => plain(`state_${m[1]}.${m[2]} +=`, `Moves ${nameOf(ctx.scene, m[1])} by ${num(m[3])} along ${m[2]} each time this runs.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.rotation \+= (-?[\d.]+)f;$/, explain: (m, ctx) => plain(`state_${m[1]}.rotation +=`, `Turns ${nameOf(ctx.scene, m[1])} by ${short(Number(m[2]))}° each time this runs.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.scale(X|Y) \*= (-?[\d.]+)f;$/, explain: (m, ctx) => plain(`state_${m[1]}.scale${m[2]} *=`, `Scales ${nameOf(ctx.scene, m[1])} by ${short(Number(m[3]))} ${m[2] === 'X' ? 'across' : 'up'} each time this runs.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.(x|y) = w(x|y);$/, explain: (m, ctx) => plain(`state_${m[1]}.${m[2]} = w${m[3]}`, `Moves ${nameOf(ctx.scene, m[1])} to the mouse position.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.(r|g|b) = ([\d.]+)f;$/, explain: (m, ctx) => plain(`state_${m[1]}.${m[2]} =`, `Sets the ${{ r: 'red', g: 'green', b: 'blue' }[m[2]]} of the colour ${nameOf(ctx.scene, m[1])} switches to.`, 'coloured', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.useColor = true;$/, explain: (m, ctx) => plain(`state_${m[1]}.useColor = true`, `Makes ${nameOf(ctx.scene, m[1])} use the colour set just above instead of its own.`, 'coloured', link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+)\.visible = (true|false|!state_\w+\.visible);$/, explain: (m, ctx) => plain(`state_${m[1]}.visible =`, `${m[2] === 'true' ? 'Shows' : m[2] === 'false' ? 'Hides' : 'Shows or hides'} ${nameOf(ctx.scene, m[1])}.`, null, link('Callbacks', 'callbacks')) },
  { test: /^state_(\w+) = initial_\w+;$/, explain: (m, ctx) => plain(`state_${m[1]} = initial_${m[1]}`, `Puts ${nameOf(ctx.scene, m[1])} back to its starting values.`, 'transformed', link('Callbacks', 'callbacks')) },
  { test: /^glewExperimental = GL_TRUE;$/, explain: () => plain('glewExperimental = GL_TRUE', 'Asks GLEW to load every buffer function the driver offers, even ones it would otherwise skip.') },

  // --- The program's own calls ---
  { test: /^if \(state_(\w+)\.visible\) draw_\w+\(\);$/, explain: (m, ctx) => plain(`draw_${m[1]}()`, `Draws ${nameOf(ctx.scene, m[1])} only while it is visible; a visibility rule changes that.`) },
  { test: /^draw_(\w+)\(\);$/, explain: (m, ctx) => plain(`draw_${m[1]}()`, `Draws ${nameOf(ctx.scene, m[1])}.`, 'transformed') },
  { test: /^draw\(\);$/, explain: () => plain('draw()', 'Draws the scene.') },
  { test: /^init\(\);$/, explain: () => plain('init()', 'Runs the one-time setup before the main loop starts.', 'stored') },
  { test: /^update_buffers\(\);$/, explain: () => plain('update_buffers()', 'Refreshes the buffers that change every frame.', 'stored') },
  { test: /^windowToWorld\(x, y, &wx, &wy\);$/, explain: () => plain('windowToWorld(x, y, &wx, &wy)', 'Turns the mouse position into scene coordinates, wx and wy.', 'projected') },

  // --- OpenGL, GLUT, GLEW and stb_image calls ---
  { test: /\bglPushMatrix\(/, explain: () => plain('glPushMatrix()', 'Saves the current matrix, so this object’s moves don’t carry over to the next one.', 'transformed') },
  { test: /\bglPopMatrix\(/, explain: () => plain('glPopMatrix()', 'Restores the matrix that glPushMatrix saved.', 'transformed') },
  {
    test: /\bglTranslatef\(state_(\w+)\.x/,
    explain: (m, ctx) => {
      const node = objectOf(ctx, m[1]);
      return {
        signature: 'glTranslatef(x, y, z)',
        text: `Moves everything drawn after it by (x, y). Here that is ${nameOf(ctx.scene, m[1])}’s position.`,
        values: [fieldRow('x', m[1], 'x', node), fieldRow('y', m[1], 'y', node)],
        stage: 'transformed',
        control: link('Translate X', 'transform', node),
      };
    },
  },
  {
    test: /\bglRotatef\(state_(\w+)\.rotation/,
    explain: (m, ctx) => {
      const node = objectOf(ctx, m[1]);
      return {
        signature: 'glRotatef(angle, x, y, z)',
        text: 'Turns everything drawn after it by angle degrees, counter-clockwise, around the z axis (0, 0, 1).',
        values: [fieldRow('angle', m[1], 'rotation', node)],
        stage: 'transformed',
        control: link('Rotate', 'transform', node),
      };
    },
  },
  {
    test: /\bglScalef\(state_(\w+)\.scaleX/,
    explain: (m, ctx) => {
      const node = objectOf(ctx, m[1]);
      return {
        signature: 'glScalef(x, y, z)',
        text: 'Stretches everything drawn after it by x across and y up.',
        values: [fieldRow('x', m[1], 'scaleX', node), fieldRow('y', m[1], 'scaleY', node)],
        stage: 'transformed',
        control: link('Scale X', 'transform', node),
      };
    },
  },
  { test: /\bglShadeModel\((GL_\w+)\)/, explain: (m, ctx) => ({ ...plain('glShadeModel(mode)', 'Chooses how colour fills each shape: GL_SMOOTH blends the vertex colours across it, GL_FLAT gives each point, line, triangle, quad or polygon the colour of one of its vertices.', 'coloured', link('Appearance', 'appearance', objectOf(ctx))), values: [{ arg: 'mode', source: 'shading', value: m[1], control: 'Appearance' }] }) },
  { test: /\bglLineWidth\(([\d.]+)f\)/, explain: (m, ctx) => ({ ...plain('glLineWidth(width)', lineWidthText(ctx.t), 'assembled', link('Line width', 'appearance', objectOf(ctx))), values: [{ arg: 'width', source: 'line width', value: short(Number(m[1])), control: 'Line width' }] }) },
  { test: /\bglEnable\(GL_LINE_STIPPLE\)/, explain: (_m, ctx) => plain('glEnable(GL_LINE_STIPPLE)', 'Turns on the dash pattern for the lines that follow.', 'assembled', link('Line stipple', 'appearance', objectOf(ctx))) },
  { test: /\bglLineStipple\((\d+), (0x[0-9A-F]+)\)/, explain: (m, ctx) => ({ ...plain('glLineStipple(factor, pattern)', 'Sets the dash pattern: each of the 16 bits is a dash or a gap, and each bit lasts factor pixels.', 'assembled', link('Line stipple', 'appearance', objectOf(ctx))), values: [{ arg: 'factor', source: 'stipple factor', value: m[1], control: 'Stipple factor' }, { arg: 'pattern', source: 'stipple pattern', value: m[2], control: 'Line stipple' }] }) },
  { test: /\bglDisable\(GL_LINE_STIPPLE\)/, explain: () => plain('glDisable(GL_LINE_STIPPLE)', 'Turns the dash pattern off again for the next object.', 'assembled') },
  { test: /\bglPointSize\(([\d.]+)f\)/, explain: (m) => plain('glPointSize(size)', Number(m[1]) === 1 ? 'Puts the point size back to 1 pixel for the next object.' : `Draws each point ${short(Number(m[1]))} pixels wide; the default of 1 is hard to see.`, 'assembled') },
  { test: /\bglEnable\(GL_TEXTURE_2D\)/, explain: (_m, ctx) => plain('glEnable(GL_TEXTURE_2D)', 'Turns texturing on for what is drawn next.', 'coloured', link('Texture', 'texture', objectOf(ctx))) },
  { test: /\bglDisable\(GL_TEXTURE_2D\)/, explain: () => plain('glDisable(GL_TEXTURE_2D)', 'Turns texturing off again, so the next object is drawn without it.', 'coloured') },
  { test: /\bglBindTexture\(GL_TEXTURE_2D, tex_(\w+)\)/, explain: (m, ctx) => plain('glBindTexture(target, texture)', `Chooses which texture to use: the one init() loaded for ${nameOf(ctx.scene, m[1])}.`, 'coloured', link('Texture', 'texture', objectOf(ctx, m[1]))) },
  { test: /\bglBegin\(GL_(\w+)\)/, explain: (m, ctx) => plain('glBegin(mode)', `Starts a list of vertices that OpenGL joins into shapes: ${RULE_OF(m[1])}.`, 'assembled', link('Vertices', 'vertices', objectOf(ctx))) },
  { test: /\bglEnd\(/, explain: () => plain('glEnd()', 'Ends the list of vertices glBegin started; OpenGL draws the shapes now.', 'assembled') },
  {
    test: /\bglColor3(f|ub)\(([^)]*)\)/,
    explain: (m, ctx) => {
      if (m[2].includes('state_')) return plain('glColor3f(r, g, b)', 'Uses the colour a callback set, while that object’s useColor is on.', 'coloured', link('Callbacks', 'callbacks'));
      const [r, g, b] = argsOf(ctx.t, `glColor3${m[1]}`);
      const range = m[1] === 'f' ? 'each from 0 to 1' : 'each from 0 to 255';
      const value = (a: string) => (m[1] === 'f' ? num(a) : a);
      const block = ctx.outline.blocks.find((x) => x.id === ctx.line.block);
      const isClear = block?.kind === 'main';
      return {
        signature: `glColor3${m[1]}(r, g, b)`,
        text: `Sets the colour for the vertices that follow: red, green and blue, ${range}.`,
        values: [
          { arg: 'r', source: 'red', value: value(r), control: 'Appearance' },
          { arg: 'g', source: 'green', value: value(g), control: 'Appearance' },
          { arg: 'b', source: 'blue', value: value(b), control: 'Appearance' },
        ],
        stage: 'coloured',
        control: isClear ? null : link('Appearance', 'appearance', objectOf(ctx)),
      };
    },
  },
  {
    test: /\bglVertex2f\((-?[\d.]+)f, (-?[\d.]+)f\)/,
    explain: (m, ctx) => {
      const n = ctx.outline.lines.slice(0, ctx.index + 1).filter((l) => l.object === ctx.line.object && l.block === ctx.line.block && l.text.includes('glVertex2f(')).length;
      return {
        signature: 'glVertex2f(x, y)',
        text: 'Sends one vertex at (x, y), in the object’s own coordinates. It takes the colour set just before it.',
        values: [
          { arg: 'x', source: `vertex ${n}`, value: num(m[1]), control: `Vertex ${n} X` },
          { arg: 'y', source: `vertex ${n}`, value: num(m[2]), control: `Vertex ${n} Y` },
        ],
        stage: 'stored',
        control: link('Vertices', 'vertices', objectOf(ctx)),
      };
    },
  },
  { test: /\bglTexCoord2f\(/, explain: (_m, ctx) => plain('glTexCoord2f(u, v)', 'Sets the texture coordinate (u, v) for the next vertex.', 'coloured', link('Texture', 'texture', objectOf(ctx))) },
  { test: /\bglEnableClientState\(GL_(\w+)_ARRAY\)/, explain: (m, ctx) => plain('glEnableClientState(array)', `Tells OpenGL to read the ${ARRAYS[m[1]].what} from an array when drawing.`, ARRAYS[m[1]].stage, link(ARRAYS[m[1]].control[0], ARRAYS[m[1]].control[1], objectOf(ctx))) },
  { test: /\bglDisableClientState\(GL_(\w+)_ARRAY\)/, explain: (m) => plain('glDisableClientState(array)', `Stops reading the ${ARRAYS[m[1]].what} from an array, so the next object starts clean.`, ARRAYS[m[1]].stage) },
  { test: /\bgl(Vertex|Color|TexCoord)Pointer\((\d), GL_FLOAT, 0, (\w+)\)/, explain: (m, ctx) => plain(`gl${m[1]}Pointer(size, type, stride, data)`, `Points OpenGL at the ${{ Vertex: 'positions', Color: 'colours', TexCoord: 'texture coordinates' }[m[1]]}: ${m[2]} floats per vertex, packed with no gap (stride 0), ${m[3] === '0' ? 'in the buffer bound just above, from its start' : `in ${m[3]}`}.`, m[1] === 'Vertex' ? 'stored' : 'coloured', link('Buffers', 'buffers', objectOf(ctx))) },
  { test: /\bglDrawArrays\(GL_(\w+), 0, (\d+)\)/, explain: (m, ctx) => plain('glDrawArrays(mode, first, count)', `Draws ${m[2]} vertices from the arrays, first to last, joined into shapes: ${RULE_OF(m[1])}.`, 'assembled', link('Rendering mode', 'buffers', objectOf(ctx))) },
  { test: /\bglDrawElements\(GL_(\w+), (\d+), GL_UNSIGNED_INT, (\w+)\)/, explain: (m, ctx) => plain('glDrawElements(mode, count, type, indices)', `Draws ${m[2]} vertices in the order the index list gives, joined into shapes: ${RULE_OF(m[1])}.`, 'assembled', link('Deduplicate vertices', 'buffers', objectOf(ctx))) },
  { test: /\bglBindBuffer\((GL_\w+), (\w+)\)/, explain: (m, ctx) => plain('glBindBuffer(target, buffer)', m[2] === '0' ? 'Unbinds the buffer, so later array calls read the program’s own memory again.' : `Makes ${m[2]} the current buffer; the buffer calls after it act on that one.`, 'stored', link('Buffers', 'buffers', objectOf(ctx))) },
  { test: /\bglGenBuffers\(1, &(\w+)\)/, explain: (m, ctx) => plain('glGenBuffers(n, buffers)', `Asks OpenGL for a new buffer name and stores it in ${m[1]}.`, 'stored', link('Buffers', 'buffers', objectOf(ctx))) },
  {
    test: /\bglBufferData\((GL_\w+), sizeof\((\w+)\), (\w+), GL_(\w+)_DRAW\)/,
    explain: (m, ctx) => ({
      ...plain('glBufferData(target, size, data, usage)', `Copies ${m[2]} to the GPU buffer. The usage hint tells the driver how often it will change.`, 'stored', link('Buffer usage hint', 'buffers', objectOf(ctx))),
      values: [{ arg: 'usage', source: 'buffer usage hint', value: `GL_${m[4]}_DRAW`, control: 'Buffer usage hint' }],
    }),
  },
  { test: /\bglBufferSubData\(/, explain: (_m, ctx) => plain('glBufferSubData(target, offset, size, data)', 'Replaces bytes in a buffer already on the GPU, without making a new one.', 'stored', link('Buffer update method', 'buffers', objectOf(ctx))) },
  { test: /\bglMapBuffer\(/, explain: (_m, ctx) => plain('glMapBuffer(target, access)', 'Gives the program a pointer straight into the buffer’s memory, so it can change values in place.', 'stored', link('Buffer update method', 'buffers', objectOf(ctx))) },
  { test: /\bglUnmapBuffer\(/, explain: () => plain('glUnmapBuffer(target)', 'Hands the buffer back to OpenGL after editing it through the pointer.', 'stored') },
  { test: /\bglGenTextures\(1, &(\w+)\)/, explain: (m, ctx) => plain('glGenTextures(n, textures)', `Asks OpenGL for a new texture name and stores it in ${m[1]}.`, 'coloured', link('Texture', 'texture', objectOf(ctx))) },
  { test: /\bglTexParameteri\(GL_TEXTURE_2D, GL_TEXTURE_WRAP_(S|T), (GL_\w+)\)/, explain: (m, ctx) => ({ ...plain('glTexParameteri(target, wrap, mode)', `Chooses what happens when ${m[1] === 'S' ? 'u' : 'v'} goes outside 0 to 1: GL_REPEAT tiles the texture, GL_CLAMP_TO_EDGE stretches its edge.`, 'coloured', link('Wrap mode', 'texture', objectOf(ctx))), values: [{ arg: 'mode', source: 'wrap mode', value: m[2], control: 'Wrap mode' }] }) },
  { test: /\bglTexParameteri\(GL_TEXTURE_2D, GL_TEXTURE_(MIN|MAG)_FILTER, (GL_\w+)\)/, explain: (m, ctx) => ({ ...plain('glTexParameteri(target, filter, mode)', `Chooses how texels are picked when the texture is drawn ${m[1] === 'MIN' ? 'smaller' : 'larger'} than it is: GL_NEAREST takes one, GL_LINEAR blends four.`, 'coloured', link('Filter mode', 'texture', objectOf(ctx))), values: [{ arg: 'mode', source: 'filter mode', value: m[2], control: 'Filter mode' }] }) },
  { test: /\bglTexEnvi\(/, explain: () => plain('glTexEnvi(target, name, mode)', 'Makes the texture replace the vertex colour instead of mixing with it.', 'coloured') },
  { test: /\bstbi_set_flip_vertically_on_load\(/, explain: () => plain('stbi_set_flip_vertically_on_load(flip)', 'Flips images as they load: image files start at the top row, OpenGL textures at the bottom.', 'coloured') },
  { test: /\bstbi_load\(/, explain: () => plain('stbi_load(path, width, height, channels, 4)', 'Reads the image file into memory, four channels (RGBA) per pixel. Put the full path to your image here.', 'coloured') },
  { test: /\bglTexImage2D\(/, explain: () => plain('glTexImage2D(target, level, …, data)', 'Copies the image to the GPU as the texture’s pixels.', 'coloured') },
  { test: /\bstbi_image_free\(/, explain: () => plain('stbi_image_free(data)', 'Frees the image now that the GPU has its own copy.', 'coloured') },
  { test: /\bglClear\(GL_COLOR_BUFFER_BIT\)/, explain: () => plain('glClear(mask)', 'Wipes the frame to the background colour before anything is drawn.', 'rasterised', link('Background', 'background')) },
  { test: /\bglMatrixMode\(GL_PROJECTION\)/, explain: () => plain('glMatrixMode(GL_PROJECTION)', 'Chooses the projection matrix, which maps the viewing volume to the window, for the calls that follow.', 'projected') },
  { test: /\bglMatrixMode\(GL_MODELVIEW\)/, explain: () => plain('glMatrixMode(GL_MODELVIEW)', 'Chooses the modelview matrix, which places objects, for the calls that follow.', 'transformed') },
  { test: /\bglLoadIdentity\(/, explain: () => plain('glLoadIdentity()', 'Resets the current matrix to the identity, undoing what came before.') },
  {
    test: /\bglOrtho\(([^,]+), ([^,]+), ([^,]+), ([^,]+), /,
    explain: (m, ctx) => ({
      signature: 'glOrtho(left, right, bottom, top, near, far)',
      text: 'Sets the viewing volume, the part of the scene the window shows: x from left to right and y from bottom to top become −1 to 1.',
      values: limitRows(ctx.scene, [m[1], m[2], m[3], m[4]].map((a) => (/^-?[\d.]+$/.test(a) ? 'viewing volume' : a)) as [string, string, string, string]),
      stage: 'projected',
      control: link('Viewing volume', 'viewing-volume'),
    }),
  },
  { test: /\bglutSwapBuffers\(/, explain: () => plain('glutSwapBuffers()', 'Shows the frame just drawn. Drawing happens on a hidden frame, so the window never shows one half-finished.', 'rasterised') },
  { test: /\bglutPostRedisplay\(/, explain: () => plain('glutPostRedisplay()', 'Asks GLUT to call display() again soon, so the change shows.') },
  { test: /\bglutInit\(/, explain: () => plain('glutInit(&argc, argv)', 'Starts GLUT and lets it read its command-line options.') },
  { test: /\bglutInitDisplayMode\(/, explain: () => plain('glutInitDisplayMode(mode)', 'Chooses the window’s pixel format: double buffering, RGB colour, and smoothed edges (multisampling).', 'rasterised') },
  { test: /\bglutInitWindowSize\((\d+), (\d+)\)/, explain: (m) => ({ ...plain('glutInitWindowSize(width, height)', 'Sets the window’s size in pixels. VAMS uses the canvas size, so the program looks like the canvas.', 'rasterised'), values: [{ arg: 'width', source: 'canvas width', value: m[1], control: null }, { arg: 'height', source: 'canvas height', value: m[2], control: null }] }) },
  { test: /\bglutCreateWindow\(/, explain: () => plain('glutCreateWindow(title)', 'Opens the window, with the title shown in its title bar.') },
  { test: /\bglewInit\(/, explain: () => plain('glewInit()', 'Finds the buffer functions in the graphics driver. It needs a window first, and must run before any buffer call.') },
  {
    test: /\bglClearColor\(([\d.]+)f, ([\d.]+)f, ([\d.]+)f, 1\.0f\)/,
    explain: (m) => ({
      ...plain('glClearColor(r, g, b, a)', 'Sets the colour glClear wipes the frame to: your background.', 'rasterised', link('Background', 'background')),
      values: [
        { arg: 'r', source: 'red', value: num(m[1]), control: 'Background' },
        { arg: 'g', source: 'green', value: num(m[2]), control: 'Background' },
        { arg: 'b', source: 'blue', value: num(m[3]), control: 'Background' },
      ],
    }),
  },
  { test: /\bglutDisplayFunc\((\w+)\)/, explain: (m) => plain('glutDisplayFunc(function)', `Registers ${m[1]}() as the function GLUT calls to draw a frame.`) },
  { test: /\bglut(Keyboard|Special|Mouse|Motion|Reshape|Idle)Func\((\w+)\)/, explain: (m) => plain(`glut${m[1]}Func(function)`, `Registers ${m[2]} as the ${CALLBACK_KIND[m[1]]} callback.`, null, link('Callbacks', 'callbacks')) },
  { test: /\bglutMainLoop\(/, explain: () => plain('glutMainLoop()', 'Hands control to GLUT, which waits for events and calls your callbacks until the window closes.') },
  { test: /\bglViewport\(/, explain: () => plain('glViewport(x, y, width, height)', 'Maps the −1 to 1 box (NDC) onto the window’s pixels: this call uses the whole window for drawing.', 'rasterised') },
  { test: /\bglutGet\(GLUT_WINDOW_(WIDTH|HEIGHT)\)/, explain: (m) => plain('glutGet(what)', `Asks GLUT for the window’s current ${m[1].toLowerCase()}.`) },
  { test: /\bglRasterPos2f\(/, explain: (_m, ctx) => plain('glRasterPos2f(x, y)', 'Sets where the next bitmap text starts, in the text’s own coordinates.', 'stored', link('Transform', 'transform', objectOf(ctx))) },
  { test: /\bglutBitmapCharacter\(/, explain: () => plain('glutBitmapCharacter(font, character)', 'Draws one character of text as a bitmap at the raster position, then moves the position along.', 'rasterised') },
  { test: /^(\w+)\(\);$/, explain: (m) => plain(`${m[1]}()`, `Calls ${m[1]}, your idle callback.`, null, link('Callbacks', 'callbacks')) },
];

export function explainLine(index: number, outline: CodeOutline, scene: ExplainScene): LineExplanation | null {
  const line = outline.lines[index];
  if (!line || !line.explainable) return null;
  const t = line.text.trim();
  for (const entry of ENTRIES) {
    const m = entry.test.exec(t);
    if (m) return entry.explain(m, { t, line, index, outline, scene });
  }
  return null;
}

export function noteFor(index: number, outline: CodeOutline, scene: ExplainScene): NotePart[] | null {
  const line = outline.lines[index];
  if (!line || !line.object) return null;
  const block = outline.blocks.find((b) => b.id === line.block);
  if (!block || block.kind !== 'draw-object') return null;
  const node = byCode(scene, line.object);
  if (!node) return null;
  const t = line.text.trim();
  const code = line.object;
  const tr = node.transform;
  if (t.startsWith('glTranslatef(')) {
    const { translateX: dx, translateY: dy } = tr;
    // Zero is judged by what the note would show, so a value that rounds to 0.00 is left out.
    const moveX = fmt(Math.abs(dx)) !== '0.00';
    const moveY = fmt(Math.abs(dy)) !== '0.00';
    if (!moveX && !moveY) return null;
    const parts: NotePart[] = [`moves ${node.name} `];
    if (moveX) parts.push({ value: fmt(Math.abs(dx)), ref: `state_${code}.x` }, dx > 0 ? ' right' : ' left');
    if (moveX && moveY) parts.push(', ');
    if (moveY) parts.push({ value: fmt(Math.abs(dy)), ref: `state_${code}.y` }, dy > 0 ? ' up' : ' down');
    return parts;
  }
  // glRotatef(angle, 0, 0, 1) turns a positive angle anticlockwise.
  if (t.startsWith('glRotatef(')) {
    const angle = short(Math.abs(tr.rotate));
    if (angle === '0') return null;
    return [`turns ${node.name} `, { value: `${angle}°`, ref: `state_${code}.rotation` }, tr.rotate > 0 ? ' anticlockwise' : ' clockwise'];
  }
  if (t.startsWith('glScalef(')) {
    const sx = short(tr.scaleX);
    const sy = short(tr.scaleY);
    if (sx === '1' && sy === '1') return null;
    return [`stretches ${node.name} `, { value: sx, ref: `state_${code}.scaleX` }, '× across, ', { value: sy, ref: `state_${code}.scaleY` }, '× up'];
  }
  if (/^gl(Begin|DrawArrays|DrawElements)\(/.test(t)) return [assemblyFor(node.type as PrimitiveType, 0, node.vertices.length).note];
  if (t.startsWith('glBindTexture(')) {
    const name = scene.textures.find((tex) => tex.id === node.texture?.textureId)?.name;
    return name ? ['paint with ', name] : null;
  }
  return null;
}
