import type { RgbaImage } from "../src/types";

export function rgbaImage(width: number, height: number, pixels: number[]): RgbaImage {
  if (pixels.length !== width * height * 4) {
    throw new Error(`expected ${width * height * 4} channels, got ${pixels.length}`);
  }
  return { width, height, data: Uint8ClampedArray.from(pixels) };
}
