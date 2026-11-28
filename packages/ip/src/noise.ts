import { fft2, ifft2 } from "./fft";
import type { Plane, RgbaImage } from "./types";

export type NoiseKind = "gaussian" | "salt-pepper" | "speckle" | "poisson";

export interface NoiseOptions {
  readonly kind: NoiseKind;
  readonly amount: number;
  readonly seed: number;
}

export type DeconvolutionMethod = "inverse" | "wiener";

export interface DeconvolutionOptions {
  readonly method: DeconvolutionMethod;
  readonly blur: "motion" | "defocus";
  readonly length: number;
  readonly angle: number;
  readonly radius: number;
  readonly strength: number;
}

interface Psf {
  readonly size: number;
  readonly weights: Float64Array;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianSample(random: () => number): number {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function addNoise(image: RgbaImage, options: NoiseOptions): RgbaImage {
  if (!Number.isFinite(options.amount) || options.amount < 0) {
    throw new RangeError("amount must be non-negative");
  }
  const random = mulberry32(options.seed);
  const amount = options.amount;
  const data = new Uint8ClampedArray(image.data);
  for (let i = 0; i < image.width * image.height; i += 1) {
    const offset = i * 4;
    if (options.kind === "salt-pepper") {
      const sample = random();
      if (sample < amount / 2) {
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
      } else if (sample > 1 - amount / 2) {
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
      }
      continue;
    }
    for (let channel = 0; channel < 3; channel += 1) {
      const value = data[offset + channel] ?? 0;
      let result = value;
      if (options.kind === "gaussian") {
        result = value + amount * 255 * gaussianSample(random);
      } else if (options.kind === "speckle") {
        result = value * (1 + amount * gaussianSample(random));
      } else {
        const lambda = (value / 255) * 20;
        let count = 0;
        let product = 1;
        const limit = Math.exp(-lambda);
        do {
          count += 1;
          product *= random();
        } while (product > limit);
        result = ((count - 1) / 20) * 255;
      }
      data[offset + channel] = clampByte(result);
    }
  }
  return { width: image.width, height: image.height, data };
}

function motionPsf(length: number, angle: number): Psf {
  const size = Math.max(
    3,
    Math.round(length) % 2 === 0 ? Math.round(length) + 1 : Math.round(length),
  );
  const weights = new Float64Array(size * size);
  const half = Math.floor(size / 2);
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  for (let step = -half; step <= half; step += 1) {
    const x = dx * step + half;
    const y = dy * step + half;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    for (const [ox, oy, weight] of [
      [0, 0, (1 - fx) * (1 - fy)],
      [1, 0, fx * (1 - fy)],
      [0, 1, (1 - fx) * fy],
      [1, 1, fx * fy],
    ] as const) {
      const px = x0 + ox;
      const py = y0 + oy;
      if (px < 0 || py < 0 || px >= size || py >= size) continue;
      weights[py * size + px] = (weights[py * size + px] ?? 0) + weight;
    }
  }
  return normalizePsf(size, weights);
}

function defocusPsf(radius: number): Psf {
  const r = Math.max(1, Math.round(radius));
  const size = 2 * r + 1;
  const weights = new Float64Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - r;
      const dy = y - r;
      if (dx * dx + dy * dy <= r * r) weights[y * size + x] = 1;
    }
  }
  return normalizePsf(size, weights);
}

function normalizePsf(size: number, weights: Float64Array): Psf {
  let sum = 0;
  for (const weight of weights) sum += weight;
  if (sum > 0) {
    for (let i = 0; i < weights.length; i += 1) weights[i] = (weights[i] ?? 0) / sum;
  }
  return { size, weights };
}

function convolvePsf(image: RgbaImage, psf: Psf): RgbaImage {
  const { size, weights } = psf;
  const half = Math.floor(size / 2);
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        for (let ky = 0; ky < size; ky += 1) {
          const sourceY = Math.min(image.height - 1, Math.max(0, y + ky - half));
          for (let kx = 0; kx < size; kx += 1) {
            const sourceX = Math.min(image.width - 1, Math.max(0, x + kx - half));
            sum +=
              (image.data[(sourceY * image.width + sourceX) * 4 + channel] ?? 0) *
              (weights[ky * size + kx] ?? 0);
          }
        }
        data[offset + channel] = clampByte(sum);
      }
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width: image.width, height: image.height, data };
}

export function motionBlur(image: RgbaImage, length: number, angle: number): RgbaImage {
  return convolvePsf(image, motionPsf(length, angle));
}

export function defocusBlur(image: RgbaImage, radius: number): RgbaImage {
  return convolvePsf(image, defocusPsf(radius));
}

export function wienerDenoise(image: RgbaImage, strength: number): RgbaImage {
  if (!Number.isFinite(strength) || strength < 0) {
    throw new RangeError("strength must be non-negative");
  }
  const radius = 2;
  const noiseVariance = (strength * 255) ** 2;
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let sumSquares = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy += 1) {
          const sourceY = Math.min(image.height - 1, Math.max(0, y + dy));
          for (let dx = -radius; dx <= radius; dx += 1) {
            const sourceX = Math.min(image.width - 1, Math.max(0, x + dx));
            const sample = image.data[(sourceY * image.width + sourceX) * 4 + channel] ?? 0;
            sum += sample;
            sumSquares += sample * sample;
            count += 1;
          }
        }
        const mean = sum / count;
        const variance = Math.max(0, sumSquares / count - mean * mean);
        const value = image.data[offset + channel] ?? 0;
        const gain = variance > 0 ? Math.max(0, variance - noiseVariance) / variance : 0;
        data[offset + channel] = clampByte(mean + gain * (value - mean));
      }
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width: image.width, height: image.height, data };
}

function psfPlane(psf: Psf, width: number, height: number): Plane {
  const data = new Float32Array(width * height);
  const half = Math.floor(psf.size / 2);
  for (let ky = 0; ky < psf.size; ky += 1) {
    for (let kx = 0; kx < psf.size; kx += 1) {
      const weight = psf.weights[ky * psf.size + kx] ?? 0;
      if (weight === 0) continue;
      const y = (((ky - half) % height) + height) % height;
      const x = (((kx - half) % width) + width) % width;
      data[y * width + x] = (data[y * width + x] ?? 0) + weight;
    }
  }
  return { width, height, data };
}

export function deconvolve(image: RgbaImage, options: DeconvolutionOptions): RgbaImage {
  if (!Number.isFinite(options.strength) || options.strength < 0) {
    throw new RangeError("strength must be non-negative");
  }
  const { width, height } = image;
  const psf =
    options.blur === "motion"
      ? motionPsf(options.length, options.angle)
      : defocusPsf(options.radius);
  const transfer = fft2(psfPlane(psf, width, height));
  const data = new Uint8ClampedArray(image.data.length);
  const epsilon = 1e-3;
  for (let channel = 0; channel < 3; channel += 1) {
    const plane = new Float32Array(width * height);
    for (let i = 0; i < width * height; i += 1) {
      plane[i] = (image.data[i * 4 + channel] ?? 0) / 255;
    }
    const spectrum = fft2({ width, height, data: plane });
    const re = new Float64Array(spectrum.re.length);
    const im = new Float64Array(spectrum.im.length);
    for (let i = 0; i < re.length; i += 1) {
      const fr = spectrum.re[i] ?? 0;
      const fi = spectrum.im[i] ?? 0;
      const hr = transfer.re[i] ?? 0;
      const hi = transfer.im[i] ?? 0;
      const power = hr * hr + hi * hi;
      let gr: number;
      let gi: number;
      if (options.method === "inverse") {
        if (power < epsilon * epsilon) {
          gr = 0;
          gi = 0;
        } else {
          gr = (fr * hr + fi * hi) / power;
          gi = (fi * hr - fr * hi) / power;
        }
      } else {
        const denominator = power + options.strength;
        gr = (fr * hr + fi * hi) / denominator;
        gi = (fi * hr - fr * hi) / denominator;
      }
      re[i] = gr;
      im[i] = gi;
    }
    const restored = ifft2({ width: spectrum.width, height: spectrum.height, re, im });
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = restored.data[y * restored.width + x] ?? 0;
        data[(y * width + x) * 4 + channel] = clampByte(value * 255);
      }
    }
  }
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4 + 3] = image.data[i * 4 + 3] ?? 255;
  }
  return { width, height, data };
}
