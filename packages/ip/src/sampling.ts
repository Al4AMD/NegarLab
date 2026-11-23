import { byteHistogram, histogramCdf } from "./histogram";
import type { RgbaImage } from "./types";

export function quantizeBits(image: RgbaImage, bits: number): RgbaImage {
  if (!Number.isInteger(bits) || bits < 1 || bits > 8) {
    throw new RangeError("bits must be an integer within 1..8");
  }
  const levels = 2 ** bits;
  const lookup = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    const quantized = Math.round((value / 255) * (levels - 1)) / (levels - 1);
    lookup[value] = Math.round(quantized * 255);
  }
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 1) {
    data[i] = i % 4 === 3 ? (image.data[i] ?? 0) : (lookup[image.data[i] ?? 0] ?? 0);
  }
  return { width: image.width, height: image.height, data };
}

export function resizeNearest(image: RgbaImage, width: number, height: number): RgbaImage {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError("width and height must be positive integers");
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / width));
      const sourceOffset = (sourceY * image.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;
      data[targetOffset] = image.data[sourceOffset] ?? 0;
      data[targetOffset + 1] = image.data[sourceOffset + 1] ?? 0;
      data[targetOffset + 2] = image.data[sourceOffset + 2] ?? 0;
      data[targetOffset + 3] = image.data[sourceOffset + 3] ?? 255;
    }
  }
  return { width, height, data };
}

export function matchHistogram(image: RgbaImage, reference: RgbaImage): RgbaImage {
  if (image.width * image.height === 0 || reference.width * reference.height === 0) {
    return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
  }
  const data = new Uint8ClampedArray(image.data.length);
  for (let channel = 0; channel < 3; channel += 1) {
    const sourceCdf = histogramCdf(byteHistogram(image.data, channel as 0 | 1 | 2));
    const referenceCdf = histogramCdf(byteHistogram(reference.data, channel as 0 | 1 | 2));
    const lookup = new Uint8Array(256);
    for (let bin = 0; bin < 256; bin += 1) {
      const target = sourceCdf[bin] ?? 0;
      let mapped = 255;
      for (let refBin = 0; refBin < 256; refBin += 1) {
        if ((referenceCdf[refBin] ?? 0) >= target) {
          mapped = refBin;
          break;
        }
      }
      lookup[bin] = mapped;
    }
    for (let i = channel; i < image.data.length; i += 4) {
      data[i] = lookup[image.data[i] ?? 0] ?? 0;
    }
  }
  for (let i = 3; i < image.data.length; i += 4) data[i] = image.data[i] ?? 0;
  return { width: image.width, height: image.height, data };
}
