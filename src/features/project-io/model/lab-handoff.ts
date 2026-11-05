import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { textureFileName } from '@/features/code-generation/model/generator/textures';
import { LAB_IMPORT_KEY, type LabImport, type LabImportFile } from '@/shared/lib/lab-import';

type SceneInput = Parameters<typeof generateCodeFromState>[0];

/** The Lab's window, as its course template opens it. */
export const LAB_WINDOW = { width: 500, height: 500 } as const;

/** Said when the scene and its images don't fit in what the browser keeps for the Lab to open. */
export const LAB_HANDOFF_TOO_LARGE = 'The scene is too large to open in the Lab. Export C++ code instead.';
/** Said when the browser keeps nothing for the Lab to open, as a blocked sessionStorage does. */
export const LAB_HANDOFF_BLOCKED = "This browser didn't let the editor pass the scene to the Lab. Export C++ code instead.";

/** The C string in each stbi_load the program makes, as the program sees it. */
function loadedPaths(source: string): string[] {
  return [...source.matchAll(/stbi_load\("((?:[^"\\]|\\.)*)"/g)].map(([, literal]) => literal.replace(/\\(.)/g, '$1'));
}

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? '';

const dataUrlType = (dataUrl: string) => /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? '';

/**
 * The scene's program at the Lab's 500 × 500, and every image it loads, each under the file name
 * its stbi_load gives, so the Lab finds it by that name.
 */
export function labHandoff(scene: SceneInput): LabImport {
  const source = generateCodeFromState(scene, LAB_WINDOW);
  const loads = new Set(loadedPaths(source).map((path) => baseName(path).toLowerCase()));
  // Only the textures a shape wears; an unused upload of the same name never takes their place.
  const worn = new Set(scene.objects.map((o) => o.texture?.textureId).filter((id) => id !== undefined));
  const files: LabImportFile[] = [];
  for (const texture of scene.textures ?? []) {
    const name = textureFileName(texture);
    const key = name.toLowerCase();
    if (!worn.has(texture.id) || !loads.has(key) || files.some((f) => f.name.toLowerCase() === key)) continue;
    files.push({ name, type: dataUrlType(texture.dataUrl), dataUrl: texture.dataUrl });
  }
  return { source, files };
}

const isQuotaError = (error: unknown) =>
  error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22);

/** Keeps the work for the Lab to open. Null once it is kept, otherwise the sentence that says why it can't be. */
export function keepForLab(work: LabImport, storage: () => Pick<Storage, 'setItem'> = () => window.sessionStorage): string | null {
  try {
    storage().setItem(LAB_IMPORT_KEY, JSON.stringify(work));
    return null;
  } catch (error) {
    return isQuotaError(error) ? LAB_HANDOFF_TOO_LARGE : LAB_HANDOFF_BLOCKED;
  }
}
