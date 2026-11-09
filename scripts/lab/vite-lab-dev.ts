import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

const TYPES: Record<string, string> = {
  mjs: 'text/javascript; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  wasm: 'application/wasm',
  json: 'application/json; charset=utf-8',
  tar: 'application/x-tar',
};
const DEV_FILE = /^\/lab-runtime\/dev\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;

/** Where the pinned @yowasp/clang keeps the compiler's files. */
export const COMPILER_DIR = 'node_modules/@yowasp/clang/gen';
/** The compiler's file list, which a published runtime stores and the dev server makes. */
export const MANIFEST = 'compiler-manifest.json';
/** The headers pack lab/runtime/build.sh writes beside the main module. */
export const HEADERS_PACK = 'lab-headers.json';

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();
const typeOf = (name: string) => TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';

/**
 * The file `/lab-runtime/dev/<file>` names: in the local runtime build, then among the compiler's
 * files, or null when there isn't one.
 */
export function labRuntimeFile(pathname: string, dir: string, compilerDir = COMPILER_DIR): { path: string; type: string } | null {
  const match = DEV_FILE.exec(pathname);
  if (!match || match[1].includes('..')) return null;
  for (const root of [dir, compilerDir]) {
    const path = join(resolve(root), match[1]);
    if (isFile(path)) return { path, type: typeOf(match[1]) };
  }
  return null;
}

/**
 * The compiler's file list for the local files: every file of the compiler, then the headers
 * pack, each stored as it is (the dev server compresses nothing), with the time it last changed,
 * so a browser holding the dev compiler fetches a rebuilt file again.
 */
export function devManifest(
  dir: string,
  compilerDir = COMPILER_DIR,
): { files: { name: string; bytes: number; stored: number; modified: number }[] } | null {
  const compiler = resolve(compilerDir);
  const pack = join(resolve(dir), HEADERS_PACK);
  if (!existsSync(compiler) || !isFile(pack)) return null;
  const entries = readdirSync(compiler)
    .filter((name) => isFile(join(compiler, name)))
    .sort()
    .map((name) => ({ name, path: join(compiler, name) }));
  return {
    files: [...entries, { name: HEADERS_PACK, path: pack }].map(({ name, path }) => {
      const { size: bytes, mtimeMs } = statSync(path);
      return { name, bytes, stored: bytes, modified: Math.round(mtimeMs) };
    }),
  };
}

/** Whether a path is the Lab page, which needs the isolation headers. */
export function isLabPage(pathname: string): boolean {
  return pathname === '/lab' || pathname.startsWith('/lab/');
}

/**
 * The Lab's workers, as the build names them: the program worker from
 * src/features/lab-run/worker/lab-worker.ts and the compiler worker from
 * src/features/lab-compile/worker/lab-compiler.ts.
 */
const LAB_WORKERS = ['lab-worker', 'lab-compiler'];

/**
 * Where the build puts each worker script. The Lab's workers go under /lab/, so they get
 * the isolation headers public/_headers gives /lab/*: on an isolated page a worker script served
 * without COEP doesn't start. Any other worker stays in /assets/ as before. What a worker imports
 * needs no COEP of its own, so chunks and assets keep their usual place.
 */
export const LAB_WORKER_OUTPUT = {
  entryFileNames: (chunk: { name: string }) => (LAB_WORKERS.includes(chunk.name) ? 'lab/[name]-[hash].js' : 'assets/[name]-[hash].js'),
};

/** Whether a built file is one of the Lab's workers: what a build with the Lab off leaves out. */
export function isLabWorkerFile(fileName: string): boolean {
  return new RegExp(`^lab/(?:${LAB_WORKERS.join('|')})-[\\w-]+\\.js$`).test(fileName.replace(/\\/g, '/'));
}

/** Whether a dev request is for a worker script: the browser says so, and Vite marks its worker URLs. */
export function isWorkerScript(req: { url?: string; headers?: Record<string, string | string[] | undefined> }): boolean {
  return req.headers?.['sec-fetch-dest'] === 'worker' || /[?&]worker_file(&|=|$)/.test(req.url ?? '');
}

/**
 * Dev server only: serves the runtime built in `dir`, and the compiler, at /lab-runtime/dev/ as the production
 * function serves it from KV, and sends the isolation headers /lab gets from public/_headers.
 */
export function labDevServer(dir: string, compilerDir = COMPILER_DIR): Plugin {
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
        if (pathname === `/lab-runtime/dev/${MANIFEST}`) {
          const manifest = devManifest(dir, compilerDir);
          res.statusCode = manifest ? 200 : 404;
          res.setHeader('Content-Type', TYPES.json);
          res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
          res.setHeader('Cache-Control', 'no-store');
          res.end(manifest && req.method === 'GET' ? JSON.stringify(manifest) : undefined);
          return;
        }
        const file = labRuntimeFile(pathname, dir, compilerDir);
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
