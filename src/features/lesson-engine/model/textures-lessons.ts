import type { Lesson } from '@/core/types/lesson';
import type { VamsState } from '@/core/store/types';
import { useVamsStore } from '@/core/store';

const SAMPLE_ATLAS  = 'sample-atlas';
const SAMPLE_PIXEL  = 'sample-pixel';
const SAMPLE_BRICKS = 'sample-bricks';

const QUAD_VERTS = [
  { x: -0.5, y: -0.5 },
  { x:  0.5, y: -0.5 },
  { x:  0.5, y:  0.5 },
  { x: -0.5, y:  0.5 },
];

const TRI_VERTS = [
  { x:  0.0, y:  0.6 },
  { x: -0.6, y: -0.4 },
  { x:  0.6, y: -0.4 },
];

// Used for evaluating state during success checks and separate steps
const withSelected = (state: VamsState) =>
  state.objects.find((o) => o.id === state.selectedObjectId);

export const TEXTURES_LESSONS: Record<string, Lesson> = {
  'textures-demo-1': {
    id: 'textures-demo-1',
    title: 'The Foundation of Textures',
    type: 'demo',
    section: 'Textures',
    steps: [
      {
        narration:
          "Welcome to Textures! Up until now, we've painted shapes using solid colors or gradients. Texturing allows us to wrap 2D images around our geometry.",
        waitForUser: true,
      },
      {
        narration: "Let's place a blank quad on the canvas. Think of this as an empty canvas waiting for a decal.",
        waitForUser: true,
        action: (state: VamsState) => {
          state.addCustomObject('QUADS', QUAD_VERTS);
        },
      },
      {
        narration:
          "Now, we will bind the 'Tiling Bricks' image to this quad. Watch the generated code update.",
        waitForUser: true,
        focusPanel: 'texture-attach',
        action: (state: VamsState) => {
          const obj = withSelected(state);
          if (obj) state.attachTexture(obj.id, SAMPLE_BRICKS);
        },
      },
      {
        narration:
          "In the init() function, OpenGL generates a texture ID and uploads the image data using glTexImage2D.",
        waitForUser: true,
      },
      {
        narration:
          "Inside the quad's specific draw function, we call glBindTexture before drawing the shape. OpenGL then uses glTexCoord2f to pin corners of the image to the corners of the geometry.",
        waitForUser: true,
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
        narration:
          "In 2D games, developers pack multiple sprites into a single image called a 'Texture Atlas'. Let's apply one.",
        waitForUser: true,
        action: (state: VamsState) => {
          state.addCustomObject('QUADS', QUAD_VERTS);
          // Fetch fresh ID from store since state snapshot is stale
          const id = useVamsStore.getState().selectedObjectId;
          if (id) state.attachTexture(id, SAMPLE_ATLAS);
        },
      },
      {
        narration:
          "Right now, the quad shows all four items. That's because the UV coordinates span from 0.0 to 1.0, covering the entire image.",
        waitForUser: true,
        focusPanel: 'uv-editor',
      },
      {
        narration:
          "We can extract just the Gold Coin by shrinking our UV coordinates to only cover the top-right quadrant.",
        waitForUser: true,
        focusPanel: 'uv-editor',
        action: (state: VamsState) => {
          const obj = withSelected(state);
          if (!obj) return;
          // Map to top-right quadrant
          state.updateUV(obj.id, 0, { u: 0.5, v: 0.5 });
          state.updateUV(obj.id, 1, { u: 1.0, v: 0.5 });
          state.updateUV(obj.id, 2, { u: 1.0, v: 1.0 });
          state.updateUV(obj.id, 3, { u: 0.5, v: 1.0 });
        },
      },
      {
        narration:
          "Notice how the quad hasn't changed size, but it now only renders the coin. Manipulating UVs is how sprite animation and tilemaps work under the hood.",
        waitForUser: true,
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
        narration:
          "When an image is stretched across a large area, OpenGL has to guess what color to make the in-between pixels. This is called 'Filtering'.",
        waitForUser: true,
        action: (state: VamsState) => {
          state.addCustomObject('QUADS', QUAD_VERTS);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) {
            state.attachTexture(id, SAMPLE_PIXEL);
            state.updateTextureFilter(id, 'LINEAR');
          }
        },
      },
      {
        narration:
          "We've attached a tiny 64x64 pixel art sprite. By default, OpenGL uses GL_LINEAR filtering, which blends neighboring pixels together. The result is a blurry, smeared image.",
        waitForUser: true,
        focusPanel: 'texture-attach',
      },
      {
        narration:
          "If we are making a retro game, we want sharp, blocky pixels. Let's change the filter mode to GL_NEAREST.",
        waitForUser: true,
        focusPanel: 'texture-attach',
        action: (state: VamsState) => {
          const obj = withSelected(state);
          if (obj) state.updateTextureFilter(obj.id, 'NEAREST');
        },
      },
      {
        narration:
          "Much better. GL_NEAREST simply grabs the exact color of the closest texel without blending. Both are useful, but you must choose the right tool for your art style.",
        waitForUser: true,
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
        narration:
          "UV coordinates normally range from 0.0 to 1.0. What happens if we tell OpenGL to read a coordinate of 3.0? The 'Wrap Mode' decides.",
        waitForUser: true,
        action: (state: VamsState) => {
          state.addCustomObject('QUADS', QUAD_VERTS);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) {
            state.attachTexture(id, SAMPLE_BRICKS);
            state.updateTextureWrap(id, 'REPEAT');
          }
        },
      },
      {
        narration:
          "Let's expand the UVs drastically. We'll set the bounds to span from 0.0 to 3.0 on both axes.",
        waitForUser: true,
        focusPanel: 'uv-editor',
        action: (state: VamsState) => {
          const obj = withSelected(state);
          if (!obj) return;
          state.updateUV(obj.id, 0, { u: 0, v: 0 });
          state.updateUV(obj.id, 1, { u: 3, v: 0 });
          state.updateUV(obj.id, 2, { u: 3, v: 3 });
          state.updateUV(obj.id, 3, { u: 0, v: 3 });
        },
      },
      {
        narration:
          "Because the wrap mode is GL_REPEAT, OpenGL loops the image seamlessly. This is how large walls and floors are textured using tiny image files.",
        waitForUser: true,
      },
      {
        narration:
          "Let's see the alternative: GL_CLAMP_TO_EDGE. Watch the canvas.",
        waitForUser: true,
        focusPanel: 'texture-attach',
        action: (state: VamsState) => {
          const obj = withSelected(state);
          if (obj) state.updateTextureWrap(obj.id, 'CLAMP_TO_EDGE');
        },
      },
      {
        narration:
          "Instead of looping, OpenGL takes the very last pixel at the edge of the image and stretches it into infinity. Both modes serve specific rendering purposes.",
        waitForUser: true,
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
        narration:
          "Texturing isn't just for quads. Triangles work the exact same way — but the rasterizer interpolates UVs barycentrically.",
        waitForUser: true,
        action: (state: VamsState) => {
          state.addCustomObject('TRIANGLES', TRI_VERTS);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) state.attachTexture(id, SAMPLE_BRICKS);
        },
      },
      {
        narration:
          "Each vertex gets one UV coordinate. Inside the triangle, every fragment's UV is a weighted blend of the three corners.",
        waitForUser: true,
        focusPanel: 'uv-editor',
      },
      {
        narration:
          "Drag a vertex's UV handle in the editor, and the image across the whole triangle shifts smoothly. That's barycentric UV interpolation in action.",
        waitForUser: true,
        focusPanel: 'uv-editor',
        action: (state: VamsState) => {
          const obj = withSelected(state);
          if (obj) state.updateUV(obj.id, 0, { u: 0.5, v: 1.5 });
        },
      },
      {
        narration:
          "Look at the math panel for the interpolation formula. It uses the exact same weights as glColor3f-per-vertex, just applied to a different attribute.",
        waitForUser: true,
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
        narration:
          "Your turn! I've placed a quad on the screen. Use the Apply Texture panel to attach the 'Tiling Bricks' sample to it.",
        waitForUser: true,
        focusPanel: 'texture-attach',
        action: (state: VamsState) => {
          state.addCustomObject('QUADS', QUAD_VERTS);
          state.setActiveTexture(SAMPLE_BRICKS);
        },
        successCheck: (state: VamsState) => {
          const obj = withSelected(state);
          return obj?.texture?.textureId === SAMPLE_BRICKS;
        },
      },
      {
        narration:
          "Perfect. Getting the texture onto the geometry is step one. Notice the code generator handles the complex loading and binding logic for you.",
        waitForUser: true,
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
        narration:
          "We have a full Texture Atlas rendered on a quad. Using the UV Editor, isolate the Green Crate (the bottom-right item).",
        waitForUser: true,
        focusPanel: 'uv-editor',
        action: (state: VamsState) => {
          state.addCustomObject('QUADS', QUAD_VERTS);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) state.attachTexture(id, SAMPLE_ATLAS);
        },
        successCheck: (state: VamsState) => {
          const obj = withSelected(state);
          if (!obj || !obj.uvs) return false;
          // Bottom-Right quadrant: U is [0.5, 1.0], V is [0.0, 0.5]
          return obj.uvs.every(
            (p) =>
              p.u >= 0.5 - 0.05 && p.u <= 1.0 + 0.05 &&
              p.v >= 0.0 - 0.05 && p.v <= 0.5 + 0.05,
          );
        },
      },
      {
        narration:
          "Spot on! You've successfully modified the glTexCoord2f data to crop out a specific sprite from a larger sheet.",
        waitForUser: true,
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
        narration:
          "This pixel art character looks terrible because it's being smeared by GL_LINEAR filtering. Fix the filter mode so the pixels are crisp.",
        waitForUser: true,
        focusPanel: 'texture-attach',
        action: (state: VamsState) => {
          state.addCustomObject('QUADS', QUAD_VERTS);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) {
            state.attachTexture(id, SAMPLE_PIXEL);
            state.updateTextureFilter(id, 'LINEAR');
          }
        },
        successCheck: (state: VamsState) => {
          const obj = withSelected(state);
          return obj?.texture?.filter === 'NEAREST';
        },
      },
      {
        narration:
          "Nailed it. By setting GL_TEXTURE_MAG_FILTER to GL_NEAREST, you instructed OpenGL to preserve the hard edges of the pixel art.",
        waitForUser: true,
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
        narration:
          "Let's turn this stretched quad into a tiled brick floor. Step one: In the Apply Texture panel, change the Wrap mode to GL_REPEAT. This permits the image to loop.",
        waitForUser: true,
        focusPanel: 'texture-attach',
        action: (state: VamsState) => {
          state.addCustomObject('QUADS', QUAD_VERTS);
          const id = useVamsStore.getState().selectedObjectId;
          if (id) {
            state.attachTexture(id, SAMPLE_BRICKS);
            state.updateTextureWrap(id, 'CLAMP_TO_EDGE');
          }
        },
        successCheck: (state: VamsState) => {
          const obj = withSelected(state);
          return obj?.texture?.wrap === 'REPEAT';
        },
      },
      {
        narration:
          "Step two: Look at the UV Editor. The dashed square represents one copy of the image. Drag the handles outward until your selection area is large enough to fit approximately two of those dashed squares inside it.",
        waitForUser: true,
        focusPanel: 'uv-editor',
        successCheck: (state: VamsState) => {
          const obj = withSelected(state);
          if (!obj || !obj.uvs || obj.texture?.wrap !== 'REPEAT') return false;
          
          const u = obj.uvs.map((p) => p.u);
          const v = obj.uvs.map((p) => p.v);
          
          // Calculate the span (width and height) of the UV coordinates
          const spanU = Math.max(...u) - Math.min(...u);
          const spanV = Math.max(...v) - Math.min(...v);
          
          const tol = 0.35; // Generous tolerance for manual dragging
          
          // As long as the UV box is roughly 2.0 units wide and 2.0 units tall, 
          // it's a 2x2 grid. It doesn't matter where it is positioned.
          return Math.abs(spanU - 2.0) < tol && Math.abs(spanV - 2.0) < tol;
        },
      },
      {
        narration:
          "Excellent! By making the UV area larger than the image itself, OpenGL automatically tiled the texture to fill the gap. You've mastered the fundamentals of texturing!",
        waitForUser: true,
      },
    ],
  },
};