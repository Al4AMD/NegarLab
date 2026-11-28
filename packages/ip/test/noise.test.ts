import { describe, expect, it } from "vitest";
import { addNoise, deconvolve, defocusBlur, motionBlur, wienerDenoise } from "../src/noise";
import type { RgbaImage } from "../src/types";

function flat(value = 128): RgbaImage {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i += 1) data.set([value, value, value, 255], i * 4);
  return { width: 16, height: 16, data };
}

describe("noise", () => {
  it("is deterministic for a seed", () => {
    const a = addNoise(flat(), { kind: "gaussian", amount: 0.1, seed: 7 });
    const b = addNoise(flat(), { kind: "gaussian", amount: 0.1, seed: 7 });
    expect([...a.data]).toEqual([...b.data]);
  });

  it("supports all four noise kinds", () => {
    for (const kind of ["gaussian", "salt-pepper", "speckle", "poisson"] as const) {
      const out = addNoise(flat(), { kind, amount: 0.1, seed: 3 });
      expect(out.data.length).toBe(16 * 16 * 4);
    }
  });

  it("blurs, denoises, and deconvolves", () => {
    const blurred = motionBlur(flat(), 5, 30);
    expect(blurred.data.length).toBe(flat().data.length);
    expect(defocusBlur(flat(), 2).width).toBe(16);
    expect(wienerDenoise(flat(), 0.01).width).toBe(16);
    const restored = deconvolve(blurred, {
      method: "wiener",
      blur: "motion",
      length: 5,
      angle: 30,
      radius: 2,
      strength: 0.01,
    });
    expect(restored.width).toBe(16);
  });

  it("keeps alpha and clamps noise", () => {
    const input = flat(255);
    for (const kind of ["gaussian", "salt-pepper", "speckle", "poisson"] as const) {
      const out = addNoise(input, { kind, amount: 0.5, seed: 11 });
      expect(out.data[3]).toBe(255);
      expect(out.data[15]).toBe(255);
    }
  });
});
