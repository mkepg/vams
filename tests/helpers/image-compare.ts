/**
 * Reading, writing and comparing the render fidelity battery's images. The comparison rule is the
 * render fidelity spec's: a pixel whose 3 × 3 neighbourhood in the reference is not all one colour
 * is an edge pixel and may differ by any amount; every other pixel must be within 2 of the
 * reference in each channel.
 */
import { unzlibSync, zlibSync } from 'fflate';

export interface Image {
  width: number;
  height: number;
  /** RGBA, top row first. */
  data: Uint8Array;
}

export const CHANNEL_TOLERANCE = 2;

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** An RGBA PNG with no filtering. */
export function encodePng({ width, height, data }: Image): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const parts = [Uint8Array.from(SIGNATURE), chunk('IHDR', header), chunk('IDAT', zlibSync(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** An 8-bit RGB or RGBA PNG, as browsers and encodePng write them. Alpha is set to 255. */
export function decodePng(bytes: Uint8Array): Image {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const idat: Uint8Array[] = [];
  while (at < bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      if (data[8] !== 8 || (data[9] !== 2 && data[9] !== 6)) throw new Error('Only 8-bit RGB and RGBA PNGs are read.');
      channels = data[9] === 6 ? 4 : 3;
    }
    if (type === 'IDAT') idat.push(data);
    at += 12 + length;
  }
  const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  idat.reduce((offset, d) => (joined.set(d, offset), offset + d.length), 0);
  const raw = unzlibSync(joined);
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = value & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * channels];
      out[o + 1] = cur[x * channels + 1];
      out[o + 2] = cur[x * channels + 2];
      out[o + 3] = 255;
    }
    prev = cur;
  }
  return { width, height, data: out };
}

export interface Comparison {
  ok: boolean;
  /** Pixels that are not edge pixels and differ by more than CHANNEL_TOLERANCE. */
  failures: number;
  /** The first few failures, as [x, y, largest channel difference]. */
  examples: [number, number, number][];
}

/** Compares `actual` with `reference` by the battery's rule. `ignore` leaves out pixels that aren't drawing. */
export function compareImages(actual: Image, reference: Image, ignore: (x: number, y: number) => boolean = () => false): Comparison {
  if (actual.width !== reference.width || actual.height !== reference.height) {
    throw new Error(`The image is ${actual.width} × ${actual.height}; the reference is ${reference.width} × ${reference.height}.`);
  }
  const { width, height } = reference;
  const ref = reference.data;
  const sameAs = (i: number, j: number) => ref[i] === ref[j] && ref[i + 1] === ref[j + 1] && ref[i + 2] === ref[j + 2];
  let failures = 0;
  const examples: [number, number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ignore(x, y)) continue;
      const i = (y * width + x) * 4;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1 && !edge; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < width && yy < height && !sameAs(i, (yy * width + xx) * 4)) edge = true;
        }
      }
      if (edge) continue;
      const diff = Math.max(
        Math.abs(actual.data[i] - ref[i]),
        Math.abs(actual.data[i + 1] - ref[i + 1]),
        Math.abs(actual.data[i + 2] - ref[i + 2]),
      );
      if (diff > CHANNEL_TOLERANCE) {
        failures++;
        if (examples.length < 5) examples.push([x, y, diff]);
      }
    }
  }
  return { ok: failures === 0, failures, examples };
}
