import { describe, expect, it } from "vitest";
import { clahe } from "../src/clahe";
import type { RgbaImage } from "../src/types";

function gray(width: number, height: number, value: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe("clahe", () => {
  it("keeps a uniform image flat", () => {
    const source = gray(16, 16, 90);
    const result = clahe(source, { tiles: 4, clipLimit: 2 });
    const values = new Set<number>();
    for (let i = 0; i < result.data.length; i += 4) values.add(result.data[i] ?? 0);
    expect(values.size).toBe(1);
  });

  it("preserves alpha and rejects invalid options", () => {
    const source = gray(8, 8, 120);
    expect(clahe(source).data[3]).toBe(255);
    expect(() => clahe(source, { tiles: 0 })).toThrow(RangeError);
    expect(() => clahe(source, { clipLimit: 0 })).toThrow(RangeError);
  });
});
