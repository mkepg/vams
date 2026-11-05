/**
 * The student's files, as the program sees them. A lab program names a file by a path on the lab
 * PC (`C:\Users\x\Desktop\skibidi.png`, `./Input.txt`), and the Lab finds it by its file name in
 * the file list, ignoring case, as Windows does. The files live in MEMFS under FILES_DIR, and
 * FS.open and FS.stat are wrapped so every path the program gives resolves there.
 *
 * Opening a name that isn't in the list prints which name was looked for. A file opened for
 * writing is reported, with its bytes, when it is closed, so it can join the list.
 */
import type { LabFile } from '../model/protocol';
import type { ConsoleIO } from './console-io';
import type { WorkerHost } from './event-queue';

/** Where the files are mounted. */
export const FILES_DIR = '/files';

/** The Console line for a name that isn't in the list. */
export const missingMessage = (name: string) => `Looked for ${name}, which isn't in your files.`;

/** The part of Emscripten's FS the Lab uses. */
export interface LabFS {
  open(path: unknown, flags: number | string, mode?: number): FSStream;
  close(stream: FSStream): void;
  stat(path: unknown, dontFollow?: boolean): unknown;
  mkdir(path: string, mode?: number): unknown;
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
}

export type FSStream = object;

export interface FileReports {
  /** A file the program opened to read that isn't in the list. */
  missing(name: string): void;
  /** A file the program wrote, with the bytes it holds now. */
  written(name: string, bytes: Uint8Array): void;
}

/** The reports a running program makes: a missing name on the Console, a written file to the page. */
export function fileReports(console: ConsoleIO, host: WorkerHost): FileReports {
  return {
    missing: (name) => console.write('stderr', `${missingMessage(name)}\n`),
    written: (name, bytes) => host.post({ type: 'fileWritten', name, bytes }),
  };
}

// Paths the runtime itself uses, which keep their meaning.
const SYSTEM = /^\/(dev|proc|tmp)(\/|$)/;

/** The file name at the end of a path, whichever way its slashes lean. */
export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? '';
}

// O_ACCMODE; anything but O_RDONLY writes. Emscripten's mode strings, as FS.open reads them.
const ACCESS = 3;
const MODE_FLAGS: Record<string, number> = { r: 0, 'r+': 2, w: 577, 'w+': 578, a: 1089, 'a+': 1090 };

function writes(flags: number | string): boolean {
  const f = typeof flags === 'string' ? (MODE_FLAGS[flags] ?? 0) : flags;
  return (f & ACCESS) !== 0;
}

/**
 * Mounts the files under FILES_DIR and wraps `fs` so the program finds them by name. `runtimePaths`
 * are paths the runtime opens itself (the program's module), which are left alone.
 */
export function installFiles(fs: LabFS, files: readonly LabFile[], reports: FileReports, runtimePaths: readonly string[] = []): {
  /** Reports every file still open for writing, as the program ends. */
  closeAll(): void;
} {
  fs.mkdir(FILES_DIR);
  // The names in the list, by their lower case; a name the program writes joins them.
  const names = new Map<string, string>();
  for (const f of files) {
    fs.writeFile(`${FILES_DIR}/${f.name}`, f.bytes);
    names.set(f.name.toLowerCase(), f.name);
  }
  const reported = new Set<string>();
  const writing = new Map<FSStream, string>();

  /** The path in MEMFS for a path the program gave, or null when the runtime's own. */
  const resolve = (path: string): { path: string; name: string; listed: boolean } | null => {
    if (SYSTEM.test(path) || runtimePaths.includes(path)) return null;
    const name = baseName(path);
    if (!name || name === '.' || name === '..') return null;
    const listed = names.get(name.toLowerCase());
    return { path: `${FILES_DIR}/${listed ?? name}`, name: listed ?? name, listed: listed !== undefined };
  };

  const open = fs.open.bind(fs);
  const close = fs.close.bind(fs);
  const stat = fs.stat.bind(fs);
  fs.open = (path, flags, mode) => {
    const r = typeof path === 'string' ? resolve(path) : null;
    if (!r) return open(path, flags, mode);
    if (!r.listed && !writes(flags) && !reported.has(r.name.toLowerCase())) {
      reported.add(r.name.toLowerCase());
      reports.missing(r.name);
    }
    const stream = open(r.path, flags, mode);
    if (writes(flags)) {
      names.set(r.name.toLowerCase(), r.name);
      writing.set(stream, r.name);
    }
    return stream;
  };
  fs.stat = (path, dontFollow) => {
    const r = typeof path === 'string' ? resolve(path) : null;
    return stat(r?.listed ? r.path : path, dontFollow);
  };
  const report = (stream: FSStream) => {
    const name = writing.get(stream);
    if (name === undefined) return;
    writing.delete(stream);
    reports.written(name, fs.readFile(`${FILES_DIR}/${name}`).slice());
  };
  fs.close = (stream) => {
    close(stream);
    report(stream);
  };
  return {
    closeAll: () => {
      for (const stream of [...writing.keys()]) report(stream);
    },
  };
}
