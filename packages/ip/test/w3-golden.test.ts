import { describe, expect, it } from "vitest";
import { dct8, jpegQuantTable } from "../src/dct";
import { jpegReconstruct } from "../src/jpeg";
import { dpcmResiduals, lumaBytes, pngAdaptiveFilter, pngFilter } from "../src/lossless";
import { compareMetrics, ssim } from "../src/metrics";
import type { RgbaImage } from "../src/types";
import fixture from "../test-data/golden/w3-compression-metrics.json";

const input: RgbaImage = {
  width: fixture.input.width,
  height: fixture.input.height,
  data: Uint8ClampedArray.from(fixture.input.rgba),
};

const odd: RgbaImage = {
  width: fixture.input.oddWidth,
  height: fixture.input.oddHeight,
  data: Uint8ClampedArray.from(fixture.input.oddRgba),
};

function rgbaOf(values: number[], width: number, height: number): RgbaImage {
  return { width, height, data: Uint8ClampedArray.from(values) };
}

describe("W3 golden vectors", () => {
  it("matches luma bytes and DCT coefficients", () => {
    const luma = lumaBytes(input);
    expect(Array.from(luma)).toEqual(fixture.expected.luma);
    const shifted = new Float64Array(64);
    for (let i = 0; i < 64; i += 1) shifted[i] = (luma[i] ?? 0) - 128;
    const coefficients = dct8(shifted);
    coefficients.forEach((value, index) => {
      expect(value).toBeCloseTo(fixture.expected.dct[index] ?? 0, 6);
    });
  });

  it("matches JPEG quantization tables", () => {
    const tables = jpegQuantTable(50);
    expect(Array.from(tables.luma)).toEqual(fixture.expected.quantLuma50);
    expect(Array.from(tables.chroma)).toEqual(fixture.expected.quantChroma50);
  });

  it("matches JPEG reconstruction at quality 50 and 90", () => {
    expect(Array.from(jpegReconstruct(input, 50).image.data)).toEqual(fixture.expected.jpeg50);
    expect(Array.from(jpegReconstruct(input, 90).image.data)).toEqual(fixture.expected.jpeg90);
  });

  it("matches JPEG reconstruction for an odd size", () => {
    expect(Array.from(jpegReconstruct(odd, 50).image.data)).toEqual(fixture.expected.jpegOdd);
  });

  it("matches quality metrics and the SSIM map", () => {
    const decoded = rgbaOf(fixture.expected.jpeg50, input.width, input.height);
    const metrics = compareMetrics(input, decoded);
    expect(metrics.mse).toBeCloseTo(fixture.expected.metrics.mse, 6);
    expect(metrics.psnr).toBeCloseTo(fixture.expected.metrics.psnr, 6);
    expect(metrics.ssim).toBeCloseTo(fixture.expected.metrics.ssim, 6);
    expect(metrics.msSsim).toBeCloseTo(fixture.expected.metrics.msSsim, 6);
    const map = ssim(input, decoded).map;
    map.forEach((value, index) => {
      expect(value).toBeCloseTo(fixture.expected.metrics.ssimMap[index] ?? 0, 6);
    });
  });

  it("matches PNG filters, adaptive choice, and DPCM", () => {
    const luma = lumaBytes(input);
    for (const filter of ["none", "sub", "up", "average", "paeth"] as const) {
      expect(Array.from(pngFilter(luma, input.width, input.height, filter))).toEqual(
        fixture.expected.png[filter],
      );
    }
    const adaptive = pngAdaptiveFilter(luma, input.width, input.height);
    expect(Array.from(adaptive.filtered)).toEqual(fixture.expected.png.adaptive);
    expect(adaptive.filters).toEqual(fixture.expected.png.filters);
    expect(Array.from(dpcmResiduals(luma, input.width, input.height))).toEqual(
      fixture.expected.dpcm,
    );
  });
});
