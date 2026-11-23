import type { Plane, RgbaImage } from "./types";

export function channelHistogram(plane: Plane): Uint32Array {
  const counts = new Uint32Array(256);
  for (const value of plane.data) {
    const bin = Math.min(255, Math.max(0, Math.floor(value * 255)));
    counts[bin] = (counts[bin] ?? 0) + 1;
  }
  return counts;
}

export function byteHistogram(data: Uint8ClampedArray, channel: 0 | 1 | 2): Uint32Array {
  const counts = new Uint32Array(256);
  for (let i = channel; i < data.length; i += 4) {
    const value = data[i] ?? 0;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export function histogramCdf(hist: Uint32Array): Float64Array {
  const cdf = new Float64Array(256);
  let total = 0;
  for (const count of hist) total += count;
  if (total === 0) return cdf;
  let cumulative = 0;
  for (let bin = 0; bin < 256; bin += 1) {
    cumulative += hist[bin] ?? 0;
    cdf[bin] = cumulative / total;
  }
  return cdf;
}

export function lumaHistogram(image: RgbaImage): Uint32Array {
  const counts = new Uint32Array(256);
  for (let i = 0; i < image.data.length; i += 4) {
    const r = (image.data[i] ?? 0) / 255;
    const g = (image.data[i + 1] ?? 0) / 255;
    const b = (image.data[i + 2] ?? 0) / 255;
    const value = Math.fround(0.299 * r + 0.587 * g + 0.114 * b);
    const bin = Math.min(255, Math.max(0, Math.floor(value * 255)));
    counts[bin] = (counts[bin] ?? 0) + 1;
  }
  return counts;
}
