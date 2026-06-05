import type { CurriculumSection } from '@/core/store/types';

/**
 * Stable identifiers for every help topic. Using a string-literal union (rather
 * than bare strings) means cross-links and the section deep-link map are checked
 * by the compiler — a renamed/removed topic surfaces as a type error, not a dead
 * link at runtime.
 */
export type HelpTopicId =
  | 'welcome'
  | 'workspace-tour'
  | 'canvas-basics'
  | 'modes'
  | 'section-pipeline'
  | 'section-primitives'
  | 'section-buffers'
  | 'section-transforms'
  | 'section-textures'
  | 'scene-hierarchy'
  | 'animation'
  | 'callbacks'
  | 'code-panel'
  | 'math-panel'
  | 'saving-loading'
  | 'shortcuts'
  | 'glossary'
  | 'about';

export type HelpCategoryId =
  | 'getting-started'
  | 'workspace'
  | 'sections'
  | 'panels'
  | 'reference';

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
}

/**
 * A small, declarative content schema. The renderer ([HelpContent]) walks these
 * blocks generically, so adding or editing a topic never requires touching JSX —
 * it is a pure data change in [help-content.ts].
 */
export type HelpBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'code'; code: string }
  | { kind: 'callout'; tone?: 'info' | 'tip' | 'warning'; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'definitions'; items: { term: string; description: string }[] }
  /** Renders the canonical keyboard-shortcut table from [shortcuts.ts]. */
  | { kind: 'shortcuts' };

export interface HelpTopic {
  id: HelpTopicId;
  category: HelpCategoryId;
  title: string;
  /** One-line summary shown under the title and in search results. */
  summary: string;
  /** Extra search terms beyond the title/summary/body text. */
  keywords: string[];
  /** When set, opening Help from this curriculum section deep-links here. */
  section?: CurriculumSection;
  blocks: HelpBlock[];
  /** Cross-links rendered as chips at the foot of the topic. */
  related?: HelpTopicId[];
}

export interface Shortcut {
  /** Human-readable key combo, e.g. "Ctrl + Z". */
  keys: string;
  label: string;
}

export interface ShortcutGroup {
  group: string;
  items: Shortcut[];
}
