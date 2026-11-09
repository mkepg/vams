/**
 * How the browser's compiler builds a student's program into a side module: the flags
 * lab/runtime/build.sh holds as SIDE_CC_FLAGS and SIDE_LD_FLAGS, word for word, with the paths
 * where the compiler's file tree mounts the headers pack. A test reads build.sh to keep them equal.
 */

/** Where the headers pack sits in the compiler's file tree. */
export const LAB_ROOT = '/lab';
export const LAB_INCLUDE = `${LAB_ROOT}/include`;
export const LAB_SYSROOT = `${LAB_ROOT}/sysroot`;

/** The student's file, at the top of the tree. */
export const MAIN_FILE = 'main.cpp';

const COMMON = ['-std=c++17', '-O1', '-fPIC', '-fwasm-exceptions', '-nostdinc++', '-isystem', LAB_INCLUDE, '-isystem', `${LAB_SYSROOT}/include/c++/v1`];

const LLVM = ['-mllvm', '-combiner-global-alias-analysis=false', '-mllvm', '-wasm-enable-sjlj', '-mllvm', '-wasm-use-legacy-eh', '-mllvm', '-disable-lsr'];

export const SIDE_CC_FLAGS: readonly string[] = [
  '--target=wasm32-unknown-emscripten',
  `--sysroot=${LAB_SYSROOT}`,
  '-fvisibility=default',
  ...LLVM,
  '-DEMSCRIPTEN',
  '-Xclang', '-iwithsysroot/include/fakesdl',
  '-Xclang', '-iwithsysroot/include/compat',
  ...COMMON,
];

export const SIDE_LD_FLAGS: readonly string[] = [
  ...LLVM,
  '-mllvm', '-wasm-enable-eh',
  '-mllvm', '-exception-model=wasm',
  '--import-memory',
  '--strip-debug',
  '--export-dynamic',
  '--export=__wasm_call_ctors',
  '--export-if-defined=main',
  '--export-if-defined=__main_argc_argv',
  '--export-if-defined=__wasm_apply_data_relocs',
  '--experimental-pic',
  '--unresolved-symbols=import-dynamic',
  '-shared',
];

/** Flags that change only how clang reports: one-line messages, no source excerpts, no crash files. */
export const REPORT_FLAGS: readonly string[] = ['-fno-color-diagnostics', '-fno-caret-diagnostics', '-fno-crash-diagnostics'];

/** The custom sections build.sh's SIDE_STRIP_FLAGS remove; a trailing * matches a prefix. */
export const STRIP_SECTIONS: readonly string[] = ['.debug*', 'producers', 'name'];
