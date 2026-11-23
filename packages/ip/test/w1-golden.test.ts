import { describe, expect, it } from "vitest";
import { planesToRgba, rgbaToPlanes } from "../src/channels";
import { contrastStretch, equalize } from "../src/equalize";
import { channelHistogram, lumaHistogram } from "../src/histogram";
import { rgbaToLuma } from "../src/luma";
import { gammaCorrect, logTransform, negative } from "../src/pointOps";
import { matchHistogram, quantizeBits, resizeNearest } from "../src/sampling";
import { otsuThreshold, threshold } from "../src/threshold";
import type { RgbaImage } from "../src/types";
import fixture from "../test-data/golden/w1-fundamentals.json";

function decode(width: number, height: number, rgba: number[]): RgbaImage {
  return { width, height, data: Uint8ClampedArray.from(rgba) };
}

const input = decode(fixture.input.width, fixture.input.height, fixture.input.rgba);
const reference = decode(fixture.reference.width, fixture.reference.height, fixture.reference.rgba);

describe("W1 golden vectors", () => {
  it("matches channel planes and histograms", () => {
    const planes = rgbaToPlanes(input);
    for (const key of ["r", "g", "b"] as const) {
      const expected = fixture.expected.channels[key];
      planes[key].data.forEach((value, index) => {
        expect(value).toBeCloseTo(expected[index] ?? 0, 6);
      });
      const hist = channelHistogram(planes[key]);
      expect(Array.from(hist)).toEqual(fixture.expected.histograms[key]);
    }
    const luma = lumaHistogram(input);
    expect(Array.from(luma)).toEqual(fixture.expected.lumaHistogram);
  });

  it("matches point transforms", () => {
    expect(Array.from(negative(input).data)).toEqual(fixture.expected.negative);
    expect(Array.from(logTransform(input).data)).toEqual(fixture.expected.log);
    expect(Array.from(gammaCorrect(input, fixture.expected.gamma.gamma).data)).toEqual(
      fixture.expected.gamma.rgba,
    );
    expect(Array.from(equalize(input).data)).toEqual(fixture.expected.equalize);
    expect(
      Array.from(
        contrastStretch(input, fixture.expected.stretch.low, fixture.expected.stretch.high).data,
      ),
    ).toEqual(fixture.expected.stretch.rgba);
  });

  it("matches sampling, matching, and thresholding", () => {
    expect(Array.from(quantizeBits(input, fixture.expected.quantize.bits).data)).toEqual(
      fixture.expected.quantize.rgba,
    );
    expect(
      Array.from(
        resizeNearest(input, fixture.expected.downsample.width, fixture.expected.downsample.height)
          .data,
      ),
    ).toEqual(fixture.expected.downsample.rgba);
    expect(Array.from(matchHistogram(input, reference).data)).toEqual(fixture.expected.match);
    expect(otsuThreshold(rgbaToLuma(input))).toBeCloseTo(fixture.expected.otsu, 6);
    expect(Array.from(threshold(input, fixture.expected.otsu).data)).toEqual(
      fixture.expected.threshold,
    );
  });
});
