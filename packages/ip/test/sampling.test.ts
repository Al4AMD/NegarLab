import { describe, expect, it } from "vitest";
import { matchHistogram, quantizeBits, resizeNearest } from "../src/sampling";
import type { RgbaImage } from "../src/types";

function rgb(width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const value = (i * 37) % 256;
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe("quantization", () => {
  it("8 bits is identity and 1 bit yields endpoints", () => {
    const image = rgb(8, 1);
    expect(Array.from(quantizeBits(image, 8).data)).toEqual(Array.from(image.data));
    const oneBit = quantizeBits(image, 1);
    for (let i = 0; i < oneBit.data.length; i += 4) {
      expect([0, 255]).toContain(oneBit.data[i]);
    }
  });
});

describe("nearest resizing", () => {
  it("halves dimensions taking even samples", () => {
    const image = rgb(8, 8);
    const half = resizeNearest(image, 4, 4);
    expect(half.width).toBe(4);
    expect(half.data[0]).toBe(image.data[0]);
    expect(half.data[4]).toBe(image.data[(0 * 8 + 2) * 4]);
  });

  it("rejects invalid dimensions", () => {
    expect(() => resizeNearest(rgb(2, 2), 0, 4)).toThrow(RangeError);
    expect(() => resizeNearest(rgb(2, 2), 2.5, 4)).toThrow(RangeError);
  });
});

describe("histogram matching", () => {
  it("returns the image unchanged when the reference matches", () => {
    const source = rgb(8, 8);
    const matched = matchHistogram(source, source);
    expect(Array.from(matched.data)).toEqual(Array.from(source.data));
  });
});
