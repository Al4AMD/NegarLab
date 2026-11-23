import { describe, expect, it } from "vitest";
import { planeStats } from "../src/stats";
import type { Plane } from "../src/types";

function plane(values: number[]): Plane {
  return { width: values.length, height: 1, data: Float32Array.from(values) };
}

describe("planeStats", () => {
  it("computes mean, variance, and entropy for a half-black half-white plane", () => {
    const stats = planeStats(plane([0, 0, 1, 1]));
    expect(stats.mean).toBeCloseTo(0.5, 6);
    expect(stats.variance).toBeCloseTo(0.25, 6);
    expect(stats.entropyBits).toBeCloseTo(1, 6);
  });

  it("returns zero variance and entropy for a constant plane", () => {
    const stats = planeStats(plane([0.25, 0.25, 0.25, 0.25]));
    expect(stats.mean).toBeCloseTo(0.25, 6);
    expect(stats.variance).toBe(0);
    expect(stats.entropyBits).toBe(0);
  });

  it("handles an empty plane", () => {
    const stats = planeStats(plane([]));
    expect(stats).toEqual({ mean: 0, variance: 0, entropyBits: 0 });
  });
});
