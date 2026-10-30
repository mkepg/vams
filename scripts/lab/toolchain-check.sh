#!/bin/sh
# Checks the Lab's toolchain end to end. Inside the pinned emscripten/emsdk
# image it builds the main module, compiles three programs as side modules
# (with emcc, and with clang and wasm-ld alone as the compile service does),
# runs each one through vams_run in Node and prints its output and sizes.
#
#   sh scripts/lab/toolchain-check.sh                  emsdk image only
#   sh scripts/lab/toolchain-check.sh --image <tag>    also compile in the
#                                                      compile-service image
set -eu

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
VERSION=$(tr -d '\r\n' < "$ROOT/lab/toolchain/EMSDK_VERSION")
EMSDK_IMAGE="emscripten/emsdk:$VERSION"
CHECK=lab/runtime/out/check
PROGRAMS="hello stl except"

if [ "${1:-}" != "--inside" ]; then
  SERVICE_IMAGE=""
  if [ "${1:-}" = "--image" ]; then SERVICE_IMAGE=${2:?"--image needs a tag"}; fi
  # Docker on Windows wants C:/ paths and no MSYS path rewriting.
  HOST_ROOT=$(cd "$ROOT" && (pwd -W 2>/dev/null || pwd))
  export MSYS_NO_PATHCONV=1
  docker run --rm \
    -v "$HOST_ROOT:/src" \
    -v "$HOST_ROOT/lab/include:/lab/include:ro" \
    -v vams-lab-emcache:/emsdk/upstream/emscripten/cache \
    -w /src "$EMSDK_IMAGE" sh scripts/lab/toolchain-check.sh --inside build
  if [ -n "$SERVICE_IMAGE" ]; then
    # The compile-service image has clang and wasm-ld but no emcc. It runs as
    # the lab user, compiles in /tmp and sends the side modules back as a tar.
    docker run --rm --entrypoint sh -v "$HOST_ROOT:/src:ro" -w /src "$SERVICE_IMAGE" -c '
      set -euf
      CC=$(sh lab/runtime/build.sh --side-cc)
      LD=$(sh lab/runtime/build.sh --side-ld)
      STRIP=$(sh lab/runtime/build.sh --side-strip)
      mkdir -p /tmp/lab
      for p in '"$PROGRAMS"'; do
        clang++ $CC -c '"$CHECK"'/src/$p.cpp -o /tmp/lab/$p.o
        wasm-ld $LD /tmp/lab/$p.o -o /tmp/lab/$p.wasm
        llvm-objcopy /tmp/lab/$p.wasm /tmp/lab/$p.wasm $STRIP
      done
      cd /tmp/lab && tar -cf - '"$(for p in $PROGRAMS; do printf '%s.wasm ' "$p"; done)"'
    ' | tar -xf - -C "$ROOT/$CHECK/service"
    docker run --rm -v "$HOST_ROOT:/src" -w /src "$EMSDK_IMAGE" \
      sh scripts/lab/toolchain-check.sh --inside run-service
  fi
  exit 0
fi

SYSROOT=/emsdk/upstream/emscripten/cache/sysroot
BIN=/emsdk/upstream/bin

run_all() {
  # $1: label, then side modules
  label=$1; shift
  echo "== side modules: $label"
  node "$CHECK/run.mjs" "$CHECK/node/vams_main.mjs" "$@"
}

if [ "$2" = "run-service" ]; then
  run_all "compile-service image" $(for p in $PROGRAMS; do printf '%s ' "$CHECK/service/$p.wasm"; done)
  exit 0
fi

rm -rf "$CHECK"
mkdir -p "$CHECK/src" "$CHECK/emcc" "$CHECK/clang" "$CHECK/service"

echo "== emcc $(emcc --version | head -1 | sed 's/.*) //')"

echo "== main module (shipping build)"
sh lab/runtime/build.sh
echo "== main module (worker,node build for this check)"
OUT="$CHECK/node" ENVIRONMENT=worker,node sh lab/runtime/build.sh

cat > "$CHECK/src/hello.cpp" <<'EOF'
#include <cstdio>

int main() {
  printf("Hello from a side module\n");
  return 0;
}
EOF

cat > "$CHECK/src/stl.cpp" <<'EOF'
#include <iostream>
#include <string>
#include <vector>

int main(int argc, char** argv) {
  std::vector<std::string> names = {"glBegin", "glVertex2f", "glEnd"};
  std::string joined;
  for (const std::string& name : names) {
    std::cout << name << " has " << name.size() << " letters\n";
    joined += name;
  }
  std::cout << "joined: " << joined << std::endl;
  return static_cast<int>(names.size());
}
EOF

cat > "$CHECK/src/except.cpp" <<'EOF'
#include <iostream>
#include <stdexcept>
#include <string>

int main() {
  try {
    int n = std::stoi("twelve");
    std::cout << "parsed " << n << "\n";
  } catch (const std::invalid_argument& e) {
    std::cout << "caught invalid_argument: " << e.what() << "\n";
  }
  std::cout << "after the catch\n";
  return 0;
}
EOF

SIDE_FLAGS=$(LAB_SYSROOT=$SYSROOT sh lab/runtime/build.sh --side-flags)
SIDE_CC_FLAGS=$(LAB_SYSROOT=$SYSROOT sh lab/runtime/build.sh --side-cc)
SIDE_LD_FLAGS=$(sh lab/runtime/build.sh --side-ld)
SIDE_STRIP_FLAGS=$(sh lab/runtime/build.sh --side-strip)
echo "== SIDE_FLAGS: $SIDE_FLAGS"
set -f
for p in $PROGRAMS; do
  # shellcheck disable=SC2086
  emcc $SIDE_FLAGS "$CHECK/src/$p.cpp" -o "$CHECK/emcc/$p.wasm"
  # shellcheck disable=SC2086
  "$BIN/clang++" $SIDE_CC_FLAGS -c "$CHECK/src/$p.cpp" -o "$CHECK/clang/$p.o"
  # shellcheck disable=SC2086
  "$BIN/wasm-ld" $SIDE_LD_FLAGS "$CHECK/clang/$p.o" -o "$CHECK/clang/$p.wasm"
  # shellcheck disable=SC2086
  "$BIN/llvm-objcopy" "$CHECK/clang/$p.wasm" "$CHECK/clang/$p.wasm" $SIDE_STRIP_FLAGS
done
set +f

cat > "$CHECK/run.mjs" <<'EOF'
// Runs each side module through vams_run in a fresh main module instance.
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const [mainJs, ...sides] = process.argv.slice(2);
const { default: createVamsMain } = await import(pathToFileURL(mainJs).href);

const expected = {
  hello: { code: 0, out: 'Hello from a side module\n' },
  stl: {
    code: 3,
    out: 'glBegin has 7 letters\nglVertex2f has 10 letters\nglEnd has 5 letters\njoined: glBeginglVertex2fglEnd\n',
  },
  except: { code: 0, out: 'caught invalid_argument: stoi: no conversion\nafter the catch\n' },
};

const gzip = (bytes) => gzipSync(bytes, { level: 9 }).length;
const brotli = (bytes) =>
  brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const indent = (text) => text.replace(/\n$/, '').replace(/^/gm, '   | ');

const shipping = join(dirname(dirname(dirname(mainJs))), 'vams_main.wasm');
const mainWasm = readFileSync(shipping);
const mainJsBytes = readFileSync(shipping.replace(/\.wasm$/, '.mjs'));
console.log(
  `main module: wasm ${kb(mainWasm.length)} raw, ${kb(gzip(mainWasm))} gzip, ${kb(brotli(mainWasm))} brotli; ` +
    `js ${kb(mainJsBytes.length)} raw, ${kb(brotli(mainJsBytes))} brotli`,
);

let failed = 0;
for (const side of sides) {
  const name = basename(side, '.wasm');
  const bytes = readFileSync(side);
  let out = '';
  const module = await createVamsMain({
    print: (line) => (out += `${line}\n`),
    printErr: (line) => (out += `${line}\n`),
  });
  module.FS.writeFile('/program.wasm', bytes);
  let code;
  try {
    code = module.ccall('vams_run', 'number', ['string'], ['/program.wasm']);
  } catch (error) {
    out += `threw: ${error}\n`;
    code = -1;
  }
  const size = gzip(bytes);
  const want = expected[name];
  const ok = want && code === want.code && out === want.out && size <= 40 * 1024;
  if (!ok) failed += 1;
  console.log(`-- ${name}: ${ok ? 'ok' : 'FAILED'} (exit ${code}, ${bytes.length} B raw, ${kb(size)} gzip)`);
  if (out) console.log(indent(out));
  if (!ok && want) console.log(`   expected exit ${want.code} and:\n${indent(want.out)}`);
}
process.exit(failed ? 1 : 0);
EOF

run_all "emcc" "$CHECK/emcc/hello.wasm" "$CHECK/emcc/stl.wasm" "$CHECK/emcc/except.wasm"
run_all "clang + wasm-ld" "$CHECK/clang/hello.wasm" "$CHECK/clang/stl.wasm" "$CHECK/clang/except.wasm"
