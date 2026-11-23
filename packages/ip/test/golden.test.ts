import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { planeStats, rgbaToLuma } from "../src";
import type { Plane, RgbaImage } from "../src/types";

interface Golden {
  input: { width: number; height: number; rgba: number[] };
  expected: { luma: number[]; stats: { mean: number; variance: number; entropyBits: number } };
  tolerance: number;
}

const golden: Golden = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../test-data/golden/luma-stats.json", import.meta.url)),
    "utf8",
  ),
);

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
    tolerance,
  );
}

describe("golden luma and stats vectors", () => {
  it("matches the NumPy reference within tolerance", () => {
    const image: RgbaImage = {
      width: golden.input.width,
      height: golden.input.height,
      data: Uint8ClampedArray.from(golden.input.rgba),
    };
    const plane: Plane = rgbaToLuma(image);
    expect(plane.width).toBe(golden.input.width);
    expect(plane.height).toBe(golden.input.height);

    golden.expected.luma.forEach((expected, index) => {
      assertClose(plane.data[index] ?? Number.NaN, expected, golden.tolerance, `luma[${index}]`);
    });

    const stats = planeStats(plane);
    assertClose(stats.mean, golden.expected.stats.mean, golden.tolerance, "mean");
    assertClose(stats.variance, golden.expected.stats.variance, golden.tolerance, "variance");
    assertClose(
      stats.entropyBits,
      golden.expected.stats.entropyBits,
      golden.tolerance,
      "entropyBits",
    );
  });
});
