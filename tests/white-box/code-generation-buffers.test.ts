/**
 * WHITE-BOX TEST SUITE — WB-GEN-BUF (extension of WB-GEN)
 * Covers the VERTEX_ARRAY and VBO rendering-mode emission paths and the
 * texture-init emission path. These paths are required by Table 13 row 5
 * (Code Generation Service) but are not exercised by IMMEDIATE-mode tests.
 */
import { describe, it, expect } from 'vitest';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { addQuad, getState } from '../helpers/store';
import { useVamsStore } from '@/core/store';
import type { TextureAsset } from '@/core/types/textures';

const CANVAS = { width: 640, height: 480 };
const gen = () => {
  const s = getState();
  return generateCodeFromState(
    {
      objects: s.objects,
      canvasBackgroundColor: s.canvasBackgroundColor,
      callbacks: s.callbacks,
      viewportLimits: s.viewportLimits,
      textures: s.uploadedTextures,
    },
    CANVAS,
  );
};

describe('WB-GEN-BUF-01: VERTEX_ARRAY mode emits glDrawArrays', () => {
  it('switches the body from glBegin/glEnd to glEnableClientState + glDrawArrays', () => {
    const t = addQuad();
    getState().updateRenderingMode(t.id, 'VERTEX_ARRAY');
    const code = gen();
    expect(code).toContain('glEnableClientState');
    expect(code).toContain('glVertexPointer');
    expect(code).toContain('glColorPointer');
    expect(code).toContain('glDrawArrays(GL_QUADS');
  });
});

describe('WB-GEN-BUF-02: VBO mode emits glGenBuffers / glBufferData', () => {
  it('emits buffer object setup in init() and bind/draw in the draw body', () => {
    const t = addQuad();
    getState().updateRenderingMode(t.id, 'VBO');
    getState().updateBufferUsage(t.id, 'STATIC');
    const code = gen();
    expect(code).toContain('glGenBuffers');
    expect(code).toContain('glBufferData');
    expect(code).toContain('GL_STATIC_DRAW');
    expect(code).toContain('glBindBuffer');
  });
});

describe('WB-GEN-BUF-03: VBO + DYNAMIC usage generates update_buffers()', () => {
  it('emits update_buffers() and glutIdleFunc(_vams_idle)', () => {
    const t = addQuad();
    getState().updateRenderingMode(t.id, 'VBO');
    getState().updateBufferUsage(t.id, 'DYNAMIC');
    const code = gen();
    expect(code).toContain('void update_buffers()');
    expect(code).toContain('glutIdleFunc(_vams_idle)');
    expect(code).toContain('GL_DYNAMIC_DRAW');
  });
});

describe('WB-GEN-BUF-04: STREAM usage maps to GL_STREAM_DRAW', () => {
  it('emits GL_STREAM_DRAW for STREAM-marked objects', () => {
    const t = addQuad();
    getState().updateRenderingMode(t.id, 'VBO');
    getState().updateBufferUsage(t.id, 'STREAM');
    expect(gen()).toContain('GL_STREAM_DRAW');
  });
});

describe('WB-GEN-BUF-05: useIndexed switches to glDrawElements', () => {
  it('emits an index buffer and draws via glDrawElements', () => {
    const t = addQuad();
    getState().updateRenderingMode(t.id, 'VERTEX_ARRAY');
    getState().updateUseIndexed(t.id, true);
    const code = gen();
    expect(code).toContain('glDrawElements');
  });
});

describe('WB-GEN-BUF-06: Texture attachments emit STB_IMAGE include + bind/enable', () => {
  it('emits the texture-init body when a texture is attached', () => {
    const t = addQuad();
    // Prepare a fake texture
    const tex: TextureAsset = {
      id: 'tex-1', name: 'sample', dataUrl: 'data:image/png;base64,iVBORw==',
      width: 4, height: 4, isSample: false,
    };
    useVamsStore.setState({ uploadedTextures: [tex] });
    getState().attachTexture(t.id, tex.id);
    const code = gen();
    expect(code).toContain('STB_IMAGE_IMPLEMENTATION');
    expect(code).toContain('stb_image.h');
    expect(code).toContain('glEnable(GL_TEXTURE_2D)');
    expect(code).toContain('glBindTexture(GL_TEXTURE_2D');
    expect(code).toContain('glTexCoord2f(');
  });

  it('NEAREST filter, CLAMP_TO_EDGE wrap appear in glTexParameteri calls', () => {
    const t = addQuad();
    const tex: TextureAsset = {
      id: 'tex-2', name: 'sample2', dataUrl: 'data:image/png;base64,iVBORw==',
      width: 4, height: 4, isSample: false,
    };
    useVamsStore.setState({ uploadedTextures: [tex] });
    getState().attachTexture(t.id, tex.id);
    getState().updateTextureFilter(t.id, 'NEAREST');
    getState().updateTextureWrap(t.id, 'CLAMP_TO_EDGE');
    const code = gen();
    expect(code).toContain('GL_NEAREST');
    expect(code).toContain('GL_CLAMP_TO_EDGE');
  });
});

describe('WB-GEN-BUF-07: Stipple emission in the draw body', () => {
  it('emits glEnable(GL_LINE_STIPPLE) and glLineStipple with hex pattern', () => {
    getState().addCustomObject('LINE_STRIP', [
      { x: 0, y: 0 }, { x: 0.3, y: 0.3 }, { x: 0.6, y: 0.0 },
    ]);
    const id = getState().objects[0].id;
    getState().updateLineStipple(id, { factor: 2, pattern: 0xAAAA });
    const code = gen();
    expect(code).toContain('glEnable(GL_LINE_STIPPLE)');
    expect(code).toContain('glLineStipple(2, 0xAAAA)');
    expect(code).toContain('glDisable(GL_LINE_STIPPLE)');
  });
});
