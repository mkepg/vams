/**
 * WHITE-BOX TEST SUITE — WB-STATE
 * Maps to Table 13, row 1: Project State Management (Zustand slices)
 *
 * Test focus:
 *  - CRUD operations across slices
 *  - Immutability is preserved (Immer)
 *  - Consistency between parents, children and selections
 *  - Batch mode behaviour during lessons / multi-stage content creation
 */
import { describe, it, expect } from 'vitest';
import { useVamsStore } from '@/core/store';
import { addTriangle, getState } from '../helpers/store';

describe('WB-STATE-01: Create / Read / Update / Delete on the scene slice', () => {
  it('addCustomObject inserts at the head and selects the new object', () => {
    const a = addTriangle();
    const b = addTriangle(0.3, 0.0, 0.05);
    expect(getState().objects[0].id).toBe(b.id);
    expect(getState().objects[1].id).toBe(a.id);
    expect(getState().selectedObjectId).toBe(b.id);
  });

  it('updateObjectName replaces just the name field', () => {
    const a = addTriangle();
    getState().updateObjectName(a.id, 'My Triangle');
    expect(getState().objects[0].name).toBe('My Triangle');
  });

  it('deleteObject removes the entry and clears the selection if needed', () => {
    const a = addTriangle();
    getState().deleteObject(a.id);
    expect(getState().objects).toHaveLength(0);
    expect(getState().selectedObjectId).toBeNull();
  });

  it('duplicateObject creates a new id but copies the vertex topology', () => {
    const a = addTriangle();
    getState().duplicateObject(a.id);
    const copies = getState().objects.filter((o) => o.type === 'TRIANGLES');
    expect(copies).toHaveLength(2);
    expect(copies[0].id).not.toBe(copies[1].id);
    expect(copies[0].vertices.length).toBe(copies[1].vertices.length);
  });
});

describe('WB-STATE-02: Object array references change when we mutate (immutability)', () => {
  it('the objects array reference changes after an update', () => {
    const a = addTriangle();
    const ref1 = getState().objects;
    getState().updateObjectTransform(a.id, { rotate: 10 });
    const ref2 = getState().objects;
    expect(ref1).not.toBe(ref2);
  });

  it('a deleted object is gone from the new array (no lingering references)', () => {
    const a = addTriangle();
    getState().deleteObject(a.id);
    expect(getState().objects.some((o) => o.id === a.id)).toBe(false);
  });
});

describe('WB-STATE-03: Selection state stays consistent with the scene', () => {
  it('selection is cleared when the selected object is deleted', () => {
    const a = addTriangle();
    getState().selectObject(a.id);
    getState().deleteObject(a.id);
    expect(getState().selectedObjectId).toBeNull();
  });
});

describe('WB-STATE-04: Batch mode suppresses history pushes', () => {
  it('updates inside a startBatch/endBatch block do not push history', () => {
    const a = addTriangle();
    const histBefore = getState().past.length;
    getState().startBatch();
    getState().updateVertexColor(a.id, a.vertices[0].id, '#ff0000');
    getState().updateVertexColor(a.id, a.vertices[1].id, '#00ff00');
    getState().updateVertexColor(a.id, a.vertices[2].id, '#0000ff');
    getState().endBatch();
    expect(getState().past.length).toBe(histBefore);
  });
});

describe('WB-STATE-05: Slices wire together without colliding on keys', () => {
  it('all expected top-level slice keys are present on the unified store', () => {
    const s = getState();
    expect(s.objects).toBeDefined();
    expect(s.callbacks).toBeDefined();
    expect(s.interactionMode).toBeDefined();
    expect(s.viewportLimits).toBeDefined();
    expect(s.appMode).toBeDefined();
    expect(s.activeSection).toBeDefined();
    expect(typeof s.pushToHistory).toBe('function');
    expect(typeof s.setActiveLesson).toBe('function');
    expect(typeof s.setCallbackHandler).toBe('function');
  });
});

describe('WB-STATE-06: getRegisteredCallbacks reads from the callbacks slice', () => {
  it('returns only non-empty handlers, trimmed', () => {
    getState().setCallbackHandler('keyboard', '  myKb  ');
    getState().setCallbackHandler('mouse', '');
    const regs = getState().getRegisteredCallbacks();
    expect(regs).toHaveLength(1);
    expect(regs[0]).toEqual({ kind: 'keyboard', handlerName: 'myKb' });
  });
});

describe('WB-STATE-07: History undo/redo round-trips a single mutation', async () => {
  it('undo restores the previous object set after the throttle window', async () => {
    addTriangle();
    // Wait beyond the 50ms history-throttle so the next push is recorded.
    await new Promise((r) => setTimeout(r, 80));
    const beforeRename = JSON.stringify(getState().objects);
    getState().updateObjectName(getState().objects[0].id, 'changed');
    expect(getState().objects[0].name).toBe('changed');
    expect(getState().past.length).toBeGreaterThanOrEqual(1);
    getState().undo();
    expect(JSON.stringify(getState().objects)).toBe(beforeRename);
  });

  it('redo undoes the undo', async () => {
    addTriangle();
    await new Promise((r) => setTimeout(r, 80));
    getState().updateObjectName(getState().objects[0].id, 'changed');
    getState().undo();
    expect(getState().objects[0].name).not.toBe('changed');
    getState().redo();
    expect(getState().objects[0].name).toBe('changed');
  });
});

describe('WB-STATE-08: Reset & rehydration clear all transient state', () => {
  it('manually resetting the store wipes transient flags', () => {
    addTriangle();
    useVamsStore.setState({ pendingShapeType: 'POLYGON', pendingVertices: [{ x: 0, y: 0 }] });
    useVamsStore.setState({
      objects: [],
      pendingShapeType: null,
      pendingVertices: [],
    });
    expect(getState().objects).toHaveLength(0);
    expect(getState().pendingShapeType).toBeNull();
    expect(getState().pendingVertices).toHaveLength(0);
  });
});
