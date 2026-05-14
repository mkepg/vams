/**
 * BLACK-BOX TEST SUITE — BB-HIER
 * Maps to Table 12, row 3: Scene Graph Hierarchy
 *
 * Test focus:
 *  - Parent-child relationships are retained
 *  - Multi-level hierarchies behave consistently
 *  - Orphan handling on parent deletion
 *  - Create-Group / Ungroup
 */
import { describe, it, expect } from 'vitest';
import { addTriangle, addQuad, getState } from '../helpers/store';

describe('BB-HIER-01: createGroup wires parent/child relationships', () => {
  it('groups two siblings under a new GROUP node', () => {
    const a = addTriangle(0.1, 0.0, 0.05);
    const b = addQuad(0.3, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    expect(group).toBeDefined();
    expect(group.children).toHaveLength(2);
    expect(group.children).toEqual(expect.arrayContaining([a.id, b.id]));

    const aChild = getState().objects.find((o) => o.id === a.id)!;
    const bChild = getState().objects.find((o) => o.id === b.id)!;
    expect(aChild.parentId).toBe(group.id);
    expect(bChild.parentId).toBe(group.id);
  });

  it('does not group when fewer than 2 siblings are supplied', () => {
    const a = addTriangle();
    getState().createGroup([a.id]);
    expect(getState().objects.some((o) => o.type === 'GROUP')).toBe(false);
  });
});

describe('BB-HIER-02: Multi-level hierarchy nesting', () => {
  it('groups can be nested via reorderObject(inside)', () => {
    const a = addTriangle(0.0, 0.0, 0.05);
    const b = addQuad(0.2, 0.0, 0.05);
    const c = addTriangle(0.4, 0.0, 0.05);
    const d = addQuad(0.6, 0.0, 0.05);
    getState().createGroup([a.id, b.id]); // inner group
    const inner = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().createGroup([inner.id, c.id, d.id]); // outer group
    const outer = getState().objects.filter((o) => o.type === 'GROUP')
      .find((g) => g.children?.includes(inner.id))!;
    expect(outer).toBeDefined();
    expect(outer.children).toEqual(expect.arrayContaining([inner.id]));
    expect(getState().objects.find((o) => o.id === inner.id)!.parentId).toBe(outer.id);
  });
});

describe('BB-HIER-03: Deleting a GROUP cascades to children (no orphans)', () => {
  it('deleteGroup removes the group AND all its descendants', () => {
    const a = addTriangle(0.0, 0.0, 0.05);
    const b = addQuad(0.2, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().deleteGroup(group.id);
    expect(getState().objects.find((o) => o.id === a.id)).toBeUndefined();
    expect(getState().objects.find((o) => o.id === b.id)).toBeUndefined();
    expect(getState().objects.find((o) => o.id === group.id)).toBeUndefined();
  });
});

describe('BB-HIER-04: Ungroup re-parents children to the grandparent', () => {
  it('ungrouped children appear at the same scope as the former group', () => {
    const a = addTriangle(0.0, 0.0, 0.05);
    const b = addQuad(0.2, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().ungroup(group.id);
    expect(getState().objects.find((o) => o.id === group.id)).toBeUndefined();
    expect(getState().objects.find((o) => o.id === a.id)!.parentId).toBeNull();
    expect(getState().objects.find((o) => o.id === b.id)!.parentId).toBeNull();
  });
});

describe('BB-HIER-05: Visibility propagates through GROUP nodes', () => {
  it('hiding a group hides its descendants', () => {
    const a = addTriangle(0.0, 0.0, 0.05);
    const b = addQuad(0.2, 0.0, 0.05);
    getState().createGroup([a.id, b.id]);
    const group = getState().objects.find((o) => o.type === 'GROUP')!;
    getState().toggleObjectVisibility(group.id);
    expect(getState().objects.find((o) => o.id === a.id)!.visible).toBe(false);
    expect(getState().objects.find((o) => o.id === b.id)!.visible).toBe(false);
    expect(getState().objects.find((o) => o.id === group.id)!.visible).toBe(false);
  });
});
