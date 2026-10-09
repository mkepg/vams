/**
 * BLACK-BOX TEST SUITE — BB-INSP
 * The unified editor: inspector groups, lesson focus places, math tabs and help context.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import {
  DEFAULT_OPEN_GROUPS,
  FOCUS_PANEL_IDS,
  contextSection,
  mathTabFor,
  resolveFocus,
  sectionForPlace,
} from '@/core/inspector';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import HelpButton from '@/features/help/ui/HelpButton';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';

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

  it('ignores a group opened before the lesson: a lesson step without focus shows the current section', () => {
    const lesson = { appMode: 'Lesson' as const, lessonFocusPanel: null, selectedObjectId: null, lastOpenedGroup: 'texture-library' as const, activeSection: 'Transforms' as const, mathTabOverride: null };
    expect(contextSection(lesson)).toBe('Transforms');
    expect(mathTabFor(lesson)).toBe('Transforms');
    // A focus id with no place in the editor counts as no focus.
    expect(contextSection({ ...lesson, lessonFocusPanel: 'nope' })).toBe('Transforms');
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

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mountEl(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmountEl(host: HTMLElement) {
  render(null, host);
  host.remove();
}

describe('BB-INSP-06: The math panel has one tab per section and follows the student', () => {
  it('names the five tabs, follows the opened group, and holds a manual pick until the next group', async () => {
    const host = mountEl(h(MathPanel, {}));
    try {
      await settle();
      const tabs = () => [...host.querySelectorAll('[role="tab"]')];
      const selected = () => host.querySelector('[role="tab"][aria-selected="true"]')!.textContent;
      expect(tabs().map((t) => t.textContent)).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
      expect(selected()).toBe('Pipeline');
      useVamsStore.getState().toggleGroup('buffers');
      await settle();
      expect(selected()).toBe('Buffers');
      (tabs()[3] as HTMLButtonElement).click();
      await settle();
      expect(selected()).toBe('Transforms');
      useVamsStore.getState().toggleGroup('texture');
      await settle();
      expect(selected()).toBe('Textures');
    } finally {
      unmountEl(host);
    }
  });
});

describe('BB-INSP-07: Help opens on the topic for what the student is doing', () => {
  it('uses the opened group section before the course section', async () => {
    useVamsStore.setState({ activeSection: 'Pipeline', lastOpenedGroup: 'texture', isHelpOpen: false, activeHelpTopicId: null });
    const host = mountEl(h(HelpButton, {}));
    try {
      (host.querySelector('button') as HTMLButtonElement).click();
      await settle();
      const { topicForSection } = await import('@/features/help/model/help-content');
      expect(useVamsStore.getState().activeHelpTopicId).toBe(topicForSection('Textures'));
    } finally {
      useVamsStore.getState().closeHelp();
      unmountEl(host);
    }
  });
});

describe('BB-INSP-08: An empty scene shows the annotated program in every section', () => {
  it('annotates the boilerplate outside Pipeline too', async () => {
    useVamsStore.setState({ activeSection: 'Textures', objects: [] });
    const host = mountEl(h(SceneCodePanel, {}));
    try {
      await settle();
      expect(host.querySelector('.has-annot')).not.toBeNull();
    } finally {
      unmountEl(host);
    }
  });
});
