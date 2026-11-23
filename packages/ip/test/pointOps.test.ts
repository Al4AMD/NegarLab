import { describe, expect, it } from "vitest";
import { gammaCorrect, logTransform, negative } from "../src/pointOps";
import type { RgbaImage } from "../src/types";

const ramp: RgbaImage = {
  width: 2,
  height: 1,
  data: Uint8ClampedArray.from([0, 64, 128, 255, 255, 255, 255, 255]),
};

describe("point ops", () => {
  it("negative is an involution and keeps alpha", () => {
    const twice = negative(negative(ramp));
    expect(Array.from(twice.data)).toEqual(Array.from(ramp.data));
    expect(twice.data[3]).toBe(255);
  });

  it("gamma 1 is identity and gamma 0.5 brightens", () => {
    expect(Array.from(gammaCorrect(ramp, 1).data)).toEqual(Array.from(ramp.data));
    const brighter = gammaCorrect(ramp, 0.5);
    expect(brighter.data[1]).toBe(128);
    expect(brighter.data[0]).toBe(0);
    expect(brighter.data[4]).toBe(255);
  });

  it("log maps endpoints and lifts midtones", () => {
    const result = logTransform(ramp);
    expect(result.data[0]).toBe(0);
    expect(result.data[4]).toBe(255);
    expect(result.data[1]).toBeGreaterThan(ramp.data[1] ?? 0);
  });
});
