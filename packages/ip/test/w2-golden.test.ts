import { describe, expect, it } from "vitest";
import { fft2, fftMagnitude } from "../src/fft";
import { convolve, gaussianKernel, meanKernel, medianFilter, sobelMagnitude } from "../src/filters";
import { applyFrequencyFilter } from "../src/frequencyFilters";
import { rgbaToLuma } from "../src/luma";
import type { RgbaImage } from "../src/types";
import fixture from "../test-data/golden/w2-spatial-frequency.json";

const input: RgbaImage = {
  width: fixture.input.width,
  height: fixture.input.height,
  data: Uint8ClampedArray.from(fixture.input.rgba),
};

describe("W2 golden vectors", () => {
  it("matches mean, Gaussian, and median filters", () => {
    expect(Array.from(convolve(input, meanKernel(3)).data)).toEqual(fixture.expected.mean);
    expect(Array.from(convolve(input, gaussianKernel(5, 1)).data)).toEqual(
      fixture.expected.gaussian,
    );
    expect(Array.from(medianFilter(input, 1).data)).toEqual(fixture.expected.median);
  });

  it("matches Sobel magnitude", () => {
    expect(Array.from(sobelMagnitude(input).data)).toEqual(fixture.expected.sobel);
  });

  it("matches FFT magnitude", () => {
    const magnitude = fftMagnitude(fft2(rgbaToLuma(input)));
    magnitude.data.forEach((value, index) => {
      expect(value).toBeCloseTo(fixture.expected.fftMagnitude[index] ?? 0, 6);
    });
  });

  it("matches the Gaussian lowpass filter", () => {
    const filtered = applyFrequencyFilter(input, {
      kind: "low",
      family: "gaussian",
      cutoff: 0.35,
    });
    expect(Array.from(filtered.data)).toEqual(fixture.expected.lowpass);
  });
});
