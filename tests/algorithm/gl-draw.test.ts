/**
 * ALGORITHM TEST SUITE — ALG-RUN
 * The editor's Run view draws through gl-draw.ts, which must make the same GL calls, in the same
 * order and with the same values, as the C++ the code generator writes for the scene. Each test runs
 * the generated display() through a small interpreter of the generator's own output and compares
 * its calls with gl-draw's, both recorded on a stub GLContext.
 */
import { describe, expect, it } from 'vitest';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import type { CallbacksState, SceneNode } from '@/core/types/scene';
import { GALLERY_BUILDERS, GALLERY_VIEW } from '@/entities/project/model/gallery-scenes';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { drawDisplay, type GlScene } from '@/features/code-generation/model/gl-draw';
import { GL, type GLContext } from '@/shared/lib/gl-raster';
import { GLUT_FONTS, glutBitmapCharacter } from '@/shared/lib/glut-fonts';
import { FIDELITY_SCENES } from '../fixtures/fidelity/scenes';

type Call = [string, ...unknown[]];

/** A GLContext that records every call it is given, and does nothing else. */
function recorder(): { gl: GLContext; calls: Call[] } {
  const calls: Call[] = [];
  const gl = new Proxy({} as Record<string, unknown>, {
    get: (_t, name: string) => (...args: unknown[]) => {
      calls.push([name, ...args.map((a) => (a instanceof Uint8Array ? Array.from(a) : a))]);
    },
  }) as unknown as GLContext;
  return { gl, calls };
}

const NO_CALLBACKS: CallbacksState = emptyCallbacks();

/**
 * Runs the generated program's main() glClearColor and display() on `gl`: straight-line GL calls,
 * draw_ and draw() calls, the visibility and colour guards (every state starts visible with its own
 * colours), the bitmap text loop, and client arrays and buffer objects, which draw as glBegin/glEnd
 * would with the arrays' values.
 */
function runGenerated(code: string, gl: GLContext): void {
  const fns = new Map<string, string[]>();
  for (const m of code.matchAll(/^void (\w+)\(\)\n\{\n([\s\S]*?)\n\}$/gm)) fns.set(m[1], m[2].split('\n'));
  const arrays = new Map<string, number[]>();
  for (const m of code.matchAll(/^(?:GLfloat|GLuint) (\w+)\[\] = \{ ([^}]*) \};$/gm)) arrays.set(m[1], m[2].split(',').map((s) => Number(s.trim().replace(/f$/, ''))));
  const state = new Map<string, Record<string, number>>();
  for (const m of code.matchAll(/^ObjectState (state_\w+) = \{ ([^}]*) \};$/gm)) {
    const v = m[2].split(',').map((s) => s.trim());
    state.set(m[1], { x: Math.fround(Number(v[0].replace(/f$/, ''))), y: Math.fround(Number(v[1].replace(/f$/, ''))), rotation: Math.fround(Number(v[2].replace(/f$/, ''))), scaleX: Math.fround(Number(v[3].replace(/f$/, ''))), scaleY: Math.fround(Number(v[4].replace(/f$/, ''))) });
  }
  const floats = new Map<string, number>();
  for (const m of code.matchAll(/^float (.*);$/gm)) {
    for (const decl of m[1].split(',')) {
      const [name, value] = decl.split('=').map((t) => t.trim());
      floats.set(name, Math.fround(Number(value.replace(/f$/, ''))));
    }
  }
  const glEnum = (s: string) => {
    const name = s.replace(/^GL_/, '');
    if (!(name in GL)) throw new Error(`unknown enum ${s}`);
    return (GL as unknown as Record<string, number>)[name];
  };
  const arg = (s: string): unknown => {
    s = s.trim();
    if (/^GL_/.test(s)) return glEnum(s);
    if (/^0x[0-9A-Fa-f]+$/.test(s)) return parseInt(s, 16);
    const field = /^(state_\w+)\.(\w+)$/.exec(s);
    if (field) return state.get(field[1])![field[2]];
    if (floats.has(s)) return floats.get(s);
    if (/^tex_/.test(s)) return s;
    if (/f$/.test(s)) return Math.fround(Number(s.slice(0, -1)));
    if (!Number.isNaN(Number(s))) return Number(s);
    return s;
  };
  const client = { vertex: '', color: '', tex: '', colorOn: false, texOn: false };
  const drawArrays = (mode: number, indices: number[]) => {
    const verts = arrays.get(client.vertex)!;
    const colors = arrays.get(client.color)!;
    const uvs = client.texOn ? arrays.get(client.tex)! : null;
    gl.begin(mode);
    for (const i of indices) {
      if (client.colorOn) gl.color3f(Math.fround(colors[i * 3]), Math.fround(colors[i * 3 + 1]), Math.fround(colors[i * 3 + 2]));
      if (uvs) gl.texCoord2f(Math.fround(uvs[i * 2]), Math.fround(uvs[i * 2 + 1]));
      gl.vertex2f(Math.fround(verts[i * 2]), Math.fround(verts[i * 2 + 1]));
    }
    gl.end();
  };
  const bound = new Map<number, string>();
  let textLine = '';
  const run = (name: string) => {
    for (let line of fns.get(name)!) {
      line = line.trim();
      if (!line || line.startsWith('//') || line === '{' || line === '}') continue;
      if (/^if \(!state_\w+\.useColor\) /.test(line)) line = line.replace(/^if \(!state_\w+\.useColor\) /, '');
      else if (/^if \(state_\w+\.useColor\) /.test(line)) continue;
      else if (line.startsWith('else ')) line = line.slice(5);
      if (/^if \(state_\w+\.visible\) \{$/.test(line)) continue;
      line = line.replace(/^if \(state_\w+\.visible\) /, '');
      const text = /^const char\* textLine = "(.*)";$/.exec(line);
      if (text) {
        textLine = text[1].replace(/\\(.)/g, '$1');
        continue;
      }
      if (line.startsWith('for (const char* c = textLine')) {
        for (let k = 0; k < textLine.length; k++) glutBitmapCharacter(gl, GLUT_FONTS.GLUT_BITMAP_9_BY_15, textLine.charCodeAt(k));
        continue;
      }
      if (line.startsWith('glutBitmapCharacter')) continue;
      const callName = /^(\w+)\(\);/.exec(line);
      if (callName && fns.has(callName[1])) {
        run(callName[1]);
        continue;
      }
      if (line === 'glutSwapBuffers();') return;
      const call = /^(gl\w+)\((.*)\);/.exec(line);
      if (!call) throw new Error(`can't run: ${line}`);
      const args = call[2] ? call[2].split(',').map(arg) : [];
      switch (call[1]) {
        case 'glEnableClientState':
        case 'glDisableClientState': {
          const on = call[1] === 'glEnableClientState';
          if (args[0] === GL.COLOR_ARRAY) client.colorOn = on;
          if (args[0] === GL.TEXTURE_COORD_ARRAY) client.texOn = on;
          continue;
        }
        case 'glBindBuffer':
          bound.set(args[0] as number, String(call[2].split(',')[1].trim()));
          continue;
        case 'glVertexPointer':
        case 'glColorPointer':
        case 'glTexCoordPointer': {
          const source = String(args[3]) === '0' ? bound.get(GL.ARRAY_BUFFER)!.replace(/^(vbo|cbo|uvbo)_/, (_m, k: string) => ({ vbo: 'verts_', cbo: 'colors_', uvbo: 'uvs_' })[k]!) : String(args[3]);
          if (call[1] === 'glVertexPointer') client.vertex = source;
          else if (call[1] === 'glColorPointer') client.color = source;
          else client.tex = source;
          continue;
        }
        case 'glDrawArrays':
          drawArrays(args[0] as number, Array.from({ length: args[2] as number }, (_, i) => i));
          continue;
        case 'glDrawElements': {
          const source = String(args[3]) === '0' ? bound.get(GL.ELEMENT_ARRAY_BUFFER)!.replace(/^ebo_/, 'indices_') : String(args[3]);
          drawArrays(args[0] as number, arrays.get(source)!.slice(0, args[1] as number));
          continue;
        }
        case 'glBindTexture':
          gl.bindTexture(args[0] as number, 'tex' as unknown as number);
          continue;
      }
      const method = call[1][2].toLowerCase() + call[1].slice(3);
      (gl as unknown as Record<string, (...a: unknown[]) => void>)[method](...args);
    }
  };
  const clear = /^ {4}glClearColor\((.*)\);$/m.exec(code)!;
  gl.clearColor(...(clear[1].split(',').map(arg) as [number, number, number, number]));
  run('display');
}

function compare(scene: GlScene) {
  const code = generateCodeFromState(
    { objects: scene.objects, canvasBackgroundColor: scene.canvasBackgroundColor, callbacks: scene.callbacks, viewportLimits: scene.viewportLimits },
    scene.canvasSize,
  );
  const want = recorder();
  runGenerated(code, want.gl);
  const got = recorder();
  const textures = new Map(scene.objects.filter((o) => o.texture).map((o) => [o.id, 'tex' as unknown as number]));
  drawDisplay(got.gl, scene, { state: {}, view: null }, textures);
  expect(got.calls).toEqual(want.calls);
  return got.calls.length;
}

describe('ALG-RUN-01: gl-draw makes the generated display()\'s calls, in order, with its values', () => {
  it.each(FIDELITY_SCENES.filter((s) => !s.gallery).map((s) => [s.id, s] as const))('%s', (_id, s) => {
    const calls = compare({
      objects: s.objects as SceneNode[],
      callbacks: NO_CALLBACKS,
      canvasBackgroundColor: '#000000',
      canvasSize: { width: 500, height: 500 },
    });
    expect(calls).toBeGreaterThan(5);
  });

  it.each(Object.entries(GALLERY_BUILDERS))('gallery %s', (_slug, g) => {
    const calls = compare({
      objects: g.build(),
      callbacks: g.callbacks(),
      canvasBackgroundColor: g.background,
      canvasSize: { width: 800, height: 450 },
      viewportLimits: { ...GALLERY_VIEW },
    });
    expect(calls).toBeGreaterThan(20);
  });
});

describe('ALG-RUN-02: A running scene draws from its state struct, as the program does', () => {
  const scene = (): GlScene => ({
    objects: [FIDELITY_SCENES.find((s) => s.id === 'smooth-triangle')!.objects![0] as SceneNode],
    callbacks: NO_CALLBACKS,
    canvasBackgroundColor: '#000000',
    canvasSize: { width: 500, height: 500 },
  });
  const run = (state: Record<string, unknown>) => {
    const s = scene();
    const { gl, calls } = recorder();
    const id = s.objects[0].id;
    drawDisplay(gl, s, { state: { [id]: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, r: 0, g: 0, b: 0, useColor: false, visible: true, ...state } }, view: null }, new Map());
    return calls;
  };

  it('moves by a state field held as a 32-bit float', () => {
    expect(run({ x: 0.1 }).find(([name]) => name === 'translatef')).toEqual(['translatef', Math.fround(0.1), 0, 0]);
  });

  it('keeps the initializer\'s printed values until a rule moves them', () => {
    expect(run({}).find(([name]) => name === 'translatef')).toEqual(['translatef', 0, 0, 0]);
  });
});
