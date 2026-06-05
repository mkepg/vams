/**
 * BLACK-BOX TEST SUITE — ANIM-SAVE
 * Saved single-object animation: it persists in the project file, survives a
 * save → JSON → load round-trip, tolerates legacy/invalid payloads, and is
 * removable. This is the data-model side of the "animation is now savable"
 * change (consistent with §1.5: projects are saved as .vams JSON files).
 */
import { describe, it, expect } from 'vitest';
import {
  buildProjectFile,
  sanitizeProjectData,
  toStorePatchFromProject,
} from '@/entities/project/model/project-io';
import { useVamsStore } from '@/core/store';
import { addTriangle, getState } from '../helpers/store';

describe('ANIM-SAVE-01: a saved animation round-trips through save → JSON → load', () => {
  it('reconstructs the object animation exactly', () => {
    const t = addTriangle();
    getState().setObjectAnimation(t.id, { motion: 'orbit', speed: 2 });

    const file = buildProjectFile(getState() as never);
    const parsed = JSON.parse(JSON.stringify(file));
    const sanitized = sanitizeProjectData(parsed.data);

    useVamsStore.setState({ objects: [] });
    useVamsStore.setState(toStorePatchFromProject(sanitized));

    const loaded = getState().objects.find((o) => o.id === t.id);
    expect(loaded?.animation).toEqual({ motion: 'orbit', speed: 2 });
  });
});

describe('ANIM-SAVE-02: setObjectAnimation writes and clears the descriptor', () => {
  it('saves, then removes, leaving no animation', () => {
    const t = addTriangle();
    getState().setObjectAnimation(t.id, { motion: 'pulse', speed: 0.5 });
    expect(getState().objects[0].animation).toEqual({ motion: 'pulse', speed: 0.5 });

    getState().setObjectAnimation(t.id, null);
    expect(getState().objects[0].animation).toBeNull();
  });

  it('participates in undo/redo via history', () => {
    const t = addTriangle();
    // Isolate from the creation push so the 50 ms history throttle doesn't
    // merge the two operations into one undo step.
    getState().clearHistory();
    getState().setObjectAnimation(t.id, { motion: 'rotate', speed: 1 });
    getState().undo();
    expect(getState().objects[0].animation == null).toBe(true);
    getState().redo();
    expect(getState().objects[0].animation).toEqual({ motion: 'rotate', speed: 1 });
  });
});

describe('ANIM-SAVE-03: the sanitiser is defensive', () => {
  it('drops an unrecognised motion and a legacy object with no animation', () => {
    const sanitized = sanitizeProjectData({
      objects: [
        { type: 'TRIANGLES', vertices: [{ x: 0, y: 0 }], animation: { motion: 'WARP', speed: 3 } },
        { type: 'QUADS', vertices: [{ x: 0, y: 0 }] }, // legacy: no animation key
      ],
    });
    expect(sanitized.objects[0].animation).toBeNull();
    expect(sanitized.objects[1].animation).toBeNull();
  });

  it('clamps an out-of-range speed', () => {
    const sanitized = sanitizeProjectData({
      objects: [
        { type: 'TRIANGLES', vertices: [{ x: 0, y: 0 }], animation: { motion: 'slide', speed: 9999 } },
      ],
    });
    expect(sanitized.objects[0].animation?.motion).toBe('slide');
    expect(sanitized.objects[0].animation?.speed).toBeLessThanOrEqual(10);
  });
});
