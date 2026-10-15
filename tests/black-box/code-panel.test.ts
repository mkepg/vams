/**
 * BLACK-BOX TEST SUITE — BB-CODE
 * The code panel: folding that follows the selection, changed values, Find, the explanation strip and notes.
 */
import { describe, it, expect } from 'vitest';
import { useVamsStore } from '@/core/store';
import { addTriangle, addQuad, getState } from '../helpers/store';

describe('BB-CODE-01: The code panel state starts calm and is never saved', () => {
  it('opens no folds, explains nothing, shows notes and follows vertex 1', () => {
    const s = getState();
    expect(s.codeFoldsOpened).toEqual([]);
    expect(s.explainedLine).toBeNull();
    expect(s.codeNotes).toBe(true);
    expect(s.journeyVertex).toBe(0);
    s.toggleCodeFold('main');
    expect(getState().codeFoldsOpened).toEqual(['main']);
    getState().toggleCodeFold('main');
    expect(getState().codeFoldsOpened).toEqual([]);
    getState().setExplainedLine(12);
    getState().setCodeNotes(false);
    getState().setJourneyVertex(2);
    expect([getState().explainedLine, getState().codeNotes, getState().journeyVertex]).toEqual([12, false, 2]);
    const options = (useVamsStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => object } } }).persist.getOptions();
    const saved = Object.keys(options.partialize(getState()));
    for (const key of ['codeFoldsOpened', 'explainedLine', 'codeNotes', 'journeyVertex']) expect(saved).not.toContain(key);
  });
});

describe('BB-CODE-02: A new selection closes the old object\'s folds and strip and follows vertex 1', () => {
  const dirty = () => {
    getState().toggleCodeFold('main');
    getState().setExplainedLine(5);
    getState().setJourneyVertex(2);
  };
  const isReset = () => {
    const s = getState();
    return s.codeFoldsOpened.length === 0 && s.explainedLine === null && s.journeyVertex === 0;
  };

  it('resets on selectObject, on a new shape, on delete and on undo', () => {
    const tri = addTriangle();
    const quad = addQuad(0.5, 0.5, 0.2);
    getState().selectObject(tri.id);
    dirty();
    getState().selectObject(quad.id);
    expect(isReset()).toBe(true);
    dirty();
    getState().deleteObject(quad.id);
    expect(isReset()).toBe(true);
    getState().selectObject(tri.id);
    dirty();
    addTriangle(-0.5, -0.5, 0.2);
    expect(isReset()).toBe(true);
    dirty();
    getState().undo();
    expect(isReset()).toBe(true);
  });

  it('keeps them while the selection stays the same', () => {
    const tri = addTriangle();
    getState().selectObject(tri.id);
    dirty();
    getState().updateObjectTransform(tri.id, { translateX: 0.4 });
    getState().selectObject(tri.id);
    expect(getState().codeFoldsOpened).toEqual(['main']);
    expect(getState().explainedLine).toBe(5);
    expect(getState().journeyVertex).toBe(2);
  });
});
