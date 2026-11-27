import { describe, expect, it } from "vitest";
import {
  balanceWhite,
  colorSpaceView,
  simulateColorBlindness,
  subsampleChroma,
} from "../src/color";
import { transformImage, multiscaleBlend, gaussianPyramid } from "../src/geometry";
import { halftone, reducePalette } from "../src/halftone";
import { applyMorphology, structuringElement } from "../src/morphology";
import { addNoise, wienerDenoise } from "../src/noise";
import type { RgbaImage } from "../src/types";
import fixture from "../test-data/golden/w4-color-noise-morphology-geometry-halftone.json";

const input: RgbaImage = {
  width: fixture.input.width,
  height: fixture.input.height,
  data: Uint8ClampedArray.from(fixture.input.rgba),
};

const base = {
  scaleX: 1,
  scaleY: 1,
  rotate: 30,
  translateX: 0,
  translateY: 0,
  shearX: 0,
  shearY: 0,
  perspectiveX: 0,
  perspectiveY: 0,
  interpolation: "bilinear" as const,
};

function rgba(values: ArrayLike<number>): number[] {
  return Array.from(values);
}

describe("W4 golden vectors", () => {
  it("matches color views and corrections", () => {
    expect(rgba(colorSpaceView(input, "lab", 1).data)).toEqual(fixture.expected.color.labA);
    expect(rgba(colorSpaceView(input, "hsv", 2).data)).toEqual(
      fixture.expected.color.hsvChannel,
    );
    expect(rgba(subsampleChroma(input, "4:2:0").data)).toEqual(
      fixture.expected.color.subsampled,
    );
    expect(rgba(simulateColorBlindness(input, "deuteranopia", 1).data)).toEqual(
      fixture.expected.color.colorblind,
    );
    expect(rgba(balanceWhite(input, "gray-world").data)).toEqual(
      fixture.expected.color.whiteBalance,
    );
  });

  it("matches morphology", () => {
    const cross = structuringElement(3, "cross");
    expect(rgba(applyMorphology(input, "erode", cross).data)).toEqual(
      fixture.expected.morphology.eroded,
    );
    expect(rgba(applyMorphology(input, "dilate", cross).data)).toEqual(
      fixture.expected.morphology.dilated,
    );
    expect(rgba(applyMorphology(input, "open", cross).data)).toEqual(
      fixture.expected.morphology.opened,
    );
  });

  it("matches geometry and pyramids", () => {
    expect(rgba(transformImage(input, base).data)).toEqual(fixture.expected.geometry.rotated);
    expect(gaussianPyramid(input, 3).map((level) => level.width)).toEqual(
      fixture.expected.geometry.pyramidWidths,
    );
    expect(rgba(multiscaleBlend(input, input, 3, 0.5).data)).toEqual(
      fixture.expected.geometry.blended,
    );
  });

  it("matches noise and local restoration", () => {
    expect(rgba(addNoise(input, { kind: "gaussian", amount: 0.1, seed: 7 }).data)).toEqual(
      fixture.expected.noise.gaussian,
    );
    expect(rgba(addNoise(input, { kind: "salt-pepper", amount: 0.1, seed: 3 }).data)).toEqual(
      fixture.expected.noise.saltPepper,
    );
    expect(rgba(addNoise(input, { kind: "speckle", amount: 0.05, seed: 5 }).data)).toEqual(
      fixture.expected.noise.speckle,
    );
    expect(rgba(addNoise(input, { kind: "poisson", amount: 0.2, seed: 11 }).data)).toEqual(
      fixture.expected.noise.poisson,
    );
    expect(rgba(wienerDenoise(input, 0.02).data)).toEqual(fixture.expected.noise.wiener);
  });

  it("matches halftone and palettes", () => {
    expect(rgba(halftone(input, "floyd-steinberg").data)).toEqual(
      fixture.expected.halftone.floyd,
    );
    expect(rgba(halftone(input, "bayer", 4).data)).toEqual(fixture.expected.halftone.bayer);
    expect(rgba(reducePalette(input, 4, "median-cut", false, 1).image.data)).toEqual(
      fixture.expected.halftone.medianCut,
    );
    expect(rgba(reducePalette(input, 4, "kmeans", false, 1).image.data)).toEqual(
      fixture.expected.halftone.kmeans,
    );
  });
});
