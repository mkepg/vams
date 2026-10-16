import { encode } from 'uqr';

/** A QR code as SVG: dark modules on white with a two-module quiet zone, sized by its container. */
export function qrSvg(text: string): string {
  const { data } = encode(text, { ecc: 'M', border: 2 });
  const size = data.length;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (data[y][x]) d += `M${x} ${y}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
}

/** The SVG drawn to a PNG, for downloading. Browser only. */
export async function qrPngBlob(svg: string, px = 1024): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas to draw the QR code with');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, px, px);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'));
}
