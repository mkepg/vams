/**
 * What the program worker takes away before a student's main runs.
 *
 * The main module is built with MAIN_MODULE=1, so it exports every function of Emscripten's
 * JavaScript library, and a program can declare any of them extern "C" and call it:
 * emscripten_idb_* open IndexedDB, emscripten_wget and the fetch API fetch, and
 * emscripten_create_worker starts a worker from any URL, which runs a script of the program's
 * own. The worker has the site's origin, so each would reach the site's storage or the network.
 * Taking the globals away makes every such call fail, while the runtime, loaded by then, needs
 * none of them: it draws, reads its files and talks to the page through shared memory.
 */

/** The worker globals that reach storage, the network, or another script. */
export const SEALED_GLOBALS = [
  'indexedDB',
  'caches',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'BroadcastChannel',
  'Worker',
  'SharedWorker',
  'importScripts',
  'WebTransport',
] as const;

/** Defines `name` on `target` as undefined, for good; assigns it when the property can't be redefined. */
function seal(target: object, name: string): void {
  try {
    Object.defineProperty(target, name, { value: undefined, writable: false, configurable: false });
  } catch {
    try {
      (target as Record<string, unknown>)[name] = undefined;
    } catch {
      // Neither redefinable nor writable: the property is already fixed.
    }
  }
}

/** Takes the storage, network and worker globals away from `scope`, and navigator.storage with them. */
export function sealProgramScope(scope: object): void {
  for (const name of SEALED_GLOBALS) seal(scope, name);
  const navigator = (scope as { navigator?: object }).navigator;
  if (navigator) seal(navigator, 'storage');
}
