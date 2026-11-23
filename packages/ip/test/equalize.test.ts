import { describe, expect, it } from "vitest";
import { contrastStretch, equalize } from "../src/equalize";
import { otsuThreshold, threshold } from "../src/threshold";
import type { Plane, RgbaImage } from "../src/types";

function gray(values: number[]): RgbaImage {
  const data = new Uint8ClampedArray(values.length * 4);
  values.forEach((value, index) => {
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  });
  return { width: values.length, height: 1, data };
}

describe("contrast stretch", () => {
  it("stretches quantile range to full scale", () => {
    const result = contrastStretch(gray([51, 102, 153, 204]), 0.25, 0.75);
    expect(Array.from(result.data)).toEqual([0, 128, 255, 255].flatMap((v) => [v, v, v, 255]));
  });

  it("returns a copy for a zero-range image", () => {
    const source = gray([90, 90, 90]);
    const result = contrastStretch(source, 0.1, 0.9);
    expect(result.data[0]).toBe(90);
    expect(result).not.toBe(source);
  });
});

describe("equalization", () => {
  it("leaves a uniform image unchanged", () => {
    const source = gray([90, 90, 90, 90]);
    expect(Array.from(equalize(source).data)).toEqual(Array.from(source.data));
  });
});

describe("otsu and threshold", () => {
  it("returns zero for a constant plane", () => {
    const plane: Plane = { width: 2, height: 1, data: Float32Array.from([0.4, 0.4]) };
    expect(otsuThreshold(plane)).toBe(0);
  });

  it("binarizes to only 0 and 255", () => {
    const result = threshold(gray([0, 255, 0, 255]), 0.5);
    const values = Array.from(result.data).filter((_, index) => index % 4 === 0);
    expect(values).toEqual([0, 255, 0, 255]);
  });
});
