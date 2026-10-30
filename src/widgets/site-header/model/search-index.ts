import { LESSON_CATALOG, lessonHref } from '@/features/lesson-engine/model/catalog';
import { HELP_TOPICS, glossaryTermId } from '@/features/help/model/help-content';
import { GALLERY_SCENES, galleryHref } from '@/entities/project/model/gallery-links';
import { PRESET_LINKS, presetHref } from '@/entities/project/model/preset-links';

export type SearchKind = 'page' | 'lesson' | 'scene' | 'guide' | 'term';

export interface SearchEntry {
  kind: SearchKind;
  title: string;
  /** One line under the title. */
  detail: string;
  href: string;
  /** Words that find the entry without showing: a lesson's section, a topic's keywords. */
  keywords: string;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  page: 'Page',
  lesson: 'Lesson',
  scene: 'Scene',
  guide: 'Guide',
  term: 'Glossary',
};

const PAGES: SearchEntry[] = [
  { kind: 'page', title: 'Editor', detail: 'Build a scene and read its OpenGL code', href: '/app', keywords: 'app open start build canvas' },
  { kind: 'page', title: 'Learn', detail: 'The course map, with every lesson', href: '/learn', keywords: 'course lessons sections progress' },
  { kind: 'page', title: 'Gallery', detail: 'Finished scenes that run', href: '/gallery', keywords: 'examples scenes' },
  { kind: 'page', title: 'Guide', detail: 'How the editor works, and a glossary', href: '/guide', keywords: 'help manual docs glossary shortcuts' },
  { kind: 'page', title: 'Teaching with VAMS', detail: 'For instructors planning a class', href: '/teach', keywords: 'teach teacher instructor class lab' },
  { kind: 'page', title: 'About', detail: 'The thesis behind VAMS, with a citation', href: '/about', keywords: 'thesis citation team' },
  { kind: 'page', title: 'Home', detail: 'What VAMS is', href: '/', keywords: 'landing' },
];

function glossaryEntries(): SearchEntry[] {
  const topic = HELP_TOPICS.find((t) => t.id === 'glossary');
  return (topic?.blocks ?? []).flatMap((block) =>
    block.kind === 'definitions'
      ? block.items.map((item) => ({ kind: 'term' as const, title: item.term, detail: item.description, href: `/guide#${glossaryTermId(item.term)}`, keywords: '' }))
      : [],
  );
}

let entries: SearchEntry[] | null = null;

/** Everything the search finds, built once on first use. */
export function searchEntries(): SearchEntry[] {
  entries ??= [
    ...PAGES,
    ...LESSON_CATALOG.map((lesson) => ({
      kind: 'lesson' as const,
      title: lesson.title,
      detail: `${lesson.section} · ${lesson.type === 'demo' ? 'Demo' : 'Exercise'}`,
      href: lessonHref(lesson.id),
      keywords: lesson.section,
    })),
    ...GALLERY_SCENES.map((scene) => ({
      kind: 'scene' as const,
      title: scene.title,
      detail: scene.summary,
      href: galleryHref(scene.slug),
      keywords: scene.shows.join(' '),
    })),
    ...PRESET_LINKS.map((preset) => ({
      kind: 'scene' as const,
      title: preset.title,
      detail: 'A sample scene',
      href: presetHref(preset.slug),
      keywords: 'sample',
    })),
    ...HELP_TOPICS.map((topic) => ({
      kind: 'guide' as const,
      title: topic.title,
      detail: topic.summary,
      href: `/guide#${topic.id}`,
      keywords: topic.keywords.join(' '),
    })),
    ...glossaryEntries(),
  ];
  return entries;
}

/** How well one word matches an entry: the title counts most, then its detail and keywords. */
function wordScore(entry: SearchEntry, word: string): number {
  const title = entry.title.toLowerCase();
  if (title.startsWith(word)) return 4;
  if (title.split(/[^a-z0-9]+/).some((w) => w.startsWith(word))) return 3;
  if (title.includes(word)) return 2;
  if (entry.keywords.toLowerCase().includes(word)) return 1.5;
  if (entry.detail.toLowerCase().includes(word)) return 1;
  return 0;
}

/**
 * The entries that match every word of the query, best first; with no query, the site's pages.
 * Ties keep the index order: pages, lessons in course order, scenes, guide topics, then terms.
 */
export function searchSite(query: string, limit = 8): SearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return PAGES.slice(0, limit);
  return searchEntries()
    .map((entry, index) => {
      const scores = words.map((word) => wordScore(entry, word));
      return { entry, index, score: scores.every((s) => s > 0) ? scores.reduce((a, b) => a + b, 0) : 0 };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((hit) => hit.entry);
}
