import { rgbaToLuma } from "./luma";
import type { Plane, RgbaImage } from "./types";

export function otsuThreshold(plane: Plane): number {
  const hist = new Float64Array(256);
  for (const value of plane.data) {
    const bin = Math.min(255, Math.max(0, Math.floor(value * 255)));
    hist[bin] = (hist[bin] ?? 0) + 1;
  }
  const total = plane.data.length;
  if (total === 0) return 0;

  let weight = 0;
  let totalSum = 0;
  for (let bin = 0; bin < 256; bin += 1) totalSum += bin * (hist[bin] ?? 0);
  const meanTotal = totalSum / total;
  let sumLow = 0;

  let bestBin = 0;
  let bestVariance = -1;
  for (let bin = 0; bin < 256; bin += 1) {
    weight += hist[bin] ?? 0;
    if (weight === 0) continue;
    const weightHigh = total - weight;
    if (weightHigh === 0) break;
    sumLow += bin * (hist[bin] ?? 0);
    const meanLow = sumLow / weight;
    const meanHigh = (meanTotal * total - sumLow) / weightHigh;
    const variance = (weight / total) * (weightHigh / total) * (meanLow - meanHigh) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestBin = bin;
    }
  }
  return bestBin / 255;
}

export function threshold(image: RgbaImage, cutoff: number, invert = false): RgbaImage {
  if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > 1) {
    throw new RangeError("cutoff must be within 0..1");
  }
  const luma = rgbaToLuma(image);
  const data = new Uint8ClampedArray(image.data.length);
  for (let p = 0; p < luma.data.length; p += 1) {
    const isWhite = invert ? (luma.data[p] ?? 0) <= cutoff : (luma.data[p] ?? 0) > cutoff;
    const offset = p * 4;
    const value = isWhite ? 255 : 0;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { width: image.width, height: image.height, data };
}
