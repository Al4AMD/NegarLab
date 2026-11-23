import { describe, expect, it } from "vitest";
import { planesToRgba, rgbaToPlanes } from "../src/channels";
import { channelHistogram, histogramCdf, lumaHistogram } from "../src/histogram";
import type { Plane, RgbaImage } from "../src/types";

const image: RgbaImage = {
  width: 2,
  height: 1,
  data: Uint8ClampedArray.from([0, 0, 0, 128, 255, 255, 255, 255]),
};

describe("channels", () => {
  it("splits normalized channels and reconstructs opaque rgba", () => {
    const planes = rgbaToPlanes(image);
    expect(planes.r.data[0]).toBe(0);
    expect(planes.r.data[1]).toBe(1);
    expect(planes.g.data[1]).toBe(1);
    const restored = planesToRgba(planes);
    expect(Array.from(restored.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});

describe("histograms", () => {
  it("counts half-black half-white pixels in the end bins", () => {
    const plane: Plane = { width: 2, height: 1, data: Float32Array.from([0, 1]) };
    const hist = channelHistogram(plane);
    expect(hist[0]).toBe(1);
    expect(hist[255]).toBe(1);
    expect(hist.reduce((sum, value) => sum + value, 0)).toBe(2);
    expect(histogramCdf(hist)[255]).toBe(1);
  });

  it("computes luma histogram from rgba", () => {
    const hist = lumaHistogram(image);
    expect(hist[0]).toBe(1);
    expect(hist[255]).toBe(1);
  });
});
