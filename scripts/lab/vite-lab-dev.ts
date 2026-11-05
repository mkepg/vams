import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

const TYPES: Record<string, string> = {
  mjs: 'text/javascript; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  wasm: 'application/wasm',
};
const DEV_FILE = /^\/lab-runtime\/dev\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;

/** The file `/lab-runtime/dev/<file>` names in the local runtime build, or null when there isn't one. */
export function labRuntimeFile(pathname: string, dir: string): { path: string; type: string } | null {
  const match = DEV_FILE.exec(pathname);
  if (!match || match[1].includes('..')) return null;
  const path = join(resolve(dir), match[1]);
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  const type = TYPES[match[1].slice(match[1].lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';
  return { path, type };
}

/** Whether a path is the Lab page, which needs the isolation headers. */
export function isLabPage(pathname: string): boolean {
  return pathname === '/lab' || pathname.startsWith('/lab/');
}

/** The Lab's program worker, as the build names it from src/features/lab-run/worker/lab-worker.ts. */
const LAB_WORKER = 'lab-worker';

/**
 * Where the build puts each worker script. The Lab's program worker goes under /lab/, so it gets
 * the isolation headers public/_headers gives /lab/*: on an isolated page a worker script served
 * without COEP doesn't start. Any other worker stays in /assets/ as before. What a worker imports
 * needs no COEP of its own, so chunks and assets keep their usual place.
 */
export const LAB_WORKER_OUTPUT = {
  entryFileNames: (chunk: { name: string }) => (chunk.name === LAB_WORKER ? 'lab/[name]-[hash].js' : 'assets/[name]-[hash].js'),
};

/** Whether a built file is the Lab's program worker: what a build with the Lab off leaves out. */
export function isLabWorkerFile(fileName: string): boolean {
  return new RegExp(`^lab/${LAB_WORKER}-[\\w-]+\\.js$`).test(fileName.replace(/\\/g, '/'));
}

/** Whether a dev request is for a worker script: the browser says so, and Vite marks its worker URLs. */
export function isWorkerScript(req: { url?: string; headers?: Record<string, string | string[] | undefined> }): boolean {
  return req.headers?.['sec-fetch-dest'] === 'worker' || /[?&]worker_file(&|=|$)/.test(req.url ?? '');
}

/**
 * Dev server only: serves the runtime built in `dir` at /lab-runtime/dev/ as the production
 * function serves it from KV, and sends the isolation headers /lab gets from public/_headers.
 */
export function labDevServer(dir: string): Plugin {
  return {
    name: 'vams-lab-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split(/[?#]/)[0];
        // The page, and the worker it starts, which must be isolated too.
        if (isLabPage(pathname) || isWorkerScript(req)) {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          return next();
        }
        if (!pathname.startsWith('/lab-runtime/')) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET, HEAD');
          res.end();
          return;
        }
        const file = labRuntimeFile(pathname, dir);
        if (!file) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', file.type);
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        const stream = createReadStream(file.path);
        stream.on('error', () => {
          // A file removed while a rebuild runs: end the answer, whatever has been sent.
          if (res.headersSent) res.destroy();
          else {
            res.statusCode = 404;
            res.end();
          }
        });
        stream.pipe(res);
      });
    },
  };
}
