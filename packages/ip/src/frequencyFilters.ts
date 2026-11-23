import { fft2, ifft2 } from "./fft";
import { rgbaToLuma } from "./luma";
import type { RgbaImage } from "./types";

export type FrequencyFamily = "ideal" | "butterworth" | "gaussian";
export type FrequencyKind = "low" | "high" | "band" | "notch";

export interface FrequencyFilterOptions {
  readonly kind: FrequencyKind;
  readonly family: FrequencyFamily;
  readonly cutoff: number;
  readonly width?: number;
  readonly order?: number;
  readonly notchX?: number;
  readonly notchY?: number;
  readonly notchRadius?: number;
}

function lowMask(distance: number, cutoff: number, family: FrequencyFamily, order: number): number {
  if (cutoff <= 0) return 0;
  if (family === "ideal") return distance <= cutoff ? 1 : 0;
  if (family === "gaussian") return Math.exp(-(distance * distance) / (2 * cutoff * cutoff));
  return 1 / (1 + (distance / cutoff) ** (2 * order));
}

export function frequencyMask(
  width: number,
  height: number,
  options: FrequencyFilterOptions,
): Float64Array {
  const mask = new Float64Array(width * height);
  const order = Math.max(1, Math.round(options.order ?? 2));
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cutoff = Math.min(1, Math.max(0, options.cutoff));
  for (let y = 0; y < height; y += 1) {
    const dy = (y - halfHeight) / halfHeight;
    for (let x = 0; x < width; x += 1) {
      const dx = (x - halfWidth) / halfWidth;
      const distance = Math.hypot(dx, dy);
      let value = 0;
      if (options.kind === "low") {
        value = lowMask(distance, cutoff, options.family, order);
      } else if (options.kind === "high") {
        value = 1 - lowMask(distance, cutoff, options.family, order);
      } else if (options.kind === "band") {
        const bandWidth = Math.max(0.01, options.width ?? 0.2);
        const inner = Math.max(0, cutoff - bandWidth / 2);
        const outer = Math.min(1, cutoff + bandWidth / 2);
        value =
          lowMask(distance, outer, options.family, order) -
          lowMask(distance, inner, options.family, order);
      } else {
        const radius = Math.max(0.01, options.notchRadius ?? 0.15);
        const nx = options.notchX ?? 0.35;
        const ny = options.notchY ?? 0.35;
        const d1 = Math.hypot(dx - nx, dy - ny);
        const d2 = Math.hypot(dx + nx, dy + ny);
        value = d1 > radius && d2 > radius ? 1 : 0;
      }
      mask[y * width + x] = Math.min(1, Math.max(0, value));
    }
  }
  return mask;
}

export function applyFrequencyFilter(image: RgbaImage, options: FrequencyFilterOptions): RgbaImage {
  if (!Number.isFinite(options.cutoff) || options.cutoff < 0 || options.cutoff > 1) {
    throw new RangeError("cutoff must be within 0..1");
  }
  const spectrum = fft2(rgbaToLuma(image));
  const mask = frequencyMask(spectrum.width, spectrum.height, options);
  const shiftX = spectrum.width / 2;
  const shiftY = spectrum.height / 2;
  for (let y = 0; y < spectrum.height; y += 1) {
    for (let x = 0; x < spectrum.width; x += 1) {
      const shiftedIndex =
        ((y + shiftY) % spectrum.height) * spectrum.width + ((x + shiftX) % spectrum.width);
      const gain = mask[shiftedIndex] ?? 0;
      const index = y * spectrum.width + x;
      spectrum.re[index] = (spectrum.re[index] ?? 0) * gain;
      spectrum.im[index] = (spectrum.im[index] ?? 0) * gain;
    }
  }
  const restored = ifft2(spectrum);
  const data = new Uint8ClampedArray(image.width * image.height * 4);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const value = Math.round((restored.data[y * restored.width + x] ?? 0) * 255);
      const offset = (y * image.width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = image.data[offset + 3] ?? 255;
    }
  }
  return { width: image.width, height: image.height, data };
}
