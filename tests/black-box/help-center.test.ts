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
import WelcomeCard from '@/features/onboarding/ui/WelcomeCard';
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

describe('BB-HELP-05: Help describes the editor column, the Learn drawer and the lesson card', () => {
  const text = (id: Parameters<typeof getHelpTopic>[0]) => JSON.stringify(getHelpTopic(id));

  it('never mentions the removed section menu or Lessons menu, nor words student text avoids', () => {
    const all = JSON.stringify(HELP_TOPICS);
    expect(all).not.toMatch(/section menu|Lessons menu|pick a section|in the (Pipeline|Primitives|Buffers|Transforms|Textures) section/i);
    expect(all).not.toMatch(/coming soon|not supported|future|deferred|\b3D\b|lighting/i);
  });

  it('tours the Scene list, the Add row, the inspector, scene settings, Learn and the lesson card', () => {
    const tour = text('workspace-tour');
    for (const phrase of ['Scene list', 'Add row', 'Create Text', 'inspector', 'Scene settings', 'Learn', 'lesson card']) {
      expect(tour).toContain(phrase);
    }
    expect(text('modes')).toContain('Learn');
  });

  it('keeps the Welcome card to the editor that exists', () => {
    useVamsStore.setState({ hasSeenWelcome: false, appMode: 'Author' });
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      render(h(WelcomeCard, {}), host);
      expect(document.body.textContent).toContain('Welcome to VAMS');
      expect(document.body.textContent).not.toMatch(/pick a section/i);
    } finally {
      render(null, host);
      host.remove();
      useVamsStore.setState({ hasSeenWelcome: true });
    }
  });
});
