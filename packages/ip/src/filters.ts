import { rgbaToLuma } from "./luma";
import type { Plane, RgbaImage } from "./types";

export interface Kernel {
  readonly size: number;
  readonly weights: Float64Array;
}

function kernelFromRows(rows: readonly (readonly number[])[]): Kernel {
  const size = rows.length;
  const weights = new Float64Array(size * size);
  rows.forEach((row, y) =>
    row.forEach((value, x) => {
      weights[y * size + x] = value;
    }),
  );
  return { size, weights };
}

function normalize(kernel: Kernel): Kernel {
  let sum = 0;
  for (const weight of kernel.weights) sum += weight;
  if (sum === 0) return kernel;
  return {
    size: kernel.size,
    weights: Float64Array.from(kernel.weights, (weight) => weight / sum),
  };
}

export function meanKernel(size = 3): Kernel {
  if (!Number.isInteger(size) || size < 1 || size % 2 === 0) {
    throw new RangeError("size must be an odd positive integer");
  }
  const weights = new Float64Array(size * size).fill(1 / (size * size));
  return { size, weights };
}

export function gaussianKernel(size = 5, sigma = 1): Kernel {
  if (!Number.isInteger(size) || size < 1 || size % 2 === 0) {
    throw new RangeError("size must be an odd positive integer");
  }
  if (!Number.isFinite(sigma) || sigma <= 0) throw new RangeError("sigma must be positive");
  const weights = new Float64Array(size * size);
  const center = (size - 1) / 2;
  const scale = 1 / (2 * sigma * sigma);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      weights[y * size + x] = Math.exp(-(dx * dx + dy * dy) * scale);
    }
  }
  return normalize({ size, weights });
}

export function sharpenKernel(): Kernel {
  return kernelFromRows([
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ]);
}

function clampIndex(value: number, limit: number): number {
  return Math.min(limit - 1, Math.max(0, value));
}

export function convolve(image: RgbaImage, kernel: Kernel): RgbaImage {
  const { size, weights } = kernel;
  if (!Number.isInteger(size) || size < 1 || size % 2 === 0) {
    throw new RangeError("kernel size must be an odd positive integer");
  }
  if (weights.length !== size * size) throw new RangeError("kernel weights do not match size");
  const half = Math.floor(size / 2);
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        for (let ky = 0; ky < size; ky += 1) {
          const sourceY = clampIndex(y + ky - half, image.height);
          for (let kx = 0; kx < size; kx += 1) {
            const sourceX = clampIndex(x + kx - half, image.width);
            const sample = image.data[(sourceY * image.width + sourceX) * 4 + channel] ?? 0;
            sum += sample * (weights[ky * size + kx] ?? 0);
          }
        }
        data[offset + channel] = Math.round(Math.min(255, Math.max(0, sum)));
      }
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width: image.width, height: image.height, data };
}

export function meanFilter(image: RgbaImage, size = 3): RgbaImage {
  return convolve(image, meanKernel(size));
}

export function gaussianFilter(image: RgbaImage, size = 5, sigma = 1): RgbaImage {
  return convolve(image, gaussianKernel(size, sigma));
}

export function sharpenFilter(image: RgbaImage): RgbaImage {
  return convolve(image, sharpenKernel());
}

export function unsharpMask(image: RgbaImage, sigma = 1, amount = 1): RgbaImage {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("amount must be non-negative");
  }
  const blurred = gaussianFilter(image, Math.max(3, 2 * Math.ceil(3 * sigma) + 1), sigma);
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 1) {
    if (i % 4 === 3) {
      data[i] = image.data[i] ?? 255;
      continue;
    }
    const value = image.data[i] ?? 0;
    const soft = blurred.data[i] ?? 0;
    data[i] = Math.round(Math.min(255, Math.max(0, value + amount * (value - soft))));
  }
  return { width: image.width, height: image.height, data };
}

export function medianFilter(image: RgbaImage, radius = 1): RgbaImage {
  if (!Number.isInteger(radius) || radius < 1) {
    throw new RangeError("radius must be a positive integer");
  }
  const data = new Uint8ClampedArray(image.data.length);
  const values: number[] = [];
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        values.length = 0;
        for (let dy = -radius; dy <= radius; dy += 1) {
          const sourceY = clampIndex(y + dy, image.height);
          for (let dx = -radius; dx <= radius; dx += 1) {
            const sourceX = clampIndex(x + dx, image.width);
            values.push(image.data[(sourceY * image.width + sourceX) * 4 + channel] ?? 0);
          }
        }
        values.sort((a, b) => a - b);
        data[offset + channel] = values[Math.floor(values.length / 2)] ?? 0;
      }
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width: image.width, height: image.height, data };
}

export function bilateralFilter(
  image: RgbaImage,
  radius = 2,
  sigmaSpace = 2,
  sigmaRange = 0.1,
): RgbaImage {
  if (!Number.isInteger(radius) || radius < 1) {
    throw new RangeError("radius must be a positive integer");
  }
  if (sigmaSpace <= 0 || sigmaRange <= 0) throw new RangeError("sigmas must be positive");
  const spatial: number[] = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      spatial.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigmaSpace * sigmaSpace)));
    }
  }
  const rangeScale = 2 * (sigmaRange * 255) ** 2;
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = image.data[offset + channel] ?? 0;
        let weighted = 0;
        let total = 0;
        let index = 0;
        for (let dy = -radius; dy <= radius; dy += 1) {
          const sourceY = clampIndex(y + dy, image.height);
          for (let dx = -radius; dx <= radius; dx += 1) {
            const sourceX = clampIndex(x + dx, image.width);
            const sample = image.data[(sourceY * image.width + sourceX) * 4 + channel] ?? 0;
            const weight = (spatial[index] ?? 0) * Math.exp(-((sample - center) ** 2) / rangeScale);
            weighted += sample * weight;
            total += weight;
            index += 1;
          }
        }
        data[offset + channel] = Math.round(total > 0 ? weighted / total : center);
      }
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width: image.width, height: image.height, data };
}

function gradientImage(
  plane: Plane,
  kx: readonly (readonly number[])[],
  ky: readonly (readonly number[])[],
): RgbaImage {
  const size = kx.length;
  const half = Math.floor(size / 2);
  const normX = kx.flat().reduce((sum, value) => sum + Math.max(0, value), 0);
  const normY = ky.flat().reduce((sum, value) => sum + Math.max(0, value), 0);
  const data = new Uint8ClampedArray(plane.width * plane.height * 4);
  for (let y = 0; y < plane.height; y += 1) {
    for (let x = 0; x < plane.width; x += 1) {
      let gx = 0;
      let gy = 0;
      for (let row = 0; row < size; row += 1) {
        const sourceY = clampIndex(y + row - half, plane.height);
        for (let column = 0; column < size; column += 1) {
          const sourceX = clampIndex(x + column - half, plane.width);
          const sample = plane.data[sourceY * plane.width + sourceX] ?? 0;
          gx += sample * (kx[row]?.[column] ?? 0);
          gy += sample * (ky[row]?.[column] ?? 0);
        }
      }
      const magnitude = Math.min(1, Math.hypot(gx / normX, gy / normY));
      const offset = (y * plane.width + x) * 4;
      const value = Math.round(magnitude * 255);
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width: plane.width, height: plane.height, data };
}

function withAlpha(result: RgbaImage, source: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(result.data);
  for (let i = 3; i < data.length; i += 4) data[i] = source.data[i] ?? 255;
  return { width: result.width, height: result.height, data };
}

export function sobelMagnitude(image: RgbaImage): RgbaImage {
  return withAlpha(
    gradientImage(
      rgbaToLuma(image),
      [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1],
      ],
      [
        [1, 2, 1],
        [0, 0, 0],
        [-1, -2, -1],
      ],
    ),
    image,
  );
}

export function prewittMagnitude(image: RgbaImage): RgbaImage {
  return withAlpha(
    gradientImage(
      rgbaToLuma(image),
      [
        [-1, 0, 1],
        [-1, 0, 1],
        [-1, 0, 1],
      ],
      [
        [1, 1, 1],
        [0, 0, 0],
        [-1, -1, -1],
      ],
    ),
    image,
  );
}

export function laplacianImage(image: RgbaImage): RgbaImage {
  const luma = rgbaToLuma(image);
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      let sum = 0;
      for (const [dx, dy, weight] of [
        [0, -1, 1],
        [-1, 0, 1],
        [0, 0, -4],
        [1, 0, 1],
        [0, 1, 1],
      ] as const) {
        sum +=
          (luma.data[
            clampIndex(y + dy, image.height) * image.width + clampIndex(x + dx, image.width)
          ] ?? 0) * weight;
      }
      const value = Math.round(Math.min(1, Math.abs(sum) / 4) * 255);
      const offset = (y * image.width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width: image.width, height: image.height, data };
}

export function logImage(image: RgbaImage, sigma = 1): RgbaImage {
  return laplacianImage(gaussianFilter(image, Math.max(3, 2 * Math.ceil(3 * sigma) + 1), sigma));
}

export function cannyEdges(image: RgbaImage, low = 0.1, high = 0.2, sigma = 1): RgbaImage {
  if (low < 0 || high <= low || high > 1)
    throw new RangeError("thresholds must satisfy 0 <= low < high <= 1");
  const smooth = gaussianFilter(image, Math.max(3, 2 * Math.ceil(3 * sigma) + 1), sigma);
  const luma = rgbaToLuma(smooth);
  const width = image.width;
  const height = image.height;
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let gx = 0;
      let gy = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const sample =
            luma.data[clampIndex(y + dy, height) * width + clampIndex(x + dx, width)] ?? 0;
          gx += sample * dx;
          gy += sample * dy;
        }
      }
      const index = y * width + x;
      magnitude[index] = Math.hypot(gx, gy) / 4;
      direction[index] = Math.atan2(gy, gx);
    }
  }
  const suppressed = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const angle = ((direction[index] ?? 0) * 180) / Math.PI;
      const normalized = (((angle + 180) % 180) + 22.5) % 180;
      const [dx, dy] =
        normalized < 45 ? [1, 0] : normalized < 90 ? [1, 1] : normalized < 135 ? [0, 1] : [-1, 1];
      const current = magnitude[index] ?? 0;
      const before = magnitude[clampIndex(y - dy, height) * width + clampIndex(x - dx, width)] ?? 0;
      const after = magnitude[clampIndex(y + dy, height) * width + clampIndex(x + dx, width)] ?? 0;
      suppressed[index] = current >= before && current >= after ? current : 0;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  const active = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let index = 0; index < suppressed.length; index += 1) {
    if ((suppressed[index] ?? 0) >= high) {
      active[index] = 1;
      stack.push(index);
    }
  }
  while (stack.length > 0) {
    const index = stack.pop() ?? 0;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (active[next] === 1) continue;
        if ((suppressed[next] ?? 0) >= low) {
          active[next] = 1;
          stack.push(next);
        }
      }
    }
  }
  for (let index = 0; index < active.length; index += 1) {
    const value = active[index] === 1 ? 255 : 0;
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = image.data[index * 4 + 3] ?? 255;
  }
  return { width, height, data };
}
