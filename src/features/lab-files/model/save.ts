import { strToU8, zipSync } from 'fflate';
import { readLabFiles, useLabStore } from '@/entities/lab-project';

export const CODE_FILE = 'main.cpp';
export const ZIP_FILE = 'lab.zip';

export type Download = (name: string, blob: Blob) => void;

/** Hands a file to the browser's downloads. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** The work as one file: main.cpp alone, or lab.zip of main.cpp and the file list. */
export async function workFile(source: string = useLabStore.getState().source): Promise<{ name: string; blob: Blob }> {
  const files = await readLabFiles();
  if (files.length === 0) return { name: CODE_FILE, blob: new Blob([source], { type: 'text/plain' }) };
  const entries: Record<string, Uint8Array> = { [CODE_FILE]: strToU8(source) };
  for (const file of files) entries[file.name] = file.bytes;
  return { name: ZIP_FILE, blob: new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }) };
}

/** Save: downloads main.cpp, or lab.zip when there are files. */
export async function saveWork(download: Download = downloadBlob): Promise<void> {
  const { source } = useLabStore.getState();
  const { name, blob } = await workFile(source);
  download(name, blob);
  // Typing while the zip was made leaves the work unsaved.
  if (useLabStore.getState().source === source) useLabStore.getState().markSaved();
}
