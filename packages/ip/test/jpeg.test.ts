import { describe, expect, it } from "vitest";
import { jpegBlock, jpegReconstruct } from "../src/jpeg";
import { psnr } from "../src/metrics";
import type { RgbaImage } from "../src/types";

function gradient(width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = Math.round((x / Math.max(1, width - 1)) * 255);
      data[i + 1] = Math.round((y / Math.max(1, height - 1)) * 255);
      data[i + 2] = ((x + y) * 13) % 256;
      data[i + 3] = x === 0 && y === 0 ? 128 : 255;
    }
  }
  return { width, height, data };
}

describe("jpegReconstruct", () => {
  it("keeps dimensions and alpha on odd sizes", () => {
    const source = gradient(9, 7);
    const result = jpegReconstruct(source, 50);
    expect(result.image.width).toBe(9);
    expect(result.image.height).toBe(7);
    expect(result.image.data[3]).toBe(128);
    expect(result.image.data[(6 * 9 + 8) * 4 + 3]).toBe(255);
  });

  it("reconstructs a smooth image with high PSNR at quality 100", () => {
    const source = gradient(32, 32);
    const result = jpegReconstruct(source, 100);
    expect(psnr(source, result.image)).toBeGreaterThan(35);
  });

  it("uses fewer bytes at low quality", () => {
    const source = gradient(64, 64);
    const low = jpegReconstruct(source, 10);
    const high = jpegReconstruct(source, 90);
    expect(low.encodedBytes).toBeLessThan(high.encodedBytes);
    expect(low.ratio).toBeGreaterThan(high.ratio);
    expect(low.bpp).toBeGreaterThan(0);
  });

  it("decodes at the quality extremes without zero coefficients", () => {
    const source = gradient(16, 16);
    for (const quality of [1, 100]) {
      const result = jpegReconstruct(source, quality);
      expect(result.image.width).toBe(16);
      expect(result.encodedBytes).toBeGreaterThan(0);
      for (const value of result.image.data) expect(Number.isFinite(value)).toBe(true);
    }
    const stages = jpegBlock(source, 0, 0, 100, "y");
    expect(stages.quantized.some((value) => value !== 0)).toBe(true);
  });

  it("keeps a constant image nearly constant", () => {
    const width = 16;
    const height = 16;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      data[i * 4] = 120;
      data[i * 4 + 1] = 120;
      data[i * 4 + 2] = 120;
      data[i * 4 + 3] = 255;
    }
    const result = jpegReconstruct({ width, height, data }, 50);
    for (let i = 0; i < width * height; i += 1) {
      expect(result.image.data[i * 4]).toBeGreaterThanOrEqual(119);
      expect(result.image.data[i * 4]).toBeLessThanOrEqual(121);
    }
  });
});

describe("jpegBlock", () => {
  it("returns every pipeline stage", () => {
    const source = gradient(32, 16);
    const stages = jpegBlock(source, 1, 0, 50, "y");
    expect(stages.source).toHaveLength(64);
    expect(stages.levelShifted).toHaveLength(64);
    expect(stages.dct).toHaveLength(64);
    expect(stages.quantized).toHaveLength(64);
    expect(stages.zigzag).toHaveLength(64);
    expect(stages.reconstructed).toHaveLength(64);
    expect(stages.blockX).toBe(1);
    expect(stages.blockY).toBe(0);
    expect(stages.dcDiff).toBeTypeOf("number");
    expect(stages.rle.length).toBeGreaterThan(0);
  });

  it("clamps block coordinates to the grid", () => {
    const stages = jpegBlock(gradient(8, 8), 99, -3, 50, "cb");
    expect(stages.blockX).toBe(0);
    expect(stages.blockY).toBe(0);
    expect(stages.channel).toBe("cb");
  });
});
