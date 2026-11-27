import { describe, expect, it } from "vitest";
import { halftone, reducePalette } from "../src/halftone";
import type { RgbaImage } from "../src/types";

function image(): RgbaImage {
  const data = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < 64; i += 1) {
    data.set([(i * 31) % 256, (i * 17) % 256, (i * 7) % 256, 255], i * 4);
  }
  return { width: 8, height: 8, data };
}

describe("halftone", () => {
  it("diffuses error and orders Bayer", () => {
    const floyd = halftone(image(), "floyd-steinberg");
    expect(floyd.data.length).toBe(8 * 8 * 4);
    expect([...floyd.data].every((value, index) => index % 4 === 3 || value === 0 || value === 255)).toBe(true);
    const bayer = halftone(image(), "bayer", 4);
    expect(bayer.data.length).toBe(8 * 8 * 4);
  });

  it("reduces palettes with both methods", () => {
    for (const method of ["median-cut", "kmeans"] as const) {
      const result = reducePalette(image(), 4, method, true, 5);
      expect(result.palette.length).toBeGreaterThan(0);
      expect(result.image.width).toBe(8);
    }
  });

  it("is deterministic for a seed", () => {
    const a = reducePalette(image(), 4, "kmeans", false, 5);
    const b = reducePalette(image(), 4, "kmeans", false, 5);
    expect(a.palette).toEqual(b.palette);
    expect([...a.image.data]).toEqual([...b.image.data]);
  });

  it("keeps alpha and honors the color count", () => {
    const input = image();
    input.data[3] = 90;
    const result = reducePalette(input, 2, "median-cut", false);
    expect(result.palette.length).toBeLessThanOrEqual(2);
    expect(result.image.data[3]).toBe(90);
  });
});
