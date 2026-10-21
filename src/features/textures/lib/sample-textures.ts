import type { TextureAsset } from '@/core/types/textures';

/** The built-in samples, in picker order. Each one is drawn to show a single idea. */
export const SAMPLE_TEXTURE_SPECS = [
  { id: 'sample-uv-grid', name: 'UV grid', width: 256, height: 256 },
  { id: 'sample-atlas', name: 'Sprite sheet', width: 256, height: 256 },
  { id: 'sample-pixel', name: 'Pixel fox', width: 64, height: 64 },
  { id: 'sample-bricks', name: 'Brick wall', width: 256, height: 256 },
  { id: 'sample-edges', name: 'Coloured edges', width: 256, height: 256 },
] as const satisfies readonly { id: string; name: string; width: number; height: number }[];

type SampleId = (typeof SAMPLE_TEXTURE_SPECS)[number]['id'];

/** The sprite sheet's icons: top-left, top-right, bottom-left, bottom-right. */
export const ATLAS_ICONS = ['heart', 'coin', 'gem', 'star'] as const;

/** The fox, 16 × 16 characters. Each character is a key of FOX_PALETTE and is drawn 4 × 4 px. */
export const FOX_SPRITE: readonly string[] = [
  '................',
  '....kk....kk....',
  '...kook..kook...',
  '...koookkoook...',
  '...kooooooook...',
  '..kooooooooook..',
  '..kowwkookwwok..',
  '..kowkkookkwok..',
  '..koooopppoook..',
  '..kooooppooook..',
  '...kooooooook...',
  '....kkooookk....',
  '...kccokkocck...',
  '...kcckookcck...',
  '....kk....kk....',
  '................',
];

export const FOX_PALETTE: Record<string, string> = {
  k: '#221e3a',
  o: '#f58b3d',
  w: '#ffffff',
  p: '#ec668c',
  c: '#ffd6aa',
  '.': '#78c8eb',
};

const INK = '#121827';

function buildCanvas(
  spec: { width: number; height: number },
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, spec.width);
  return canvas.toDataURL('image/png');
}

/**
 * UV grid: graph paper with the u axis in red along the bottom and the v axis in blue up the
 * left, meeting at 0,0. A flag on a pole points one way only, so any flip or swap shows.
 */
function drawUvGrid(ctx: CanvasRenderingContext2D, size: number) {
  const minor = size / 16;
  ctx.fillStyle = '#f6f8fd';
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 1;
  for (let k = 0; k <= 16; k++) {
    const at = k * minor + 0.5;
    ctx.strokeStyle = k % 4 === 0 ? '#b8c4de' : '#dbe2f1';
    ctx.beginPath();
    ctx.moveTo(at, 0);
    ctx.lineTo(at, size);
    ctx.moveTo(0, at);
    ctx.lineTo(size, at);
    ctx.stroke();
  }

  const axis = 6;
  ctx.fillStyle = '#e5484d';
  ctx.fillRect(0, size - axis, size, axis);
  ctx.fillStyle = '#2f4de0';
  ctx.fillRect(0, 0, axis, size);

  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#e5484d';
  ctx.fillText('u → 1', size - 58, size - 14);
  ctx.save();
  ctx.translate(22, 66);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#2f4de0';
  ctx.fillText('v → 1', 0, 0);
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.fillText('0,0', 12, size - 14);

  // The flag: pole, foot and a pennant pointing towards +u, near the top.
  ctx.fillStyle = INK;
  ctx.fillRect(96, 70, 8, 120);
  ctx.fillRect(84, 186, 32, 8);
  ctx.fillStyle = '#f5a524';
  ctx.beginPath();
  ctx.moveTo(104, 70);
  ctx.lineTo(170, 92);
  ctx.lineTo(104, 114);
  ctx.closePath();
  ctx.fill();
}

/** Sprite sheet: four icons in a 2 × 2 grid, so showing one icon means UVs from 0 to 0.5. */
function drawSpriteSheet(ctx: CanvasRenderingContext2D, size: number) {
  const half = size / 2;
  const tints = ['#f1f4fb', '#e6ebf6', '#e6ebf6', '#f1f4fb'];
  tints.forEach((tint, k) => {
    ctx.fillStyle = tint;
    ctx.fillRect((k % 2) * half, Math.floor(k / 2) * half, half, half);
  });
  ctx.strokeStyle = '#c6cfe2';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half, size);
  ctx.moveTo(0, half);
  ctx.lineTo(size, half);
  ctx.stroke();

  const icons: Record<(typeof ATLAS_ICONS)[number], () => void> = {
    heart: () => {
      ctx.fillStyle = '#e5484d';
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.bezierCurveTo(-46, 0, -30, -40, 0, -16);
      ctx.bezierCurveTo(30, -40, 46, 0, 0, 30);
      ctx.fill();
    },
    coin: () => {
      ctx.fillStyle = '#f5a524';
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
    },
    gem: () => {
      ctx.fillStyle = '#2f4de0';
      ctx.beginPath();
      ctx.moveTo(0, -36);
      ctx.lineTo(32, -6);
      ctx.lineTo(0, 36);
      ctx.lineTo(-32, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(0, -36);
      ctx.lineTo(32, -6);
      ctx.lineTo(0, -6);
      ctx.fill();
    },
    star: () => {
      ctx.fillStyle = '#12a150';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 ? 15 : 36;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();
    },
  };
  ATLAS_ICONS.forEach((icon, k) => {
    ctx.save();
    ctx.translate((k % 2) * half + half / 2, Math.floor(k / 2) * half + half / 2);
    icons[icon]();
    ctx.restore();
  });

  ctx.fillStyle = '#535c76';
  ctx.font = '600 11px monospace';
  ['0', '1', '2', '3'].forEach((t, k) => ctx.fillText(t, (k % 2) * half + 6, Math.floor(k / 2) * half + 16));
}

/** Pixel fox: each sprite character is a hard-edged 4 × 4 px square. */
function drawPixelFox(ctx: CanvasRenderingContext2D, size: number) {
  const cell = size / FOX_SPRITE.length;
  FOX_SPRITE.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      ctx.fillStyle = FOX_PALETTE[ch];
      ctx.fillRect(x * cell, y * cell, cell, cell);
    });
  });
}

type Rgb = [number, number, number];

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Value noise that repeats every `period` lattice cells, so the result tiles. */
function noise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const wrap = (a: number) => ((a % period) + period) % period;
  const ease = (t: number) => t * t * (3 - 2 * t);
  const a = hash(wrap(xi), wrap(yi), seed);
  const b = hash(wrap(xi + 1), wrap(yi), seed);
  const c = hash(wrap(xi), wrap(yi + 1), seed);
  const d = hash(wrap(xi + 1), wrap(yi + 1), seed);
  const u = ease(xf);
  const v = ease(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, period: number, seed: number, octaves = 4): number {
  let total = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    total += amp * noise(x * freq, y * freq, period * freq, seed + o);
    amp *= 0.5;
    freq *= 2;
  }
  return total;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Brick wall: 8 rows of 64 × 32 px bricks with 4 px mortar; odd rows shift by half a brick.
 * Every position is read modulo the image and the noise repeats at the edge, so the left column
 * matches the right and the top row matches the bottom.
 */
function drawBrickWall(ctx: CanvasRenderingContext2D, size: number) {
  const rows = 8;
  const brickH = size / rows;
  const brickW = size / 4;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / brickH);
    const shift = row % 2 ? brickW / 2 : 0;
    for (let x = 0; x < size; x++) {
      const along = (x + shift) % size;
      const col = Math.floor(along / brickW);
      const inX = along % brickW;
      const inY = y % brickH;
      const n = fbm((x / size) * 8, (y / size) * 8, 8, 3);
      const isMortar = inX < 2 || inX >= brickW - 2 || inY < 2 || inY >= brickH - 2;
      const colour = isMortar
        ? mix([196, 190, 178], [150, 144, 132], n)
        : mix(mix([168, 64, 44], [122, 44, 34], hash(col + (shift ? 7 : 0), row, 11)), [70, 30, 24], n * 0.55);
      const i = (y * size + x) * 4;
      image.data[i] = Math.round(colour[0]);
      image.data[i + 1] = Math.round(colour[1]);
      image.data[i + 2] = Math.round(colour[2]);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Coloured edges: a light field with an 18 px band of a different colour on each edge. */
function drawColouredEdges(ctx: CanvasRenderingContext2D, size: number) {
  const band = 18;
  ctx.fillStyle = '#f6f8fd';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#e5484d';
  ctx.fillRect(0, 0, band, size);
  ctx.fillStyle = '#2f4de0';
  ctx.fillRect(size - band, 0, band, size);
  ctx.fillStyle = '#12a150';
  ctx.fillRect(0, 0, size, band);
  ctx.fillStyle = '#f5a524';
  ctx.fillRect(0, size - band, size, band);

  // A right-pointing arrow in the middle, drawn from a shaft and a triangular head.
  const mid = size / 2;
  ctx.fillStyle = INK;
  ctx.fillRect(mid - 36, mid - 5, 48, 10);
  ctx.beginPath();
  ctx.moveTo(mid + 10, mid - 20);
  ctx.lineTo(mid + 38, mid);
  ctx.lineTo(mid + 10, mid + 20);
  ctx.closePath();
  ctx.fill();
}

const PAINTERS: Record<SampleId, (ctx: CanvasRenderingContext2D, size: number) => void> = {
  'sample-uv-grid': drawUvGrid,
  'sample-atlas': drawSpriteSheet,
  'sample-pixel': drawPixelFox,
  'sample-bricks': drawBrickWall,
  'sample-edges': drawColouredEdges,
};

let cached: TextureAsset[] | null = null;

export function getSampleTextures(): TextureAsset[] {
  if (cached) return cached;
  cached = SAMPLE_TEXTURE_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    isSample: true,
    width: spec.width,
    height: spec.height,
    dataUrl: buildCanvas(spec, PAINTERS[spec.id]),
  }));
  return cached;
}
