import type { RgbaImage } from "@negarlab/ip";

const SIZE = 8;

export function generateTestImage(): RgbaImage {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const p = (y * SIZE + x) * 4;
      data[p] = (x * 37 + y * 11) % 256;
      data[p + 1] = (x * 17 + y * 53) % 256;
      data[p + 2] = (x * 97 + y * 7) % 256;
      data[p + 3] = x === 0 && y === 0 ? 128 : 255;
    }
  }
  return { width: SIZE, height: SIZE, data };
}
