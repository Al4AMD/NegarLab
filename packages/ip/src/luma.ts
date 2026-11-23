import type { Plane, RgbaImage } from "./types";

export function rgbaToLuma(image: RgbaImage): Plane {
  const { width, height, data } = image;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    out[i] =
      (0.299 * (data[p] ?? 0) + 0.587 * (data[p + 1] ?? 0) + 0.114 * (data[p + 2] ?? 0)) / 255;
  }
  return { width, height, data: out };
}
