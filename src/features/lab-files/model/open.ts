import { unzipSync } from 'fflate';
import { labFileType, useLabStore, type LabFile, type LabWork } from '@/entities/lab-project';
import { CONTROL_CHARACTER, MAX_LAB_FILES } from '@/shared/lib/share-schema';

/** What the file list takes, said when it is given anything else. */
export const LAB_TAKES = 'The Lab takes PNG, JPEG, BMP and .txt files.';
/** What Open takes, said when it is given anything else. */
export const OPEN_TAKES = 'Open takes a .cpp file, or a .zip with a .cpp file in it.';
export const ZIP_UNREADABLE = "This .zip couldn't be read. Open takes a .zip that Save made, or any .zip with a .cpp file in it.";
/** Said when the list is full; a share link holds no more than the list. */
export const LAB_FILES_FULL = `The Lab keeps up to ${MAX_LAB_FILES} files.`;

/** Said about an upload whose name holds a control character, which is shown as ?. */
export const labFileNameMessage = (name: string) =>
  `${name.replace(new RegExp(CONTROL_CHARACTER.source, 'g'), '?')} has a character a file name can't hold. Rename it, then add it again.`;

/** A file Open can't use, with the sentence to show. */
export class OpenError extends Error {
  override name = 'OpenError';
}

/** The file name at the end of a path, whichever way its slashes lean. */
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? '';

const bytesOf = async (file: Blob) => new Uint8Array(await file.arrayBuffer());

/** Code as the editor holds it: UTF-8, with \n line ends. */
const codeText = (bytes: Uint8Array) => new TextDecoder().decode(bytes).replace(/\r\n?/g, '\n');

/**
 * main.cpp and the files the list takes, from a zip; folders don't matter, as in a lab folder. At
 * most MAX_LAB_FILES files come in; `full` says some were left out.
 */
function workFromZip(bytes: Uint8Array): { work: LabWork; full: boolean } {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new OpenError(ZIP_UNREADABLE);
  }
  const names = Object.keys(entries)
    .filter((path) => !path.endsWith('/') && !path.startsWith('__MACOSX/') && !baseName(path).startsWith('.'))
    // The shallowest first, so a file at the top wins over its namesake in a folder.
    .sort((a, b) => a.split('/').length - b.split('/').length);
  const code = names.find((path) => baseName(path).toLowerCase() === 'main.cpp') ?? names.find((path) => path.toLowerCase().endsWith('.cpp'));
  if (!code) throw new OpenError(OPEN_TAKES);
  const files: LabFile[] = [];
  let full = false;
  for (const path of names) {
    const name = baseName(path);
    const type = labFileType(name);
    if (!type || CONTROL_CHARACTER.test(name) || files.some((f) => f.name.toLowerCase() === name.toLowerCase())) continue;
    if (files.length >= MAX_LAB_FILES) full = true;
    else files.push({ name, bytes: entries[path], type });
  }
  return { work: { source: codeText(entries[code]), files }, full };
}

/** Whether Open takes a file of this name: a .cpp or a .zip. */
export const canOpen = (name: string) => /\.(cpp|zip)$/i.test(name);

/**
 * Open: a .cpp replaces the code and keeps the file list; a .zip replaces both. Anything else
 * rejects with an OpenError that says what Open takes. Resolves what the file list should say:
 * LAB_FILES_FULL when a .zip held more files than the list keeps, otherwise null.
 */
export async function openWork(file: File): Promise<string | null> {
  if (!canOpen(file.name)) throw new OpenError(OPEN_TAKES);
  const bytes = await bytesOf(file);
  if (!file.name.toLowerCase().endsWith('.zip')) {
    await useLabStore.getState().replaceWork({ source: codeText(bytes) });
    return null;
  }
  const { work, full } = workFromZip(bytes);
  await useLabStore.getState().replaceWork(work);
  return full ? LAB_FILES_FULL : null;
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
  const unread: string[] = [];
  const badNames: string[] = [];
  let other = false;
  let full = false;
  // The names the list will hold, in lower case: a name already there is replaced, not added.
  const held = useLabStore.getState().files.map((f) => f.name.toLowerCase());
  for (const upload of uploads) {
    const name = baseName(upload.name);
    const type = labFileType(name);
    if (!type) {
      other = true;
      continue;
    }
    if (CONTROL_CHARACTER.test(name)) {
      badNames.push(name);
      continue;
    }
    const isNew = !held.includes(name.toLowerCase());
    if (isNew && held.length >= MAX_LAB_FILES) {
      full = true;
      continue;
    }
    try {
      taken.push({ name, bytes: await bytesOf(upload), type });
      if (isNew) held.push(name.toLowerCase());
    } catch {
      // Moved or deleted since it was picked.
      unread.push(name);
    }
  }
  const replaced = taken.length > 0 ? await useLabStore.getState().addFiles(taken) : [];
  const said = replaced.map(({ name, replaced: old }) =>
    name === old ? `${name} replaced the earlier ${old}.` : `${name} replaced ${old}. The program finds a file by its name in any case.`,
  );
  for (const name of unread) said.push(`${name} couldn't be read. Add it again.`);
  for (const name of badNames) said.push(labFileNameMessage(name));
  if (other) said.push(LAB_TAKES);
  if (full) said.push(LAB_FILES_FULL);
  return said;
}
