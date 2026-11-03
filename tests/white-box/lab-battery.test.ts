/**
 * WHITE-BOX TEST SUITE — WB-LAB (the Lab's reference battery)
 * The battery programs that come from the editor are the editor's own export: S-1 to S-7 of
 * tests/reports/manual-compile-procedure.md, built through the store, and five gallery scenes,
 * each exported with generateCodeFromState at 500 × 500. Their reference images were captured
 * from these files, so a changed export means recapturing them.
 *
 * Rewrite the programs and their images with LAB_EXPORT=1, then recapture the references with
 * scripts/lab/capture-reference.mjs.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { getPreset } from '@/entities/project/model/scene-presets';
import { FOX_PALETTE, FOX_SPRITE, SAMPLE_TEXTURE_SPECS } from '@/features/textures/lib/sample-textures';
import { encodePng } from '../helpers/image-compare';
import { addPrimitive, addQuad, addTriangle, getState, setState } from '../helpers/store';

const PROGRAMS = resolve('tests/fixtures/lab/programs');
const SIZE = { width: 500, height: 500 };
const EXPORT = process.env.LAB_EXPORT === '1';

/** The export as a battery file: CRLF, and images read from the folder the program runs in. */
function asProgram(cpp: string): string {
  return cpp.replaceAll('C:\\\\path\\\\to\\\\your\\\\', '').replace(/\r?\n/g, '\r\n');
}

function exportScene(): string {
  const s = getState();
  return generateCodeFromState(
    { objects: s.objects, canvasBackgroundColor: s.canvasBackgroundColor, callbacks: s.callbacks, viewportLimits: s.viewportLimits, textures: s.uploadedTextures },
    SIZE,
  );
}

function colour(id: string, colours: string[]) {
  const o = getState().objects.find((x) => x.id === id)!;
  o.vertices.forEach((v, i) => getState().updateVertexColor(id, v.id, colours[i % colours.length]));
}

/** Checks a battery file against what it should hold, or writes it under LAB_EXPORT. */
function expectFile(name: string, bytes: Uint8Array | string) {
  const path = join(PROGRAMS, name);
  if (EXPORT) writeFileSync(path, bytes);
  expect(existsSync(path), `${name} is missing: run with LAB_EXPORT=1`).toBe(true);
  const want = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  expect(readFileSync(path).equals(want), `${name} differs from the export: run with LAB_EXPORT=1 and recapture`).toBe(true);
}

const RGB = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

/** S-1 to S-7, as the manual compile procedure describes them. */
const SCENES: [string, () => void][] = [
  ['s1-triangle', () => {
    colour(addTriangle().id, RGB);
  }],
  ['s2-two-quads', () => {
    colour(addQuad(-0.45, 0, 0.3).id, ['#ff8800']);
    colour(addQuad(0.45, 0, 0.3).id, ['#3366ff']);
    getState().setCallbackHandler('mouse', 'onMouse');
  }],
  ['s3-group-with-text', () => {
    const tri = addTriangle(-0.25, 0, 0.25);
    const quad = addQuad(0.3, 0, 0.2);
    colour(tri.id, ['#ff8800']);
    colour(quad.id, ['#3366ff']);
    getState().createGroup([tri.id, quad.id]);
    const inner = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().updateObjectTransform(inner.id, { rotate: 45 });
    getState().addTextObject('Hello', -0.2, 0.6);
    getState().createGroup([inner.id, getState().objects[0].id]);
  }],
  ['s4-stippled-strip', () => {
    const strip = addPrimitive('LINE_STRIP', [{ x: -0.8, y: 0.6 }, { x: 0.8, y: 0.6 }, { x: 0.6, y: -0.2 }, { x: -0.8, y: -0.6 }]);
    getState().updateLineStipple(strip.id, { factor: 2, pattern: 0xaaaa });
    getState().updateLineWidth(strip.id, 4.5);
  }],
  ['s5-dynamic-vbo', () => {
    const tri = addTriangle();
    colour(tri.id, RGB);
    getState().updateRenderingMode(tri.id, 'VBO');
    getState().updateBufferUsage(tri.id, 'DYNAMIC');
  }],
  ['s6-textured-quad', () => {
    const png = readFileSync(join(PROGRAMS, 'checkerboard.png'));
    getState().addUploadedTexture({ id: 'tex-checkerboard', name: 'checkerboard', dataUrl: `data:image/png;base64,${png.toString('base64')}`, width: 8, height: 8 });
    getState().attachTexture(addQuad(0, 0, 0.5).id, 'tex-checkerboard');
  }],
  ['s7-indexed-strip', () => {
    const strip = addPrimitive('TRIANGLE_STRIP', [
      { x: -0.6, y: -0.3 }, { x: -0.6, y: 0.3 }, { x: 0, y: -0.3 }, { x: 0, y: 0.3 }, { x: 0.6, y: -0.3 }, { x: 0.6, y: 0.3 },
    ]);
    colour(strip.id, RGB);
    getState().updateRenderingMode(strip.id, 'VERTEX_ARRAY');
    getState().updateUseIndexed(strip.id, true);
  }],
];

const GALLERY = ['jeepney-street', 'solar-system', 'parol', 'clock', 'pixel-fox'];

/** The pixel fox sample as the editor draws it: each sprite character a 4 × 4 px square. */
function pixelFox(): Uint8Array {
  const size = 64;
  const cell = size / FOX_SPRITE.length;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hex = FOX_PALETTE[FOX_SPRITE[Math.floor(y / cell)][Math.floor(x / cell)]];
      data.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], (y * size + x) * 4);
    }
  }
  return encodePng({ width: size, height: size, data });
}

describe('WB-LAB-19: The battery programs from the editor are its export of their scenes', () => {
  // The test setup keeps uploaded textures between tests; each scene starts with none.
  beforeEach(() => setState({ uploadedTextures: [] }));

  it.each(SCENES)('%s', (name, build) => {
    build();
    expectFile(`${name}.cpp`, asProgram(exportScene()));
  });

  it.each(GALLERY)('gallery-%s, with the images it loads', (slug) => {
    const data = getPreset(slug)!.data;
    const samples = SAMPLE_TEXTURE_SPECS.map((s) => ({ ...s, dataUrl: '', isSample: true }));
    const cpp = generateCodeFromState(
      { objects: data.objects, canvasBackgroundColor: data.canvasBackgroundColor, callbacks: data.callbacks, viewportLimits: data.viewportLimits, textures: [...data.uploadedTextures, ...samples] },
      SIZE,
    );
    expectFile(`gallery-${slug}.cpp`, asProgram(cpp));
    for (const [, name] of cpp.matchAll(/stbi_load\("(?:C:\\\\path\\\\to\\\\your\\\\)?([^"]+)\.png"/g)) {
      const uploaded = data.uploadedTextures.find((t) => t.name === name);
      if (uploaded) expectFile(`${name}.png`, Buffer.from(uploaded.dataUrl.slice(uploaded.dataUrl.indexOf(',') + 1), 'base64'));
      else if (name === 'Pixel fox') expectFile(`${name}.png`, pixelFox());
      else throw new Error(`gallery-${slug} loads ${name}.png, which the battery doesn't make.`);
    }
  });
});
