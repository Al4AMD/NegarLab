import type { RgbaImage } from "./types";

export type Interpolation = "nearest" | "bilinear" | "bicubic" | "lanczos";

export interface GeometryOptions {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotate: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly shearX: number;
  readonly shearY: number;
  readonly perspectiveX: number;
  readonly perspectiveY: number;
  readonly interpolation: Interpolation;
}

type Matrix3 = [number, number, number, number, number, number, number, number, number];

const PANEL: readonly [number, number, number] = [30, 34, 39];

function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const out = new Array<number>(9).fill(0) as Matrix3;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      let sum = 0;
      for (let k = 0; k < 3; k += 1) {
        sum += (a[row * 3 + k] ?? 0) * (b[k * 3 + column] ?? 0);
      }
      out[row * 3 + column] = sum;
    }
  }
  return out;
}

function invert(m: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw new RangeError("transform is singular");
  return [
    (e * i - f * h) / det,
    (c * h - b * i) / det,
    (b * f - c * e) / det,
    (f * g - d * i) / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    (d * h - e * g) / det,
    (b * g - a * h) / det,
    (a * e - b * d) / det,
  ];
}

function clampIndex(value: number, limit: number): number {
  return Math.min(limit - 1, Math.max(0, value));
}

function sinc(value: number): number {
  if (value === 0) return 1;
  const angle = Math.PI * value;
  return Math.sin(angle) / angle;
}

function cubicWeight(value: number): number {
  const a = -0.5;
  const x = Math.abs(value);
  if (x <= 1) return (a + 2) * x ** 3 - (a + 3) * x ** 2 + 1;
  if (x < 2) return a * x ** 3 - 5 * a * x ** 2 + 8 * a * x - 4 * a;
  return 0;
}

function lanczosWeight(value: number): number {
  const x = Math.abs(value);
  return x < 3 ? sinc(x) * sinc(x / 3) : 0;
}

function kernelFor(interpolation: Interpolation): {
  radius: number;
  weight: (value: number) => number;
} | null {
  if (interpolation === "bicubic") return { radius: 2, weight: cubicWeight };
  if (interpolation === "lanczos") return { radius: 3, weight: lanczosWeight };
  return null;
}

function sample(
  image: RgbaImage,
  x: number,
  y: number,
  interpolation: Interpolation,
): [number, number, number, number] {
  const { width, height, data } = image;
  const read = (px: number, py: number, channel: number): number =>
    data[(clampIndex(py, height) * width + clampIndex(px, width)) * 4 + channel] ?? 0;

  if (interpolation === "nearest") {
    const px = Math.round(x);
    const py = Math.round(y);
    return [read(px, py, 0), read(px, py, 1), read(px, py, 2), read(px, py, 3)];
  }

  const kernel = kernelFor(interpolation);
  if (kernel === null) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const out: [number, number, number, number] = [0, 0, 0, 0];
    for (let channel = 0; channel < 4; channel += 1) {
      const top = read(x0, y0, channel) * (1 - fx) + read(x0 + 1, y0, channel) * fx;
      const bottom = read(x0, y0 + 1, channel) * (1 - fx) + read(x0 + 1, y0 + 1, channel) * fx;
      out[channel] = top * (1 - fy) + bottom * fy;
    }
    return out;
  }

  const { radius, weight } = kernel;
  const startX = Math.floor(x) - radius + 1;
  const startY = Math.floor(y) - radius + 1;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  let total = 0;
  for (let ky = 0; ky < radius * 2; ky += 1) {
    const wy = weight(y - (startY + ky));
    for (let kx = 0; kx < radius * 2; kx += 1) {
      const wx = weight(x - (startX + kx));
      const w = wx * wy;
      if (w === 0) continue;
      total += w;
      for (let channel = 0; channel < 4; channel += 1) {
        out[channel] = (out[channel] ?? 0) + read(startX + kx, startY + ky, channel) * w;
      }
    }
  }
  if (total !== 0) {
    for (let channel = 0; channel < 4; channel += 1) {
      out[channel] = (out[channel] ?? 0) / total;
    }
  }
  return out;
}

export function transformImage(image: RgbaImage, options: GeometryOptions): RgbaImage {
  const { width, height } = image;
  const base: Matrix3 = [
    options.scaleX,
    options.shearX,
    options.translateX,
    options.shearY,
    options.scaleY,
    options.translateY,
    options.perspectiveX,
    options.perspectiveY,
    1,
  ];
  const angle = (options.rotate * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const toCenter: Matrix3 = [1, 0, cx, 0, 1, cy, 0, 0, 1];
  const fromCenter: Matrix3 = [1, 0, -cx, 0, 1, -cy, 0, 0, 1];
  const rotation: Matrix3 = [cos, -sin, 0, sin, cos, 0, 0, 0, 1];
  const forward = multiply(multiply(toCenter, multiply(rotation, fromCenter)), base);
  const inverse = invert(forward);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const w = (inverse[6] ?? 0) * x + (inverse[7] ?? 0) * y + (inverse[8] ?? 0);
      const sourceX =
        ((inverse[0] ?? 0) * x + (inverse[1] ?? 0) * y + (inverse[2] ?? 0)) / w;
      const sourceY =
        ((inverse[3] ?? 0) * x + (inverse[4] ?? 0) * y + (inverse[5] ?? 0)) / w;
      const offset = (y * width + x) * 4;
      if (
        !Number.isFinite(sourceX) ||
        !Number.isFinite(sourceY) ||
        sourceX < -0.5 ||
        sourceY < -0.5 ||
        sourceX > width - 0.5 ||
        sourceY > height - 0.5
      ) {
        data[offset + 3] = 0;
        continue;
      }
      const [r, g, b, a] = sample(image, sourceX, sourceY, options.interpolation);
      data[offset] = Math.round(r);
      data[offset + 1] = Math.round(g);
      data[offset + 2] = Math.round(b);
      data[offset + 3] = Math.round(a);
    }
  }
  return { width, height, data };
}

function blur5(image: RgbaImage): RgbaImage {
  const taps = [1, 4, 6, 4, 1];
  const { width, height } = image;
  const horizontal = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        for (let k = 0; k < 5; k += 1) {
          const sourceX = clampIndex(x + k - 2, width);
          sum += (image.data[(y * width + sourceX) * 4 + channel] ?? 0) * (taps[k] ?? 0);
        }
        horizontal[(y * width + x) * 3 + channel] = sum / 16;
      }
    }
  }
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        for (let k = 0; k < 5; k += 1) {
          const sourceY = clampIndex(y + k - 2, height);
          sum += horizontal[(sourceY * width + x) * 3 + channel] ?? 0;
        }
        data[offset + channel] = Math.round(sum / 16);
      }
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width, height, data };
}

function downsample(image: RgbaImage): RgbaImage {
  const width = Math.max(1, Math.floor(image.width / 2));
  const height = Math.max(1, Math.floor(image.height / 2));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (Math.min(image.height - 1, y * 2) * image.width + Math.min(image.width - 1, x * 2)) * 4;
      const offset = (y * width + x) * 4;
      data[offset] = image.data[source] ?? 0;
      data[offset + 1] = image.data[source + 1] ?? 0;
      data[offset + 2] = image.data[source + 2] ?? 0;
      data[offset + 3] = image.data[source + 3] ?? 255;
    }
  }
  return { width, height, data };
}

export function gaussianPyramid(image: RgbaImage, levels: number): RgbaImage[] {
  if (!Number.isInteger(levels) || levels < 1) throw new RangeError("levels must be positive");
  const pyramid = [image];
  while (pyramid.length < levels) {
    const last = pyramid[pyramid.length - 1] as RgbaImage;
    if (last.width <= 1 && last.height <= 1) break;
    pyramid.push(downsample(blur5(last)));
  }
  return pyramid;
}

function upsampleNearest(image: RgbaImage, width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / width));
      const source = (sourceY * image.width + sourceX) * 4;
      const offset = (y * width + x) * 4;
      data[offset] = image.data[source] ?? 0;
      data[offset + 1] = image.data[source + 1] ?? 0;
      data[offset + 2] = image.data[source + 2] ?? 0;
      data[offset + 3] = image.data[source + 3] ?? 255;
    }
  }
  return { width, height, data };
}

export function laplacianPyramid(image: RgbaImage, levels: number): RgbaImage[] {
  const gaussian = gaussianPyramid(image, levels);
  const pyramid: RgbaImage[] = [];
  for (let level = 0; level < gaussian.length; level += 1) {
    const current = gaussian[level] as RgbaImage;
    if (level === gaussian.length - 1) {
      pyramid.push(current);
      continue;
    }
    const next = gaussian[level + 1] as RgbaImage;
    const upsampled = upsampleNearest(next, current.width, current.height);
    const data = new Uint8ClampedArray(current.data.length);
    for (let i = 0; i < current.width * current.height; i += 1) {
      const offset = i * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = Math.round(
          128 + (current.data[offset + channel] ?? 0) - (upsampled.data[offset + channel] ?? 0),
        );
      }
      data[offset + 3] = current.data[offset + 3] ?? 255;
    }
    pyramid.push({ width: current.width, height: current.height, data });
  }
  return pyramid;
}

export function pyramidContactSheet(levels: RgbaImage[]): RgbaImage {
  if (levels.length === 0) throw new RangeError("at least one level is required");
  const gap = 4;
  const width =
    levels.reduce((sum, level) => sum + level.width, 0) + gap * (levels.length - 1);
  const height = levels.reduce((max, level) => Math.max(max, level.height), 1);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.set([PANEL[0], PANEL[1], PANEL[2], 255], i * 4);
  }
  let offsetX = 0;
  for (const level of levels) {
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const source = (y * level.width + x) * 4;
        const target = (y * width + offsetX + x) * 4;
        data[target] = level.data[source] ?? 0;
        data[target + 1] = level.data[source + 1] ?? 0;
        data[target + 2] = level.data[source + 2] ?? 0;
        data[target + 3] = level.data[source + 3] ?? 255;
      }
    }
    offsetX += level.width + gap;
  }
  return { width, height, data };
}

export function multiscaleBlend(
  a: RgbaImage,
  b: RgbaImage,
  levels: number,
  mix: number,
): RgbaImage {
  if (a.width !== b.width || a.height !== b.height) {
    throw new RangeError("images must have the same dimensions");
  }
  const weight = Math.min(1, Math.max(0, mix));
  const la = laplacianPyramid(a, levels);
  const lb = laplacianPyramid(b, levels);
  const blended: RgbaImage[] = la.map((level, index) => {
    const other = lb[index] as RgbaImage;
    const data = new Uint8ClampedArray(level.data.length);
    for (let i = 0; i < level.data.length; i += 1) {
      data[i] =
        i % 4 === 3
          ? (level.data[i] ?? 255)
          : Math.round((level.data[i] ?? 0) * (1 - weight) + (other.data[i] ?? 0) * weight);
    }
    return { width: level.width, height: level.height, data };
  });
  let current = blended[blended.length - 1] as RgbaImage;
  for (let level = blended.length - 2; level >= 0; level -= 1) {
    const residual = blended[level] as RgbaImage;
    const upsampled = upsampleNearest(current, residual.width, residual.height);
    const data = new Uint8ClampedArray(residual.data.length);
    for (let i = 0; i < residual.width * residual.height; i += 1) {
      const offset = i * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = Math.round(
          (residual.data[offset + channel] ?? 0) - 128 + (upsampled.data[offset + channel] ?? 0),
        );
      }
      data[offset + 3] = residual.data[offset + 3] ?? 255;
    }
    current = { width: residual.width, height: residual.height, data };
  }
  return current;
}
