/** A buffer object (2.9): its bytes, its usage hint, and whether glMapBuffer has it. */
export interface BufferObject {
  data: Uint8Array;
  usage: number;
  mapped: boolean;
}

export const GL_TYPE = {
  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  INT: 0x1404,
  UNSIGNED_INT: 0x1405,
  FLOAT: 0x1406,
  DOUBLE: 0x140a,
} as const;

/** The size in bytes of one value of `type`, or 0 for a type that isn't one. */
export function typeSize(type: number): number {
  switch (type) {
    case GL_TYPE.BYTE:
    case GL_TYPE.UNSIGNED_BYTE:
      return 1;
    case GL_TYPE.SHORT:
    case GL_TYPE.UNSIGNED_SHORT:
      return 2;
    case GL_TYPE.INT:
    case GL_TYPE.UNSIGNED_INT:
    case GL_TYPE.FLOAT:
      return 4;
    case GL_TYPE.DOUBLE:
      return 8;
  }
  return 0;
}

/** Reads one little-endian value of `type` at byte `at`, as it is. */
export function readValue(view: DataView, at: number, type: number): number {
  switch (type) {
    case GL_TYPE.BYTE:
      return view.getInt8(at);
    case GL_TYPE.UNSIGNED_BYTE:
      return view.getUint8(at);
    case GL_TYPE.SHORT:
      return view.getInt16(at, true);
    case GL_TYPE.UNSIGNED_SHORT:
      return view.getUint16(at, true);
    case GL_TYPE.INT:
      return view.getInt32(at, true);
    case GL_TYPE.UNSIGNED_INT:
      return view.getUint32(at, true);
    case GL_TYPE.FLOAT:
      return view.getFloat32(at, true);
    default:
      return view.getFloat64(at, true);
  }
}

/**
 * Reads one value of `type` as a colour component, 0 to 1 (Table 2.9): an unsigned integer c of b
 * bits is c / (2^b − 1), a signed one (2c + 1) / (2^b − 1), and floating point is kept.
 */
export function readNormalised(view: DataView, at: number, type: number): number {
  const c = readValue(view, at, type);
  switch (type) {
    case GL_TYPE.UNSIGNED_BYTE:
      return c / 0xff;
    case GL_TYPE.BYTE:
      return (2 * c + 1) / 0xff;
    case GL_TYPE.UNSIGNED_SHORT:
      return c / 0xffff;
    case GL_TYPE.SHORT:
      return (2 * c + 1) / 0xffff;
    case GL_TYPE.UNSIGNED_INT:
      return c / 0xffffffff;
    case GL_TYPE.INT:
      return (2 * c + 1) / 0xffffffff;
    default:
      return c;
  }
}

/**
 * Where an array's elements live (2.8, 2.9.1): in the buffer object bound when the pointer was
 * given, from byte `offset`; or in client memory, either a view the caller passed or the address
 * `offset` in the program's memory.
 */
export interface ArraySource {
  buffer: BufferObject | null;
  view: Uint8Array | null;
  offset: number;
}

/** One client array: glVertexPointer, glColorPointer or glTexCoordPointer's arguments and switch. */
export interface ArrayPointer extends ArraySource {
  enabled: boolean;
  size: number;
  type: number;
  /** Bytes from one element to the next; 0 means tightly packed. */
  stride: number;
}

export function createPointer(size: number): ArrayPointer {
  return { enabled: false, size, type: GL_TYPE.FLOAT, stride: 0, buffer: null, view: null, offset: 0 };
}

/** The bytes `source` reads from, starting at the byte its offset names. */
export function sourceBytes(source: ArraySource, memory: (() => Uint8Array) | undefined): { bytes: Uint8Array; start: number } {
  if (source.view) return { bytes: source.view, start: 0 };
  if (source.buffer) return { bytes: source.buffer.data, start: source.offset };
  return { bytes: memory?.() ?? new Uint8Array(0), start: source.offset };
}

/** Whether the array reads a buffer object that glMapBuffer holds. */
export function readsMapped(source: ArraySource): boolean {
  return !source.view && !!source.buffer?.mapped;
}

/**
 * A reader of an enabled array's elements, over one view of its bytes: element `i` is `size`
 * components, each read by `read`, or 0 past the end of the bytes.
 */
export function elementReader(
  p: ArrayPointer,
  memory: (() => Uint8Array) | undefined,
  read: (view: DataView, at: number, type: number) => number,
): (i: number) => number[] {
  const { bytes, start } = sourceBytes(p, memory);
  const width = typeSize(p.type);
  const stride = p.stride || p.size * width;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return (i) => {
    const out: number[] = [];
    for (let k = 0; k < p.size; k++) {
      const at = start + i * stride + k * width;
      out.push(at >= 0 && at + width <= bytes.byteLength ? read(view, at, p.type) : 0);
    }
    return out;
  };
}

/** How many whole elements the array's bytes hold from its start. */
export function elementCount(p: ArrayPointer, memory: (() => Uint8Array) | undefined): number {
  const { bytes, start } = sourceBytes(p, memory);
  const width = typeSize(p.type);
  const stride = p.stride || p.size * width;
  const room = bytes.byteLength - start - p.size * width;
  return room < 0 ? 0 : Math.floor(room / stride) + 1;
}

/** The indices glDrawElements reads, `count` of `type` from `source`, stopping where its bytes end. */
export function readIndices(source: ArraySource, count: number, type: number, memory: (() => Uint8Array) | undefined): number[] {
  const { bytes, start } = sourceBytes(source, memory);
  const width = typeSize(type);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const at = start + k * width;
    if (at < 0 || at + width > bytes.byteLength) break;
    out.push(readValue(view, at, type));
  }
  return out;
}
