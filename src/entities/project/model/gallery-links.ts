/**
 * The gallery's finished scenes, which open in the editor from a link (/app?scene=<slug>) as the
 * prepared scenes do. This module has no imports, so the gallery page can list the scenes
 * without loading scene data.
 */
export const GALLERY_SCENES = [
  {
    slug: 'jeepney-street',
    title: 'Jeepney street',
    summary: 'A night street in Manila: parols on the wire, a sari-sari store with a painted sign, and a jeepney on its route.',
    shows: ['Primitives', 'Transforms', 'Textures'],
    run: 'Idle drives the jeepney and turns its wheels. Space brings it back.',
    alt: 'A jeepney on a city street at night, under four star lanterns hung from a wire.',
  },
  {
    slug: 'solar-system',
    title: 'Solar system',
    summary: 'The Sun, Earth with its Moon, and Mars, each orbit a group that turns the planet it holds.',
    shows: ['Transforms', 'Buffers'],
    run: 'Idle turns every orbit, so the Moon circles Earth while Earth circles the Sun. Space resets them.',
    alt: 'A yellow sun with Earth, its moon and Mars on dashed orbit paths, against a starfield.',
  },
  {
    slug: 'parol',
    title: 'Parol at night',
    summary: 'One Christmas star lantern built from triangle fans, a line loop and lines, glowing over a starry sky.',
    shows: ['Primitives'],
    run: 'Press 1, 2 or 3 to change the star’s colour. A left click turns its glow on and off.',
    alt: 'A five-pointed star lantern with hanging tails and a soft glow, on a dark blue sky.',
  },
  {
    slug: 'clock',
    title: 'Analogue clock',
    summary: 'A clock face with tick marks, bitmap-text numbers and three hands that each turn about the centre.',
    shows: ['Transforms', 'Primitives'],
    run: 'Idle sweeps the second hand. M moves the minute hand and H the hour hand. Space resets them.',
    alt: 'A round clock face showing ten past ten, with the numbers 12, 3, 6 and 9.',
  },
  {
    slug: 'pixel-fox',
    title: 'Fox in the clouds',
    summary: 'A pixel-art fox over a sky of repeating cloud tiles, both textures sampled with Nearest filtering.',
    shows: ['Textures', 'Buffers'],
    run: 'Steer the fox with the arrow keys. Space brings it home. Resize the window and the view keeps its proportions.',
    alt: 'A pixel-art orange fox in a blue sky full of small white clouds.',
  },
] as const;

export type GallerySlug = (typeof GALLERY_SCENES)[number]['slug'];

export function galleryHref(slug: GallerySlug): string {
  return `/app?scene=${slug}`;
}

/** The still of the scene's program window, served from public/gallery/. */
export function galleryImage(slug: GallerySlug): string {
  return `/gallery/${slug}.png`;
}
