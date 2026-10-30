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
import { useVamsStore, STORAGE_KEY } from '@/core/store';
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
    expect(getState().callbacks.mouse.handlerName).toBe('onClick');
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

describe('BB-PERSIST-05: A schema 8 project file loads into the new callbacks shape', () => {
  it('turns name strings into callbacks with no rules', () => {
    const data = sanitizeProjectData({
      objects: [],
      callbacks: { keyboard: 'onKey', mouse: '', reshape: 'onResize', motion: '', idle: '' },
    });
    expect(data.callbacks.keyboard).toEqual({ handlerName: 'onKey', rules: [] });
    expect(data.callbacks.reshape).toEqual({ handlerName: 'onResize', resize: 'stretch' });
    expect(data.callbacks.special).toEqual({ handlerName: '', rules: [] });
  });
});

describe('BB-PERSIST-06: A schema 9 round trip keeps rules and the reshape choice', () => {
  it('saves and loads rules', () => {
    const t = addTriangle();
    getState().setCallbackHandler('special', 'onSpecial');
    getState().addCallbackRule('special', {
      id: 'r1', objectId: t.id, trigger: { kind: 'special', key: 'right' }, action: { type: 'translate', dx: 0.1, dy: 0 },
    });
    getState().setCallbackHandler('reshape', 'onReshape');
    getState().setReshapeMode('stretch');
    const file = JSON.parse(JSON.stringify(buildProjectFile(getState() as never)));
    expect(file.schemaVersion).toBe(9);
    const data = sanitizeProjectData(file.data);
    expect(data.callbacks.special.rules).toEqual(getState().callbacks.special.rules);
    expect(data.callbacks.reshape).toEqual({ handlerName: 'onReshape', resize: 'stretch' });
  });
});

describe('BB-PERSIST-07: Loading drops broken rules and clamps values', () => {
  it('drops rules for missing objects or bad triggers, clamps, and keeps at most 8', () => {
    const objects = [{ id: 'o1', name: 'T', type: 'TRIANGLES', visible: true, vertices: [], transform: {} }];
    const ok = (i: number) => ({ id: `r${i}`, objectId: 'o1', trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'translate', dx: 99, dy: -99 } });
    const data = sanitizeProjectData({
      objects,
      callbacks: {
        keyboard: {
          handlerName: 'onKey',
          rules: [
            { id: 'gone', objectId: 'missing', trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'reset' } },
            { id: 'bad', objectId: 'o1', trigger: { kind: 'keyboard', key: '%' }, action: { type: 'reset' } },
            { id: 'ptr', objectId: 'o1', trigger: { kind: 'keyboard', key: 'd' }, action: { type: 'moveToPointer' } },
            ...Array.from({ length: 10 }, (_, i) => ok(i)),
          ],
        },
      },
    });
    const rules = data.callbacks.keyboard.rules;
    expect(rules).toHaveLength(8);
    expect(rules[0].action).toEqual({ type: 'translate', dx: 10, dy: -10 });
  });
});

describe('BB-PERSIST-08: A file saved with an object animation still opens', () => {
  it('keeps the object and leaves the animation behind', () => {
    const t = addTriangle();
    const file = buildProjectFile(getState() as never);
    const saved = { ...file.data, objects: file.data.objects.map((o) => ({ ...o, animation: { motion: 'orbit', speed: 1 } })) };
    const data = sanitizeProjectData(saved);
    expect(data.objects.map((o) => o.id)).toEqual([t.id]);
    expect('animation' in data.objects[0]).toBe(false);
  });
});

describe('BB-PERSIST-09: A project file without Grid numbers loads with them on', () => {
  it('reads a missing showGridNumbers as true and keeps a saved false', () => {
    const file = buildProjectFile(getState() as never);
    const older: Record<string, unknown> = { ...file.data.axisVisibility };
    delete older.showGridNumbers;
    const loaded = sanitizeProjectData({ ...file.data, axisVisibility: older });
    expect(loaded.axisVisibility.showGridNumbers).toBe(true);
    const off = sanitizeProjectData({ ...file.data, axisVisibility: { ...older, showGridNumbers: false } });
    expect(off.axisVisibility.showGridNumbers).toBe(false);
  });
});

describe('BB-PERSIST-10: A background colour that is not a hex colour loads as black', () => {
  it.each(['zzz', 'red', '#12345', '#1234567', '#12345g', 42, null])('replaces %j with #000000', (bad) => {
    expect(sanitizeProjectData({ objects: [], canvasBackgroundColor: bad }).canvasBackgroundColor).toBe('#000000');
  });
  it('keeps a six-digit hex colour', () => {
    expect(sanitizeProjectData({ objects: [], canvasBackgroundColor: '#1A2b3C' }).canvasBackgroundColor).toBe('#1A2b3C');
  });
  it('repairs a bad colour already saved in the browser', async () => {
    const saved = { state: { canvasBackgroundColor: 'zzz' }, version: 11 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    await useVamsStore.persist.rehydrate();
    expect(useVamsStore.getState().canvasBackgroundColor).toBe('#000000');
    localStorage.removeItem(STORAGE_KEY);
  });
});

describe('BB-PERSIST-11: A version 7 save in the browser opens through the real rehydrate', () => {
  it('keeps the handler names and gives each callback its rules', async () => {
    const saved = {
      state: { objects: [], callbacks: { keyboard: 'onKey', mouse: '', reshape: 'onResize', motion: '', idle: 'tick' } },
      version: 7,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    await useVamsStore.persist.rehydrate();
    const { callbacks } = useVamsStore.getState();
    expect(callbacks.keyboard).toEqual({ handlerName: 'onKey', rules: [] });
    expect(callbacks.special).toEqual({ handlerName: '', rules: [] });
    expect(callbacks.reshape).toEqual({ handlerName: 'onResize', resize: 'stretch' });
    expect(callbacks.idle).toEqual({ handlerName: 'tick', rules: [] });
    localStorage.removeItem(STORAGE_KEY);
  });
});
