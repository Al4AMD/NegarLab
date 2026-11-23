import { describe, expect, it } from "vitest";
import {
  bilateralFilter,
  cannyEdges,
  convolve,
  gaussianFilter,
  laplacianImage,
  meanFilter,
  medianFilter,
  prewittMagnitude,
  sobelMagnitude,
  unsharpMask,
} from "../src/filters";
import type { RgbaImage } from "../src/types";

function image(pixels: number[][], alpha = 255): RgbaImage {
  const height = pixels.length;
  const width = pixels[0]?.length ?? 0;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = pixels[y]?.[x] ?? 0;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = alpha;
    }
  }
  return { width, height, data };
}

function constant(width: number, height: number, value: number): RgbaImage {
  return image(Array.from({ length: height }, () => new Array(width).fill(value)));
}

function row(imageValue: RgbaImage, y: number): number[] {
  const values: number[] = [];
  for (let x = 0; x < imageValue.width; x += 1)
    values.push(imageValue.data[(y * imageValue.width + x) * 4] ?? 0);
  return values;
}

describe("spatial filters", () => {
  it("keeps constant images unchanged for normalized smoothing", () => {
    const source = constant(8, 8, 90);
    for (const output of [meanFilter(source, 3), gaussianFilter(source, 5, 1)]) {
      expect(
        Array.from(output.data.filter((_, index) => index % 4 !== 3)).every(
          (value) => value === 90,
        ),
      ).toBe(true);
    }
  });

  it("clamps at borders and preserves alpha", () => {
    const source = image([[0, 255]], 128);
    const result = convolve(source, {
      size: 3,
      weights: new Float64Array([1, 0, 0, 0, 0, 0, 0, 0, 0]),
    });
    expect(result.data[3]).toBe(128);
    expect(Number.isFinite(result.data[0])).toBe(true);
  });

  it("median removes isolated salt noise", () => {
    const source = image([
      [10, 10, 10],
      [10, 255, 10],
      [10, 10, 10],
    ]);
    expect(row(medianFilter(source, 1), 1)).toEqual([10, 10, 10]);
  });

  it("detects a vertical step with Sobel and Prewitt", () => {
    const source = image(Array.from({ length: 5 }, () => [0, 0, 0, 255, 255]));
    const sobel = sobelMagnitude(source);
    const prewitt = prewittMagnitude(source);
    for (const output of [sobel, prewitt]) {
      expect(row(output, 2)[2]).toBe(255);
      expect(row(output, 2)[0]).toBe(0);
      expect(row(output, 2)[4]).toBe(0);
    }
  });

  it("returns zero edges on constant images", () => {
    const source = constant(8, 8, 120);
    expect(row(sobelMagnitude(source), 4).every((value) => value === 0)).toBe(true);
    expect(row(laplacianImage(source), 4).every((value) => value === 0)).toBe(true);
  });

  it("unsharp and bilateral preserve dimensions and alpha", () => {
    const source = image(
      Array.from({ length: 4 }, (_, y) => [y * 40, y * 40, y * 40, y * 40]),
      200,
    );
    for (const output of [
      unsharpMask(source, 1, 1),
      bilateralFilter(source, 1, 2, 0.1),
      cannyEdges(source),
    ]) {
      expect(output.width).toBe(4);
      expect(output.height).toBe(4);
      expect(output.data[3]).toBe(200);
    }
  });
});
