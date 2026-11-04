import { unzipSync } from 'fflate';
import { labFileType, useLabStore, type LabFile, type LabWork } from '@/entities/lab-project';

/** What the file list takes, said when it is given anything else. */
export const LAB_TAKES = 'The Lab takes PNG, JPEG, BMP and .txt files.';
/** What Open takes, said when it is given anything else. */
export const OPEN_TAKES = 'Open takes a .cpp file, or a .zip with a .cpp file in it.';
export const ZIP_UNREADABLE = "This .zip couldn't be read. Open takes a .zip that Save made, or any .zip with a .cpp file in it.";

/** A file Open can't use, with the sentence to show. */
export class OpenError extends Error {
  override name = 'OpenError';
}

/** The file name at the end of a path, whichever way its slashes lean. */
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? '';

const bytesOf = async (file: Blob) => new Uint8Array(await file.arrayBuffer());

/** Code as the editor holds it: UTF-8, with \n line ends. */
const codeText = (bytes: Uint8Array) => new TextDecoder().decode(bytes).replace(/\r\n?/g, '\n');

/** main.cpp and the files the list takes, from a zip; folders don't matter, as in a lab folder. */
function workFromZip(bytes: Uint8Array): LabWork {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new OpenError(ZIP_UNREADABLE);
  }
  const names = Object.keys(entries)
    .filter((path) => !path.endsWith('/') && !path.startsWith('__MACOSX/') && !baseName(path).startsWith('.'))
    // The shallowest first, so main.cpp at the top wins over one in a folder.
    .sort((a, b) => a.split('/').length - b.split('/').length);
  const code = names.find((path) => baseName(path).toLowerCase() === 'main.cpp') ?? names.find((path) => path.toLowerCase().endsWith('.cpp'));
  if (!code) throw new OpenError(OPEN_TAKES);
  const files: LabFile[] = [];
  for (const path of names) {
    const name = baseName(path);
    const type = labFileType(name);
    if (type) files.push({ name, bytes: entries[path], type });
  }
  return { source: codeText(entries[code]), files };
}

/** Whether Open takes a file of this name: a .cpp or a .zip. */
export const canOpen = (name: string) => /\.(cpp|zip)$/i.test(name);

/**
 * Open: a .cpp replaces the code and keeps the file list; a .zip replaces both. Anything else
 * rejects with an OpenError that says what Open takes.
 */
export async function openWork(file: File): Promise<void> {
  if (!canOpen(file.name)) throw new OpenError(OPEN_TAKES);
  const bytes = await bytesOf(file);
  const work = file.name.toLowerCase().endsWith('.zip') ? workFromZip(bytes) : { source: codeText(bytes) };
  await useLabStore.getState().replaceWork(work);
}

/** Asks the browser for one file; null when the student closes the picker. */
export function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Adds uploads to the file list, and returns what the list says about them: which file each
 * upload replaced, and what the list takes when an upload is of another kind.
 */
export async function addUploads(uploads: readonly File[]): Promise<string[]> {
  const taken: LabFile[] = [];
  let other = false;
  for (const upload of uploads) {
    const name = baseName(upload.name);
    const type = labFileType(name);
    if (type) taken.push({ name, bytes: await bytesOf(upload), type });
    else other = true;
  }
  const replaced = taken.length > 0 ? await useLabStore.getState().addFiles(taken) : [];
  const said = replaced.map(({ name, replaced: old }) =>
    name === old ? `${name} replaced the earlier ${old}.` : `${name} replaced ${old}. The program finds a file by its name in any case.`,
  );
  if (other) said.push(LAB_TAKES);
  return said;
}
