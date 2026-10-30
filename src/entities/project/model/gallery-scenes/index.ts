import type { GallerySlug } from '../gallery-links';
import type { GalleryScene } from './gallery-scene';
import { clock } from './clock';
import { jeepneyStreet } from './jeepney-street';
import { parol } from './parol';
import { pinwheels } from './pinwheels';
import { pixelFox } from './pixel-fox';
import { riceTerraces } from './rice-terraces';
import { solarSystem } from './solar-system';

export { GALLERY_VIEW, type GalleryScene } from './gallery-scene';

export const GALLERY_BUILDERS: Record<GallerySlug, GalleryScene> = {
  'jeepney-street': jeepneyStreet,
  'solar-system': solarSystem,
  parol,
  clock,
  'pixel-fox': pixelFox,
  'rice-terraces': riceTerraces,
  pinwheels,
};
