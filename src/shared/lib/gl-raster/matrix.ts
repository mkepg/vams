/**
 * 4 × 4 matrices as OpenGL keeps them: sixteen numbers in column-major order, so element (row r,
 * column c) is m[c * 4 + r] and a translation sits in m[12], m[13], m[14] (2.11.2).
 */
export type Mat4 = Float64Array;

export function identity(): Mat4 {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** a × b: b applied first, then a. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

/** A matrix from sixteen column-major values, as glLoadMatrix and glMultMatrix read them. */
export function fromArray(values: ArrayLike<number>): Mat4 {
  const m = new Float64Array(16);
  for (let i = 0; i < 16; i++) m[i] = values[i] ?? 0;
  return m;
}

/** glTranslate's matrix. */
export function translation(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

/** glScale's matrix. */
export function scaling(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}

/**
 * glRotate's matrix: `angle` degrees counter-clockwise about the axis (x, y, z), which is
 * normalised first. An axis of length 0 leaves the identity.
 */
export function rotation(angle: number, x: number, y: number, z: number): Mat4 {
  const len = Math.hypot(x, y, z);
  if (len === 0) return identity();
  x /= len;
  y /= len;
  z /= len;
  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const t = 1 - c;
  const m = identity();
  m[0] = x * x * t + c;
  m[1] = y * x * t + z * s;
  m[2] = x * z * t - y * s;
  m[4] = x * y * t - z * s;
  m[5] = y * y * t + c;
  m[6] = y * z * t + x * s;
  m[8] = x * z * t + y * s;
  m[9] = y * z * t - x * s;
  m[10] = z * z * t + c;
  return m;
}

/** glOrtho's matrix (2.11.2): the box l..r, b..t, −n..−f onto −1..1 on every axis. */
export function orthographic(l: number, r: number, b: number, t: number, n: number, f: number): Mat4 {
  const m = identity();
  m[0] = 2 / (r - l);
  m[5] = 2 / (t - b);
  m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l);
  m[13] = -(t + b) / (t - b);
  m[14] = -(f + n) / (f - n);
  return m;
}

/** m × (x, y, z, w). */
export function transform(m: Mat4, x: number, y: number, z: number, w: number): [number, number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
}

/** A matrix stack of at most `depth` entries; the last is the current matrix. */
export class MatrixStack {
  private readonly entries: Mat4[] = [identity()];
  readonly depth: number;

  constructor(depth: number) {
    this.depth = depth;
  }

  get top(): Mat4 {
    return this.entries[this.entries.length - 1];
  }

  set top(m: Mat4) {
    this.entries[this.entries.length - 1] = m;
  }

  get size(): number {
    return this.entries.length;
  }

  /** Copies the current matrix onto the stack; false, and nothing changes, when it is full. */
  push(): boolean {
    if (this.entries.length >= this.depth) return false;
    this.entries.push(new Float64Array(this.top));
    return true;
  }

  /** Drops the current matrix; false, and nothing changes, when it is the only one. */
  pop(): boolean {
    if (this.entries.length <= 1) return false;
    this.entries.pop();
    return true;
  }
}
