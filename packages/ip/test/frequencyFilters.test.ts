import { describe, expect, it } from "vitest";
import { applyFrequencyFilter, frequencyMask } from "../src/frequencyFilters";
import type { RgbaImage } from "../src/types";

function constant(size: number, value: number): RgbaImage {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return { width: size, height: size, data };
}

describe("frequency filters", () => {
  it("builds bounded masks for every family and kind", () => {
    for (const family of ["ideal", "butterworth", "gaussian"] as const) {
      for (const kind of ["low", "high", "band", "notch"] as const) {
        const mask = frequencyMask(16, 16, { kind, family, cutoff: 0.3 });
        mask.forEach((value) => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        });
      }
    }
  });

  it("keeps a constant image through a lowpass and removes its DC with a highpass", () => {
    const source = constant(8, 120);
    const low = applyFrequencyFilter(source, { kind: "low", family: "gaussian", cutoff: 0.4 });
    low.data.forEach((value, index) => {
      if (index % 4 !== 3) expect(Math.abs(value - 120)).toBeLessThanOrEqual(1);
    });
    const high = applyFrequencyFilter(source, { kind: "high", family: "ideal", cutoff: 0.2 });
    high.data.forEach((value, index) => {
      if (index % 4 !== 3) expect(value).toBeLessThanOrEqual(1);
    });
  });

  it("rejects invalid cutoffs", () => {
    expect(() =>
      applyFrequencyFilter(constant(4, 10), { kind: "low", family: "ideal", cutoff: 2 }),
    ).toThrow(RangeError);
  });
});
