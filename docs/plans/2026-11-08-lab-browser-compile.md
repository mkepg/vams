# VAMS Lab: compiling in the browser, implementation plan

**Goal:** Run compiles the student's program in their own browser with `@yowasp/clang`, and the Cloud Run compile service is removed.

**Architecture:** The pure parts of the service's compile (`checkIncludes`, the diagnostics rewriter, the flags) move into `src/features/lab-compile/model/`, with a new section strip and a compile function that takes the two tools as parameters. A compile worker loads `@yowasp/clang` from the runtime version's files, keeps them in Cache Storage, and runs that compile function. The page side holds the compiler's download state in a small store that the notice and Run read. The runtime publish uploads the compiler and the headers pack beside the main module, brotli-compressed.

**Tech stack:** TypeScript, Preact, Zustand, Web Workers, `@yowasp/clang` `22.0.0-git20542-10`, Cloudflare Pages Functions and KV, Emscripten 4.0.10, Vitest and Playwright.

**Spec:** [docs/specs/2026-11-08-lab-browser-compile-design.md](../specs/2026-11-08-lab-browser-compile-design.md)

## Global constraints

- Student-facing text is British English and never says "coming soon", "not yet", "future", "deferred", "unsupported", "not supported", "3D" or "lighting".
- These strings are used exactly as written:
  - Notice: `Run uses a compiler that downloads once (about 18 MB).` with the button `Download now`.
  - Progress: `Downloading the compiler… <n> of 18 MB`.
  - Download failure: `The compiler couldn't download. Your code is saved in this browser. Try Run again.`
  - Offline: `Run needs the internet the first time, to download the compiler. Your code is saved in this browser.`
  - Time limit: `The compile took longer than 30 seconds, so it was stopped.`
  - Failure: the existing `failed` message.
- The compile time limit is 30 000 ms, counted from the compile request. The compiler's messages are capped at 256 KB, and the source at 200 KB.
- Cache name: `vams-lab-compiler-<runtimeVersion>`. Notice dismissal key: localStorage `vams-lab-compiler-notice` = `dismissed`.
- Runtime files sit flat under `<version>/`: `vams_main.mjs`, `vams_main.wasm`, `lab-headers.json`, `bundle.js`, `llvm.core.wasm`, `llvm.core2.wasm`, `llvm.core3.wasm`, `llvm.core4.wasm`, `llvm-resources.tar` and `compiler-manifest.json`. They are flat because `bundle.js` resolves its files beside itself.
- Test IDs that move keep their numbers. New tests take the next free number: BB-LAB-93 and up, WB-LAB-21 and up, VIS-LAB-07 and up.
- No secret or machine path in committed files. Files are CRLF, except `.sh` files, which are LF.

## Review focus

1. **A Run pressed twice during the first download.** One download, and one compile, for the second press. Pinned in Task 4.
2. **A compile worker that dies in the middle of a compile.** It ends `failed`, and the next Run starts a fresh worker. Pinned in Task 3.
3. **A stale cache.** A version whose cache is missing one file isn't ready, and downloads again. Pinned in Task 3.
4. **The page opening, or a dismissed notice:** no request to `/lab-runtime/*/llvm*`, `bundle.js` or `lab-headers.json`. Pinned in Task 6 (VIS).
5. **A program calling `emscripten_run_script`.** It ends without the script running. Pinned in Task 6 (VIS).

---

### Task 1: The runtime is hardened and packs the headers

**Files:**
- Move `lab/toolchain/EMSDK_VERSION` to `lab/runtime/EMSDK_VERSION`, and update every reader: publish-runtime, the visual helper and docs.
- Modify `lab/runtime/build.sh`:
  - `MAIN_FLAGS` gains `-sDYNAMIC_EXECUTION=0`.
  - After emcc, run `node "$HERE/pack-headers.mjs" "$SYSROOT_INCLUDE" "$LAB_INCLUDE_SRC" "$OUT/lab-headers.json"`.
- Create `lab/runtime/pack-headers.mjs`: `packHeaders(sysrootInclude, labInclude) → Record<string,string>`, with keys `sysroot/include/<rel>` and `include/<rel>`. It skips the folders `GL GLES GLES2 GLES3 EGL KHR SDL AL X11 GLFW webgl webgpu emscripten` and the file `emscripten.h` at the top of sysroot/include. The CLI writes JSON.
- Test: `tests/white-box/lab-runtime-build.test.ts`, which holds WB-LAB-21 (flag present) and WB-LAB-22 (packHeaders on a temporary tree: skips, keys, text).

- [ ] Write WB-LAB-21 and WB-LAB-22. Run them and see them fail.
- [ ] Implement. In the image, the sysroot include is `/emsdk/upstream/emscripten/cache/sysroot/include`, and `lab/include` is `$HERE/../include`.
- [ ] Rebuild: `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/src" -w /src emscripten/emsdk:4.0.10 sh lab/runtime/build.sh`. `lab/runtime/out/` then holds `vams_main.{mjs,wasm}` and `lab-headers.json` (about 15 MB). The `.mjs` has `DYNAMIC_EXECUTION=0 was set` and no `eval(`.
- [ ] Commit: `feat(lab): build the runtime without dynamic execution and pack the compiler's headers`.

### Task 2: The compile moves into the browser's code

**Files:**
- Create in `src/features/lab-compile/model/`:
  - `includes.ts`: `lab/service/src/includes.ts` copied, with `Buffer.byteLength` replaced by `new TextEncoder().encode(...).length`. `checkExpanded` and `LINE_MARKER` are dropped.
  - `diagnostics.ts`: the service's file copied, with `includeTrace` dropped if nothing else uses it.
  - `flags.ts`: `SIDE_CC_FLAGS`, `SIDE_LD_FLAGS` and `REPORT_FLAGS` (`-fno-color-diagnostics -fno-caret-diagnostics -fno-crash-diagnostics`), all as `readonly string[]`. Also `STRIP_SECTIONS = ['.debug*', 'producers', 'name']`, and the paths `LAB_ROOT='/lab'`, `MAIN_FILE`.
  - `strip.ts`: `stripSections(wasm: Uint8Array, names = STRIP_SECTIONS): Uint8Array`. It drops custom sections (id 0) whose name matches. `.debug*` is a prefix match.
  - `compile.ts`: `compileWith(tools: CompileTools, source: string, headers: FileTree): Promise<BrowserCompileResult>`, where:
    - `CompileTools = { clang(args, tree, stderr): Promise<FileTree>; ld(args, tree, stderr): Promise<FileTree> }`, with `stderr: (text: string) => void`; a tool rejects on a non-zero exit.
    - `BrowserCompileResult = { kind:'ok'; module: ArrayBuffer; diagnostics } | { kind:'errors'; diagnostics }`.

    It follows the service's `compile()`:
    1. The source cap (`The source is over 200 KB.`).
    2. `checkIncludes`.
    3. `clang++ ...SIDE_CC_FLAGS ...REPORT_FLAGS -c main.cpp -o main.o`, with the tree `{ lab: headers, 'main.cpp': checked.source }`.
    4. `wasm-ld ...SIDE_LD_FLAGS main.o -o main.wasm`, then `stripSections`.

    The 256 KB cap on stderr has the service's message. A rejection with no error diagnostic adds `The compiler stopped before it finished. Compile again.`, or for the link `Linking stopped before it finished. Compile again.`.
- Move the tests, keeping their IDs:
  - SEC-LAB-01, 02, 11, 12 and 13 go to `tests/security/lab-includes.test.ts`, importing from `@/features/lab-compile/model/includes`.
  - WB-LAB-01 and 02 (diagnostics) and WB-LAB-13 (`flags.ts` equals the `build.sh` `--side-cc` and `--side-ld` output, parsed from the file text) go to `tests/white-box/lab-compile.test.ts`.
  - SEC-LAB-03, 14 and 15 are retired.
- New: WB-LAB-23 (`stripSections`, with and without the sections), WB-LAB-24 (`compileWith` with fake tools: ok, clang errors, stderr cap, a link failure, the source cap, a refused include with no tool call).

- [ ] Write the new tests and move the old ones. See them fail.
- [ ] Implement. Then run `npx vitest run tests/security/lab-includes.test.ts tests/white-box/lab-compile.test.ts`: all pass.
- [ ] Commit: `feat(lab): move the compile's checks, flags and diagnostics into the browser`.

### Task 3: The compiler worker and its loader

**Files:**
- Create `src/features/lab-compile/worker/compiler-worker.ts`, a module worker. It is named `lab-compiler`, so `LAB_WORKER_OUTPUT` puts it under `lab/`: extend `isLabWorkerFile` and `entryFileNames` to both names.
  - On `{type:'prepare', version}`, it installs a `fetch` wrapper. The wrapper serves `/lab-runtime/<version>/*` from the `vams-lab-compiler-<version>` cache, or fetches, stores and reports `{type:'progress', received}` on each chunk.
  - It then fetches `compiler-manifest.json`, imports `/lab-runtime/<version>/bundle.js`, runs `clang++ --version` once and fetches `lab-headers.json` into a tree. It posts `{type:'ready'}`, or `{type:'download-failed'}` on a network failure or a non-200 answer.
  - On `{type:'compile', id, source}`, it runs `compileWith` and posts `{type:'result', id, result}`, transferring the module.
- Create `src/features/lab-compile/model/compiler.ts`:
  - `useCompiler`, a zustand store: `{ state: 'unknown'|'absent'|'downloading'|'ready'|'failed'; received: number; total: number }`.
  - `checkCompilerCached(version, cachesApi = globalThis.caches): Promise<boolean>`. It is true only when every manifest file is in the cache. It opens no network, and reads the manifest from the cache.
  - `deleteOldCompilerCaches(version)`.
  - `downloadCompiler(): Promise<'ready'|'failed'|'offline'>`, idempotent: a second call returns the same promise.
  - `compileSource(source, { signal? }): Promise<CompileResult>`. It awaits `downloadCompiler`, then sends the compile. The 30 s timer starts there. When it fires, the worker is terminated and the result is `{kind:'errors', diagnostics:[{line:1,col:1,severity:'error',message: TIME_LIMIT}]}`. A worker `error` event ends with `{kind:'failed'}`, the worker is dropped, and the next call makes a fresh one.
  - A `createWorker` seam for the tests.
- Modify `compile-client.ts`. It becomes the re-exported types:
  - `CompileResult = ok | errors | failed | offline | download`, where `download` is the download failure.
  - Delete `RETRY_WAITS_MS`, `decodeDiagnostics`, `visitor.ts` and `ENDPOINT`.
- Modify `messages.ts`:
  - Remove `busy`, `restingMonth`, `restingDay` and `limited`.
  - `offline` takes the new wording. Add `download`, `downloading(n)`, `notice` and `timeLimit`.
- Tests: rewrite `tests/black-box/lab-editor.test.ts` BB-LAB-38, 39, 40, 67, 68 and 69 for the new client, with fake worker and fake caches. Same IDs, new titles:
  - 38: Run waits for one download.
  - 39: a download failure.
  - 40: offline before the download.
  - 67: a dead worker fails, and the next is fresh.
  - 68: the 30 s stop.
  - 69: the cache check, all files or not ready.

  Also add BB-LAB-93: old caches are deleted.

- [ ] Write the tests and see them fail. Implement them, and run `npx vitest run tests/black-box/lab-editor.test.ts`: all pass.
- [ ] Commit: `feat(lab): compile in a worker with the compiler kept in Cache Storage`.

### Task 4: The notice and Run

**Files:**
- Create `src/widgets/lab-workspace/ui/CompilerNotice.tsx` and its SCSS, on the tokens. It sits above the editor, inside `.lab-workspace__code`:
  - When `absent` and not dismissed: the notice, Download now and a dismiss ✕ ("Dismiss").
  - When `downloading`: the progress bar (`role="progressbar"`, aria values in MB) and the progress text, even if the notice was dismissed.
  - When `failed`: the download message and Download now.
  - When `ready` or `unknown`: nothing.

  On mount, the workspace calls `checkCompilerCached` and `deleteOldCompilerCaches`, and sets `absent` or `ready`.
- Modify `run-controller.ts`: `busy()` becomes `downloading()`, and the status `'busy'` becomes `'downloading'`. Update `LabStage` and `runPhase`, and `runPhase` shows `Downloading the compiler…`.
- Modify `LabWorkspace.tsx`. Run calls `compileSource`, and while the store is `downloading` it sets the controller to `downloading`. `compileMessage` covers `offline`, `download` and `failed`. A Stop during a download leaves the download running.
- Tests:
  - BB-LAB-94 (the notice: shown, dismissed and remembered, back while downloading, hidden when ready), in `tests/black-box/lab-workspace.test.ts`.
  - BB-LAB-95 (two Runs during a download: one download, one compile, the second press's source).
  - BB-LAB-72 kept, with the new message kinds.
- [ ] Write the tests and see them fail. Implement. Run `npx vitest run tests/black-box/lab-workspace.test.ts tests/black-box/lab-editor.test.ts`: all pass.
- [ ] Commit: `feat(lab): offer the compiler download, and show its progress`.

### Task 5: Serving and publishing the compiler

**Files:**
- `functions/lab-runtime/[[path]].ts`:
  - `env.LAB_RUNTIME.getWithMetadata(key, 'stream')`. With metadata `{encoding:'br'}`, it answers `Content-Encoding: br` and `encodeBody: 'manual'`.
  - Add the types `tar: application/x-tar` and `json`.
  - `LabEnv`: drop `LAB_COMPILE_*` and `MAX_COMPILE_BODY_BYTES`, and retype `LAB_RUNTIME`.
- `scripts/lab/publish-runtime.mjs`. After the build:
  - Copy `node_modules/@yowasp/clang/gen/*` into the publish folder.
  - Write `compiler-manifest.json`: `{ files: [{ name, bytes, stored }] }`, for every compiler file and `lab-headers.json`.
  - Brotli every file at quality 11 into `<name>.br`, and upload it with `--metadata '{"encoding":"br"}'`.
  - The exported helpers:
    - `storedTooLarge(files)`: any over 25 × 1024 × 1024.
    - `downloadMegabytes(manifest)`: the stored total of every file but the main module, rounded.
    - `checkNoticeSize(mb, NOTICE_MB = 22)`.
  - Publishing refuses when either check fails. The version hash covers every file.
- `scripts/lab/vite-lab-dev.ts`: serve `/lab-runtime/dev/<file>` from `lab/runtime/out/`, then from `node_modules/@yowasp/clang/gen/`. Add a dev `compiler-manifest.json` built on request, from the sizes on disk, with `stored = bytes`. Add the `tar` and `json` types.
- `package.json`: devDependency `"@yowasp/clang": "22.0.0-git20542-10"` (exact).
- Tests:
  - BB-LAB-08: the runtime function, with the `br` metadata and plain values.
  - BB-LAB-65: the dev server serves the compiler files and the manifest.
  - WB-LAB-15 stays.
  - New WB-LAB-25: storedTooLarge, the megabyte check, and a manifest with every name.
- [ ] Tests first, then implement. Run `npx vitest run tests/black-box/lab-functions.test.ts tests/black-box/lab-page.test.ts tests/white-box/lab-scripts.test.ts`: pass.
- [ ] Commit: `feat(lab): serve and publish the compiler with the runtime`.

### Task 6: The real compiler in the visual suite

**Files:**
- `tests/visual/helpers/lab.ts`:
  - `LAB_RUNTIME_LOCAL` replaces `LAB_DOCKER`, and `startCompileService` and the `/api/compile` route go.
  - `/lab-runtime/*/<file>` is routed to `lab/runtime/out/`, then `node_modules/@yowasp/clang/gen/`, with a manifest built as in the dev server.
  - Every compiler request is recorded in `window`-independent Node state (`compilerRequests: string[]`).
- `tests/visual/lab.spec.ts` and `lab-drawing.spec.ts`: switch to `LAB_RUNTIME_LOCAL`. New checks:
  - VIS-LAB-07: no compiler request after open, or after dismissing the notice. Run then requests them.
  - VIS-LAB-08: a program that declares and calls `emscripten_run_script` ends crashed, and the Console holds the abort. A script that ran would have thrown a different error first, so the abort is the evidence.
  - VIS-LAB-09: every generator name compiles in one program, and each rejected name (BB-LAB-03's list) gives `isn't part of VAMS Lab's OpenGL.` on its line.
- [ ] Run `LAB_RUNTIME_LOCAL=1 npx playwright test lab.spec lab-drawing`: all pass, with VIS-LAB-05 at 21 of 21. Re-record the Lab captures the notice changes, with `--update-snapshots`, and look at each one.
- [ ] Commit: `test(lab): run the real compiler in the page for the Lab checks`.

### Task 7: The service goes, and the docs follow

- Delete:
  - `lab/service/`, `lab/toolchain/` and `lab/billing-guard/`;
  - `functions/api/compile.ts`;
  - `scripts/lab/setup-gcp.sh`, `setup-helpers.mjs`, `load-test.mjs` and `toolchain-check.sh`;
  - `tests/white-box/lab-service.test.ts`, `lab-limits.test.ts` and `lab-billing-guard.test.ts`;
  - the service, guard and load-test parts of `lab-scripts.test.ts` (WB-LAB-16, 17 and 18, and SEC-LAB-04 to 10);
  - `tests/black-box/lab-functions.test.ts` BB-LAB-05, 06 and 07;
  - `tests/helpers/fake-firestore.ts`, if nothing else uses it;
  - the `wrangler.toml` secrets note;
  - any `package.json` scripts and the dependencies only those files used.
- `docs/lab-operations.md` is rewritten. It covers:
  - building the runtime, and publishing it (what is uploaded, the 25 MiB and megabyte checks);
  - the KV namespace;
  - the visual checks with `LAB_RUNTIME_LOCAL=1`;
  - the Firefox smoke record;
  - the divergences (the spec's "Dropped" paragraph);
  - credits: LLVM, Apache 2.0 with LLVM exceptions; the `@yowasp/clang` packaging, ISC; and the Emscripten sysroot headers, MIT and the University of Illinois/NCSA licence;
  - "The earlier compile service": the tag `lab-compile-service` on `e5b64f2`, the path list, and `git checkout lab-compile-service -- <paths>`.
- `docs/product-plan.md`: the Compile line and the LAB_LIVE line, per the spec.
- The roadmap's item 25, as the spec says.
- `docs/specs/2026-10-28-vams-lab-design.md`: a line at the top of each compile-service section pointing to the new spec.
- `tests/README.md` and the `README.md` test counts.
- [ ] Search with `grep -rn "compile service\|Cloud Run\|LAB_DOCKER\|/api/compile\|lab/service\|lab/toolchain" --exclude-dir=node_modules .` and keep only the history mentions.
- [ ] Run `npm run lint && npm run build && npm test`: all pass. Then `git checkout -- tests/reports`.
- [ ] Commit: `refactor(lab): remove the compile service; the browser compiles`, followed by a `docs(lab): ...` commit if it is separate.

### After the tasks

1. A final whole-branch review on the most capable model, then one fix pass.
2. Merge to `main`, push, and run `git tag lab-compile-service e5b64f2 && git push origin lab-compile-service`.
3. `node scripts/lab/publish-runtime.mjs`. Commit `runtime-version.ts`, set `LAB_LIVE = true`, run the checks, merge and push.
4. `npx wrangler pages secret list --project-name vams`, and delete `LAB_COMPILE_*` if they are listed.
5. Check the live site: `curl -I` a `.wasm` file for `content-encoding: br`. Then in Chrome, open /lab, see no compiler request, press Download now, and Run an example.
6. The Firefox smoke run, recorded in `docs/lab-operations.md`.
