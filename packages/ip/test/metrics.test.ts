import { describe, expect, it } from "vitest";
import { compareMetrics, errorHeatmap, mse, msSsim, psnr, ssim } from "../src/metrics";
import type { RgbaImage } from "../src/types";

function flat(width: number, height: number, value: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe("mse and psnr", () => {
  it("reports zero error for identical images", () => {
    const image = flat(4, 4, 80);
    expect(mse(image, image)).toBe(0);
    expect(psnr(image, image)).toBe(Number.POSITIVE_INFINITY);
  });

  it("computes the mean squared RGB error", () => {
    const a = flat(2, 2, 0);
    const b = flat(2, 2, 0);
    b.data[0] = 10;
    expect(mse(a, b)).toBeCloseTo(100 / 12, 12);
    expect(psnr(a, b)).toBeCloseTo(10 * Math.log10((255 * 255) / (100 / 12)), 12);
  });

  it("rejects mismatched sizes", () => {
    expect(() => mse(flat(2, 2, 0), flat(3, 2, 0))).toThrow(RangeError);
    expect(() => ssim(flat(2, 2, 0), flat(3, 2, 0))).toThrow(RangeError);
  });
});

describe("ssim", () => {
  it("returns one for identical images", () => {
    const image = flat(16, 16, 90);
    const result = ssim(image, image);
    expect(result.mean).toBeCloseTo(1, 12);
    expect(result.map).toHaveLength(256);
    expect(result.map[0]).toBeCloseTo(1, 6);
    for (const value of result.map) {
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("drops for a luminance difference", () => {
    const a = flat(16, 16, 60);
    const b = flat(16, 16, 180);
    expect(ssim(a, b).mean).toBeLessThan(0.7);
    expect(msSsim(a, b)).toBeLessThan(0.7);
  });
});

describe("ms-ssim", () => {
  it("returns one for identical images", () => {
    const image = flat(32, 32, 100);
    expect(msSsim(image, image)).toBeCloseTo(1, 12);
  });

  it("handles images smaller than the window", () => {
    const a = flat(4, 3, 10);
    const b = flat(4, 3, 30);
    const value = msSsim(a, b);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });
});

describe("errorHeatmap", () => {
  it("is black with no error and keeps alpha", () => {
    const image = flat(4, 4, 50);
    const heatmap = errorHeatmap(image, image);
    expect(heatmap.width).toBe(4);
    expect(heatmap.height).toBe(4);
    expect(Array.from(heatmap.data.slice(0, 4))).toEqual([0, 0, 0, 255]);
  });

  it("brightens with error and saturates at full gain", () => {
    const a = flat(1, 1, 0);
    const b = flat(1, 1, 255);
    const heatmap = errorHeatmap(a, b, 4);
    expect(Array.from(heatmap.data)).toEqual([255, 255, 255, 255]);
  });
});

describe("compareMetrics", () => {
  it("returns every metric", () => {
    const result = compareMetrics(flat(8, 8, 40), flat(8, 8, 42));
    expect(result.mse).toBeCloseTo(4, 12);
    expect(result.psnr).toBeGreaterThan(40);
    expect(result.ssim).toBeCloseTo(1, 2);
    expect(result.msSsim).toBeCloseTo(1, 2);
  });
});
