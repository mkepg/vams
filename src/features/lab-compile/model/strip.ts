import { STRIP_SECTIONS } from './flags';

/** Reads an unsigned LEB128 at `at`: the value and the position after it. */
function leb(bytes: Uint8Array, at: number): [number, number] {
  let value = 0;
  let shift = 0;
  for (;;) {
    if (at >= bytes.length) throw new Error('The module ends inside a number.');
    const b = bytes[at++];
    value += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) return [value, at];
    shift += 7;
  }
}

const matches = (name: string, patterns: readonly string[]) =>
  patterns.some((p) => (p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p));

/**
 * The module without the custom sections `names` lists, as `llvm-objcopy --remove-section` makes it.
 * Every other section keeps its bytes and its place.
 */
export function stripSections(wasm: Uint8Array, names: readonly string[] = STRIP_SECTIONS): Uint8Array {
  if (wasm.length < 8 || wasm[0] !== 0x00 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6d) {
    throw new Error('This is not a WebAssembly module.');
  }
  const kept: Uint8Array[] = [wasm.subarray(0, 8)];
  let at = 8;
  while (at < wasm.length) {
    const start = at;
    const id = wasm[at++];
    const [size, body] = leb(wasm, at);
    const end = body + size;
    if (end > wasm.length) throw new Error('A section runs past the end of the module.');
    let drop = false;
    if (id === 0) {
      const [length, nameAt] = leb(wasm, body);
      drop = matches(new TextDecoder().decode(wasm.subarray(nameAt, nameAt + length)), names);
    }
    if (!drop) kept.push(wasm.subarray(start, end));
    at = end;
  }
  const out = new Uint8Array(kept.reduce((n, part) => n + part.length, 0));
  let o = 0;
  for (const part of kept) {
    out.set(part, o);
    o += part.length;
  }
  return out;
}

/** The names a module exports, from its export section; a module without one exports none. */
export function exportNames(wasm: Uint8Array): string[] {
  const names: string[] = [];
  let at = 8;
  while (at < wasm.length) {
    const id = wasm[at++];
    const [size, body] = leb(wasm, at);
    at = body + size;
    if (id !== 7) continue;
    let [count, p] = leb(wasm, body);
    while (count-- > 0) {
      const [length, nameAt] = leb(wasm, p);
      names.push(new TextDecoder().decode(wasm.subarray(nameAt, nameAt + length)));
      // The export's kind (one byte), then its index.
      p = leb(wasm, nameAt + length + 1)[1];
    }
  }
  return names;
}
