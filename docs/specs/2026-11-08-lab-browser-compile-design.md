# VAMS Lab: compiling in the browser

This changes how the Lab compiles a student's program. It replaces the compile service on Google Cloud Run in [the Lab's design](2026-10-28-vams-lab-design.md). Everything else in that design stands: the page, the editor, the runtime, the 2D set, saving and sharing, and the drawing checks.

## Intent

The Lab was built to compile on Cloud Run's free tier, behind a $1 budget that switches billing off. That needs a Google Cloud billing account. Opening one from the Philippines asks for a US$30 prepayment, which the owner can't make. Every other host that was checked either costs money, needs a card, or is too small to run clang. Those were Hugging Face Docker Spaces, Cloudflare Containers, Render, Koyeb, Oracle and Azure for Students, checked 2026-11-08.

The browser can run the compiler itself. A WebAssembly build of clang and wasm-ld runs the same two steps the service ran, with the same flags. Nothing is hosted that costs money, there are no usage limits to keep, and it can never charge anyone.

## What a spike showed (2026-11-08)

The spike used `@yowasp/clang` 22.1.0 (npm `22.0.0-git20542-10`), with the service's flags and the headers from the service's image:

- All 21 battery programs compiled, and all 21 drew within VIS-LAB-05's tolerance against the emsdk 4.0.10 main module. The page checks VIS-LAB-01 to 04 and VIS-LAB-06 passed too.
- The largest program, `gallery-jeepney-street`, compiled in 0.7 to 1.6 s in Chrome, and the others in 0.1 to 0.6 s in Node. The module was byte for byte the same in Node and in Chrome.
- Compile errors arrived as clang wrote them, for example `main.cpp:1:20: error: use of undeclared identifier 'x'`.
- The download is about 17 MB for the compiler (75 MB raw), 3 MB for its resources (30 MB raw) and 1.2 MB for the headers (15 MB raw), all brotli-compressed: about 22 MB in all. Published at brotli's highest setting, it measured about 18 MB (14.6 MB, 2.5 MB and 1.2 MB), which is what the notice states.
- The same 21 programs passed VIS-LAB-05 again against a main module rebuilt with `-sDYNAMIC_EXECUTION=0` (below). Its dynamic linker still loads side modules, and every evaluation path in it aborts instead.
- `llvm-objcopy` fails in its sandbox ("Function not implemented"). The strip it did, which removes the `.debug*`, `producers` and `name` sections, is easy to do in JavaScript.

## Goals

- Run compiles the student's program in their own browser and runs it, as it does today.
- The Lab page opens as fast as it does today. The compiler is downloaded only when it is wanted (the owner's answer, below).
- After the first download, Run downloads nothing more until the runtime version changes.
- A program that compiled on the service compiles here and draws the same, and a program `checkIncludes` refused is refused here with the same message.
- A program can't run JavaScript, in its own worker or anywhere else (found while designing this, below).
- The site has no server beyond its Pages Functions and KV namespaces, as before the Lab.
- The old compile service stays findable in git (the owner's answer, below).

## Non-goals

- Changing the editor, saving, sharing, the GL emulation or the 2D set.
- Supporting browsers the Lab doesn't already support. The Lab already needs cross-origin isolation, WebAssembly exceptions and OffscreenCanvas.
- Opening the Lab offline. The service worker leaves `/lab` and the runtime to the network, because the page needs its isolation headers, and that stays.
- Keeping usage counters, rate limits or a budget. There is nothing left to spend.

## Anti-goals (failure even if it technically works)

- The Lab page, or any other page, downloads the compiler without being asked.
- A program that compiled on the service fails to compile here, or draws differently.
- A compile that hangs freezes the page, or loses the student's code.
- A shared link runs code that reaches the site's storage: the service worker's caches, the Lab's files in IndexedDB, or the compiler's cache.
- A student-facing message uses the banned wording: "coming soon", "not yet", "future", "deferred", "unsupported", "not supported", "3D", "lighting".
- The service, its scripts or its checks stay in the tree, unused.

## What the owner decided (2026-11-08)

- **Compile in the browser**, after Google, Azure for Students and the GitHub Student Developer Pack all fell through.
- **The download needs an action.** The first press of Run downloads the compiler, with a progress bar, and then compiles and runs. A notice also offers the download early, so a student can fetch it while they type.
- **Remove the old compile service**, and record where it is in git history so it can be brought back.
- The owner left every other decision in this document to the builder ("decide on your own"). Those are marked as the builder's calls.

## How it works

### Where the files come from

The compiler and the headers belong to the runtime version: `runtimeVersion` names the main module, the headers it was built against and the compiler that builds side modules for it. `scripts/lab/publish-runtime.mjs` publishes all of them to the `LAB_RUNTIME` KV namespace under `<version>/...`, and `/lab-runtime/<version>/<file>` serves them, cached for a year, as it serves the main module today.

- **The compiler:** the files in `@yowasp/clang`'s `gen/` folder (`bundle.js`, `llvm.core.wasm`, `llvm.core2.wasm` to `llvm.core4.wasm`, `llvm-resources.tar`), under `<version>/compiler/`. The package is a devDependency pinned to the exact version, so the site's own bundle never includes it.
- **The headers:** the emsdk sysroot's `include` folder, without the folders the service's Dockerfile removed (`GL GLES GLES2 GLES3 EGL KHR SDL AL X11 GLFW webgl webgpu emscripten emscripten.h`), and `lab/include`. `lab/runtime/build.sh` already runs in the pinned emsdk image, so it packs them there into `lab-headers.json`, beside the main module. The pack maps each path under `/lab` (`sysroot/include/...`, `include/...`) to the file's text: the paths the service's image used, so the diagnostics rewriter's path rules hold unchanged.
- **A manifest:** `<version>/compiler/manifest.json` lists each file with its size unpacked and as stored. The loader fetches it when a download starts, for the progress bar. *(Builder's call.)*
- **Compression:** files are stored brotli-compressed (KV metadata `{ "encoding": "br" }`) and served with `Content-Encoding: br`, so the browser unpacks them as they arrive. The largest, `llvm.core.wasm`, is about 17 MB stored, under KV's 25 MiB value limit. `publish-runtime.mjs` refuses to publish a value over 25 MiB, so no file is split. *(Builder's call: KV rather than Pages static files, because Pages caps a file at 25 MiB too and its compression of a large file isn't guaranteed. Precompressed KV values are.)*
- The dev server serves the same files under `/lab-runtime/dev/`, from `node_modules/@yowasp/clang/gen/` and `lab/runtime/out/`.

### Getting the compiler

- The compiler runs in its own Web Worker, separate from the program's worker, so a compile that hangs can be stopped by terminating it. The worker is kept between compiles, so the compiler is started once per page. *(Builder's call.)*
- **Not downloaded:** the page loads nothing of the compiler. A dismissible notice above the editor says "Run uses a compiler that downloads once (about 18 MB)." with a **Download now** button. Dismissing it is remembered in this browser. The number in it is a constant, and `publish-runtime.mjs` refuses to publish if the stored total rounds to a different number of megabytes.
- **Downloading:** pressing Run, or Download now, starts one download. The notice shows a progress bar and "Downloading the compiler… 8 of 18 MB", and comes back for the download if it was dismissed. Pressing Run during an early download waits for it, then compiles. Stopping Run during a download stops the run but lets the download finish, since it is needed anyway. Leaving the page stops the download, and the next try starts again. *(Builder's call.)*
- **Ready:** the files are kept in Cache Storage, in a cache named for the runtime version (`vams-lab-compiler-<version>`). The page asks that cache, without the network, whether every file is there, and hides the notice when it is. A new runtime version deletes the caches of older versions. *(Builder's call: Cache Storage rather than the HTTP cache, because the page can ask it what it holds, and it keeps a 75 MB file the HTTP cache may drop.)*
- **Download failed:** Run shows "The compiler couldn't download. Your code is saved in this browser. Try Run again." With no connection before the first download, it shows "Run needs the internet the first time, to download the compiler. Your code is saved in this browser."
- The headers are unpacked into the compiler's file tree once per worker, not once per compile.

### Compiling

The browser runs the service's compile, minus the steps that only protected the server:

- **Kept, moved unchanged:**
  - `checkIncludes`. It refuses paths, unlisted headers, includes built from macros, inline assembly and the other directives and operators it refuses today, with the same messages. It also rewrites the source as the service did: header names take `lab/include`'s spelling (`<Windows.h>` finds `windows.h`), a bundled header in quotes is written in `<>`, and `#pragma comment(...)` and `#pragma warning(...)` become spaces. The course's programs rely on those rewrites.
  - The diagnostics rewriter: rejected names, undeclared GL names, header errors moved to the student's line, no paths.
  - The 200 KB source cap and its message.
  - The 256 KB cap on the compiler's messages and its message.
  - The flags: clang++ `-c`, then wasm-ld, with `lab/runtime/build.sh`'s `SIDE_CC_FLAGS` and `SIDE_LD_FLAGS`, and the report flags `-fno-color-diagnostics -fno-caret-diagnostics -fno-crash-diagnostics`. The flags live in one place, and a test checks they agree with `build.sh`.
- **Dropped:** `clang++ -E` with `checkExpanded`, the `-H` include trace, ulimit, and the temporary folder. The browser compiler sees only the files it is handed, so there is no server file to reach. Two refusals change with them, and `docs/lab-operations.md` records it: inline assembly that a header's macro builds now reaches clang, and so does an include that reaches a file outside the headers through a path clang resolves (the sysroot holds only headers, so it finds a header or nothing). Either can now compile, or fail with clang's own message. *(Builder's call: neither can read anything but the compiler's own files.)*
- **Strip:** the `.debug*`, `producers` and `name` sections are removed in JavaScript, after wasm-ld.
- **Time limit:** the service stopped a compile at 10 s on Cloud Run. A lab PC is slower, so the browser allows 30 s. The time counts from the compile's start, not the compiler's first start-up. Over the limit, the compile worker is terminated, and the compile ends with the service's message, "The compile took longer than 30 seconds, so it was stopped." The next Run starts a fresh worker from the cache. *(Builder's call.)*
- **A compiler that dies** (out of memory, say) ends the compile with the existing "The Lab couldn't compile this time. Your code is saved in this browser. Try Run again.", and the next Run starts a fresh worker.
- The compile result keeps its kinds `ok`, `errors` and `failed`, and gains `offline`'s new wording and a `download` failure. `resting`, `limited`, the busy retry and their messages go away. The run controller and the page change only where they show those.

### A program can't run JavaScript

This was true before the change too. The main module is built with `-sMAIN_MODULE=1`, so a side module can call `emscripten_run_script`, and the dynamic linker evaluates the `EM_ASM` and `EM_JS` code a side module carries. A program, or a shared link the instructor runs, could then run JavaScript in the program's worker. That worker is same-origin, so the JavaScript could rewrite the service worker's caches and the Lab's IndexedDB files. The Lab was never switched on, so this was never live, but it is fixed before the Lab goes on.

- `lab/runtime/build.sh` adds `-sDYNAMIC_EXECUTION=0` to the main module. Every evaluation path then aborts instead ("DYNAMIC_EXECUTION=0 was set, cannot eval"), and the program ends as a crash does.
- A test checks the flag is in `build.sh`, and a visual Lab check runs a program that calls `emscripten_run_script` and sees it end without the script running.
- The 21 battery programs pass VIS-LAB-05 against the rebuilt main module.

## Browsers and machines

- The gate is Chromium: Chrome and Edge, which the lab PCs run. The visual Lab specs run there.
- Firefox gets one manual smoke run (download, compile, run one program) before the Lab goes on, recorded in `docs/lab-operations.md`. If it fails, the Lab stays as it is in that browser: a compiler that can't start ends the compile with the existing failed message.
- A machine that runs out of memory gets the same message, by the "compiler that dies" path above.

## Where this ends

The work ends with the Lab live on vams.pages.dev, which is what the owner asked for when they started the deployment:

1. merge to `main`, push, and push the tag `lab-compile-service` on `e5b64f2`;
2. publish the runtime, with the compiler and headers, to the production `LAB_RUNTIME` namespace with `publish-runtime.mjs`, and commit the `runtimeVersion` it writes;
3. remove `LAB_COMPILE_URL` and `LAB_COMPILE_SECRET` from the Pages project if they were ever set;
4. set `LAB_LIVE = true`, push, and check the live Lab: no compiler request on opening it, Download now, then Run on an example.

## What goes away

- `lab/service/`, `lab/toolchain/` (the service's image; `EMSDK_VERSION` moves to `lab/runtime/EMSDK_VERSION`), `lab/billing-guard/`, `functions/api/compile.ts` and its helpers.
- `scripts/lab/setup-gcp.sh`, `setup-helpers.mjs`, `load-test.mjs` and `toolchain-check.sh`.
- The Pages secrets `LAB_COMPILE_URL` and `LAB_COMPILE_SECRET`, and their note in `wrangler.toml`.
- The service's tests: the tests of the service, the counters, the billing guard, the compile function and the GCP scripts. `checkIncludes`'s tests (SEC-LAB-01 to 03 and 11 to 15) and the flags check (WB-LAB-13) move with their code, keeping their IDs. The checks that need the service's image are dropped.
- The browser's visitor id, which existed for the rate limits.
- `docs/lab-operations.md` is rewritten for what stays: building and publishing the runtime, and the KV namespace.

The last commit that has the service, main's `e5b64f2`, is tagged `lab-compile-service`, and the tag is pushed. A section of `docs/lab-operations.md`, "The earlier compile service", names the tag, lists the paths above, and gives the command that restores them: `git checkout lab-compile-service -- <paths>`.

## Testing

- **Unit (in `npm test`):**
  - the compiler loader's states (not downloaded, downloading, ready, failed), the offline message, and the cache check that hides the notice;
  - the notice: shown, dismissed and remembered, back during a download, hidden when ready;
  - Run starting the download, and a second Run during a download waiting for it;
  - the 30 s stop and a compiler that dies;
  - the section strip, on a module with and without those sections;
  - the flags agreeing with `build.sh`, and `-sDYNAMIC_EXECUTION=0` in the main module's flags;
  - `checkIncludes`'s and the diagnostics rewriter's existing tests, moved;
  - the run controller and the page with the result kinds that remain;
  - `publish-runtime.mjs`: the compressed values, the size refusal, the manifest and the megabyte check.

  The real compiler isn't run in `npm test`.
- **With the real compiler:** the visual suite's Lab specs run the real compiler in the page against a local build of the runtime and the headers, with `LAB_RUNTIME_LOCAL=1` replacing `LAB_DOCKER=1`:
  - VIS-LAB-01 to VIS-LAB-06, as today;
  - a check that the page made no compiler request before Run or Download now;
  - the `emscripten_run_script` check above;
  - every name in the 2D set compiles, and every rejected name gives the VAMS message on its line.
- **Wording:** the new messages join the Language Discipline check.
- lint, build and `npm test` pass on Node 20 and 22. The Lab captures are re-recorded where the notice changes them.

## Left to the builder

- The notice's exact place and look, on the tokens, in both themes and at 390 px.
- How the loader feeds `@yowasp/clang` its files from Cache Storage: wrapping `fetch` in the worker, or its `fetchProgress` option.
- Credits for clang and LLVM (Apache 2.0 with LLVM exceptions) and the headers' licences, beside the Lab's other third-party notices if it has any, or in `docs/lab-operations.md` if not.

## Product plan and roadmap

- The product plan's **Compile** line (Lab section) is rewritten to say that Run compiles in the browser with clang built for WebAssembly, downloaded once on the first Run or from the notice. The line about `LAB_LIVE` changes: the route appears once the runtime is published, not "once the compile service is live".
- The amendment that said the site's server "now also covers the compile service on Cloud Run" is withdrawn. The site again has no server beyond its Pages Functions and KV namespaces.
- Item 25 in the roadmap's list of differences from the manuscript says the program is compiled in the student's browser, not by a compile service.
- The earlier Lab design's sections on the compile service get a line at their top pointing here.
