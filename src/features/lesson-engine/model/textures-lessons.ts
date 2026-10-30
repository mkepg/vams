import type { Lesson } from '@/core/types/lesson';
import type { VamsState } from '@/core/store/types';
import type { PendingVertex, PrimitiveType, SceneNode } from '@/core/types/scene';
import type { TextureFilter, TextureWrap, UV } from '@/core/types/textures';
import { useVamsStore } from '@/core/store';

const SAMPLE_UV_GRID = 'sample-uv-grid';
const SAMPLE_ATLAS = 'sample-atlas';
const SAMPLE_PIXEL = 'sample-pixel';
const SAMPLE_BRICKS = 'sample-bricks';
const SAMPLE_EDGES = 'sample-edges';

/** A square: bottom left, bottom right, top right, top left, so row 0 of the UV table is the bottom-left corner. */
const QUAD: PendingVertex[] = [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }];
const TRIANGLE: PendingVertex[] = [{ x: 0, y: 0.6 }, { x: -0.6, y: -0.4 }, { x: 0.6, y: -0.4 }];
/** The filled primitives, the only shapes a texture can be drawn on. */
const TEXTUREABLE = new Set<SceneNode['type']>(['TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN', 'QUADS', 'QUAD_STRIP', 'POLYGON']);

const now = () => useVamsStore.getState();
const named = (state: VamsState, name: string) => state.objects.find((o) => o.name === name);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
/** The lesson's shape: the newest one a texture can go on. */
const subject = (state: VamsState) => state.objects.find((o) => TEXTUREABLE.has(o.type));
const textureOf = (o: SceneNode | undefined) => o?.texture ?? null;

/** UVs for the quad's corners spanning u0..u1 across and v0..v1 up. */
const box = (u0: number, u1: number, v0: number, v1: number): UV[] => [
  { u: u0, v: v0 }, { u: u1, v: v0 }, { u: u1, v: v1 }, { u: u0, v: v1 },
];

/** The quad's corners, in their order, carry the UVs of the box u0..u1 by v0..v1, within tol. */
const showsBox = (o: SceneNode | undefined, u0: number, u1: number, v0: number, v1: number, tol = 0.05) => {
  const want = box(u0, u1, v0, v1);
  return !!o?.uvs && o.uvs.length === want.length && o.uvs.every((p, i) => near(p.u, want[i].u, tol) && near(p.v, want[i].v, tol));
};

/** Adds a named shape, selected, with an image on it; returns it. */
function addTextured(type: PrimitiveType, vertices: PendingVertex[], name: string, textureId: string, filter?: TextureFilter, wrap?: TextureWrap): SceneNode {
  now().addCustomObject(type, vertices);
  const id = now().objects[0].id;
  now().updateObjectName(id, name);
  now().attachTexture(id, textureId);
  if (filter) now().updateTextureFilter(id, filter);
  if (wrap) now().updateTextureWrap(id, wrap);
  now().selectObject(id);
  return now().objects.find((o) => o.id === id)!;
}

function setUVs(name: string, uvs: UV[]) {
  const o = named(now(), name);
  if (o) now().setUVs(o.id, uvs);
}

/** Selects the named shape, so Math follows it. */
const select = (name: string) => (state: VamsState) => {
  const o = named(state, name);
  if (o) state.selectObject(o.id);
};

/** The capstone's shape: the newest one with an image, else the newest one that can take one. */
const capstoneShape = (state: VamsState) =>
  state.objects.find((o) => TEXTUREABLE.has(o.type) && !!o.texture) ?? subject(state);

export const TEXTURES_LESSONS: Record<string, Lesson> = {
  'textures-demo-1': {
    id: 'textures-demo-1',
    title: 'The Foundation of Textures',
    type: 'demo',
    section: 'Textures',
    steps: [
      {
        narration: "So far every shape took its colours from glColor3f. A texture paints an image across a shape instead. The image's pixels are called texels.",
      },
      {
        narration: 'Here is a plain quad, named Wall.',
        action: () => {
          now().addCustomObject('QUADS', QUAD);
          now().updateObjectName(now().objects[0].id, 'Wall');
        },
      },
      {
        narration: "In its Texture group, under Image, we picked the Brick wall tile. The quad is now drawn with the picture.",
        focusPanel: 'texture-attach',
        action: (state) => {
          const o = named(state, 'Wall');
          if (o) state.attachTexture(o.id, SAMPLE_BRICKS);
        },
        codeChangeFocus: ['glGenTextures'],
      },
      {
        narration: 'The image is loaded once, in init(). glGenTextures(1, &tex_Wall) makes a name for a texture object, and glBindTexture(GL_TEXTURE_2D, tex_Wall) selects it, like glGenBuffers and glBindBuffer in Buffers.',
        pane: 'code',
        codeChangeFocus: ['glGenTextures', 'glBindTexture(GL_TEXTURE_2D, tex_Wall)'],
      },
      {
        narration: 'glTexImage2D then uploads the texels, ending in GL_RGBA, GL_UNSIGNED_BYTE, data. What does GL_UNSIGNED_BYTE describe?',
        predict: {
          options: [
            { id: 'channel', label: 'Each colour channel is one byte, 0 to 255', why: 'An unsigned byte holds 0 to 255, and every red, green, blue and alpha value is one of them.' },
            { id: 'image', label: 'The whole image is one byte', why: 'width and height say how many texels there are; the type describes each value.' },
            { id: 'grey', label: 'The image is black and white', why: 'GL_RGBA says there are four channels: red, green, blue and alpha.' },
          ],
          correctId: 'channel',
        },
        action: (state) => state.setCodePane('code'),
      },
      {
        narration: 'GL_RGBA says each texel has four channels: red, green, blue and alpha. The first GL_RGBA is how OpenGL keeps the image; the second is how your data is laid out. stbi_load reads the file into data just before.',
        pane: 'code',
        codeChangeFocus: ['glTexImage2D'],
      },
      {
        narration: 'In draw_Wall, glEnable(GL_TEXTURE_2D) turns texturing on and glBindTexture picks the wall. Before each glVertex2f, glTexCoord2f pins a point of the image to that corner. glDisable(GL_TEXTURE_2D) turns it off again.',
        pane: 'code',
        codeChangeFocus: ['glEnable(GL_TEXTURE_2D)', 'glTexCoord2f'],
      },
      {
        narration: 'Every corner still has glColor3f(1.00f, 1.00f, 1.00f). We will make all four corners red. What happens to the wall?',
        predict: {
          options: [
            { id: 'same', label: 'It looks the same', why: 'init() calls glTexEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_REPLACE), so each texel replaces the colour.' },
            { id: 'red', label: 'It turns red', why: 'That would need the colour and the texel mixed. GL_REPLACE keeps only the texel.' },
            { id: 'gone', label: 'The bricks disappear', why: 'The texture stays bound; only the corner colours change.' },
          ],
          correctId: 'same',
        },
        action: (state) => {
          const o = named(state, 'Wall');
          if (o) state.setAllVertexColors(o.id, '#ff0000');
        },
      },
      {
        narration: 'glColor3f now says red, but the wall is unchanged: with GL_REPLACE the texture decides the colour of every pixel it covers.',
        pane: 'code',
        codeChangeFocus: ['glTexEnvi'],
      },
      {
        narration: 'A texture is made once and drawn every frame.',
        recap: {
          points: [
            'glGenTextures, glBindTexture and glTexImage2D make, select and fill a texture once, in init().',
            'Each frame, glEnable(GL_TEXTURE_2D), glBindTexture and glTexCoord2f draw it on the shape.',
            "GL_REPLACE lets the texture replace the corners' colours.",
          ],
          calls: ['glGenTextures', 'glTexImage2D', 'glTexEnvi', 'glTexCoord2f'],
        },
      },
    ],
  },

  'textures-demo-6': {
    id: 'textures-demo-6',
    title: 'Mapping with UVs',
    type: 'demo',
    section: 'Textures',
    steps: [
      {
        narration: 'An image has its own coordinates: u runs across it from 0 to 1, and v runs up it from 0 to 1. The UV grid sample draws them: red u along the bottom, blue v up the left, meeting at 0,0.',
        focusPanel: 'uv-editor',
        action: () => { addTextured('QUADS', QUAD, 'Card', SAMPLE_UV_GRID); },
      },
      {
        narration: "Each corner gets one (u, v). The bottom-left corner's glTexCoord2f(0.0000f, 0.0000f) shows the image's 0,0; the top-right corner shows (1, 1).",
        pane: 'code',
        codeChangeFocus: ['glTexCoord2f'],
      },
      {
        narration: 'We will press Flip U, which makes every u into 1 − u. The flag points right now. Which way will it point?',
        predict: {
          options: [
            { id: 'left', label: 'Left', why: 'The left corners now read u = 1 and the right ones u = 0, so the image is mirrored across.' },
            { id: 'right', label: 'Right', why: 'That is how it was drawn. Flipping u mirrors it.' },
            { id: 'down', label: 'Down', why: 'Pointing down needs Flip V, which mirrors v.' },
          ],
          correctId: 'left',
        },
        focusPanel: 'uv-editor',
        action: () => setUVs('Card', box(1, 0, 0, 1)),
      },
      {
        narration: 'The first glTexCoord2f now reads (1.0000f, 0.0000f). The image moved on the card; the corners did not.',
        pane: 'code',
        codeChangeFocus: ['glTexCoord2f(1.0000f, 0.0000f)'],
      },
      {
        narration: 'We will go back to Fit, then halve every u and v, so they run from 0 to 0.5. What will the card show?',
        predict: {
          options: [
            { id: 'quarter', label: 'The bottom-left quarter of the image, twice as big', why: 'The card now spans half the image each way, from 0,0, so that quarter fills it.' },
            { id: 'small', label: 'The whole image at half size', why: "The card's size comes from its corners, not its UVs." },
            { id: 'top', label: 'The top-right quarter', why: 'Small u and v are near 0,0, the bottom left.' },
          ],
          correctId: 'quarter',
        },
        focusPanel: 'uv-editor',
        action: () => setUVs('Card', box(0, 0.5, 0, 0.5)),
      },
      {
        narration: "Math's Coloured stage lists each corner's (u, v) in its UV table, and shows how a texel is picked from them.",
        pane: 'math',
        mathStage: 'coloured',
        action: select('Card'),
      },
      {
        narration: 'UVs say which part of the image each corner shows.',
        recap: {
          points: [
            'u runs across the image and v up it, both from 0 to 1.',
            'glTexCoord2f gives each corner the point of the image it shows.',
            'Changing UVs moves the image on the shape; the shape stays put.',
          ],
          calls: ['glTexCoord2f'],
        },
      },
    ],
  },

  'textures-demo-2': {
    id: 'textures-demo-2',
    title: 'Unlocking the Texture Atlas',
    type: 'demo',
    section: 'Textures',
    steps: [
      {
        narration: 'Games pack many small pictures into one image, a texture atlas, and pick one with UVs. This quad shows the Sprite sheet: a heart, a coin, a gem and a star.',
        focusPanel: 'texture-attach',
        action: () => { addTextured('QUADS', QUAD, 'Sprite', SAMPLE_ATLAS); },
      },
      {
        narration: 'Its UVs run from 0 to 1, so all four icons show.',
        focusPanel: 'uv-editor',
      },
      {
        narration: 'The coin is top right. We will set the UVs that show only the coin. Which are they?',
        predict: {
          options: [
            { id: 'coin', label: 'u 0.5 to 1, v 0.5 to 1', why: 'The right half has u above 0.5 and the top half has v above 0.5.' },
            { id: 'heart', label: 'u 0 to 0.5, v 0.5 to 1', why: 'That is the left half: the heart.' },
            { id: 'star', label: 'u 0.5 to 1, v 0 to 0.5', why: 'That is the bottom half: the star.' },
          ],
          correctId: 'coin',
        },
        focusPanel: 'uv-editor',
        action: () => setUVs('Sprite', box(0.5, 1, 0.5, 1)),
      },
      {
        narration: 'The quad is the same size, but shows only the coin, scaled up to fill it. Its glTexCoord2f lines hold 0.5 and 1.',
        pane: 'code',
        codeChangeFocus: ['glTexCoord2f'],
      },
      {
        narration: 'A game flips between icons by changing UVs. We will take 0.5 off every u. Which icon appears?',
        predict: {
          options: [
            { id: 'heart', label: 'The heart', why: 'u 0 to 0.5 with v 0.5 to 1 is the top-left quarter.' },
            { id: 'star', label: 'The star', why: 'The star needs v from 0 to 0.5.' },
            { id: 'gem', label: 'The gem', why: 'The gem is bottom left, v from 0 to 0.5.' },
          ],
          correctId: 'heart',
        },
        focusPanel: 'uv-editor',
        action: () => setUVs('Sprite', box(0, 0.5, 0.5, 1)),
      },
      {
        narration: 'Sprite animation and tile maps work this way: one texture, bound once, and different UVs for each picture.',
      },
      {
        narration: 'One image can hold many pictures.',
        recap: {
          points: ['A texture atlas packs several pictures into one image.', 'UVs pick which part of it a shape shows.'],
          calls: ['glTexCoord2f'],
        },
      },
    ],
  },

  'textures-demo-3': {
    id: 'textures-demo-3',
    title: 'The Pixel Art Problem',
    type: 'demo',
    section: 'Textures',
    steps: [
      {
        narration: 'The Pixel fox is only 64 by 64 texels. On this quad each texel covers several pixels of the window, so OpenGL must decide what goes between them. That choice is the filter.',
        focusPanel: 'texture-attach',
        action: () => { addTextured('QUADS', QUAD, 'Fox', SAMPLE_PIXEL, 'LINEAR'); },
      },
      {
        narration: 'Filter is LINEAR, as VAMS starts it. With GL_LINEAR each pixel blends the four nearest texels, so the fox looks soft.',
        pane: 'code',
        codeChangeFocus: ['GL_TEXTURE_MAG_FILTER'],
      },
      {
        narration: 'We will set Filter to NEAREST. What happens to the fox?',
        predict: {
          options: [
            { id: 'sharp', label: 'Sharp, blocky pixels', why: 'NEAREST takes the one nearest texel, with no blending.' },
            { id: 'smoother', label: 'Smoother still', why: 'Blending is what LINEAR does.' },
            { id: 'smaller', label: 'It gets smaller', why: "The filter only picks colours; the size comes from the shape's corners." },
          ],
          correctId: 'sharp',
        },
        focusPanel: 'texture-attach',
        action: (state) => {
          const o = named(state, 'Fox');
          if (o) state.updateTextureFilter(o.id, 'NEAREST');
        },
      },
      {
        narration: 'glTexParameteri sets the filter in init(). GL_TEXTURE_MAG_FILTER is used when the image is drawn bigger than it is, GL_TEXTURE_MIN_FILTER when it is drawn smaller. VAMS sets both to your choice.',
        pane: 'code',
        codeChangeFocus: ['_FILTER'],
      },
      {
        narration: 'We will scale the fox down to 0.1. Which line now decides how it looks?',
        predict: {
          options: [
            { id: 'min', label: 'The GL_TEXTURE_MIN_FILTER line', why: '64 texels now fall on fewer pixels than that, so the image is drawn smaller than it is.' },
            { id: 'mag', label: 'The GL_TEXTURE_MAG_FILTER line', why: 'MAG is for drawing an image bigger than it is.' },
          ],
          correctId: 'min',
        },
        focusPanel: 'object-transform',
        action: (state) => {
          const o = named(state, 'Fox');
          if (o) state.updateObjectTransform(o.id, { scaleX: 0.1, scaleY: 0.1 });
        },
      },
      {
        narration: "Math's Coloured stage shows the filter's formula: NEAREST reads the single texel T[⌊x⌋, ⌊y⌋].",
        pane: 'math',
        mathStage: 'coloured',
        action: select('Fox'),
      },
      {
        narration: 'The filter chooses between sharp and smooth.',
        recap: {
          points: [
            'GL_NEAREST takes one texel: sharp and blocky. GL_LINEAR blends four: smooth.',
            'GL_TEXTURE_MAG_FILTER is for drawing bigger, GL_TEXTURE_MIN_FILTER for drawing smaller.',
          ],
          calls: ['glTexParameteri'],
        },
      },
    ],
  },

  'textures-demo-4': {
    id: 'textures-demo-4',
    title: 'Pushing Boundaries (Wrapping)',
    type: 'demo',
    section: 'Textures',
    steps: [
      {
        narration: 'UVs usually run from 0 to 1. What should OpenGL draw at u = 2, or v = −1? The wrap mode decides.',
        focusPanel: 'texture-attach',
        action: () => { addTextured('QUADS', QUAD, 'Floor', SAMPLE_BRICKS, undefined, 'REPEAT'); },
      },
      {
        narration: 'We will set the UVs to run from 0 to 3 both ways, with Wrap REPEAT. What appears?',
        predict: {
          options: [
            { id: 'tiles', label: '3 by 3 copies of the wall', why: 'REPEAT keeps only the part after the point: 2.4 reads like 0.4, so the image repeats.' },
            { id: 'one', label: 'One wall, stretched', why: 'That is what UVs from 0 to 1 give.' },
            { id: 'gap', label: 'One wall in a corner, the rest empty', why: 'Past 1 the wrap mode still picks a texel; it never leaves a gap.' },
          ],
          correctId: 'tiles',
        },
        focusPanel: 'uv-editor',
        action: () => setUVs('Floor', box(0, 3, 0, 3)),
      },
      {
        narration: 'Brick wall is drawn so its edges meet, so the nine copies join into one floor. Large floors and walls are drawn from small images this way.',
      },
      {
        narration: 'Wrap is set in init() with two lines: GL_TEXTURE_WRAP_S for the u direction and GL_TEXTURE_WRAP_T for v. VAMS sets both together.',
        pane: 'code',
        codeChangeFocus: ['GL_TEXTURE_WRAP_'],
      },
      {
        narration: 'Now the Coloured edges sample: a band of colour on each edge and an arrow in the middle, with UVs from −0.5 to 1.5. REPEAT shows one whole copy in the middle, with halves and quarters of others around it.',
        focusPanel: 'texture-attach',
        action: (state) => {
          const o = named(state, 'Floor');
          if (!o) return;
          state.attachTexture(o.id, SAMPLE_EDGES);
          setUVs('Floor', box(-0.5, 1.5, -0.5, 1.5));
        },
      },
      {
        narration: 'We will set Wrap to CLAMP. What fills the area outside the image?',
        predict: {
          options: [
            { id: 'edge', label: "Each edge's colour, stretched outward", why: 'GL_CLAMP_TO_EDGE reads the last texel for any u or v past the edge.' },
            { id: 'copies', label: 'More copies of the image', why: 'That is REPEAT.' },
            { id: 'background', label: 'The background colour', why: 'A wrap mode always picks a texel of the image.' },
          ],
          correctId: 'edge',
        },
        focusPanel: 'texture-attach',
        action: (state) => {
          const o = named(state, 'Floor');
          if (o) state.updateTextureWrap(o.id, 'CLAMP_TO_EDGE');
        },
        codeChangeFocus: ['GL_TEXTURE_WRAP_'],
      },
      {
        narration: "Math's Coloured stage shows the CLAMP rule, u' = clamp(u, 0, 1): any u below 0 reads 0. Under REPEAT it reads u − ⌊u⌋.",
        pane: 'math',
        mathStage: 'coloured',
        action: select('Floor'),
      },
      {
        narration: 'The wrap mode decides what lies past the edge.',
        recap: {
          points: [
            'GL_REPEAT tiles the image past 0 to 1; GL_CLAMP_TO_EDGE stretches its edge texels.',
            'GL_TEXTURE_WRAP_S is the u direction and GL_TEXTURE_WRAP_T the v direction.',
          ],
          calls: ['glTexParameteri'],
        },
      },
    ],
  },

  'textures-demo-5': {
    id: 'textures-demo-5',
    title: 'Texture on a Triangle',
    type: 'demo',
    section: 'Textures',
    steps: [
      {
        narration: 'Textures work on any filled shape. A triangle has three corners, so three UVs. This one shows the UV grid.',
        focusPanel: 'uv-editor',
        action: () => { addTextured('TRIANGLES', TRIANGLE, 'Tri', SAMPLE_UV_GRID); },
      },
      {
        narration: 'VAMS fits the image over the triangle: the tip gets (0.5, 1) and the base corners (0, 0) and (1, 0), so the triangle shows a triangle cut from the image.',
        pane: 'code',
        codeChangeFocus: ['glTexCoord2f'],
      },
      {
        narration: "We will move the tip's UV to (0.5, 2). What happens to the image?",
        predict: {
          options: [
            { id: 'face', label: 'The whole face changes, most near the tip', why: "Every point inside blends the three corners' UVs, so moving one changes them all, most near that corner." },
            { id: 'tip', label: 'Only the tip changes', why: 'Points inside take a share of every corner, not just the nearest.' },
            { id: 'none', label: 'Nothing', why: 'The tip now reaches twice as far up the image.' },
          ],
          correctId: 'face',
        },
        focusPanel: 'uv-editor',
        action: (state) => {
          const o = named(state, 'Tri');
          if (o) state.updateUV(o.id, 0, { u: 0.5, v: 2 });
        },
      },
      {
        narration: "Math's Coloured stage, under Across the triangle: u(p) = λ₀·u₀ + λ₁·u₁ + λ₂·u₂, the same weights that blend colours in Primitives.",
        pane: 'math',
        mathStage: 'coloured',
        action: select('Tri'),
      },
      {
        narration: 'UVs blend across a face the way colours do.',
        recap: {
          points: ['Each corner carries a UV, and every point inside blends them by barycentric weights.'],
          calls: ['glTexCoord2f'],
        },
      },
    ],
  },

  'textures-demo-7': {
    id: 'textures-demo-7',
    title: 'Textures from Arrays',
    type: 'demo',
    section: 'Textures',
    steps: [
      {
        narration: 'In Buffers you moved corners into arrays. UVs can move too. Here is a textured quad in immediate mode.',
        focusPanel: 'buffers-panel',
        action: () => { addTextured('QUADS', QUAD, 'Wall', SAMPLE_BRICKS); },
      },
      {
        narration: 'We will switch it to Vertex Array. Where will its four glTexCoord2f values go?',
        predict: {
          options: [
            { id: 'array', label: 'Into an array, uvs_Wall', why: 'Like verts_ and colors_, the UVs become an array of numbers.' },
            { id: 'calls', label: 'They stay in glTexCoord2f calls', why: 'Array mode has no glBegin, so it has no glTexCoord2f calls.' },
            { id: 'dropped', label: 'They are dropped', why: 'Each corner still needs a UV to show the image.' },
          ],
          correctId: 'array',
        },
        focusPanel: 'buffers-panel',
        action: (state) => {
          const o = named(state, 'Wall');
          if (o) state.updateRenderingMode(o.id, 'VERTEX_ARRAY');
        },
        codeChangeFocus: ['GLfloat uvs_Wall'],
      },
      {
        narration: 'glEnableClientState(GL_TEXTURE_COORD_ARRAY) turns the UV array on, and glTexCoordPointer(2, GL_FLOAT, 0, uvs_Wall) points at it: two floats per corner.',
        pane: 'code',
        codeChangeFocus: ['GL_TEXTURE_COORD_ARRAY', 'glTexCoordPointer'],
      },
      {
        narration: 'glDrawArrays then reads a position, a colour and a UV for each corner, in one call.',
        pane: 'code',
        codeChangeFocus: ['glDrawArrays'],
      },
      {
        narration: 'Now VBO. Where do the UVs live?',
        predict: {
          options: [
            { id: 'own', label: 'In a buffer of their own, uvbo_Wall', why: 'Positions, colours and UVs each get a buffer, filled once in init().' },
            { id: 'shared', label: 'In the position buffer', why: 'VAMS keeps positions and UVs in separate buffers.' },
          ],
          correctId: 'own',
        },
        focusPanel: 'buffers-panel',
        action: (state) => {
          const o = named(state, 'Wall');
          if (o) state.updateRenderingMode(o.id, 'VBO');
        },
        codeChangeFocus: ['uvbo_Wall'],
      },
      {
        narration: 'glTexCoordPointer(2, GL_FLOAT, 0, 0) now reads from uvbo_Wall, bound just before it.',
        pane: 'code',
        codeChangeFocus: ['glTexCoordPointer'],
      },
      {
        narration: 'UVs travel with the corners.',
        recap: {
          points: [
            'Vertex arrays and VBOs keep UVs in an array of their own.',
            'glEnableClientState(GL_TEXTURE_COORD_ARRAY) and glTexCoordPointer point OpenGL at it.',
          ],
          calls: ['glTexCoordPointer'],
        },
      },
    ],
  },

  'textures-exercise-1': {
    id: 'textures-exercise-1',
    title: 'First Coat of Paint',
    type: 'exercise',
    section: 'Textures',
    steps: [
      {
        narration: 'Your turn: put the Brick wall image on this quad.',
        focusPanel: 'texture-attach',
        action: () => {
          now().addCustomObject('QUADS', QUAD);
          now().updateObjectName(now().objects[0].id, 'Quad');
        },
        goals: [{ label: 'Brick wall on the quad', check: (state) => textureOf(subject(state))?.textureId === SAMPLE_BRICKS }],
        task: 'Put Brick wall on the quad',
        hints: ['Select the quad, then open its Texture group.', 'Under Image, pick the Brick wall tile.'],
        solve: (state) => {
          const o = subject(state);
          if (o) state.attachTexture(o.id, SAMPLE_BRICKS);
        },
      },
      {
        narration: 'How your code does it: init() makes and fills tex_Quad with glGenTextures and glTexImage2D, and draw_Quad binds it every frame.',
        pane: 'code',
        codeChangeFocus: ['glGenTextures', 'glTexImage2D'],
      },
      {
        narration: 'Now swap the image for the UV grid.',
        focusPanel: 'texture-attach',
        goals: [{ label: 'UV grid on the quad', check: (state) => textureOf(subject(state))?.textureId === SAMPLE_UV_GRID }],
        task: 'Swap to the UV grid',
        hints: ['Pick the UV grid tile under Image.'],
        solve: (state) => {
          const o = subject(state);
          if (o) state.attachTexture(o.id, SAMPLE_UV_GRID);
        },
      },
      {
        narration: 'Only the file name in stbi_load changed. The texture object and the glTexCoord2f lines stay the same.',
        pane: 'code',
        codeChangeFocus: ['stbi_load('],
      },
      {
        narration: 'A shape shows whatever image is bound when it draws.',
        recap: {
          points: ['Picking an image gives the shape a texture object, made in init() and bound each frame.'],
          calls: ['glBindTexture', 'glTexImage2D'],
        },
      },
    ],
  },

  'textures-exercise-2': {
    id: 'textures-exercise-2',
    title: 'Sprite Extraction',
    type: 'exercise',
    section: 'Textures',
    steps: [
      {
        narration: 'This quad shows the whole Sprite sheet. Set its UVs so it shows only the green star, bottom right.',
        focusPanel: 'uv-editor',
        action: () => { addTextured('QUADS', QUAD, 'Sprite', SAMPLE_ATLAS); },
        goals: [{ label: 'Only the star shows', check: (state) => showsBox(subject(state), 0.5, 1, 0, 0.5) }],
        task: 'Show only the star',
        hints: [
          'The star is the bottom-right quarter: u from 0.5 to 1, v from 0 to 0.5.',
          'Under UV coordinates, open Exact values. Row 0 is the bottom-left corner, then bottom right, top right and top left.',
          'Row 0: U 0.5, V 0. Row 1: U 1, V 0. Row 2: U 1, V 0.5. Row 3: U 0.5, V 0.5.',
        ],
        solve: () => setUVs('Sprite', box(0.5, 1, 0, 0.5)),
      },
      {
        narration: 'How your code does it: the four glTexCoord2f lines now run from 0.5 to 1 across and 0 to 0.5 up.',
        pane: 'code',
        codeChangeFocus: ['glTexCoord2f'],
      },
      {
        narration: 'Now show the blue gem, bottom left.',
        focusPanel: 'uv-editor',
        goals: [{ label: 'Only the gem shows', check: (state) => showsBox(subject(state), 0, 0.5, 0, 0.5) }],
        task: 'Show only the gem',
        hints: ['The gem is the bottom-left quarter.', 'In Exact values: rows 0 and 3 get U 0, rows 1 and 2 U 0.5; rows 0 and 1 get V 0, rows 2 and 3 V 0.5.'],
        solve: () => setUVs('Sprite', box(0, 0.5, 0, 0.5)),
      },
      {
        narration: 'One more, without the editor.',
        task: 'Pick the UVs',
        hints: ['The heart is top left.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which UVs show only the heart?',
          options: [
            { id: 'heart', label: 'u 0 to 0.5, v 0.5 to 1' },
            { id: 'coin', label: 'u 0.5 to 1, v 0.5 to 1' },
            { id: 'gem', label: 'u 0 to 0.5, v 0 to 0.5' },
          ],
          correctId: 'heart',
        },
      },
      {
        narration: 'UVs crop a picture out of an atlas.',
        recap: {
          points: ['Each quarter of the sheet is a range of u and v of 0.5.', 'The glTexCoord2f values pick the quarter.'],
          calls: ['glTexCoord2f'],
        },
      },
    ],
  },

  'textures-exercise-3': {
    id: 'textures-exercise-3',
    title: 'Retro Crispness',
    type: 'exercise',
    section: 'Textures',
    steps: [
      {
        narration: 'The fox is blurred by LINEAR filtering. Make its pixels crisp.',
        focusPanel: 'texture-attach',
        action: () => { addTextured('QUADS', QUAD, 'Fox', SAMPLE_PIXEL, 'LINEAR'); },
        goals: [{ label: 'Filter NEAREST', check: (state) => textureOf(subject(state))?.filter === 'NEAREST' }],
        task: 'Make the fox crisp',
        hints: ['Select the fox and open its Texture group.', 'Set Filter to NEAREST.'],
        solve: (state) => {
          const o = subject(state);
          if (o) state.updateTextureFilter(o.id, 'NEAREST');
        },
      },
      {
        narration: 'How your code does it: both filter lines in init() now end in GL_NEAREST.',
        pane: 'code',
        codeChangeFocus: ['_FILTER'],
      },
      {
        narration: 'Now make the fox bigger: scale it to at least 1.8. The blocks grow with it and stay sharp.',
        focusPanel: 'object-transform',
        goals: [
          {
            label: 'Scaled to 1.8 or more, still NEAREST',
            check: (state) => {
              const o = subject(state);
              return !!o && o.transform.scaleX >= 1.79 && o.transform.scaleY >= 1.79 && o.texture?.filter === 'NEAREST';
            },
          },
        ],
        task: 'Scale the fox to 1.8',
        hints: ['Open the Transform group and set Scale X to 1.8. The lock keeps Scale Y with it.'],
        solve: (state) => {
          const o = subject(state);
          if (o) state.updateObjectTransform(o.id, { scaleX: 1.8, scaleY: 1.8 });
        },
      },
      {
        narration: 'One question about the two filter lines.',
        task: 'Pick the line',
        hints: ['MAG is short for magnify.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'Which line decides how the fox looks when it is drawn smaller than 64 by 64?',
          options: [
            { id: 'mag', label: 'GL_TEXTURE_MAG_FILTER' },
            { id: 'min', label: 'GL_TEXTURE_MIN_FILTER' },
            { id: 'wrap', label: 'GL_TEXTURE_WRAP_S' },
          ],
          correctId: 'min',
        },
      },
      {
        narration: 'NEAREST keeps pixel art sharp at any size.',
        recap: {
          points: ['GL_NEAREST keeps hard edges when an image is enlarged.', 'MAG_FILTER is for drawing bigger, MIN_FILTER for drawing smaller.'],
          calls: ['glTexParameteri'],
        },
      },
    ],
  },

  'textures-exercise-4': {
    id: 'textures-exercise-4',
    title: 'The Endless Floor',
    type: 'exercise',
    section: 'Textures',
    steps: [
      {
        narration: 'This floor is one brick wall, clamped. First let the image repeat.',
        focusPanel: 'texture-attach',
        action: () => { addTextured('QUADS', QUAD, 'Floor', SAMPLE_BRICKS, undefined, 'CLAMP_TO_EDGE'); },
        goals: [{ label: 'Wrap REPEAT', check: (state) => textureOf(subject(state))?.wrap === 'REPEAT' }],
        task: 'Set Wrap to REPEAT',
        hints: ['Wrap is beside Filter in the Texture group.', 'Pick REPEAT.'],
        solve: (state) => {
          const o = subject(state);
          if (o) state.updateTextureWrap(o.id, 'REPEAT');
        },
      },
      {
        narration: 'Now tile it 2 by 2: UVs from 0 to 2 both ways.',
        focusPanel: 'uv-editor',
        goals: [{ label: 'u and v from 0 to 2', check: (state) => showsBox(subject(state), 0, 2, 0, 2, 0.1) && textureOf(subject(state))?.wrap === 'REPEAT' }],
        task: 'Tile the floor 2 by 2',
        hints: ['Under UV coordinates, press Tile 2 × 2.'],
        solve: () => setUVs('Floor', box(0, 2, 0, 2)),
      },
      {
        narration: 'How your code does it: the glTexCoord2f lines now reach 2.0000f, and GL_REPEAT draws a copy for each whole step.',
        pane: 'code',
        codeChangeFocus: ['glTexCoord2f'],
      },
      {
        narration: 'Now make the bricks half as tall, keeping their width.',
        focusPanel: 'uv-editor',
        goals: [{ label: 'u from 0 to 2, v from 0 to 4', check: (state) => showsBox(subject(state), 0, 2, 0, 4, 0.1) && textureOf(subject(state))?.wrap === 'REPEAT' }],
        task: 'Halve the bricks’ height',
        hints: [
          'More v means more copies up the floor, so shorter bricks.',
          'Under UV coordinates, open Exact values.',
          'Set V to 4 in rows 2 and 3, the top corners.',
        ],
        solve: () => setUVs('Floor', box(0, 2, 0, 4)),
      },
      {
        narration: 'Four copies up and two across: u and v repeat on their own, through GL_TEXTURE_WRAP_S and GL_TEXTURE_WRAP_T.',
        pane: 'code',
        codeChangeFocus: ['glTexCoord2f'],
      },
      {
        narration: 'A small image can cover any floor.',
        recap: {
          points: ['With GL_REPEAT, the range of u or v is the number of copies across or up.'],
          calls: ['glTexCoord2f', 'glTexParameteri'],
        },
      },
    ],
  },

  'textures-exercise-5': {
    id: 'textures-exercise-5',
    title: 'Clamp the Edges',
    type: 'exercise',
    section: 'Textures',
    steps: [
      {
        narration: 'This card shows the Coloured edges sample with UVs from −0.5 to 1.5, and REPEAT tiles it. Stop the tiling, so one image sits in the middle, framed by its own edges.',
        focusPanel: 'texture-attach',
        action: () => {
          addTextured('QUADS', QUAD, 'Card', SAMPLE_EDGES, undefined, 'REPEAT');
          setUVs('Card', box(-0.5, 1.5, -0.5, 1.5));
        },
        goals: [{ label: 'Wrap CLAMP', check: (state) => textureOf(subject(state))?.wrap === 'CLAMP_TO_EDGE' }],
        task: 'Set Wrap to CLAMP',
        hints: ['Wrap is beside Filter in the Texture group.', 'Pick CLAMP.'],
        solve: (state) => {
          const o = subject(state);
          if (o) state.updateTextureWrap(o.id, 'CLAMP_TO_EDGE');
        },
      },
      {
        narration: 'Look at the canvas.',
        task: 'Pick the colour',
        hints: ['Each band is stretched outward from its own edge.'],
        exercise: {
          kind: 'multiple-choice',
          prompt: 'What colour fills the strip to the left of the image?',
          options: [
            { id: 'red', label: 'Mostly red, the left edge stretched' },
            { id: 'blue', label: 'Blue, from the right edge' },
            { id: 'copy', label: 'Another copy of the image' },
          ],
          correctId: 'red',
        },
      },
      {
        narration: 'Now move the image to the right half of the card, with the red edge filling the left half: u from −1 to 1, v from 0 to 1.',
        focusPanel: 'uv-editor',
        goals: [{ label: 'u from −1 to 1, v from 0 to 1', check: (state) => showsBox(subject(state), -1, 1, 0, 1) && textureOf(subject(state))?.wrap === 'CLAMP_TO_EDGE' }],
        task: 'Push the image to the right half',
        hints: [
          'Under UV coordinates, open Exact values. Rows 0 and 3 are the left corners: give them U −1. Rows 1 and 2 get U 1.',
          'Rows 0 and 1, the bottom corners, get V 0; rows 2 and 3 get V 1.',
        ],
        solve: () => setUVs('Card', box(-1, 1, 0, 1)),
      },
      {
        narration: 'How your code does it: both GL_TEXTURE_WRAP lines end in GL_CLAMP_TO_EDGE, and the left glTexCoord2f lines start at −1.',
        pane: 'code',
        codeChangeFocus: ['GL_TEXTURE_WRAP_', 'glTexCoord2f(-1.0000f'],
      },
      {
        narration: 'Clamping keeps one copy and stretches its edges.',
        recap: {
          points: ['GL_CLAMP_TO_EDGE repeats the edge texel for any u or v past 0 to 1.'],
          calls: ['glTexParameteri'],
        },
      },
    ],
  },

  'textures-exercise-6': {
    id: 'textures-exercise-6',
    title: 'Write the Texture Calls',
    type: 'exercise',
    section: 'Textures',
    steps: [
      {
        narration: "The course's last exercise: set up a textured shape, then write the calls that load and draw its texture.",
      },
      {
        narration: 'Add a filled shape, put any image on it, then set Filter to NEAREST and Wrap to CLAMP.',
        focusPanel: 'texture-attach',
        goals: [
          { label: 'A shape with an image', check: (state) => !!textureOf(capstoneShape(state)) },
          { label: 'Filter NEAREST', check: (state) => textureOf(capstoneShape(state))?.filter === 'NEAREST' },
          { label: 'Wrap CLAMP', check: (state) => textureOf(capstoneShape(state))?.wrap === 'CLAMP_TO_EDGE' },
        ],
        task: 'Set up a textured shape',
        hints: [
          'Add a triangle or a quad from Add, then pick an image in its Texture group.',
          'Filter NEAREST, Wrap CLAMP.',
          'The goals follow the newest shape that has an image.',
        ],
        solve: (state) => {
          let o = capstoneShape(state);
          if (!o) o = addTextured('QUADS', QUAD, 'Card', SAMPLE_UV_GRID);
          if (!o.texture) now().attachTexture(o.id, SAMPLE_UV_GRID);
          now().updateTextureFilter(o.id, 'NEAREST');
          now().updateTextureWrap(o.id, 'CLAMP_TO_EDGE');
        },
      },
      {
        narration: 'In init(), first make a name for the texture.',
        task: 'Name the call',
        hints: ['It generates texture names.'],
        exercise: {
          kind: 'code',
          template: '{0}(1, &tex);',
          blanks: [{ answer: () => 'glGenTextures', wrong: 'not the call that makes a texture name' }],
        },
      },
      {
        narration: 'Select it as a 2D texture.',
        task: 'Name the target',
        hints: ['A flat image is a 2D texture.'],
        exercise: {
          kind: 'code',
          template: 'glBindTexture({0}, tex);',
          blanks: [{ answer: () => 'GL_TEXTURE_2D', wrong: 'not the target for a flat image' }],
        },
      },
      {
        narration: 'Set the filter used when the image is drawn bigger than it is.',
        task: 'Fill in the filter',
        hints: ['Your shape uses NEAREST.'],
        exercise: {
          kind: 'code',
          template: 'glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, {0});',
          blanks: [{ answer: (state) => `GL_${textureOf(capstoneShape(state))?.filter ?? 'NEAREST'}`, wrong: "that's not your shape's filter" }],
        },
      },
      {
        narration: 'Set the wrap mode in the u direction.',
        task: 'Fill in the direction and the mode',
        hints: ['S is the u direction, T the v direction.', 'Your shape clamps to the edge.'],
        exercise: {
          kind: 'code',
          template: 'glTexParameteri(GL_TEXTURE_2D, {0}, {1});',
          blanks: [
            { answer: () => 'GL_TEXTURE_WRAP_S', wrong: 'not the wrap in the u direction' },
            { answer: (state) => `GL_${textureOf(capstoneShape(state))?.wrap ?? 'CLAMP_TO_EDGE'}`, wrong: "that's not your shape's wrap mode" },
          ],
        },
      },
      {
        narration: 'Upload the texels: four channels, one byte each.',
        task: 'Fill in the format and the type',
        hints: ['Red, green, blue and alpha.', 'Each channel is 0 to 255.'],
        exercise: {
          kind: 'code',
          template: 'glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, {0}, {1}, data);',
          blanks: [
            { answer: () => 'GL_RGBA', wrong: 'not four channels' },
            { answer: () => 'GL_UNSIGNED_BYTE', wrong: 'not one byte per channel' },
          ],
        },
      },
      {
        narration: 'In the draw function, turn texturing on.',
        task: 'Fill in what to enable',
        hints: ['The same target you bound.'],
        exercise: {
          kind: 'code',
          template: 'glEnable({0});',
          blanks: [{ answer: () => 'GL_TEXTURE_2D', wrong: 'not the texturing switch' }],
        },
      },
      {
        narration: "Give the first corner its UV, before its glVertex2f.",
        task: "Fill in the first corner's u and v",
        hints: ['Row 0 under Exact values in UV coordinates, or the first glTexCoord2f line in the code.'],
        exercise: {
          kind: 'code',
          template: 'glTexCoord2f({0}, {1});',
          blanks: [
            { answer: (state) => capstoneShape(state)?.uvs?.[0]?.u ?? 0, wrong: "that's not the first corner's u" },
            { answer: (state) => capstoneShape(state)?.uvs?.[0]?.v ?? 0, wrong: "that's not the first corner's v" },
          ],
        },
      },
      {
        narration: 'You have written every part of a textured OpenGL program, and that is the whole course: the pipeline, primitives, buffers, transforms and textures.',
        recap: {
          points: [
            'In init(): glGenTextures, glBindTexture, glTexParameteri and glTexImage2D.',
            'Each frame: glEnable(GL_TEXTURE_2D), glBindTexture, then glTexCoord2f before each glVertex2f.',
            'Filter and wrap decide how texels are picked; UVs decide which ones.',
          ],
          calls: ['glGenTextures', 'glTexParameteri', 'glTexImage2D', 'glTexCoord2f'],
        },
      },
    ],
  },
};
