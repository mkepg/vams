/**
 * WHITE-BOX TEST SUITE — WB-ERR
 * Maps to Table 13, row 7: Error Handling Logic
 *
 * Test focus:
 *  - Defensive coding for null references / undefined properties
 *  - Range checks on numeric inputs
 *  - Edge conditions: empty scenes, single-vertex shapes, deeply nested
 *    groups, very long callback names
 *  - Failure scenarios must not crash the application
 */
import { describe, it, expect } from 'vitest';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { sanitizeProjectData } from '@/entities/project/model/project-io';
import { getState, addTriangle, addQuad } from '../helpers/store';

const CANVAS = { width: 800, height: 600 };
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

describe('WB-ERR-01: Empty-scene code generation does not crash', () => {
  it('emits a complete main() with an Empty-scene comment', () => {
    const code = gen();
    expect(code).toContain('// Empty scene');
    expect(code).toContain('int main(');
  });
});

describe('WB-ERR-02: Operations on unknown ids are no-ops', () => {
  it('deleteObject on a non-existent id leaves the scene alone', () => {
    const a = addTriangle();
    const before = JSON.stringify(getState().objects);
    getState().deleteObject('ghost-id');
    expect(JSON.stringify(getState().objects)).toBe(before);
    expect(a).toBeDefined();
  });

  it('updateObjectTransform on a non-existent id leaves the scene alone', () => {
    addTriangle();
    const before = JSON.stringify(getState().objects);
    getState().updateObjectTransform('ghost-id', { rotate: 90 });
    expect(JSON.stringify(getState().objects)).toBe(before);
  });

  it('updateVertexPosition on a non-existent vertex is a no-op', () => {
    const t = addTriangle();
    const before = JSON.stringify(getState().objects);
    getState().updateVertexPosition(t.id, 'ghost-vertex', 9, 9);
    expect(JSON.stringify(getState().objects)).toBe(before);
  });
});

describe('WB-ERR-03: Single-vertex shape still renders', () => {
  it('a POINTS object with one vertex generates code without errors', () => {
    getState().addCustomObject('POINTS', [{ x: 0, y: 0 }]);
    expect(() => gen()).not.toThrow();
    const code = gen();
    expect(code).toContain('glBegin(GL_POINTS)');
  });
});

describe('WB-ERR-04: Deeply nested groups (10 levels)', () => {
  it('does not stack-overflow or hang', () => {
    addTriangle(0, 0, 0.02);
    for (let i = 0; i < 10; i++) {
      addTriangle(0.05 * i, 0, 0.02);
    }
    // Build groups iteratively
    let ids = getState().objects.map((o) => o.id);
    for (let depth = 0; depth < 9; depth++) {
      // Group all currently-root objects into a fresh group; repeat.
      getState().createGroup(ids.slice(0, Math.min(2, ids.length)));
      // After group creation, all root objects = remaining + new group.
      ids = getState().objects.filter((o) => !o.parentId).map((o) => o.id);
      if (ids.length < 2) break;
    }
    expect(() => gen()).not.toThrow();
  });
});

describe('WB-ERR-05: Very long callback handler names are accepted', () => {
  it('handlers up to 256 chars are emitted verbatim', () => {
    addTriangle();
    const handler = 'kb_' + 'x'.repeat(200);
    getState().setCallbackHandler('keyboard', handler);
    expect(() => gen()).not.toThrow();
    expect(gen()).toContain(handler);
  });
});

describe('WB-ERR-06: Range checks reject NaN / Infinity transforms', () => {
  it('a sanitised transform replaces non-finite values with defaults', () => {
    const sanitized = sanitizeProjectData({
      objects: [{
        type: 'TRIANGLES', vertices: [{ x: 0, y: 0 }],
        transform: { translateX: NaN, translateY: Infinity, rotate: -Infinity, scaleX: NaN, scaleY: 1 },
      }],
    });
    const t = sanitized.objects[0].transform;
    expect(t.translateX).toBe(0);
    expect(t.translateY).toBe(0);
    expect(t.rotate).toBe(0);
    expect(t.scaleX).toBe(1);
    expect(t.scaleY).toBe(1);
  });
});

describe('WB-ERR-07: Cycle prevention in reorderObject', () => {
  it('reordering an ancestor into its descendant is rejected', () => {
    const a = addTriangle();
    const b = addQuad(0.3, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    // Try to move the group into one of its children
    getState().reorderObject(group.id, a.id, 'inside');
    expect(getState().objects.find((o) => o.id === group.id)!.parentId).not.toBe(a.id);
  });
});

describe('WB-ERR-08: An invalid project payload yields a valid default project', () => {
  it('null payload, undefined payload, primitive payloads all map to defaults', () => {
    for (const p of [null, undefined, 0, false, 'string', []]) {
      expect(() => sanitizeProjectData(p as unknown)).not.toThrow();
      const s = sanitizeProjectData(p as unknown);
      expect(s.objects).toEqual([]);
    }
  });
});
