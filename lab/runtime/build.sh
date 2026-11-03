#!/bin/sh
# Builds the Lab's main module into lab/runtime/out/.
# Runs inside the emscripten/emsdk image pinned in lab/toolchain/EMSDK_VERSION.
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

# Where the compile service keeps the bundled headers and Emscripten's sysroot.
LAB_INCLUDE=${LAB_INCLUDE:-/lab/include}
LAB_SYSROOT=${LAB_SYSROOT:-/lab/sysroot}

# What every compile of a student's program shares.
SIDE_COMMON="-std=c++17 -O1 -fPIC -fwasm-exceptions -nostdinc++ -isystem $LAB_INCLUDE -isystem $LAB_SYSROOT/include/c++/v1"

# A student's program, compiled and linked by emcc into a side module.
SIDE_FLAGS="$SIDE_COMMON -sSIDE_MODULE=1"

# The same compile without emcc, as the compile service runs it. emcc adds the
# target, sysroot and LLVM flags itself; toolchain-check.sh checks that both
# ways give the same bytes.
#   clang++ $SIDE_CC_FLAGS -c main.cpp -o main.o
#   wasm-ld $SIDE_LD_FLAGS main.o -o main.wasm
#   llvm-objcopy main.wasm main.wasm $SIDE_STRIP_FLAGS
SIDE_LLVM_FLAGS="-mllvm -combiner-global-alias-analysis=false -mllvm -wasm-enable-sjlj -mllvm -wasm-use-legacy-eh -mllvm -disable-lsr"
SIDE_CC_FLAGS="--target=wasm32-unknown-emscripten --sysroot=$LAB_SYSROOT -fvisibility=default $SIDE_LLVM_FLAGS -DEMSCRIPTEN -Xclang -iwithsysroot/include/fakesdl -Xclang -iwithsysroot/include/compat $SIDE_COMMON"
SIDE_LD_FLAGS="$SIDE_LLVM_FLAGS -mllvm -wasm-enable-eh -mllvm -exception-model=wasm --import-memory --strip-debug --export-dynamic --export=__wasm_call_ctors --export-if-defined=main --export-if-defined=__main_argc_argv --export-if-defined=__wasm_apply_data_relocs --experimental-pic --unresolved-symbols=import-dynamic -shared"
SIDE_STRIP_FLAGS="--remove-section=.debug* --remove-section=producers --remove-section=name"

# The main module: libc, libc++, stb_image and the bridges, shared by every program.
# EXIT_RUNTIME makes exit() run atexit handlers and static destructors, so files are written.
MAIN_SOURCES="$HERE/vams_main.c $HERE/conio.c $HERE/windows.c $HERE/glew.c $HERE/stb_image_impl.c"
MAIN_FLAGS="-O2 -fwasm-exceptions -sMAIN_MODULE=1 -sMODULARIZE -sEXPORT_ES6 -sENVIRONMENT=$ENVIRONMENT -sALLOW_MEMORY_GROWTH -sEXPORT_NAME=createVamsMain -sEXPORTED_RUNTIME_METHODS=FS,ccall -sEXIT_RUNTIME=1"

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
echo "built $OUT/vams_main.mjs and $OUT/vams_main.wasm"
