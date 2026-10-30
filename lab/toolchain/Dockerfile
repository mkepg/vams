# The Lab's compile service: clang, wasm-ld and llvm-objcopy from the pinned
# Emscripten release, the sysroot headers, the bundled headers and Node 24.
# A student's program is compiled and linked as a side module, which links no
# libraries, so the sysroot's prebuilt libraries stay behind.
#
# Build from the repository root:
#   docker build -f lab/toolchain/Dockerfile \
#     --build-arg EMSDK_VERSION=$(tr -d '\r\n' < lab/toolchain/EMSDK_VERSION) \
#     -t vams-lab-compile .

ARG EMSDK_VERSION=4.0.10

FROM emscripten/emsdk:${EMSDK_VERSION} AS toolchain
RUN set -eu; \
    up=/emsdk/upstream; \
    clang=$(readlink -f "$up/bin/clang"); \
    mkdir -p /out/llvm/bin /out/llvm/lib /out/sysroot; \
    cp "$clang" /out/llvm/bin/clang; \
    ln -s clang /out/llvm/bin/clang++; \
    cp "$up/bin/lld" /out/llvm/bin/lld; \
    ln -s lld /out/llvm/bin/wasm-ld; \
    cp "$up/bin/llvm-objcopy" /out/llvm/bin/llvm-objcopy; \
    cp -a "$up/lib/clang" /out/llvm/lib/clang; \
    cp -a "$up/emscripten/cache/sysroot/include" /out/sysroot/include; \
    strip /out/llvm/bin/clang /out/llvm/bin/lld /out/llvm/bin/llvm-objcopy

FROM node:24-slim
COPY --from=toolchain /out/llvm /opt/llvm
COPY --from=toolchain /out/sysroot /lab/sysroot
COPY lab/include /lab/include
COPY lab/service/src /lab/service/src
ENV PATH=/opt/llvm/bin:$PATH \
    NODE_ENV=production \
    PORT=8080
RUN useradd --create-home --uid 10001 lab
USER lab
WORKDIR /lab/service
EXPOSE 8080
CMD ["node", "src/server.ts"]
