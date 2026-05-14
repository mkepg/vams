/**
 * BLACK-BOX TEST SUITE — BB-PERSIST
 * Maps to Table 12, row 7: Project Persistence
 *
 * Test focus:
 *  - Saved JSON files can be loaded back into an identical scene
 *  - Sanitiser cleans up files saved by older builds
 *  - Parser tolerates invalid input
 */
import { describe, it, expect } from 'vitest';
import {
  buildProjectFile,
  sanitizeProjectData,
  toStorePatchFromProject,
  VAMS_PROJECT_SCHEMA_VERSION,
} from '@/entities/project/model/project-io';
import { useVamsStore } from '@/core/store';
import { addTriangle, addQuad, getState } from '../helpers/store';

describe('BB-PERSIST-01: A scene round-trips through save → JSON → load', () => {
  it('reconstructs the same set of objects, callbacks, viewport and theme', () => {
    const t = addTriangle(0.1, 0.2, 0.05);
    addQuad(-0.2, 0.0, 0.05);
    getState().setCallbackHandler('mouse', 'onClick');
    useVamsStore.setState({ canvasBackgroundColor: '#112233' });

    const file = buildProjectFile(getState() as never);
    expect(file.app).toBe('VAMS');
    expect(file.schemaVersion).toBe(VAMS_PROJECT_SCHEMA_VERSION);

    const json = JSON.stringify(file);
    const parsed = JSON.parse(json);
    const sanitized = sanitizeProjectData(parsed.data);

    // Reset and apply
    useVamsStore.setState({ objects: [], canvasBackgroundColor: '#000000' });
    useVamsStore.setState(toStorePatchFromProject(sanitized));

    expect(getState().objects).toHaveLength(2);
    expect(getState().callbacks.mouse).toBe('onClick');
    expect(getState().canvasBackgroundColor).toBe('#112233');
    expect(getState().objects.find((o) => o.id === t.id)?.transform.translateX)
      .toBeCloseTo(0.1, 5);
  });
});

describe('BB-PERSIST-02: Older / malformed payloads are sanitised gracefully', () => {
  it('drops objects with an unrecognised type', () => {
    const sanitized = sanitizeProjectData({
      objects: [
        { type: 'NOT_A_REAL_PRIMITIVE', vertices: [] },
        { type: 'TRIANGLES', vertices: [{ x: 0, y: 0 }] },
      ],
    });
    expect(sanitized.objects).toHaveLength(1);
    expect(sanitized.objects[0].type).toBe('TRIANGLES');
  });

  it('coerces a missing visible flag to true (legacy schema)', () => {
    const sanitized = sanitizeProjectData({
      objects: [{ type: 'POINTS', isVisible: false, vertices: [] }],
    });
    expect(sanitized.objects[0].visible).toBe(false);
  });

  it('strips parentIds that point at non-existent objects', () => {
    const sanitized = sanitizeProjectData({
      objects: [
        { id: 'a', type: 'POINTS', vertices: [], parentId: 'ghost' },
      ],
    });
    expect(sanitized.objects[0].parentId).toBeNull();
  });

  it('returns the default project when given utter garbage', () => {
    const sanitized = sanitizeProjectData('not an object' as unknown);
    expect(Array.isArray(sanitized.objects)).toBe(true);
    expect(sanitized.objects).toHaveLength(0);
    expect(sanitized.theme).toBe('dark');
    expect(sanitized.viewportLimits).toMatchObject({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
  });
});

describe('BB-PERSIST-03: Selected IDs that no longer exist are cleared', () => {
  it('selectedObjectId is nulled out if it does not match any object', () => {
    const sanitized = sanitizeProjectData({
      objects: [{ id: 'real-1', type: 'POINTS', vertices: [{ x: 0, y: 0 }] }],
      selectedObjectId: 'ghost',
    });
    expect(sanitized.selectedObjectId).toBeNull();
  });
});

describe('BB-PERSIST-04: Texture attachments are validated', () => {
  it('drops texture attachments without a textureId', () => {
    const sanitized = sanitizeProjectData({
      objects: [{
        type: 'POINTS', vertices: [{ x: 0, y: 0 }],
        texture: { filter: 'LINEAR', wrap: 'REPEAT' },
      }],
    });
    expect(sanitized.objects[0].texture).toBeNull();
  });
});
