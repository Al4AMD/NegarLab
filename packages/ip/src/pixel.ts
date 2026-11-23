import type { RgbaImage } from "./types";

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function toByte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

export function mapChannels(image: RgbaImage, fn: (value: number) => number): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 1) {
    if (i % 4 === 3) {
      data[i] = image.data[i] ?? 0;
    } else {
      data[i] = toByte(fn((image.data[i] ?? 0) / 255));
    }
  }
  return { width: image.width, height: image.height, data };
}
