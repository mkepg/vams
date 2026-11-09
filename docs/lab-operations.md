# VAMS Lab operations

How the Lab's runtime is built and published, and what exists on Cloudflare for it.

The Lab compiles a student's program in their own browser. The design is in [specs/2026-11-08-lab-browser-compile-design.md](specs/2026-11-08-lab-browser-compile-design.md), and the rest of the Lab in [specs/2026-10-28-vams-lab-design.md](specs/2026-10-28-vams-lab-design.md).

In short, a runtime version holds three things:

- **The main module:** libc, libc++, stb_image and the GL and GLUT bridges, built with Emscripten.
- **The compiler:** clang and wasm-ld built for WebAssembly, from the pinned `@yowasp/clang`.
- **The headers the compiler reads.**

The Lab page downloads none of the compiler until Run or Download now asks for it. It then keeps the compiler in Cache Storage, so later visits download nothing. A browser that can't keep it there (no Cache Storage, or a full quota) keeps it in the compiler worker's memory for the visit, and downloads it again on the next. A download that sends nothing for 30 seconds fails, and Run says so. Nothing in the Lab costs money to run, and nothing counts compiles.

## What exists where

### Cloudflare (Pages project `vams`)

| Thing | Name | Where it is set |
| --- | --- | --- |
| KV namespace | `SHARES`, id `7d85439fec8247699fb6cbef54207f94` | `wrangler.toml` |
| KV namespace | `LAB_RUNTIME`, id `03554bbf6ea4458bba35732e7e1f43db`: the runtime under `<version>/<file>` | `wrangler.toml` |
| Function | `/lab-runtime/<version>/<file>` (`functions/lab-runtime/[[path]].ts`) | the repository |

The function sends each file with a year-long immutable cache and `Cross-Origin-Resource-Policy: same-origin`. It sends a value stored with the metadata `{"encoding":"br"}` as it is stored, with `Content-Encoding: br`, and the browser unpacks it as it arrives.

### In the repository

| Thing | Where |
| --- | --- |
| The pinned Emscripten release | `lab/runtime/EMSDK_VERSION` |
| The main module's build, and the side-module flags | `lab/runtime/build.sh` |
| The headers pack | `lab/runtime/pack-headers.mjs`, run by `build.sh` |
| The pinned compiler | `@yowasp/clang` in `package.json` (devDependency, exact version) |
| The version the site loads | `src/features/lab-run/model/runtime-version.ts` |
| The notice's download size | `COMPILER_DOWNLOAD_MB` in `src/features/lab-compile/model/messages.ts` |

## Building the runtime

Docker runs the pinned Emscripten image:

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/src" -w /src \
  emscripten/emsdk:$(tr -d '\r\n' < lab/runtime/EMSDK_VERSION) sh lab/runtime/build.sh
```

Run this from the repository root. On Linux and macOS, use `$(pwd)` and drop `MSYS_NO_PATHCONV=1`.

It writes three files to `lab/runtime/out/`, which git leaves out:

- `vams_main.mjs` and `vams_main.wasm`, the main module;
- `lab-headers.json`, the headers pack.

The pack holds the sysroot's `include` folder, without its graphics, audio and browser headers, and `lab/include`. Each file is keyed by its path under `/lab`, where the compiler's file tree mounts it.

The main module is built with `-sDYNAMIC_EXECUTION=0`, so a program can't run JavaScript. Every path that would evaluate it aborts instead: `emscripten_run_script`, and the `EM_ASM` and `EM_JS` code a side module carries. VIS-LAB-08 checks this.

The main module also exports every other function of Emscripten's JavaScript library, and a program can declare any of them and call it. Some reach past the program: `emscripten_idb_*` open IndexedDB, `emscripten_wget` fetches, and `emscripten_create_worker` starts a worker from any URL, which would run a script of the program's own. So the program's worker takes away its storage, network and worker globals (`indexedDB`, `caches`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `BroadcastChannel`, `Worker`, `SharedWorker`, `importScripts`, `WebTransport` and `navigator.storage`) once the main module has loaded and just before the program's main runs (`src/features/lab-run/worker/seal-scope.ts`). The runtime needs none of them by then. SEC-LAB-16 checks the seal and when it happens, and VIS-LAB-10 and 11 run programs that try both paths.

`npm run dev` serves the local build and the compiler at `/lab-runtime/dev/`. It also makes the compiler's manifest from the files on disk.

## Publishing the runtime

```bash
node scripts/lab/publish-runtime.mjs --dry-run   # build, compress and check; uploads nothing
node scripts/lab/publish-runtime.mjs             # the same, then upload and write the version
```

Publishing needs Docker and a signed-in wrangler (`npx wrangler login`).

The script works in this order:

1. It builds the runtime into `lab/runtime/out/publish/`.
2. It copies in every file of `node_modules/@yowasp/clang/gen/`.
3. It names the version `<EMSDK_VERSION>-<sha8>`, where `sha8` comes from a SHA-256 over every file. A changed compiler, header or main module therefore always makes a new version.
4. It compresses each file with brotli at its highest setting, into `lab/runtime/out/publish-br/`.
5. It writes `compiler-manifest.json`. The manifest lists every file but the main module, each with its size unpacked and as stored.

It refuses to publish in these cases:

- a stored file is over KV's 25 MiB value limit;
- the compiler's download, rounded to megabytes, differs from `COMPILER_DOWNLOAD_MB`, which the notice states;
- `bundle.js` or `lab-headers.json` is missing.

It then uploads each file with `wrangler kv key put --remote --metadata '{"encoding":"br"}'`. Last, it writes the version into `runtime-version.ts`, which is committed.

The first published version measured 14.6 MB for `llvm.core.wasm`, 2.5 MB for `llvm-resources.tar` and 1.2 MB for the headers: about 18 MB in all.

A build with `LAB_LIVE = true` refuses the version `dev`, so the version must be published before the Lab goes live.

After the next deployment, check the live files:

```bash
curl -sI https://vams.pages.dev/lab-runtime/<version>/llvm.core.wasm   # HEAD: 200, content-encoding: br
```

A new version leaves the older ones in KV, and each browser deletes its cache of an older compiler the next time it opens the Lab.

## Checking the Lab with the real compiler

`npm test` never runs the real compiler. These visual specs run it in the page, against the local build:

```bash
LAB_RUNTIME_LOCAL=1 npx playwright test lab.spec lab-drawing lab-compiler
```

| Check | What it shows |
| --- | --- |
| VIS-LAB-01 to 04, 06 | The Lab's look, with the template running, and the Share dialog |
| VIS-LAB-05 | Each of the 21 battery programs draws as FreeGLUT draws it |
| VIS-LAB-07 | Nothing of the compiler downloads until Run or Download now; a reload asks only the cache |
| VIS-LAB-08 | A program that calls `emscripten_run_script` stops on an error, and its script never runs |
| VIS-LAB-09 | Every name the code generator emits compiles; every rejected name gives the VAMS message on its line |
| VIS-LAB-10 | A program that stores to IndexedDB through `emscripten_idb_async_store` stops, and no database appears |
| VIS-LAB-11 | A program that starts a worker through `emscripten_create_worker` stops on an error, and the worker's script never runs |

## Browsers

The gate is Chromium (Chrome and Edge), which the lab PCs run, and where the visual specs run.

Firefox gets one manual smoke run on the live site before the Lab goes on: download, compile and run one program.

| Date | Browser | Result |
| --- | --- | --- |
| | Firefox | pending |

## Where the browser's compile differs from the service's

The browser runs the service's include check (`checkIncludes`), diagnostics rewriter, source and message caps and flags unchanged. Two steps that only protected the server are gone:

- **Inline assembly built by a header's macro** now reaches clang. The service found it in `clang++ -E` output. Inline assembly written in the student's file, and `##`, are still refused before clang runs.
- **An include that reaches a file outside the headers through a path clang resolves** now reaches clang. The service found it in the `-H` trace. The compiler's tree holds only the headers pack, so clang finds a header or nothing.

Either kind can now compile, or fail with clang's own message. Neither can read anything but the compiler's own files.

The time limit is 30 seconds, from the compile's start; the service allowed 10 s on Cloud Run.

## Third-party code in the runtime

| Code | Licence |
| --- | --- |
| clang, LLVM and lld, built for WebAssembly | Apache 2.0 with LLVM exceptions |
| `@yowasp/clang`, which packages them | ISC |
| Emscripten's sysroot headers (musl, libc++, libc++abi), in the headers pack and the main module | MIT, and Apache 2.0 with LLVM exceptions for libc++ |
| stb_image | MIT or public domain |

## The earlier compile service

The Lab first compiled on a Cloud Run service, behind a $1 budget that switched billing off. It was never deployed: opening a Google Cloud billing account asked for a US$30 prepayment. The service was removed, and its last commit is tagged `lab-compile-service` (`e5b64f2`).

These paths held it:

- `lab/service/`: the service (server, compile, include check, diagnostics, usage counters, limits)
- `lab/toolchain/`: its Docker image and the pinned `EMSDK_VERSION`, now `lab/runtime/EMSDK_VERSION`
- `lab/billing-guard/`: the Cloud Function that unlinked billing at the budget
- `functions/api/compile.ts`: the Pages Function that forwarded to it, with its secrets in `functions/_lib/lab-env.ts`
- `scripts/lab/setup-gcp.sh`, `setup-helpers.mjs`, `load-test.mjs` and `toolchain-check.sh`
- `tests/white-box/lab-service.test.ts`, `lab-limits.test.ts`, `lab-scripts.test.ts` and `lab-billing-guard.test.ts`, with `tests/helpers/fake-firestore.ts` and `lab-http.ts`
- `tsconfig.lab.json`
- `src/features/lab-compile/model/compile-client.ts` and `visitor.ts`: the page's side of it
- this file, as it was then

To bring any of it back:

```bash
git checkout lab-compile-service -- lab/service lab/toolchain lab/billing-guard functions/api/compile.ts
```

Add the other paths above as needed. The service read the Pages secrets `LAB_COMPILE_URL` and `LAB_COMPILE_SECRET`, which are no longer set.
