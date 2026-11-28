import { describe, expect, it } from "vitest";
import {
  balanceWhite,
  colorSpaceView,
  simulateColorBlindness,
  subsampleChroma,
} from "../src/color";
import type { RgbaImage } from "../src/types";

function image(pixels: number[][]): RgbaImage {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r = 0, g = 0, b = 0, a = 255], index) => {
    data.set([r, g, b, a], index * 4);
  });
  return { width: pixels.length, height: 1, data };
}

describe("color", () => {
  it("round-trips RGB through Lab", () => {
    const input = image([
      [120, 40, 200],
      [0, 0, 0],
      [255, 255, 255],
    ]);
    const lab = colorSpaceView(input, "lab", -1);
    expect(lab.width).toBe(3);
    expect(lab.data[0]).toBeCloseTo(120, 0);
    expect(lab.data[1]).toBeCloseTo(40, 0);
    expect(lab.data[2]).toBeCloseTo(200, 0);
  });

  it("separates channels as grayscale", () => {
    const input = image([[10, 20, 30]]);
    const hsv = colorSpaceView(input, "hsv", 2);
    expect(hsv.data[0]).toBe(hsv.data[1]);
    expect(hsv.data[1]).toBe(hsv.data[2]);
  });

  it("subsamples 4:2:0 chroma and preserves alpha", () => {
    const input = image([
      [255, 0, 0, 77],
      [0, 255, 0, 88],
    ]);
    const out = subsampleChroma(input, "4:2:0");
    expect(out.data[3]).toBe(77);
    expect(out.data[7]).toBe(88);
  });

  it("simulates color blindness and white balance", () => {
    const input = image([
      [200, 40, 40],
      [40, 200, 40],
    ]);
    const blind = simulateColorBlindness(input, "deuteranopia", 1);
    expect(blind.data[0]).not.toBe(200);
    const balanced = balanceWhite(input, "gray-world");
    expect(balanced.width).toBe(2);
  });
});
