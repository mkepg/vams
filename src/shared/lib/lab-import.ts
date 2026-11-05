/**
 * The editor's Open in Lab hands the scene's program to the Lab through sessionStorage: the editor
 * writes it under LAB_IMPORT_KEY and loads LAB_IMPORT_URL, and the Lab takes it as the page loads.
 * It has no imports, so the editor reaches it without the Lab's code.
 */
export const LAB_IMPORT_KEY = 'vams-lab-import';
/** The address bar's mark that the editor has just sent work: /lab?import=1. */
export const LAB_IMPORT_PARAM = 'import';
export const LAB_IMPORT_URL = `/lab?${LAB_IMPORT_PARAM}=1`;

/** One image the program loads, by the file name its stbi_load gives, as a data URL of `type`. */
export interface LabImportFile {
  name: string;
  type: string;
  dataUrl: string;
}

/** The program and the images it loads. */
export interface LabImport {
  source: string;
  files: LabImportFile[];
}

const isFile = (f: unknown): f is LabImportFile =>
  !!f &&
  typeof f === 'object' &&
  typeof (f as LabImportFile).name === 'string' &&
  typeof (f as LabImportFile).type === 'string' &&
  typeof (f as LabImportFile).dataUrl === 'string';

/** The work under LAB_IMPORT_KEY, which leaves storage as it is read; null when there is none or it is malformed. */
export function takeLabImport(storage: Pick<Storage, 'getItem' | 'removeItem'>): LabImport | null {
  let text: string | null;
  try {
    text = storage.getItem(LAB_IMPORT_KEY);
    storage.removeItem(LAB_IMPORT_KEY);
  } catch {
    return null;
  }
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { source, files } = value as Partial<LabImport>;
  if (typeof source !== 'string' || !Array.isArray(files)) return null;
  return { source, files: files.filter(isFile) };
}
