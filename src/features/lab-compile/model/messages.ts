import type { CompileResult } from './compiler';

/** The compiler download's size as stored, in the notice. scripts/lab/publish-runtime.mjs refuses a runtime whose total rounds to another number. */
export const COMPILER_DOWNLOAD_MB = 22;

/** What the page says about the compiler, and when Run cannot go ahead. Worded by the Lab spec. */
export const LAB_MESSAGES = {
  notice: `Run uses a compiler that downloads once (about ${COMPILER_DOWNLOAD_MB} MB).`,
  downloadNow: 'Download now',
  offline: 'Run needs the internet the first time, to download the compiler. Your code is saved in this browser.',
  download: "The compiler couldn't download. Your code is saved in this browser. Try Run again.",
  failed: "The Lab couldn't compile this time. Your code is saved in this browser. Try Run again.",
} as const;

/** The progress line while the compiler downloads: megabytes as stored, of the notice's total. */
export function downloadingMessage(received: number, total: number): string {
  const done = total > 0 ? Math.min(COMPILER_DOWNLOAD_MB, Math.floor((received / total) * COMPILER_DOWNLOAD_MB)) : 0;
  return `Downloading the compiler… ${done} of ${COMPILER_DOWNLOAD_MB} MB`;
}

/** The line to show for a result that did not produce a program, or null when there is nothing to say. */
export function compileMessage(result: CompileResult): string | null {
  switch (result.kind) {
    case 'offline':
      return LAB_MESSAGES.offline;
    case 'download':
      return LAB_MESSAGES.download;
    case 'failed':
      return LAB_MESSAGES.failed;
    default:
      return null;
  }
}
