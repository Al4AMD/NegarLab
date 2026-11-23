import { describe, expect, it } from "vitest";
import { rgbaToLuma } from "../src/luma";
import { rgbaImage } from "./helpers";

describe("rgbaToLuma", () => {
  it("applies BT.601 weights to primary colors", () => {
    const image = rgbaImage(3, 1, [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
    const plane = rgbaToLuma(image);
    expect(plane.width).toBe(3);
    expect(plane.height).toBe(1);
    expect(plane.data[0]).toBeCloseTo(0.299, 6);
    expect(plane.data[1]).toBeCloseTo(0.587, 6);
    expect(plane.data[2]).toBeCloseTo(0.114, 6);
  });

  it("ignores alpha and maps white to one", () => {
    const image = rgbaImage(2, 1, [255, 255, 255, 0, 0, 0, 0, 255]);
    const plane = rgbaToLuma(image);
    expect(plane.data[0]).toBeCloseTo(1, 6);
    expect(plane.data[1]).toBeCloseTo(0, 6);
  });
});
