# VAMS Lab operations

How the Lab's runtime is built and published, and what exists on Cloudflare for it.

The Lab compiles a student's program in their own browser. The design is in [specs/2026-11-08-lab-browser-compile-design.md](specs/2026-11-08-lab-browser-compile-design.md), and the rest of the Lab in [specs/2026-10-28-vams-lab-design.md](specs/2026-10-28-vams-lab-design.md).

In short, a runtime version holds three things:

- **The main module:** libc, libc++, stb_image and the GL and GLUT bridges, built with Emscripten.
- **The compiler:** clang and wasm-ld built for WebAssembly, from the pinned `@yowasp/clang`.
- **The headers the compiler reads.**

The Lab page downloads none of the compiler until Run or Download now asks for it. It then keeps the compiler in Cache Storage, so later visits download nothing. Every file of it, the entry point `bundle.js` too, is read from that cache, never from the browser's HTTP cache. The download's progress counts bytes as stored, the size the notice gives. Under the dev server (runtime version `dev`) the manifest is fetched on every start and lists each file's modified time, so a rebuilt file is fetched again. A browser that can't keep it there (no Cache Storage, or a full quota) keeps it in the compiler worker's memory for the visit, and downloads it again on the next. A download that sends nothing for 30 seconds fails, and Run says so. Nothing in the Lab costs money to run, and nothing counts compiles.

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

The pack holds the sysroot's `include` folder, without its graphics, audio and browser headers, and `lab/include`. Each file is keyed by its path under `/lab`, where the compiler's file tree mounts it. It also holds `symbols.txt`: every name a program's side module can find when it loads, which is the main module's exports and the functions of Emscripten's JavaScript library. wasm-ld reads it as `--allow-undefined-file`, so a program that uses a name it never defines stops at the link, as on a lab PC, instead of when it reaches the call.

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

A build with `LAB_LIVE = true` refuses the version `dev`, so the version must be published before the Lab goes live. The first version, `4.0.10-76e5dc0b`, was published on 9 Nov 2026, and the Lab went live with it. The second, `4.0.10-bfcc5346`, was published on 25 Nov 2026: the main module gives a program a 2 MB stack and 2 GB of memory, and names an exception nothing caught ([The Lab in a class](specs/2026-11-25-lab-class-design.md)). The third, `4.0.10-e8461e5b`, published the same day, adds `symbols.txt` to the pack, and `bits/stdc++.h`, `glew.h`, `GL/glext.h` and FreeGLUT's special keys to the headers ([Clear when refused](specs/2026-11-25-lab-refusals-design.md)).

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
| VIS-LAB-05 | Each of the 28 battery programs draws as FreeGLUT draws it |
| VIS-LAB-07 | Nothing of the compiler downloads until Run or Download now; a reload asks only the cache |
| VIS-LAB-08 | A program that calls `emscripten_run_script` stops on an error, and its script never runs |
| VIS-LAB-09 | Every name the code generator emits compiles; every rejected name gives the VAMS message on its line |
| VIS-LAB-10 | A program that stores to IndexedDB through `emscripten_idb_async_store` stops, and no database appears |
| VIS-LAB-11 | A program that starts a worker through `emscripten_create_worker` stops on an error, and the worker's script never runs |
| VIS-LAB-12 | The gallery's jeepney drives across the window as fast in the Lab as in the editor's Run |
| VIS-LAB-13 | A sample of GLUT misuse prints FreeGLUT's messages and ends with its exit codes |
| VIS-LAB-14 | Timers fire within 1 ms of the reference's, and an idle loop isn't held to the page's refresh |
| VIS-LAB-15 | A script of keys and mouse actions gives the program FreeGLUT's callbacks, line for line |

## How fast a program runs

On the lab PCs' Intel GPU, `glutSwapBuffers` doesn't wait for the screen, so an idle loop runs as fast as the PC can go: about 1,750 frames a second for a trivial frame on the reference. The Lab does the same. `glutSwapBuffers` hands the frame to the page and returns, and the page shows the newest frame at each refresh, as Windows' compositor does.

The Lab draws in software, so it draws only frames the page will show. A frame run before the page has taken the last one is held back from drawing (`GLContext.hold`). Held drawing is dropped when the next frame clears the whole window, and drawn in order when it doesn't. So a scene slow to draw still runs all its frames and keeps its pace, and the page shows the newest one drawn. When the page takes the last frame while the frame run since is still held, that held frame is drawn at once, before the program's next idle call, rather than when the program next draws: a program paced by the clock has nothing to draw until its next step. When the program stops to wait (a `Sleep`, a read from the Console, no idle work and no timer due, or its end), the last frame it ran is drawn and shown.

Drawing is the cost that limits a frame. The gallery's jeepney street, 800 × 450 with 4× multisampling, took 44 ms a frame in Node before 25 Nov 2026 and takes about 19 ms since (CPU time, best of five batches). Every pixel is the same; see [Faster drawing](specs/2026-11-25-lab-drawing-speed-design.md).

Since 26 Nov 2026 a frame is drawn on several threads. The program's worker starts up to three drawing helpers (`lab-raster`), one per spare core, before the program runs. The program's drawing is queued as data, and when the frame is shown each helper draws a band of its rows into the shared framebuffer while the program's worker draws the first. The bands are cut from the time the last frame's took, so the threads finish together. The jeepney's frame went from about 13 ms to about 7 ms in Chrome on the reference laptop, and the editor's Run view, whose worker draws bands with band workers of its own, from about 15 ms to about 8 ms. Every pixel is the same; see [Drawing on several cores](specs/2026-11-26-multicore-drawing-design.md). A helper that fails or doesn't answer within 10 seconds is stopped and the frames go on without it, and a PC with two cores or fewer draws on the program's thread alone.

Timers keep their time, as FreeGLUT's do in a window that can be seen. The runtime sleeps until shortly before a timer is due and spins the rest, because a browser's wait can wake a millisecond or a whole Windows tick late.

Exported VAMS code doesn't race. Its `_vams_idle` takes a step only 60 times a second, by `glutGet(GLUT_ELAPSED_TIME)`, and the editor's Run steps 60 times a second whatever the screen's refresh rate. Both catch up at most 30 steps, half a second, so a scene the Lab draws slowly in software (400 ms a frame for 400 large multisampled triangles on the reference) still keeps its pace. So a scene moves at the same speed in the editor, in the Lab and on a lab PC. How each part was measured is in [GLUT behaviour](specs/2026-11-24-glut-behaviour-design.md).

## How the Lab runs GLUT

The Lab runs a program as FreeGLUT 3.0.0 (the course toolchain's) runs it on the reference:

- **Misuse:** the same messages, return values and exit codes, recorded case by case in `tests/fixtures/lab/glut/reference.json`.
- **Message prefix:** messages name the program as `x.bat` builds it on a lab PC, `c:\openglcpp\Program.exe`. A lab PC builds programs as Windows programs, so these messages never show there; the Lab shows them in the Console.
- **Closing:** the window's ✕ is its close button. The program's close callback runs and `glutMainLoop` ends as `GLUT_ACTION_ON_WINDOW_CLOSE` says. A program that doesn't take the close within a second, because it is busy or waiting for typed input, is stopped.
- **Matrix stacks:** they hold Intel's depths, 32 modelview and 4 projection matrices.

To record the misuse, input and crash batteries again, on a Windows PC with the course toolchain:

```bash
VAMS_GLUT_TOOLCHAIN='<the toolchain>\mingw32' node scripts/lab/capture-glut.mjs misuse events crash
```

The misuse battery runs each case as a program of its own, so a window opens and closes for each case that makes a window. The input battery is one window for a few seconds. It plays `events.script.txt` on itself by posting messages, so nothing else on the desktop is touched.

## When a program goes wrong

A program has what a lab PC's program has: MinGW's 2 MB stack (`-sSTACK_SIZE` in `build.sh`), and memory up to 2 GB, as a 32-bit program's. So a large local array works as it does there, and an allocation past 2 GB fails as it does there: `new` throws `std::bad_alloc`, and `malloc` gives `NULL`.

`tests/fixtures/lab/glut/crash.cpp` records how a lab PC ends each kind of crash, and VIS-LAB-16 runs every case in the Lab:

- **An exception nothing caught:** libstdc++'s lines, `terminate called after throwing an instance of '<type>'` and `what():`, printed as on a lab PC (the type and message come from the runtime's `getExceptionMessage`).
- **A crash:** a lab PC ends it with a Windows exception code and prints nothing. The Lab stops the program, and the Console says what happened in plain words: an exception nothing caught, `abort()`, a division by zero, memory outside the program's own, a stack that ran out, a bad function pointer, or code the compiler marked as never reached. A browser message the Lab doesn't know is shown as it came (`crash-words.ts`).
- **The named differences:** a write through a null pointer doesn't crash, because a program's memory starts at address 0 in the browser. The stack sits after the runtime's data, so a program that overflows its 2 MB writes over that data before it stops; it stops either way, at the depth where a lab PC's would. The Lab compiles with `-O1` where `x.bat` doesn't optimise, so undefined behaviour can end differently: a function that ends without returning its value stops on "never reached", and `1 / x` becomes a comparison that never divides.

A program that never ends is ended by the window's ✕, or Stop when it has no window. The code is never part of a run: a crash or a stop leaves the editor and its browser save as they were.

## When the Lab refuses a program

Each refusal names the line and says what to write instead ([Clear when refused](specs/2026-11-25-lab-refusals-design.md)):

- **A GL, GLU or GLUT name the Lab leaves out:** `<name> isn't part of VAMS Lab's OpenGL.`, then what to use. The names `vams_rejected.h` declares unavailable carry their advice in the header. Every other name of a lab PC's headers has a rule in `src/features/lab-compile/model/refusals.ts`, and BB-LAB-117 holds that none is missing: when a FreeGLUT or MinGW update adds names, run `scripts/lab/reference-names.mjs` and give the new ones rules. A mistyped name keeps clang's "did you mean".
- **A name used and never defined, or no `main`:** the link stops, and the Lab says it in plain words on the line that uses the name (`linkDiagnostics` in `diagnostics.ts`).
- **An include or a directive:** the include check (`includes.ts`) says which header to write, or that the Lab compiles one file, or lists the headers there are. It names the directive a mistyped one meant, and blanks the pragmas g++ reads past.

## In a class

- **The first download:** the compiler is about 18 MB, fetched once per browser at the first Run or Download now, then kept in Cache Storage. Forty machines fetching it at the start of a class share the room's network, so the instructor page asks for Download now on each machine beforehand. A new runtime version is a new download.
- **Compiling:** every compile runs in the student's browser, about a quarter of a second on the reference, so a class puts no load on the site. Nothing counts compiles.
- **Sharing:** a class shares from one network address. `SHARE_LIMITER` is not bound in production, so no rate limit applies to it.
- **The code:** it is saved in the browser on every change. A second Lab tab follows the newest save (`followOtherTabs`), so an older tab never writes its code back over newer work. A full or blocked localStorage says so once. Lab PCs that clear browser data at sign-out clear the code and the compiler with it, so students keep their work with Save or Share.

## What the Lab draws like

The Lab draws what FreeGLUT draws on the lab PCs, which have Intel graphics. The reference is the owner's laptop's Intel Iris Xe Graphics, driver 31.0.101.4502, because no lab PC is available to capture on. The rules it follows, and how each was measured, are in [One reference: Intel FreeGLUT, every pixel](specs/2026-11-24-intel-reference-design.md).

- **The check:** VIS-LAB-05 holds every battery program to every pixel within 2 of its reference. It runs with `LAB_RUNTIME_LOCAL=1 npx playwright test lab-drawing`.
- **Named exceptions:**
  - `gallery-clock` 12, `gallery-jeepney-street` 22, `gallery-parol` 68, `gallery-solar-system` 127, `modes-multisample` 4, `sizes-multisample` 29 and `state-ops` 20 pixels: each is one sample of a multisampled line's edge, which Intel's fixed-point edge setup puts inside the line and no model here matches.
  - `gallery-pixel-fox` 10 pixels: one row where a pixel centre falls exactly on a texel boundary under `GL_NEAREST`.
- **Recording:** record again with `scripts/lab/capture-reference.mjs` on a laptop whose integrated GPU is Intel. The capture shim asks for no particular GPU, and recording refuses any other renderer, or sample positions that aren't Intel's.
- **The file name trap:** the NVIDIA driver sends some file names to the discrete GPU whatever the shim asks; `resolve.exe` is DaVinci Resolve's. Name probe programs `vams-*.exe`.

## Browsers

The gate is Chromium (Chrome and Edge), which the lab PCs run, and where the visual specs run.

Firefox gets one manual smoke run on the live site before the Lab goes on: download, compile and run one program.

| Date | Browser | Result |
| --- | --- | --- |
| 9 Nov 2026 | Chrome, Windows 11 | The live build's preview deployment, runtime `4.0.10-76e5dc0b`. Opening `/lab` fetched nothing of the compiler. Download now took 5 s. Jeepney street compiled and ran in about 2 s. After a reload, Run went straight to Compiling. |
| 9 Nov 2026 | Firefox 155, Windows 11 | The same deployment. The page is cross-origin isolated. Download now took 7 s. Solar system compiled and ran in 1.4 s, with no console errors. |

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
