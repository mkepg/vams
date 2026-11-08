#!/bin/sh
# Builds the Lab's main module, and the headers pack the browser's compiler reads, into
# lab/runtime/out/. Runs inside the emscripten/emsdk image pinned in lab/runtime/EMSDK_VERSION.
#
#   sh lab/runtime/build.sh                 build the main module
#   sh lab/runtime/build.sh --side-flags    print SIDE_FLAGS
#   sh lab/runtime/build.sh --side-cc       print SIDE_CC_FLAGS
#   sh lab/runtime/build.sh --side-ld       print SIDE_LD_FLAGS
#   sh lab/runtime/build.sh --side-strip    print SIDE_STRIP_FLAGS
#
# OUT and ENVIRONMENT override the output folder and -sENVIRONMENT.
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${OUT:-$HERE/out}
ENVIRONMENT=${ENVIRONMENT:-worker}

# Where the browser's compiler finds the bundled headers and Emscripten's sysroot: the pack
# below mounts at /lab in its file tree.
LAB_INCLUDE=${LAB_INCLUDE:-/lab/include}
LAB_SYSROOT=${LAB_SYSROOT:-/lab/sysroot}

# What every compile of a student's program shares.
SIDE_COMMON="-std=c++17 -O1 -fPIC -fwasm-exceptions -nostdinc++ -isystem $LAB_INCLUDE -isystem $LAB_SYSROOT/include/c++/v1"

# A student's program, compiled and linked by emcc into a side module.
SIDE_FLAGS="$SIDE_COMMON -sSIDE_MODULE=1"

# The same compile without emcc, as the browser's compiler runs it
# (src/features/lab-compile/model/flags.ts holds these word for word). emcc adds
# the target, sysroot and LLVM flags itself.
#   clang++ $SIDE_CC_FLAGS -c main.cpp -o main.o
#   wasm-ld $SIDE_LD_FLAGS main.o -o main.wasm
#   then the sections SIDE_STRIP_FLAGS names are removed (llvm-objcopy, or strip.ts)
SIDE_LLVM_FLAGS="-mllvm -combiner-global-alias-analysis=false -mllvm -wasm-enable-sjlj -mllvm -wasm-use-legacy-eh -mllvm -disable-lsr"
SIDE_CC_FLAGS="--target=wasm32-unknown-emscripten --sysroot=$LAB_SYSROOT -fvisibility=default $SIDE_LLVM_FLAGS -DEMSCRIPTEN -Xclang -iwithsysroot/include/fakesdl -Xclang -iwithsysroot/include/compat $SIDE_COMMON"
SIDE_LD_FLAGS="$SIDE_LLVM_FLAGS -mllvm -wasm-enable-eh -mllvm -exception-model=wasm --import-memory --strip-debug --export-dynamic --export=__wasm_call_ctors --export-if-defined=main --export-if-defined=__main_argc_argv --export-if-defined=__wasm_apply_data_relocs --experimental-pic --unresolved-symbols=import-dynamic -shared"
SIDE_STRIP_FLAGS="--remove-section=.debug* --remove-section=producers --remove-section=name"

# The main module: libc, libc++, stb_image and the bridges, shared by every program.
# EXIT_RUNTIME makes exit() run atexit handlers and static destructors, so files are written.
# DYNAMIC_EXECUTION=0 turns every path that evaluates a program's JavaScript (emscripten_run_script,
# and the EM_ASM and EM_JS code a side module carries) into an abort, so a program runs only wasm.
MAIN_SOURCES="$HERE/vams_main.c $HERE/conio.c $HERE/windows.c $HERE/glew.c $HERE/stb_image_impl.c"
MAIN_FLAGS="-O2 -fwasm-exceptions -sMAIN_MODULE=1 -sMODULARIZE -sEXPORT_ES6 -sENVIRONMENT=$ENVIRONMENT -sALLOW_MEMORY_GROWTH -sEXPORT_NAME=createVamsMain -sEXPORTED_RUNTIME_METHODS=FS,ccall -sEXIT_RUNTIME=1 -sDYNAMIC_EXECUTION=0"

case "${1:-}" in
  --side-flags) echo "$SIDE_FLAGS"; exit 0 ;;
  --side-cc) echo "$SIDE_CC_FLAGS"; exit 0 ;;
  --side-ld) echo "$SIDE_LD_FLAGS"; exit 0 ;;
  --side-strip) echo "$SIDE_STRIP_FLAGS"; exit 0 ;;
  '') ;;
  *) echo "usage: build.sh [--side-flags|--side-cc|--side-ld|--side-strip]" >&2; exit 2 ;;
esac

mkdir -p "$OUT"
# shellcheck disable=SC2086
emcc $MAIN_FLAGS -isystem "$HERE/../include" --js-library "$HERE/library_vams.js" $MAIN_SOURCES -o "$OUT/vams_main.mjs"
# The headers the browser's compiler reads, from this image's sysroot and lab/include.
SYSROOT_INCLUDE=${SYSROOT_INCLUDE:-/emsdk/upstream/emscripten/cache/sysroot/include}
node "$HERE/pack-headers.mjs" "$SYSROOT_INCLUDE" "$HERE/../include" "$OUT/lab-headers.json"
echo "built $OUT/vams_main.mjs, $OUT/vams_main.wasm and $OUT/lab-headers.json"
