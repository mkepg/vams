import type { BrowserCompileResult } from './compile';

/** What the page sends the compiler worker. */
export type CompilerRequest = { type: 'prepare'; version: string } | { type: 'compile'; id: number; source: string };

/**
 * What the compiler worker sends back. `progress` counts bytes as stored. `started` says a compile
 * has left the queue and is running, which starts its time limit. `network` is false when the
 * files arrived but the compiler didn't start.
 */
export type CompilerReply =
  | { type: 'progress'; received: number; total: number }
  | { type: 'ready' }
  | { type: 'started'; id: number }
  | { type: 'download-failed'; network: boolean }
  | { type: 'result'; id: number; result: BrowserCompileResult | { kind: 'failed' } };
