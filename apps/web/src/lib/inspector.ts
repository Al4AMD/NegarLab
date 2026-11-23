import type { RgbaImage } from "@negarlab/ip";

export interface PixelSample {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  luma: number;
}

export function samplePixel(image: RgbaImage, x: number, y: number): PixelSample | null {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const offset = (y * image.width + x) * 4;
  const r = image.data[offset] ?? 0;
  const g = image.data[offset + 1] ?? 0;
  const b = image.data[offset + 2] ?? 0;
  return {
    x,
    y,
    r,
    g,
    b,
    a: image.data[offset + 3] ?? 255,
    luma: Math.round(0.299 * r + 0.587 * g + 0.114 * b),
  };
}

export function lumaMatrix(
  image: RgbaImage,
  centerX: number,
  centerY: number,
  size = 8,
): number[][] {
  const start = Math.floor((size - 1) / 2);
  const rows: number[][] = [];
  for (let row = 0; row < size; row += 1) {
    const values: number[] = [];
    for (let col = 0; col < size; col += 1) {
      const x = Math.min(image.width - 1, Math.max(0, centerX - start + col));
      const y = Math.min(image.height - 1, Math.max(0, centerY - start + row));
      const offset = (y * image.width + x) * 4;
      const r = image.data[offset] ?? 0;
      const g = image.data[offset + 1] ?? 0;
      const b = image.data[offset + 2] ?? 0;
      values.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
    }
    rows.push(values);
  }
  return rows;
}
