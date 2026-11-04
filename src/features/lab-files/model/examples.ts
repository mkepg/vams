import { useLabStore, labFileType, type LabWork } from '@/entities/lab-project';
import { GALLERY_SCENES, type GallerySlug } from '@/entities/project/model/gallery-links';
import { dataUrlBytes, EXAMPLE_IMAGES } from './example-images';

/**
 * The examples: five short programs, then every gallery scene as the VAMS editor exports it.
 * Each is a .cpp in ../examples, loaded only when it is chosen.
 */
export interface LabExample {
  id: string;
  title: string;
  group: 'program' | 'gallery';
  /** The images it loads, which join the file list with it. */
  images: string[];
}

/** The window the gallery examples are exported for: the gallery's 16:9 view. */
export const GALLERY_EXAMPLE_SIZE = { width: 800, height: 450 } as const;

export const PROGRAM_EXAMPLES: LabExample[] = [
  { id: 'triangle', title: 'A triangle', group: 'program', images: [] },
  { id: 'keyboard', title: 'Moving a shape with the keyboard', group: 'program', images: [] },
  { id: 'idle-animation', title: 'An idle animation', group: 'program', images: [] },
  { id: 'textured-quad', title: 'A textured quad', group: 'program', images: ['checkerboard.png'] },
  { id: 'bitmap-text', title: 'Bitmap text', group: 'program', images: [] },
];

const GALLERY_IMAGES: Partial<Record<GallerySlug, string[]>> = {
  'jeepney-street': ['Sari-sari sign.png'],
  'pixel-fox': ['Pixel fox.png', 'Cloud tile.png'],
};

export const GALLERY_EXAMPLES: LabExample[] = GALLERY_SCENES.map((scene) => ({
  id: `gallery-${scene.slug}`,
  title: scene.title,
  group: 'gallery',
  images: GALLERY_IMAGES[scene.slug] ?? [],
}));

export const EXAMPLES: LabExample[] = [...PROGRAM_EXAMPLES, ...GALLERY_EXAMPLES];

const SOURCES = import.meta.glob<string>('../examples/*.cpp', { query: '?raw', import: 'default' });

/** An example's code and images. Its code has the editor's line ends, whatever the checkout's. */
export async function exampleWork(id: string): Promise<LabWork> {
  const example = EXAMPLES.find((e) => e.id === id);
  const load = SOURCES[`../examples/${id}.cpp`];
  if (!example || !load) throw new Error(`No example ${id}`);
  const source = (await load()).replace(/\r\n?/g, '\n');
  const files = example.images.map((name) => ({ name, bytes: dataUrlBytes(EXAMPLE_IMAGES[name]), type: labFileType(name)! }));
  return { source, files };
}

/** Replaces the work with an example: its code, and its images as the file list. */
export async function loadExample(id: string): Promise<void> {
  await useLabStore.getState().replaceWork(await exampleWork(id));
}
