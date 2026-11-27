import { describe, expect, it } from "vitest";
import {
  gaussianPyramid,
  laplacianPyramid,
  multiscaleBlend,
  pyramidContactSheet,
  transformImage,
} from "../src/geometry";
import type { RgbaImage } from "../src/types";

function image(width = 8, height = 8): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255], i * 4);
  }
  return { width, height, data };
}

const base = {
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  translateX: 0,
  translateY: 0,
  shearX: 0,
  shearY: 0,
  perspectiveX: 0,
  perspectiveY: 0,
  interpolation: "bilinear" as const,
};

describe("geometry", () => {
  it("keeps identity transforms stable", () => {
    const input = image();
    const out = transformImage(input, base);
    expect(out.width).toBe(8);
    expect([...out.data.slice(0, 4)]).toEqual([...input.data.slice(0, 4)]);
  });

  it("rotates and changes interpolation", () => {
    const input = image();
    const out = transformImage(input, { ...base, rotate: 45, interpolation: "nearest" });
    expect(out.width).toBe(8);
    expect(out.data[3]).toBe(0);
  });

  it("supports all interpolation kernels", () => {
    for (const interpolation of ["nearest", "bilinear", "bicubic", "lanczos"] as const) {
      const out = transformImage(image(), { ...base, rotate: 20, interpolation });
      expect(out.width).toBe(8);
      expect(out.data.length).toBe(8 * 8 * 4);
    }
  });

  it("builds pyramids and a contact sheet", () => {
    const levels = gaussianPyramid(image(), 3);
    expect(levels.map((level) => level.width)).toEqual([8, 4, 2]);
    const laplacian = laplacianPyramid(image(), 3);
    expect(laplacian).toHaveLength(3);
    const sheet = pyramidContactSheet(levels);
    expect(sheet.width).toBeGreaterThanOrEqual(8);
  });

  it("blends two pyramids", () => {
    const out = multiscaleBlend(image(), image(), 3, 0.5);
    expect(out.width).toBe(8);
  });
});
