/**
 * BLACK-BOX TEST SUITE — BB-HELP
 * Help Center: content integrity, search, section deep-linking, and the
 * open/navigate/back/close state machine in the Help slice.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  HELP_TOPICS,
  HELP_CATEGORIES,
  DEFAULT_HELP_TOPIC,
  getHelpTopic,
  topicForSection,
  searchHelpTopics,
} from '@/features/help/model/help-content';
import type { CurriculumSection } from '@/core/store/types';
import { h, render } from 'preact';
import { useVamsStore } from '@/core/store';
import HelpCenter from '@/features/help/ui/HelpCenter';
import WelcomeCard from '@/features/onboarding/ui/WelcomeCard';
import { SHORTCUT_GROUPS } from '@/features/help/model/shortcuts';
import { getState } from '../helpers/store';

const SECTIONS: CurriculumSection[] = ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'];

describe('BB-HELP-01: Content integrity', () => {
  it('every topic has a unique id', () => {
    const ids = HELP_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every topic belongs to a declared category', () => {
    const categoryIds = new Set(HELP_CATEGORIES.map((c) => c.id));
    for (const topic of HELP_TOPICS) {
      expect(categoryIds.has(topic.category)).toBe(true);
    }
  });

  it('every related cross-link points to a real topic', () => {
    const ids = new Set(HELP_TOPICS.map((t) => t.id));
    for (const topic of HELP_TOPICS) {
      for (const related of topic.related ?? []) {
        expect(ids.has(related)).toBe(true);
      }
    }
  });

  it('the default topic exists', () => {
    expect(getHelpTopic(DEFAULT_HELP_TOPIC)).toBeDefined();
  });
});

describe('BB-HELP-02: Section deep-linking', () => {
  it.each(SECTIONS)('maps the %s section to a topic for that section', (section) => {
    const topicId = topicForSection(section);
    const topic = getHelpTopic(topicId);
    expect(topic).toBeDefined();
    expect(topic.section).toBe(section);
  });
});

describe('BB-HELP-03: Search', () => {
  it('returns all topics for an empty query', () => {
    expect(searchHelpTopics('')).toHaveLength(HELP_TOPICS.length);
  });

  it('matches on keywords', () => {
    const results = searchHelpTopics('vbo');
    expect(results.some((t) => t.id === 'section-buffers')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(searchHelpTopics('SHORTCUT')).toEqual(searchHelpTopics('shortcut'));
  });

  it('returns nothing for a nonsense query', () => {
    expect(searchHelpTopics('zzzznotopic')).toHaveLength(0);
  });
});

describe('BB-HELP-04: Help slice state machine', () => {
  beforeEach(() => {
    getState().closeHelp();
    // Reset transient navigation state between tests.
    getState().openHelp('welcome');
    getState().closeHelp();
  });

  it('opens to a given topic and records it in history', () => {
    getState().openHelp('section-buffers');
    expect(getState().isHelpOpen).toBe(true);
    expect(getState().activeHelpTopicId).toBe('section-buffers');
  });

  it('navigates forward and supports going back', () => {
    getState().openHelp('welcome');
    getState().navigateHelp('shortcuts');
    expect(getState().activeHelpTopicId).toBe('shortcuts');

    getState().helpBack();
    expect(getState().activeHelpTopicId).toBe('welcome');
  });

  it('does not push duplicate consecutive entries to history', () => {
    getState().openHelp('welcome');
    getState().navigateHelp('welcome');
    expect(getState().helpHistory).toHaveLength(1); // only the initial open entry
  });

  it('closeHelp leaves the active topic intact for next open', () => {
    getState().openHelp('glossary');
    getState().closeHelp();
    expect(getState().isHelpOpen).toBe(false);
    expect(getState().activeHelpTopicId).toBe('glossary');
  });

  it('marks the welcome state as seen', () => {
    getState().markWelcomeSeen();
    expect(getState().hasSeenWelcome).toBe(true);
  });
});

describe('BB-HELP-05: Help describes the rail, the Learn drawer and the lesson bar', () => {
  const text = (id: Parameters<typeof getHelpTopic>[0]) => JSON.stringify(getHelpTopic(id));

  it('never mentions the removed section menu or Lessons menu, nor words student text avoids', () => {
    const all = JSON.stringify(HELP_TOPICS);
    expect(all).not.toMatch(/section menu|Lessons menu|pick a section|in the (Pipeline|Primitives|Buffers|Transforms|Textures) section/i);
    expect(all).not.toMatch(/coming soon|not yet|not supported|unsupported|future|deferred|\b3D\b|lighting/i);
  });

  it('tours the rail and its four panels, Code and Math, Learn and the lesson bar, and starts the tour', () => {
    const tour = text('workspace-tour');
    for (const phrase of ['rail', 'Add', 'Scene', 'Settings', 'Callbacks', 'Select several', 'Code / Math', 'Hide', 'Learn', 'lesson bar']) {
      expect(tour, phrase).toContain(phrase);
    }
    expect(getHelpTopic('workspace-tour').blocks[0]).toEqual({ kind: 'start-tour' });
    expect(text('modes')).toContain('Learn');
    expect(text('modes')).toContain('lesson bar');
  });

  it('keeps the Welcome card to the editor that exists', () => {
    useVamsStore.setState({ hasSeenWelcome: false, appMode: 'Author' });
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      render(h(WelcomeCard, {}), host);
      const welcome = document.body.textContent ?? '';
      expect(welcome).toContain('Welcome to VAMS');
      expect(welcome).toContain('The rail on the left: Add, Scene, Settings and Callbacks.');
      expect(welcome).toContain('Code and Math on the right');
      expect(welcome).not.toMatch(/pick a section|left column/i);
    } finally {
      render(null, host);
      host.remove();
      useVamsStore.setState({ hasSeenWelcome: true });
    }
  });
});

describe('BB-HELP-06: Help teaches motion through the idle callback only', () => {
  it('has no Animation guide and no saved-animation wording', () => {
    expect(HELP_TOPICS.some((t) => (t.id as string) === 'animation')).toBe(false);
    const text = JSON.stringify(HELP_TOPICS);
    for (const phrase of ['Animation panel', 'Animation group', 'animate_', 'pulse', 'orbit', 'saved animation', 'and animations']) {
      expect(text).not.toContain(phrase);
    }
    for (const topic of HELP_TOPICS) expect(topic.related ?? []).not.toContain('animation');
  });
});

describe('BB-HELP-07: The welcome card and the Help Center start the tour', () => {
  async function settle() {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  function mountEl(vnode: ReturnType<typeof h>) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(vnode, host);
    return host;
  }
  function unmount(host: HTMLElement) {
    render(null, host);
    host.remove();
  }
  const buttonNamed = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name);

  it('Take the tour closes the welcome card and starts the tour', async () => {
    useVamsStore.setState({ hasSeenWelcome: false, appMode: 'Author' });
    const host = mountEl(h(WelcomeCard, {}));
    await settle();
    buttonNamed('Take the tour')!.click();
    await settle();
    expect(getState().hasSeenWelcome).toBe(true);
    expect(getState().tourStep).toBe(0);
    expect(getState().isHelpOpen).toBe(false);
    getState().endTour();
    unmount(host);
  });

  it('Start the tour in the Workspace Tour topic, and in the first-visit banner, closes Help and starts it', async () => {
    useVamsStore.setState({ hasSeenWelcome: true, appMode: 'Author' });
    getState().openHelp('workspace-tour');
    let host = mountEl(h(HelpCenter, {}));
    await settle();
    document.querySelector<HTMLButtonElement>('.help-start-tour')!.click();
    await settle();
    expect(getState().isHelpOpen).toBe(false);
    expect(getState().tourStep).toBe(0);
    getState().endTour();
    unmount(host);

    useVamsStore.setState({ hasSeenWelcome: false });
    getState().openHelp('shortcuts');
    host = mountEl(h(HelpCenter, {}));
    await settle();
    document.querySelector<HTMLButtonElement>('.help-welcome-banner button')!.click();
    await settle();
    expect(getState().isHelpOpen).toBe(false);
    expect(getState().hasSeenWelcome).toBe(true);
    expect(getState().tourStep).toBe(0);
    getState().endTour();
    unmount(host);
  });

  it('offers no Start the tour during a lesson', async () => {
    useVamsStore.setState({ hasSeenWelcome: false, appMode: 'Lesson' });
    getState().openHelp('workspace-tour');
    const host = mountEl(h(HelpCenter, {}));
    await settle();
    expect(document.querySelector('.help-start-tour')).toBeNull();
    expect(document.querySelector('.help-welcome-banner')).toBeNull();
    getState().closeHelp();
    await settle();
    unmount(host);
    useVamsStore.setState({ hasSeenWelcome: true, appMode: 'Author' });
  });
});

describe('BB-HELP-08: Help names only places the editor has', () => {
  it('never names the old left column, Add row, scene settings, lesson card or Callbacks group', () => {
    const all = JSON.stringify(HELP_TOPICS);
    expect(all).not.toMatch(/left column|Add row|scene settings|lesson card|Multi-Select|Callbacks group|top-right panel|Below the code|Panels button/i);
  });

  it('lists the tour keys with the other shortcuts', () => {
    const tour = SHORTCUT_GROUPS.find((g) => g.group === 'Tour');
    expect(tour?.items.map((i) => `${i.keys}: ${i.label}`)).toEqual([
      'Right arrow: Next tour step',
      'Enter: Next tour step',
      'Left arrow: Previous tour step',
      'Esc: End the tour',
    ]);
  });
});

describe('BB-HELP-09: Help describes the folded code and the vertex journey', () => {
  it('explains folds, the strip, notes, the marks and the six stages, and no longer mentions tabs or underlines', () => {
    const code = JSON.stringify(HELP_TOPICS.find((t) => t.id === 'code-panel'));
    for (const word of ['fold', 'strip', 'Notes', 'amber', 'Copy always copies the whole program']) expect(code, word).toContain(word);
    const math = JSON.stringify(HELP_TOPICS.find((t) => t.id === 'math-panel'));
    for (const stage of ['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured']) expect(math, stage).toContain(stage);
    const all = JSON.stringify(HELP_TOPICS);
    expect(all).not.toMatch(/one tab per section|underlined line|the code highlights it/i);
  });
});
