/**
 * The prepared scenes the editor opens from a link (/app?scene=<slug>).
 * This module has no imports, so the home page can list the scenes without loading scene data.
 */
export const PRESET_LINKS = [
  { slug: 'triangle', title: 'Triangle' },
  { slug: 'transforms', title: 'Transforms' },
  { slug: 'primitives', title: 'Primitives tour' },
  { slug: 'textured-quad', title: 'Textured quad' },
] as const;

export type PresetSlug = (typeof PRESET_LINKS)[number]['slug'];

export function presetHref(slug: PresetSlug): string {
  return `/app?scene=${slug}`;
}
