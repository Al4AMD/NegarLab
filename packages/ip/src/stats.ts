import type { ImageStats, Plane } from "./types";

export function planeStats(plane: Plane): ImageStats {
  const values = plane.data;
  const n = values.length;
  if (n === 0) {
    return { mean: 0, variance: 0, entropyBits: 0 };
  }

  const histogram = new Uint32Array(256);
  let sum = 0;
  for (const value of values) {
    sum += value;
    const bin = Math.min(255, Math.max(0, Math.floor(value * 255)));
    histogram[bin] = (histogram[bin] ?? 0) + 1;
  }

  const mean = sum / n;
  let squared = 0;
  for (const value of values) {
    const delta = value - mean;
    squared += delta * delta;
  }
  const variance = squared / n;

  let entropyBits = 0;
  for (const count of histogram) {
    if (count === 0 || count === n) continue;
    const p = count / n;
    entropyBits -= p * Math.log2(p);
  }

  return { mean, variance, entropyBits };
}
