/**
 * WHITE-BOX TEST SUITE — ANIM-IDLE
 * Saved single-object animation wired into the generated program's idle loop,
 * plus the transient preview override.
 *
 * Focus:
 *  - The idle body references only real ObjectState fields (compilable).
 *  - A SAVED animation emits a real `animate_<name>()` + `glutIdleFunc`.
 *  - It COMPOSES with a student-registered idle handler (never clobbers).
 *  - The transient preview override reflects in code without persisting.
 *  - Multiple animated objects each get their own animator.
 */
import { describe, it, expect } from 'vitest';
import { generateIdleBody } from '@/features/code-generation/model/generator/idle';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { resolveChangedLines } from '@/features/code-generation/model/code-diff';
import { buildProjectFile } from '@/entities/project/model/project-io';
import { addTriangle, addQuad, getState } from '../helpers/store';

const CANVAS = { width: 800, height: 600 };

function baseInput() {
  const s = getState();
  return {
    objects: s.objects,
    canvasBackgroundColor: s.canvasBackgroundColor,
    callbacks: s.callbacks,
    viewportLimits: s.viewportLimits,
  };
}

describe('ANIM-IDLE-01: the idle body references only real ObjectState fields', () => {
  it('driving lines assign real fields; sine motions use static base locals', () => {
    const real = /state_\w+\.(x|y|rotation|scaleX|scaleY)\b/;
    for (const motion of ['rotate', 'pulse', 'slide', 'orbit'] as const) {
      const body = generateIdleBody(motion, 'Tri 1', 1);
      expect(body.lines.length).toBeGreaterThan(0);
      for (const idx of body.drivingIndices) {
        expect(body.lines[idx]).toMatch(real);
      }
    }
    expect(generateIdleBody('pulse', 'Tri', 1).lines.join('\n')).toContain('static float baseSX_Tri');
    expect(generateIdleBody('slide', 'Tri', 1).lines.join('\n')).toContain('static float baseX_Tri');
    expect(generateIdleBody('pulse', 'Tri', 1).lines.join('\n')).not.toContain('.baseScaleX');
  });
});

describe('ANIM-IDLE-02: a SAVED animation creates a real idle loop', () => {
  it('emits animate_<name>(), calls it from _vams_idle, and registers glutIdleFunc', () => {
    const tri = addTriangle();
    const without = generateCodeFromState(baseInput(), CANVAS);
    expect(without).not.toContain('void _vams_idle()');
    expect(without).not.toContain('glutIdleFunc');

    getState().setObjectAnimation(tri.id, { motion: 'rotate', speed: 1 });
    const name = getState().objects[0].name.replace(/[^a-zA-Z0-9_]/g, '_');
    const withAnim = generateCodeFromState(baseInput(), CANVAS);

    expect(withAnim).toContain(`void animate_${name}()`);
    expect(withAnim).toContain('.rotation += 1.50f;');
    expect(withAnim).toContain('void _vams_idle()');
    expect(withAnim).toContain(`animate_${name}();`);
    expect(withAnim).toContain('glutIdleFunc(_vams_idle);');
  });
});

describe('ANIM-IDLE-03: a saved animation composes with a registered idle handler', () => {
  it('calls both the animator and the student handler, animator first', () => {
    const tri = addTriangle();
    getState().setObjectAnimation(tri.id, { motion: 'slide', speed: 1 });
    getState().setCallbackHandler('idle', 'myAnim');
    const name = getState().objects[0].name.replace(/[^a-zA-Z0-9_]/g, '_');

    const code = generateCodeFromState(baseInput(), CANVAS);
    expect(code).toContain('void myAnim()');

    const idleFn = code.slice(code.indexOf('void _vams_idle()'));
    const body = idleFn.slice(0, idleFn.indexOf('}'));
    expect(body).toContain(`animate_${name}();`);
    expect(body).toContain('myAnim();');
    expect(body.indexOf(`animate_${name}();`)).toBeLessThan(body.indexOf('myAnim();'));
  });
});

describe('ANIM-IDLE-04: the transient preview override reflects in code, never persists', () => {
  it('previewAnimation changes the generated code but not the saved project', () => {
    const tri = addTriangle();
    const savedBefore = JSON.stringify(buildProjectFile(getState() as never).data);

    const base = generateCodeFromState(baseInput(), CANVAS);
    const preview = generateCodeFromState(
      { ...baseInput(), previewAnimation: { objectId: tri.id, motion: 'orbit', speed: 2 } },
      CANVAS,
    );
    const changed = resolveChangedLines(base, preview);

    expect(preview).not.toBe(base);
    expect(changed.length).toBeGreaterThan(0);
    expect(preview).toContain('void animate_');

    // The override never touched scene state.
    const savedAfter = JSON.stringify(buildProjectFile(getState() as never).data);
    expect(savedAfter).toBe(savedBefore);
    expect(getState().objects[0].animation == null).toBe(true);
  });
});

describe('ANIM-IDLE-05: multiple saved animations each get their own animator', () => {
  it('emits one animate_<name>() per animated object, all called from _vams_idle', () => {
    const a = addTriangle();
    const b = addQuad(0.5, 0, 0.1);
    getState().setObjectAnimation(a.id, { motion: 'rotate', speed: 1 });
    getState().setObjectAnimation(b.id, { motion: 'pulse', speed: 2 });

    const code = generateCodeFromState(baseInput(), CANVAS);
    const defs = (code.match(/void animate_\w+\(\)\n\{/g) ?? []).length;
    expect(defs).toBe(2);

    const idleFn = code.slice(code.indexOf('void _vams_idle()'));
    const body = idleFn.slice(0, idleFn.indexOf('}'));
    expect((body.match(/animate_\w+\(\);/g) ?? []).length).toBe(2);
  });
});
