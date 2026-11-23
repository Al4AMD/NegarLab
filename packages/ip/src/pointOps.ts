import { mapChannels, toByte } from "./pixel";
import type { RgbaImage } from "./types";

export function negative(image: RgbaImage): RgbaImage {
  return mapChannels(image, (value) => 1 - value);
}

export function logTransform(image: RgbaImage): RgbaImage {
  return mapChannels(image, (value) => Math.log1p(255 * value) / Math.log(256));
}

export function gammaCorrect(image: RgbaImage, gamma: number): RgbaImage {
  if (!Number.isFinite(gamma) || gamma <= 0) {
    throw new RangeError("gamma must be a positive finite number");
  }
  return mapChannels(image, (value) => value ** gamma);
}

export function byteLookup(image: RgbaImage, lookup: Uint8Array): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 1) {
    data[i] = i % 4 === 3 ? (image.data[i] ?? 0) : (lookup[image.data[i] ?? 0] ?? 0);
  }
  return { width: image.width, height: image.height, data };
}

export { toByte };
