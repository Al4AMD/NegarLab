import { byteHistogram, histogramCdf } from "./histogram";
import type { RgbaImage } from "./types";

function channelCount(data: Uint8ClampedArray, channel: 0 | 1 | 2): number {
  let count = 0;
  for (let i = channel; i < data.length; i += 4) count += 1;
  return count;
}

function quantileByte(hist: Uint32Array, target: number): number {
  let cumulative = 0;
  for (let bin = 0; bin < 256; bin += 1) {
    cumulative += hist[bin] ?? 0;
    if (cumulative > target) return bin;
  }
  return 255;
}

export function contrastStretch(image: RgbaImage, low = 0, high = 1): RgbaImage {
  if (!(low >= 0 && high <= 1 && low < high)) {
    throw new RangeError("expected 0 <= low < high <= 1");
  }
  const data = new Uint8ClampedArray(image.data.length);
  const n = channelCount(image.data, 0);
  const lowTarget = Math.floor(low * (n - 1));
  const highTarget = Math.floor(high * (n - 1));

  for (let channel = 0; channel < 3; channel += 1) {
    const hist = byteHistogram(image.data, channel as 0 | 1 | 2);
    const lo = quantileByte(hist, lowTarget);
    const hi = quantileByte(hist, highTarget);
    if (hi <= lo) {
      for (let i = channel; i < image.data.length; i += 4) {
        data[i] = image.data[i] ?? 0;
      }
      continue;
    }
    for (let i = channel; i < image.data.length; i += 4) {
      const value = (image.data[i] ?? 0) / 255;
      const mapped = Math.min(1, Math.max(0, (value - lo / 255) / (hi / 255 - lo / 255)));
      data[i] = Math.round(mapped * 255);
    }
  }

  for (let i = 3; i < image.data.length; i += 4) data[i] = image.data[i] ?? 0;
  return { width: image.width, height: image.height, data };
}

export function equalize(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let channel = 0; channel < 3; channel += 1) {
    const counts = byteHistogram(image.data, channel as 0 | 1 | 2);
    const cdf = histogramCdf(counts);
    const lookup = new Uint8Array(256);
    let cdfMin = 0;
    for (let bin = 0; bin < 256; bin += 1) {
      if ((counts[bin] ?? 0) > 0) {
        cdfMin = cdf[bin] ?? 0;
        break;
      }
    }
    const scale = 1 - cdfMin;
    for (let bin = 0; bin < 256; bin += 1) {
      lookup[bin] = scale <= 0 ? bin : Math.round((((cdf[bin] ?? 0) - cdfMin) / scale) * 255);
    }
    for (let i = channel; i < image.data.length; i += 4) {
      data[i] = lookup[image.data[i] ?? 0] ?? 0;
    }
  }
  for (let i = 3; i < image.data.length; i += 4) data[i] = image.data[i] ?? 0;
  return { width: image.width, height: image.height, data };
}
