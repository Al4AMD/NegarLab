import { describe, expect, it } from "vitest";
import { applyMorphology, structuringElement } from "../src/morphology";
import type { RgbaImage } from "../src/types";

function flat(width: number, height: number, value: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.set([value, value, value, 255], i * 4);
  }
  return { width, height, data };
}

describe("morphology", () => {
  it("erodes a bright pixel with a cross", () => {
    const input = flat(3, 3, 0);
    input.data.set([255, 255, 255, 255], 4 * 4);
    const se = structuringElement(3, "cross");
    const out = applyMorphology(input, "erode", se);
    expect(out.data[4 * 4]).toBe(0);
  });

  it("dilates with a rectangle", () => {
    const input = flat(3, 3, 0);
    input.data.set([255, 255, 255, 255], 4 * 4);
    const out = applyMorphology(input, "dilate", structuringElement(3, "rect"));
    expect(out.data[0]).toBe(255);
    expect(out.data[8 * 4]).toBe(255);
  });

  it("makes a binary image", () => {
    const input = flat(2, 1, 200);
    const out = applyMorphology(input, "erode", structuringElement(3, "rect"), 128);
    expect([...out.data.slice(0, 4)]).toEqual([255, 255, 255, 255]);
  });

  it("builds ellipse and cross masks", () => {
    const ellipse = structuringElement(5, "ellipse");
    expect(ellipse.mask[0]).toBe(0);
    expect(ellipse.mask[12]).toBe(1);
    const cross = structuringElement(3, "cross");
    expect(cross.mask.filter((value) => value === 1)).toHaveLength(5);
  });

  it("computes gradient and top-hat", () => {
    const input = flat(5, 5, 0);
    input.data.set([255, 255, 255, 255], 12 * 4);
    const se = structuringElement(3, "cross");
    expect(applyMorphology(input, "gradient", se).data[12 * 4]).toBe(255);
    expect(applyMorphology(input, "tophat", se).data[12 * 4]).toBe(255);
  });
});
