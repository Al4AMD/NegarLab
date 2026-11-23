import type { RgbaImage } from "./types";

export interface SsimResult {
  mean: number;
  map: Float32Array;
  width: number;
  height: number;
}

export interface MetricsResult {
  mse: number;
  psnr: number;
  ssim: number;
  msSsim: number;
}

const WINDOW = 11;
const RADIUS = 5;
const SIGMA = 1.5;
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;
const MS_WEIGHTS = [0.0448, 0.2856, 0.3001, 0.2363, 0.1333] as const;

const GAUSSIAN: Float64Array = (() => {
  const kernel = new Float64Array(WINDOW);
  let total = 0;
  for (let i = 0; i < WINDOW; i += 1) {
    const offset = i - RADIUS;
    const value = Math.exp(-(offset * offset) / (2 * SIGMA * SIGMA));
    kernel[i] = value;
    total += value;
  }
  for (let i = 0; i < kernel.length; i += 1) kernel[i] = (kernel[i] ?? 0) / total;
  return kernel;
})();

function lumaPlane(image: RgbaImage): Float64Array {
  const out = new Float64Array(image.width * image.height);
  for (let i = 0; i < out.length; i += 1) {
    const base = i * 4;
    out[i] =
      0.299 * (image.data[base] ?? 0) +
      0.587 * (image.data[base + 1] ?? 0) +
      0.114 * (image.data[base + 2] ?? 0);
  }
  return out;
}

function blurPlane(plane: Float64Array, width: number, height: number): Float64Array {
  const horizontal = new Float64Array(plane.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = 0; k < WINDOW; k += 1) {
        const sourceX = Math.min(width - 1, Math.max(0, x + k - RADIUS));
        sum += (plane[y * width + sourceX] ?? 0) * (GAUSSIAN[k] ?? 0);
      }
      horizontal[y * width + x] = sum;
    }
  }
  const vertical = new Float64Array(plane.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = 0; k < WINDOW; k += 1) {
        const sourceY = Math.min(height - 1, Math.max(0, y + k - RADIUS));
        sum += (horizontal[sourceY * width + x] ?? 0) * (GAUSSIAN[k] ?? 0);
      }
      vertical[y * width + x] = sum;
    }
  }
  return vertical;
}

function ssimPlanes(a: Float64Array, b: Float64Array, width: number, height: number): SsimResult {
  const meanA = blurPlane(a, width, height);
  const meanB = blurPlane(b, width, height);
  const squareA = new Float64Array(a.length);
  const squareB = new Float64Array(b.length);
  const product = new Float64Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    const valueA = a[i] ?? 0;
    const valueB = b[i] ?? 0;
    squareA[i] = valueA * valueA;
    squareB[i] = valueB * valueB;
    product[i] = valueA * valueB;
  }
  const meanSquareA = blurPlane(squareA, width, height);
  const meanSquareB = blurPlane(squareB, width, height);
  const meanProduct = blurPlane(product, width, height);
  const map = new Float32Array(a.length);
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    const muA = meanA[i] ?? 0;
    const muB = meanB[i] ?? 0;
    const varianceA = Math.max(0, (meanSquareA[i] ?? 0) - muA * muA);
    const varianceB = Math.max(0, (meanSquareB[i] ?? 0) - muB * muB);
    const covariance = (meanProduct[i] ?? 0) - muA * muB;
    const value =
      ((2 * muA * muB + C1) * (2 * covariance + C2)) /
      ((muA * muA + muB * muB + C1) * (varianceA + varianceB + C2));
    map[i] = value;
    total += value;
  }
  return { mean: total / Math.max(1, a.length), map, width, height };
}

function averagePool(
  plane: Float64Array,
  width: number,
  height: number,
): {
  plane: Float64Array;
  width: number;
  height: number;
} {
  const nextWidth = Math.floor(width / 2);
  const nextHeight = Math.floor(height / 2);
  const out = new Float64Array(nextWidth * nextHeight);
  for (let y = 0; y < nextHeight; y += 1) {
    for (let x = 0; x < nextWidth; x += 1) {
      const base = y * 2 * width + x * 2;
      out[y * nextWidth + x] =
        ((plane[base] ?? 0) +
          (plane[base + 1] ?? 0) +
          (plane[base + width] ?? 0) +
          (plane[base + width + 1] ?? 0)) /
        4;
    }
  }
  return { plane: out, width: nextWidth, height: nextHeight };
}

export function mse(a: RgbaImage, b: RgbaImage): number {
  if (a.width !== b.width || a.height !== b.height) throw new RangeError("image sizes differ");
  const count = a.width * a.height * 3;
  if (count === 0) return 0;
  let total = 0;
  for (let i = 0; i < a.width * a.height; i += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const difference = (a.data[i * 4 + channel] ?? 0) - (b.data[i * 4 + channel] ?? 0);
      total += difference * difference;
    }
  }
  return total / count;
}

export function psnr(a: RgbaImage, b: RgbaImage): number {
  const error = mse(a, b);
  return error === 0 ? Number.POSITIVE_INFINITY : 10 * Math.log10((255 * 255) / error);
}

export function ssim(a: RgbaImage, b: RgbaImage): SsimResult {
  if (a.width !== b.width || a.height !== b.height) throw new RangeError("image sizes differ");
  if (a.width === 0 || a.height === 0) {
    return { mean: 1, map: new Float32Array(0), width: a.width, height: a.height };
  }
  return ssimPlanes(lumaPlane(a), lumaPlane(b), a.width, a.height);
}

export function msSsim(a: RgbaImage, b: RgbaImage): number {
  if (a.width !== b.width || a.height !== b.height) throw new RangeError("image sizes differ");
  let currentA = lumaPlane(a);
  let currentB = lumaPlane(b);
  let width = a.width;
  let height = a.height;
  const values: number[] = [];
  for (let scale = 0; scale < MS_WEIGHTS.length; scale += 1) {
    if (width === 0 || height === 0) break;
    values.push(ssimPlanes(currentA, currentB, width, height).mean);
    if (scale === MS_WEIGHTS.length - 1 || width < 2 || height < 2) break;
    const pooledA = averagePool(currentA, width, height);
    const pooledB = averagePool(currentB, width, height);
    currentA = pooledA.plane;
    currentB = pooledB.plane;
    width = pooledA.width;
    height = pooledA.height;
  }
  if (values.length === 0) return 1;
  let weightTotal = 0;
  for (let i = 0; i < values.length; i += 1) weightTotal += MS_WEIGHTS[i] ?? 0;
  let product = 1;
  for (let i = 0; i < values.length; i += 1) {
    const weight = (MS_WEIGHTS[i] ?? 0) / weightTotal;
    product *= Math.max(0, values[i] ?? 0) ** weight;
  }
  return product;
}

export function errorHeatmap(a: RgbaImage, b: RgbaImage, gain = 4): RgbaImage {
  if (a.width !== b.width || a.height !== b.height) throw new RangeError("image sizes differ");
  const data = new Uint8ClampedArray(a.width * a.height * 4);
  for (let i = 0; i < a.width * a.height; i += 1) {
    let difference = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      difference += Math.abs((a.data[i * 4 + channel] ?? 0) - (b.data[i * 4 + channel] ?? 0));
    }
    const value = Math.min(1, (difference / (3 * 255)) * gain);
    data[i * 4] = Math.min(255, Math.max(0, Math.floor(value * 3 * 255)));
    data[i * 4 + 1] = Math.min(255, Math.max(0, Math.floor((value * 3 - 1) * 255)));
    data[i * 4 + 2] = Math.min(255, Math.max(0, Math.floor((value * 3 - 2) * 255)));
    data[i * 4 + 3] = 255;
  }
  return { width: a.width, height: a.height, data };
}

export function compareMetrics(a: RgbaImage, b: RgbaImage): MetricsResult {
  const ssimResult = ssim(a, b);
  return {
    mse: mse(a, b),
    psnr: psnr(a, b),
    ssim: ssimResult.mean,
    msSsim: msSsim(a, b),
  };
}
