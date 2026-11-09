/**
 * SECURITY TEST SUITE — SEC-LAB (what a running program can reach)
 * A Lab program runs in a worker with the site's origin. The main module exports every function
 * of Emscripten's JavaScript library, so a program can call, by name, the ones that open
 * IndexedDB, fetch, or start a worker. Before the program's main runs, the worker takes those
 * globals away, so each of those calls fails instead of reaching the site's storage, the network
 * or a script of the program's own.
 *
 *  - SEC-LAB-16: the seal leaves none of the globals that reach storage, the network or a new
 *    worker, and runProgram seals the worker after the main module loads and before main runs
 */
import { describe, expect, it } from 'vitest';
import { createSharedLayout } from '@/features/lab-run/model/shared-layout';
import { runProgram } from '@/features/lab-run/worker/lab-worker';
import { SEALED_GLOBALS, sealProgramScope } from '@/features/lab-run/worker/seal-scope';
import type { LabFS } from '@/features/lab-run/worker/lab-files';

/** As much of Emscripten's FS as a program with no files of its own needs. */
const fakeFS = (): LabFS => ({
  open: () => ({}),
  close: () => {},
  stat: () => ({ size: 0 }),
  mkdir: () => {},
  writeFile: () => {},
  readFile: () => new Uint8Array(0),
});

describe('SEC-LAB-16: A program finds no storage, network or worker of its own to reach', () => {
  it('names every global that reaches storage, the network or a new worker', () => {
    expect([...SEALED_GLOBALS].sort()).toEqual(
      [
        'BroadcastChannel',
        'EventSource',
        'SharedWorker',
        'WebSocket',
        'WebTransport',
        'Worker',
        'XMLHttpRequest',
        'caches',
        'fetch',
        'importScripts',
        'indexedDB',
      ].sort(),
    );
  });

  it('takes each one away for good, and the storage manager with them', () => {
    const scope: Record<string, unknown> = { navigator: { storage: { persist: () => true } } };
    for (const name of SEALED_GLOBALS) scope[name] = () => name;
    sealProgramScope(scope);
    for (const name of SEALED_GLOBALS) {
      expect(scope[name], name).toBeUndefined();
      // A program that tries to put one back finds it still gone.
      try {
        scope[name] = () => 'back';
      } catch {
        // Strict mode throws on a read-only property; either way it stays undefined.
      }
      expect(scope[name], name).toBeUndefined();
    }
    expect((scope.navigator as { storage?: unknown }).storage).toBeUndefined();
  });

  it('seals a scope whose globals are inherited, as a worker’s are', () => {
    const proto = { fetch: () => 'fetch', indexedDB: {} };
    const scope = Object.create(proto) as Record<string, unknown>;
    sealProgramScope(scope);
    expect(scope.fetch).toBeUndefined();
    expect(scope.indexedDB).toBeUndefined();
  });

  it('runProgram seals after the main module loads and before main runs', async () => {
    const steps: string[] = [];
    const start = { type: 'start' as const, module: new ArrayBuffer(0), files: [], shared: createSharedLayout(0) };
    await runProgram(
      start,
      () => {},
      async () => {
        steps.push('import');
        return async () => {
          steps.push('instantiate');
          return {
            FS: fakeFS(),
            ccall: () => {
              steps.push('main');
              return 0;
            },
          };
        };
      },
      () => steps.push('seal'),
    );
    expect(steps).toEqual(['import', 'instantiate', 'seal', 'main']);
  });

  it('a seal that throws stops the program before main runs', async () => {
    const posts: unknown[] = [];
    let ran = false;
    const start = { type: 'start' as const, module: new ArrayBuffer(0), files: [], shared: createSharedLayout(0) };
    await runProgram(
      start,
      (m) => posts.push(m),
      async () => async () => ({
        FS: fakeFS(),
        ccall: () => {
          ran = true;
          return 0;
        },
      }),
      () => {
        throw new Error('sealed');
      },
    );
    expect(ran).toBe(false);
    expect(posts).toEqual([{ type: 'crash', message: 'sealed' }]);
  });
});
