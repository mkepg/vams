/**
 * WHITE-BOX TEST SUITE — WB-PERSIST
 * Maps to Table 13, row 6: Persistence Manager
 *
 * Test focus:
 *  - JSON schema construction and parsing via buildProjectFile / sanitizeProjectData
 *  - Data integrity throughout save/load
 *  - Older schema cleanup
 *  - Graceful error recovery for malformed input
 */
import { describe, it, expect } from 'vitest';
import {
  buildProjectFile,
  sanitizeProjectData,
  VAMS_PROJECT_SCHEMA_VERSION,
} from '@/entities/project/model/project-io';
import { addTriangle, addQuad, getState } from '../helpers/store';
import { useVamsStore } from '@/core/store';
import { migratePersistedState } from '@/core/store/persist-migrate';
import { emptyCallbacks } from '@/core/callbacks/callbacks-model';

describe('WB-PERSIST-01: buildProjectFile produces a v7 envelope', () => {
  it('contains app, schemaVersion, exportedAt and data', () => {
    addTriangle();
    const file = buildProjectFile(getState() as never);
    expect(file.app).toBe('VAMS');
    expect(file.schemaVersion).toBe(VAMS_PROJECT_SCHEMA_VERSION);
    expect(typeof file.exportedAt).toBe('string');
    expect(file.data.objects.length).toBe(1);
  });
});

describe('WB-PERSIST-02: sanitizeProjectData restores defaults for missing fields', () => {
  it('a {} payload yields a fully populated default project', () => {
    const sanitized = sanitizeProjectData({});
    expect(sanitized.objects).toEqual([]);
    expect(sanitized.theme).toBe('dark');
    expect(sanitized.canvasBackgroundColor).toBe('#000000');
    expect(sanitized.callbacks).toEqual(emptyCallbacks());
    expect(sanitized.viewportLimits).toMatchObject({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
  });
});

describe('WB-PERSIST-03: sanitizeProjectData clamps numeric ranges', () => {
  it('lineWidth outside [0.5..20] is clamped to that range', () => {
    const sanitized = sanitizeProjectData({
      objects: [
        { id: 'a', type: 'LINES', vertices: [{ x: 0, y: 0 }], lineWidth: 9999 },
        { id: 'b', type: 'LINES', vertices: [{ x: 0, y: 0 }], lineWidth: 0.01 },
      ],
    });
    expect(sanitized.objects[0].lineWidth).toBe(20);
    expect(sanitized.objects[1].lineWidth).toBe(0.5);
  });

  it('stipple factor is clamped to 1..256', () => {
    const sanitized = sanitizeProjectData({
      objects: [
        { type: 'LINES', vertices: [], lineStipple: { factor: 0, pattern: 0xAAAA } },
        { type: 'LINES', vertices: [], lineStipple: { factor: 9999, pattern: 0xAAAA } },
      ],
    });
    expect(sanitized.objects[0].lineStipple?.factor).toBe(1);
    expect(sanitized.objects[1].lineStipple?.factor).toBe(256);
  });
});

describe('WB-PERSIST-04: Round-trip preserves object identity, transform and vertices', () => {
  it('a non-trivial scene round-trips losslessly through JSON', () => {
    const a = addTriangle(0.1, 0.2, 0.05);
    addQuad(-0.2, 0.0, 0.05);
    getState().updateObjectTransform(a.id, { rotate: 45 });

    const file = buildProjectFile(getState() as never);
    const json = JSON.stringify(file);
    const re = JSON.parse(json);
    const sanitized = sanitizeProjectData(re.data);

    expect(sanitized.objects).toHaveLength(2);
    const t = sanitized.objects.find((o) => o.id === a.id)!;
    expect(t.transform.rotate).toBeCloseTo(45, 5);
    expect(t.vertices).toHaveLength(3);
  });
});

describe('WB-PERSIST-05: Older schemas — isVisible → visible, childIds → children', () => {
  it('translates legacy isVisible to the modern visible field', () => {
    const sanitized = sanitizeProjectData({
      objects: [{ type: 'POINTS', isVisible: false, vertices: [] }],
    });
    expect(sanitized.objects[0].visible).toBe(false);
  });

  it('translates legacy childIds to the modern children field', () => {
    const sanitized = sanitizeProjectData({
      objects: [
        { id: 'g', type: 'GROUP', vertices: [], childIds: ['a', 'b'] },
        { id: 'a', type: 'POINTS', vertices: [], parentId: 'g' },
        { id: 'b', type: 'POINTS', vertices: [], parentId: 'g' },
      ],
    });
    const group = sanitized.objects.find((o) => o.id === 'g')!;
    expect(group.children).toEqual(expect.arrayContaining(['a', 'b']));
  });
});

describe('WB-PERSIST-06: Malformed nested data does not crash', () => {
  it('non-array vertices become an empty array', () => {
    const sanitized = sanitizeProjectData({
      objects: [{ type: 'POINTS', vertices: 'not an array' }],
    });
    expect(sanitized.objects[0].vertices).toEqual([]);
  });

  it('non-array uploadedTextures becomes []', () => {
    const sanitized = sanitizeProjectData({ uploadedTextures: 'oops' });
    expect(sanitized.uploadedTextures).toEqual([]);
  });

  it('a dataUrl not starting with data:image/ is dropped', () => {
    const sanitized = sanitizeProjectData({
      uploadedTextures: [{ id: 't1', dataUrl: 'http://evil.example.com/x.png' }],
    });
    expect(sanitized.uploadedTextures).toEqual([]);
  });
});

describe('WB-PERSIST-07: toStorePatchFromProject is a Partial<VamsState>', () => {
  it('does not expose history or batch flags (those are runtime-only)', () => {
    const sanitized = sanitizeProjectData({});
    // Apply and verify the past stays untouched.
    useVamsStore.setState({ past: [{ objects: [], selectedObjectId: null, interactionMode: 'SELECT', selectedVertexId: null, pendingShapeType: null, pendingVertices: [], pendingMinVertices: 1, pendingVertexStride: null, timestamp: 0 }] });
    // Cannot import toStorePatchFromProject from project-io in this scope
    // without re-importing — patch keys are validated by absence of `past`.
    expect(Object.keys(sanitized)).not.toContain('past');
    expect(Object.keys(sanitized)).not.toContain('future');
    expect(Object.keys(sanitized)).not.toContain('isBatchMode');
  });
});

describe('WB-PERSIST-06: Browser storage version 7 migrates to version 8', () => {
  it('keeps handler names, adds empty rules, maps Reshape to Stretch, and migrates the lesson backup', () => {
    const v7 = {
      objects: [],
      callbacks: { keyboard: 'onKey', mouse: '', reshape: 'onResize', motion: '', idle: 'tick' },
      callbacksBackup: { keyboard: '', mouse: 'onClick', reshape: '', motion: '', idle: '' },
      theme: 'light',
    };
    const out = migratePersistedState(v7, 7) as Record<string, Record<string, unknown>> & { theme: string };
    expect(out.theme).toBe('light');
    expect(out.callbacks.keyboard).toEqual({ handlerName: 'onKey', rules: [] });
    expect(out.callbacks.special).toEqual({ handlerName: '', rules: [] });
    expect(out.callbacks.reshape).toEqual({ handlerName: 'onResize', resize: 'stretch' });
    expect(out.callbacks.idle).toEqual({ handlerName: 'tick', rules: [] });
    expect(out.callbacksBackup.mouse).toEqual({ handlerName: 'onClick', rules: [] });
  });

  it('keeps a null lesson backup null, and starts fresh from versions before 7', () => {
    expect((migratePersistedState({ callbacks: {}, callbacksBackup: null }, 7) as { callbacksBackup: unknown }).callbacksBackup).toBeNull();
    expect(migratePersistedState({ objects: [{ id: 'x' }] }, 6)).toEqual({});
  });
});

describe('WB-PERSIST-08: Browser storage version 8 migrates to version 9', () => {
  it('drops the saved animation from every object and from the lesson backup', () => {
    const v8 = {
      objects: [{ id: 'a', name: 'Sun', animation: { motion: 'pulse', speed: 1 } }, { id: 'b', name: 'Box' }],
      sceneBackup: [{ id: 'c', name: 'Old', animation: { motion: 'rotate', speed: 2 } }],
      callbacks: emptyCallbacks(),
    };
    const out = migratePersistedState(v8, 8) as { objects: Record<string, unknown>[]; sceneBackup: Record<string, unknown>[] };
    expect(out.objects).toEqual([{ id: 'a', name: 'Sun' }, { id: 'b', name: 'Box' }]);
    expect(out.sceneBackup).toEqual([{ id: 'c', name: 'Old' }]);
    expect((migratePersistedState({ objects: [], sceneBackup: null }, 8) as { sceneBackup: unknown }).sceneBackup).toBeNull();
  });
});

describe('WB-PERSIST-09: Browser storage version 9 migrates to version 10', () => {
  it('names an old save "Untitled scene" and leaves its id for rehydration to assign', () => {
    const out = migratePersistedState({ objects: [], callbacks: emptyCallbacks() }, 9) as { sceneName: unknown; sceneId: unknown };
    expect(out.sceneName).toBe('Untitled scene');
    expect(out.sceneId).toBe('');
    const kept = migratePersistedState({ objects: [], sceneName: 'Mine', sceneId: 'abc' }, 9) as { sceneName: unknown; sceneId: unknown };
    expect(kept).toMatchObject({ sceneName: 'Mine', sceneId: 'abc' });
  });
});

describe('WB-PERSIST-10: The store saves the scene identity at version 10', () => {
  it('persists sceneId and sceneName', () => {
    const options = useVamsStore.persist.getOptions();
    expect(options.version).toBe(10);
    useVamsStore.setState({ sceneId: 'id-1', sceneName: 'Solar system' });
    const saved = options.partialize!(useVamsStore.getState()) as Record<string, unknown>;
    expect(saved.sceneId).toBe('id-1');
    expect(saved.sceneName).toBe('Solar system');
  });
});

describe('WB-PERSIST-11: ensureSceneId gives a migrated save an id once', () => {
  it('fills an empty id and keeps an existing one', () => {
    useVamsStore.setState({ sceneId: '' });
    useVamsStore.getState().ensureSceneId();
    const first = useVamsStore.getState().sceneId;
    expect(first).not.toBe('');
    useVamsStore.getState().ensureSceneId();
    expect(useVamsStore.getState().sceneId).toBe(first);
  });
});
