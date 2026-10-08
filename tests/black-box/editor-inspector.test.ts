/**
 * BLACK-BOX TEST SUITE — BB-INSP
 * The unified editor: inspector groups, lesson focus places, math tabs and help context.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useVamsStore } from '@/core/store';
import {
  DEFAULT_OPEN_GROUPS,
  FOCUS_PANEL_IDS,
  contextSection,
  mathTabFor,
  resolveFocus,
  sectionForPlace,
} from '@/core/inspector';

afterEach(() => {
  useVamsStore.getState().clearLessonState();
  useVamsStore.setState({
    appMode: 'Author',
    activeSection: 'Pipeline',
    openGroups: [...DEFAULT_OPEN_GROUPS],
    lastOpenedGroup: null,
    mathTabOverride: null,
    learnOpen: false,
  });
});

describe('BB-INSP-01: Every lesson focus target has a place in the editor', () => {
  it('maps panel ids to the scene area, object groups, scene settings or the lesson card', () => {
    expect(resolveFocus('scene-hierarchy', false)).toEqual({ area: 'scene', target: 'list' });
    expect(resolveFocus('primitive-palette', true)).toEqual({ area: 'scene', target: 'add' });
    expect(resolveFocus('text-node-panel', false)).toEqual({ area: 'scene', target: 'create-text' });
    expect(resolveFocus('buffers-panel', true)).toEqual({ area: 'object', group: 'buffers' });
    expect(resolveFocus('object-transform', true)).toEqual({ area: 'object', group: 'transform' });
    expect(resolveFocus('line-style-panel', true)).toEqual({ area: 'object', group: 'appearance' });
    expect(resolveFocus('texture-attach', true)).toEqual({ area: 'object', group: 'texture' });
    expect(resolveFocus('uv-editor', true)).toEqual({ area: 'object', group: 'texture' });
    expect(resolveFocus('animation-preview', true)).toEqual({ area: 'object', group: 'animation' });
    expect(resolveFocus('ortho-editor', true)).toEqual({ area: 'settings', group: 'viewing-volume' });
    expect(resolveFocus('texture-library', true)).toEqual({ area: 'settings', group: 'texture-library' });
    expect(resolveFocus('callbacks-panel', true)).toEqual({ area: 'settings', group: 'callbacks' });
    expect(resolveFocus('pipeline-mode-controls', false)).toEqual({ area: 'lesson-card' });
    expect(resolveFocus('nope', true)).toBeNull();
    expect(resolveFocus(null, true)).toBeNull();
    expect(FOCUS_PANEL_IDS).toContain('object-transform');
  });

  it('sends the appearance panel to the object with a selection and to Background without one', () => {
    expect(resolveFocus('appearance-panel', true)).toEqual({ area: 'object', group: 'appearance' });
    expect(resolveFocus('appearance-panel', false)).toEqual({ area: 'settings', group: 'background' });
  });
});

describe('BB-INSP-02: Each place belongs to a curriculum section', () => {
  it('follows the spec table', () => {
    expect(sectionForPlace({ area: 'scene', target: 'add' })).toBe('Primitives');
    expect(sectionForPlace({ area: 'object', group: 'vertices' })).toBe('Primitives');
    expect(sectionForPlace({ area: 'object', group: 'buffers' })).toBe('Buffers');
    expect(sectionForPlace({ area: 'object', group: 'animation' })).toBe('Transforms');
    expect(sectionForPlace({ area: 'settings', group: 'viewing-volume' })).toBe('Transforms');
    expect(sectionForPlace({ area: 'settings', group: 'texture-library' })).toBe('Textures');
    expect(sectionForPlace({ area: 'settings', group: 'callbacks' })).toBe('Pipeline');
    expect(sectionForPlace({ area: 'lesson-card' })).toBe('Pipeline');
  });
});

describe('BB-INSP-03: The context section follows focus, then the opened group, then the section', () => {
  it('prefers a lesson focus, then the last opened group, then activeSection; a manual tab wins until cleared', () => {
    const base = { appMode: 'Author' as const, lessonFocusPanel: null, selectedObjectId: null, lastOpenedGroup: null, activeSection: 'Pipeline' as const, mathTabOverride: null };
    expect(contextSection(base)).toBe('Pipeline');
    expect(contextSection({ ...base, lastOpenedGroup: 'texture' })).toBe('Textures');
    expect(contextSection({ ...base, appMode: 'Lesson', lessonFocusPanel: 'buffers-panel', selectedObjectId: 'x', lastOpenedGroup: 'texture' })).toBe('Buffers');
    expect(mathTabFor({ ...base, lastOpenedGroup: 'texture', mathTabOverride: 'Transforms' })).toBe('Transforms');
  });
});

describe('BB-INSP-04: Groups toggle, remember the last opened one, and clear a manual tab', () => {
  it('updates the transient state through store actions', () => {
    const s = () => useVamsStore.getState();
    expect(s().openGroups).toEqual(['transform', 'background']);
    s().setMathTabOverride('Textures');
    s().toggleGroup('buffers');
    expect(s().openGroups).toContain('buffers');
    expect(s().lastOpenedGroup).toBe('buffers');
    expect(s().mathTabOverride).toBeNull();
    s().toggleGroup('buffers');
    expect(s().openGroups).not.toContain('buffers');
    s().setOpenGroups(['texture']);
    s().openGroup('texture');
    expect(s().openGroups).toEqual(['texture']);
    s().setMathTabOverride('Buffers');
    s().setLessonFocusPanel('object-transform');
    expect(s().mathTabOverride).toBeNull();
    s().setActiveSection('Textures');
    expect(s().openGroups).toEqual(['transform', 'background']);
    expect(s().lastOpenedGroup).toBeNull();
  });

  it('resets the Pipeline view when a lesson ends', () => {
    useVamsStore.setState({ pipelineMode: 'Diagram', activePipelineStage: 2 });
    useVamsStore.getState().clearLessonState();
    expect(useVamsStore.getState().pipelineMode).toBe('Playground');
    expect(useVamsStore.getState().activePipelineStage).toBeNull();
  });
});

describe('BB-INSP-05: The persisted shape is unchanged and transient state is never saved', () => {
  it('keeps version 7, the same partialize keys, and no inspector fields', () => {
    const options = (useVamsStore as unknown as { persist: { getOptions: () => { version: number; partialize: (s: unknown) => object } } }).persist.getOptions();
    expect(options.version).toBe(7);
    const keys = Object.keys(options.partialize(useVamsStore.getState())).sort();
    expect(keys).toEqual([
      'activeSection', 'axisVisibility', 'callbacks', 'callbacksBackup', 'canvasBackgroundColor',
      'canvasBackgroundColorBackup', 'hasSeenWelcome', 'learningSettings', 'objects', 'sceneBackup',
      'showCoordinateTracker', 'theme', 'uploadedTextures', 'uploadedTexturesBackup', 'viewportLimits',
      'viewportLimitsBackup',
    ]);
  });
});
