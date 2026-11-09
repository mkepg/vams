import type { BrowserCompileResult } from './compile';

/** What the page sends the compiler worker. */
export type CompilerRequest = { type: 'prepare'; version: string } | { type: 'compile'; id: number; source: string };

/** What the compiler worker sends back. `network` is false when the files arrived but the compiler didn't start. */
export type CompilerReply =
  | { type: 'progress'; received: number; total: number }
  | { type: 'ready' }
  | { type: 'download-failed'; network: boolean }
  | { type: 'result'; id: number; result: BrowserCompileResult | { kind: 'failed' } };
