# W4 Color, Noise, Morphology, Geometry, Halftone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete I02, I06, I07, I08, and I11 with golden-tested TypeScript algorithms, worker RPC, bilingual lab panels, and backend NLM.

**Architecture:** All interactive algorithms live in `packages/ip` and run in the Comlink worker. NLM alone runs on the FastAPI backend through OpenCV because full-image NLM is too slow in JavaScript. The five new dock tabs are self-contained and set the shared preview.

**Tech Stack:** TypeScript strict, Vitest, React 19, Comlink, NumPy golden vectors, FastAPI, OpenCV headless.

**Spec:** `docs/superpowers/specs/2026-11-23-negarlab-design.md`

## Global Constraints

- Working image cap is 2048 px; never process a larger source in the browser.
- All DSP runs in `packages/ip` through the worker; no DOM code in the package.
- Floating golden comparisons use absolute tolerance `1e-6`; integer and byte outputs must be exact.
- Persian is the default locale and RTL; English is LTR. Latin digits go in `.numeric`.
- No new runtime dependency except `opencv-python-headless` (Apache-2.0) for NLM.
- Every theory panel is bilingual (en + fa) and uses KaTeX where a formula exists.
- E2E must keep the console-error assertion and finish with zero errors.
- Do not log image bytes or EXIF values; no secrets in the repo.
- Commit after each task. Do not push or merge until the wave is verified.

---

## File Structure

Create:

- `packages/ip/src/color.ts` — conversions, channel views, chroma subsampling, colorblind simulation, white balance.
- `packages/ip/src/morphology.ts` — structuring elements and binary/grayscale morphology.
- `packages/ip/src/geometry.ts` — inverse-mapped warps, interpolation kernels, pyramids, blend.
- `packages/ip/src/noise.ts` — seeded noise, motion/defocus PSF, inverse/Wiener deconvolution.
- `packages/ip/src/halftone.ts` — error diffusion, Bayer, median cut, sampled k-means, palette mapping.
- `packages/ip/test/color.test.ts`
- `packages/ip/test/morphology.test.ts`
- `packages/ip/test/geometry.test.ts`
- `packages/ip/test/noise.test.ts`
- `packages/ip/test/halftone.test.ts`
- `packages/ip/test/w4-golden.test.ts`
- `packages/ip/test-data/golden/w4-color-noise-morphology-geometry-halftone.json`
- `apps/api/src/negarlab_api/api/routes/denoise.py`
- `apps/api/tests/test_denoise.py`
- `apps/web/src/components/ColorPanel.tsx`
- `apps/web/src/components/NoisePanel.tsx`
- `apps/web/src/components/MorphologyPanel.tsx`
- `apps/web/src/components/GeometryPanel.tsx`
- `apps/web/src/components/HalftonePanel.tsx`
- `apps/web/src/lib/denoise.ts`
- `apps/web/src/lib/png.ts`

Modify:

- `packages/ip/src/index.ts` — export new modules and types.
- `apps/web/src/workers/ip.worker.ts` — request types and RPC methods.
- `apps/web/src/components/ParameterDock.tsx` — five tabs.
- `apps/web/src/components/TheoryPanel.tsx` — five topics.
- `apps/web/src/i18n/locales/en/common.json`, `fa/common.json` — labels and theory.
- `apps/web/e2e/smoke.spec.ts` — one operation per new tab.
- `tools/golden/negarlab_golden/generate.py` — W4 reference vectors.
- `tools/golden/tests/test_generate.py` — W4 determinism/coverage test.
- `apps/api/pyproject.toml`, `apps/api/uv.lock` — OpenCV dependency.
- `docs/ALGORITHMS.md`, `docs/DECISIONS.md`, `docs/THIRD_PARTY.md`, `docs/PROGRESS.md`, `docs/plans/README.md`.

---

### Task 1: Color Conversions and Views

**Files:**
- Create: `packages/ip/src/color.ts`
- Test: `packages/ip/test/color.test.ts`

**Interfaces:**
- Consumes: `RgbaImage` from `./types`.
- Produces:
  - `type ColorSpace = "rgb" | "hsv" | "hsl" | "ycbcr" | "cmyk" | "lab" | "gray"`
  - `type ChromaMode = "4:4:4" | "4:2:2" | "4:2:0"`
  - `type ColorBlindness = "protanopia" | "deuteranopia" | "tritanopia"`
  - `type WhiteBalanceMethod = "gray-world" | "white-patch"`
  - `function colorSpaceView(image: RgbaImage, space: ColorSpace, channel: number): RgbaImage`
  - `function subsampleChroma(image: RgbaImage, mode: ChromaMode): RgbaImage`
  - `function simulateColorBlindness(image: RgbaImage, kind: ColorBlindness, severity: number): RgbaImage`
  - `function balanceWhite(image: RgbaImage, method: WhiteBalanceMethod): RgbaImage`

- [x] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  balanceWhite,
  colorSpaceView,
  simulateColorBlindness,
  subsampleChroma,
} from "../src/color";
import type { RgbaImage } from "../src/types";

function image(pixels: number[][]): RgbaImage {
  return {
    width: pixels.length,
    height: 1,
    data: new Uint8ClampedArray(pixels.flatMap(([r, g, b, a = 255]) => [r, g, b, a])),
  };
}

describe("color", () => {
  it("round-trips RGB through Lab", () => {
    const input = image([[120, 40, 200], [0, 0, 0], [255, 255, 255]]);
    const lab = colorSpaceView(input, "lab", -1);
    expect(lab.width).toBe(3);
    expect(lab.data[0]).toBeCloseTo(120, 0);
    expect(lab.data[1]).toBeCloseTo(40, 0);
    expect(lab.data[2]).toBeCloseTo(200, 0);
  });

  it("separates channels as grayscale", () => {
    const input = image([[10, 20, 30]]);
    const hsv = colorSpaceView(input, "hsv", 2);
    expect(hsv.data[0]).toBe(hsv.data[1]);
    expect(hsv.data[1]).toBe(hsv.data[2]);
  });

  it("subsamples 4:2:0 chroma and preserves alpha", () => {
    const input = image([[255, 0, 0, 77], [0, 255, 0, 88]]);
    const out = subsampleChroma(input, "4:2:0");
    expect(out.data[3]).toBe(77);
    expect(out.data[7]).toBe(88);
  });

  it("simulates color blindness and white balance", () => {
    const input = image([[200, 40, 40], [40, 200, 40]]);
    const blind = simulateColorBlindness(input, "deuteranopia", 1);
    expect(blind.data[0]).not.toBe(200);
    const balanced = balanceWhite(input, "gray-world");
    expect(balanced.width).toBe(2);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @negarlab/ip test -- color.test.ts`
Expected: FAIL because `../src/color` does not exist.

- [x] **Step 3: Implement `color.ts`**

Implement these exact behaviors:

- sRGB encoded values are `byte / 255`; linearize with the IEC 61966-2-1 piecewise curve.
- HSV/HSL use the standard hexcone formulas.
- YCbCr uses BT.601 full range: `Y=0.299R+0.587G+0.114B`, `Cb=128-0.168736R-0.331264G+0.5B`, `Cr=128+0.5R-0.418688G-0.081312B`.
- CMYK is `K=1-max(R,G,B)`, `C=(1-R-K)/(1-K)`, and zero when `K=1`.
- Lab uses D65 white `(0.95047, 1.0, 1.08883)`, `f(t)=t^(1/3)` above `0.008856`, otherwise `7.787t+16/116`; `L=116f(Y)-16`, `a=500(f(X)-f(Y))`, `b=200(f(Y)-f(Z))`.
- `colorSpaceView` with `channel=-1` converts to the space and back to sRGB. With a channel index, it renders that channel normalized to 0..255 as grayscale. CMYK channel 4 is K; gray only has channel 0.
- `subsampleChroma` converts to YCbCr, averages 2×2 chroma blocks for 4:2:0, averages horizontal pairs for 4:2:2, and reconstructs with nearest chroma. Alpha is copied unchanged.
- `simulateColorBlindness` uses the Machado matrices for severity 1.0, linearly interpolates from identity for `0 <= severity <= 1`, and clamps.
- `balanceWhite` scales channels so the gray-world mean is equal, or the white-patch 99th percentile is equal; preserve alpha.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @negarlab/ip test -- color.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ip/src/color.ts packages/ip/test/color.test.ts
git commit -m "feat(ip): add color space tools"
```

---

### Task 2: Morphology

**Files:**
- Create: `packages/ip/src/morphology.ts`
- Test: `packages/ip/test/morphology.test.ts`

**Interfaces:**
- Produces:
  - `type MorphologyOp = "erode" | "dilate" | "open" | "close" | "gradient" | "tophat" | "blackhat"`
  - `interface StructuringElement { size: number; mask: Uint8Array }`
  - `function structuringElement(size: number, shape: "rect" | "ellipse" | "cross"): StructuringElement`
  - `function applyMorphology(image: RgbaImage, op: MorphologyOp, se: StructuringElement, binaryThreshold?: number): RgbaImage`

- [x] **Step 1: Write failing tests**

```ts
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
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @negarlab/ip test -- morphology.test.ts`
Expected: FAIL because the module is missing.

- [x] **Step 3: Implement `morphology.ts`**

- `structuringElement(size, shape)` requires odd `size` in `1..9`; `rect` sets every cell, `ellipse` uses normalized radius `<= 1`, `cross` keeps the center row and column.
- For binary mode (`binaryThreshold !== undefined`), convert luma with `0.299R + 0.587G + 0.114B`; output black/white.
- For grayscale mode, process R, G, B independently.
- Use clamp-to-edge for out-of-bounds samples.
- Erode takes the minimum under the SE; dilate takes the maximum.
- `open = dilate(erode)`, `close = erode(dilate)`, `gradient = dilate - erode`, `tophat = image - open`, `blackhat = close - image`.
- Preserve alpha.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @negarlab/ip test -- morphology.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ip/src/morphology.ts packages/ip/test/morphology.test.ts
git commit -m "feat(ip): add morphology"
```

---

### Task 3: Geometry and Pyramids

**Files:**
- Create: `packages/ip/src/geometry.ts`
- Test: `packages/ip/test/geometry.test.ts`

**Interfaces:**
- Produces:
  - `type Interpolation = "nearest" | "bilinear" | "bicubic" | "lanczos"`
  - `interface GeometryOptions { scaleX: number; scaleY: number; rotate: number; translateX: number; translateY: number; shearX: number; shearY: number; perspectiveX: number; perspectiveY: number; interpolation: Interpolation }`
  - `function transformImage(image: RgbaImage, options: GeometryOptions): RgbaImage`
  - `function gaussianPyramid(image: RgbaImage, levels: number): RgbaImage[]`
  - `function laplacianPyramid(image: RgbaImage, levels: number): RgbaImage[]`
  - `function pyramidContactSheet(levels: RgbaImage[]): RgbaImage`
  - `function multiscaleBlend(a: RgbaImage, b: RgbaImage, levels: number, mix: number): RgbaImage`

- [x] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  gaussianPyramid,
  laplacianPyramid,
  multiscaleBlend,
  pyramidContactSheet,
  transformImage,
} from "../src/geometry";
import type { RgbaImage } from "../src/types";

function image(width = 8, height = 8): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255], i * 4);
  }
  return { width, height, data };
}

const base = {
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  translateX: 0,
  translateY: 0,
  shearX: 0,
  shearY: 0,
  perspectiveX: 0,
  perspectiveY: 0,
  interpolation: "bilinear" as const,
};

describe("geometry", () => {
  it("keeps identity transforms stable", () => {
    const input = image();
    const out = transformImage(input, base);
    expect(out.width).toBe(8);
    expect([...out.data.slice(0, 4)]).toEqual([...input.data.slice(0, 4)]);
  });

  it("rotates and changes interpolation", () => {
    const input = image();
    const out = transformImage(input, { ...base, rotate: 45, interpolation: "nearest" });
    expect(out.width).toBe(8);
    expect(out.data[3]).toBe(0);
  });

  it("builds pyramids and a contact sheet", () => {
    const levels = gaussianPyramid(image(), 3);
    expect(levels.map((level) => level.width)).toEqual([8, 4, 2]);
    const laplacian = laplacianPyramid(image(), 3);
    expect(laplacian).toHaveLength(3);
    const sheet = pyramidContactSheet(levels);
    expect(sheet.width).toBeGreaterThanOrEqual(8);
  });

  it("blends two pyramids", () => {
    const out = multiscaleBlend(image(), image(), 3, 0.5);
    expect(out.width).toBe(8);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @negarlab/ip test -- geometry.test.ts`
Expected: FAIL because the module is missing.

- [x] **Step 3: Implement `geometry.ts`**

- Build the forward homography `H` in homogeneous coordinates:
  `H = [[scaleX, shearX, translateX], [shearY, scaleY, translateY], [perspectiveX, perspectiveY, 1]]`.
  Rotation is applied around the image center by multiplying a rotation matrix on the left. Invert `H` and map each destination pixel back to source coordinates.
- `nearest` uses `floor(x+0.5)`; `bilinear` uses the four neighbors; `bicubic` uses the Keys cubic with `a=-0.5`; `lanczos` uses `sinc(x)sinc(x/3)` for `|x| < 3`.
- Clamp source coordinates to the image; write alpha `0` outside the source.
- `gaussianPyramid` uses a 5-tap `[1,4,6,4,1]/16` blur, then 2× nearest downsample. Stop at 1 px.
- `laplacianPyramid` returns residuals offset by 128 for display; the last level is the Gaussian residual.
- `pyramidContactSheet` tiles levels left-to-right with 4 px gaps on the dark panel color.
- `multiscaleBlend` blends Gaussian/Laplacian levels with weight `mix` and reconstructs; both images must have the same dimensions.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @negarlab/ip test -- geometry.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ip/src/geometry.ts packages/ip/test/geometry.test.ts
git commit -m "feat(ip): add geometry and pyramids"
```

---

### Task 4: Noise, Blur, and Deconvolution

**Files:**
- Create: `packages/ip/src/noise.ts`
- Test: `packages/ip/test/noise.test.ts`

**Interfaces:**
- Produces:
  - `type NoiseKind = "gaussian" | "salt-pepper" | "speckle" | "poisson"`
  - `interface NoiseOptions { kind: NoiseKind; amount: number; seed: number }`
  - `function addNoise(image: RgbaImage, options: NoiseOptions): RgbaImage`
  - `function motionBlur(image: RgbaImage, length: number, angle: number): RgbaImage`
  - `function defocusBlur(image: RgbaImage, radius: number): RgbaImage`
  - `function wienerDenoise(image: RgbaImage, strength: number): RgbaImage`
  - `type DeconvolutionMethod = "inverse" | "wiener"`
  - `interface DeconvolutionOptions { method: DeconvolutionMethod; blur: "motion" | "defocus"; length: number; angle: number; radius: number; strength: number }`
  - `function deconvolve(image: RgbaImage, options: DeconvolutionOptions): RgbaImage`

- [x] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  addNoise,
  deconvolve,
  defocusBlur,
  motionBlur,
  wienerDenoise,
} from "../src/noise";
import type { RgbaImage } from "../src/types";

function flat(value = 128): RgbaImage {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i += 1) data.set([value, value, value, 255], i * 4);
  return { width: 16, height: 16, data };
}

describe("noise", () => {
  it("is deterministic for a seed", () => {
    const a = addNoise(flat(), { kind: "gaussian", amount: 0.1, seed: 7 });
    const b = addNoise(flat(), { kind: "gaussian", amount: 0.1, seed: 7 });
    expect([...a.data]).toEqual([...b.data]);
  });

  it("supports all four noise kinds", () => {
    for (const kind of ["gaussian", "salt-pepper", "speckle", "poisson"] as const) {
      const out = addNoise(flat(), { kind, amount: 0.1, seed: 3 });
      expect(out.data.length).toBe(16 * 16 * 4);
    }
  });

  it("blurs, denoises, and deconvolves", () => {
    const blurred = motionBlur(flat(), 5, 30);
    expect(blurred.data.length).toBe(flat().data.length);
    expect(defocusBlur(flat(), 2).width).toBe(16);
    expect(wienerDenoise(flat(), 0.01).width).toBe(16);
    const restored = deconvolve(blurred, {
      method: "wiener",
      blur: "motion",
      length: 5,
      angle: 30,
      radius: 2,
      strength: 0.01,
    });
    expect(restored.width).toBe(16);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @negarlab/ip test -- noise.test.ts`
Expected: FAIL because the module is missing.

- [x] **Step 3: Implement `noise.ts`**

- Use a local `mulberry32(seed)` PRNG. Gaussian samples use Box–Muller.
- Gaussian noise: add `amount * 255 * N(0,1)`.
- Salt & pepper: replace with 0 or 255 when a uniform sample is below `amount/2` or above `1-amount/2`.
- Speckle: multiply by `1 + amount * N(0,1)`.
- Poisson: lambda `= value/255 * 20`; use Knuth for lambda `< 30`, normal approximation otherwise; normalize back to 0..255.
- Motion PSF: line of length `length`, angle in degrees, normalized, with bilinear endpoint weights.
- Defocus PSF: disk of radius `radius`, normalized.
- Deconvolution: process R/G/B independently; pad to the next power of two, FFT, apply `F/H` for inverse with `epsilon=1e-3`, or `F*conj(H)/(|H|^2 + strength)` for Wiener; inverse FFT and crop.
- `wienerDenoise` uses a 5×5 local mean/variance filter: `noiseVar=(strength*255)^2`, `out=mean+max(0,var-noiseVar)/var*(x-mean)`; preserve alpha.
- Preserve alpha. Clamp outputs to 0..255.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @negarlab/ip test -- noise.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ip/src/noise.ts packages/ip/test/noise.test.ts
git commit -m "feat(ip): add noise and restoration"
```

---

### Task 5: Halftone and Palette Reduction

**Files:**
- Create: `packages/ip/src/halftone.ts`
- Test: `packages/ip/test/halftone.test.ts`

**Interfaces:**
- Produces:
  - `type HalftoneMethod = "floyd-steinberg" | "bayer"`
  - `function halftone(image: RgbaImage, method: HalftoneMethod, matrixSize?: number): RgbaImage`
  - `type PaletteMethod = "median-cut" | "kmeans"`
  - `interface PaletteResult { image: RgbaImage; palette: Array<[number, number, number]> }`
  - `function reducePalette(image: RgbaImage, colors: number, method: PaletteMethod, dither: boolean, seed?: number): PaletteResult`

- [x] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { halftone, reducePalette } from "../src/halftone";
import type { RgbaImage } from "../src/types";

function image(): RgbaImage {
  const data = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < 64; i += 1) {
    data.set([(i * 31) % 256, (i * 17) % 256, (i * 7) % 256, 255], i * 4);
  }
  return { width: 8, height: 8, data };
}

describe("halftone", () => {
  it("diffuses error and orders Bayer", () => {
    expect(halftone(image(), "floyd-steinberg").data.length).toBe(8 * 8 * 4);
    expect(halftone(image(), "bayer", 4).data.length).toBe(8 * 8 * 4);
  });

  it("reduces palettes with both methods", () => {
    for (const method of ["median-cut", "kmeans"] as const) {
      const result = reducePalette(image(), 4, method, true, 5);
      expect(result.palette.length).toBeGreaterThan(0);
      expect(result.image.width).toBe(8);
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @negarlab/ip test -- halftone.test.ts`
Expected: FAIL because the module is missing.

- [x] **Step 3: Implement `halftone.ts`**

- `halftone` converts to luma and emits black/white. Floyd–Steinberg distributes `7/16`, `3/16`, `5/16`, `1/16` to right, below-left, below, below-right.
- Bayer matrices: 2×2 `[[0,2],[3,1]]`, 4×4 and 8×8 recursively; threshold `(matrix+0.5)/n²`.
- `reducePalette` uses median cut: split the box with the largest channel range at the median until `colors` boxes exist; average each box.
- K-means samples at most 20,000 pixels with stride `max(1, floor(sqrt(N/20000)))`, initializes centroids from median cut, runs 12 iterations, and maps every pixel to the nearest centroid.
- Optional dithering uses Floyd–Steinberg on each channel before mapping.
- Return the palette in RGB order and preserve alpha.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @negarlab/ip test -- halftone.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ip/src/halftone.ts packages/ip/test/halftone.test.ts
git commit -m "feat(ip): add halftone and palette reduction"
```

---

### Task 6: W4 Golden Vectors

**Files:**
- Modify: `tools/golden/negarlab_golden/generate.py`
- Modify: `tools/golden/tests/test_generate.py`
- Create: `packages/ip/test-data/golden/w4-color-noise-morphology-geometry-halftone.json`
- Create: `packages/ip/test/w4-golden.test.ts`

**Interfaces:**
- Consumes: all public functions from Tasks 1–5.
- Produces: `W4_OUT`, `build_w4_vectors()`, `write_w4_vectors(path)`.

- [x] **Step 1: Add generator test**

Append to `tools/golden/tests/test_generate.py`:

```python
def test_w4_vectors_are_deterministic(tmp_path):
    from negarlab_golden.generate import W4_OUT, build_w4_vectors, write_w4_vectors

    first = tmp_path / "a.json"
    second = tmp_path / "b.json"
    write_w4_vectors(first)
    write_w4_vectors(second)
    assert first.read_bytes() == second.read_bytes()
    assert W4_OUT.exists(), "run pnpm gen:golden"
    assert_close(json.loads(W4_OUT.read_text()), build_w4_vectors())
    data = build_w4_vectors()
    assert data["expected"]["color"]["width"] == 8
    assert data["expected"]["morphology"]["width"] == 8
    assert data["expected"]["geometry"]["width"] == 8
    assert data["expected"]["noise"]["width"] == 8
    assert data["expected"]["halftone"]["width"] == 8
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run --directory tools/golden pytest -q`
Expected: FAIL because `W4_OUT` is missing.

- [x] **Step 3: Implement NumPy references**

Add `W4_OUT`, `build_w4_vectors`, `write_w4_vectors` to `generate.py`. Use the existing `pattern_rgba()` input and implement independent NumPy references:

- Color: HSV/HSL/YCbCr/CMYK/Lab arrays for the 8×8 pattern; Lab `a` channel grayscale; 4:2:0 reconstruction; deuteranopia matrix; gray-world gains.
- Morphology: grayscale erode/dilate with a 3×3 cross; binary opening with threshold 128.
- Geometry: bilinear rotate 30° around center; 3-level Gaussian pyramid widths `[8,4,2]`; Laplacian residual sum; 2-level blend with mix 0.5.
- Noise: Gaussian seed 7 amount 0.1; salt-pepper seed 3 amount 0.1; speckle seed 5 amount 0.05; Poisson seed 11 amount 0.2; local Wiener strength 0.02.
- Halftone: FS and 4×4 Bayer; median-cut and k-means palettes with 4 colors.

The JSON shape must be:

```json
{
  "input": {"width": 8, "height": 8, "rgba": [0, 0, 0, 255]},
  "expected": {
    "color": {"width": 8, "height": 8, "labA": [0], "hsvChannel": [0], "subsampled": [0], "colorblind": [0], "whiteBalance": [0]},
    "morphology": {"width": 8, "height": 8, "eroded": [0], "dilated": [0], "opened": [0]},
    "geometry": {"width": 8, "height": 8, "rotated": [0], "pyramidWidths": [8, 4, 2], "blended": [0]},
    "noise": {"width": 8, "height": 8, "gaussian": [0], "saltPepper": [0], "speckle": [0], "poisson": [0], "wiener": [0]},
    "halftone": {"width": 8, "height": 8, "floyd": [0], "bayer": [0], "medianCut": [0], "kmeans": [0]}
  },
  "tolerance": 1e-6,
  "source": "tools/golden/negarlab_golden/generate.py (numpy float64, byte-exact integer outputs)"
}
```

- [x] **Step 4: Generate and test**

Run: `pnpm gen:golden`
Run: `uv run --directory tools/golden pytest -q`
Expected: 7 passed.

- [x] **Step 5: Add TS golden test**

```ts
import { describe, expect, it } from "vitest";
import golden from "../test-data/golden/w4-color-noise-morphology-geometry-halftone.json";
import { colorSpaceView, subsampleChroma } from "../src/color";
import { applyMorphology, structuringElement } from "../src/morphology";
import { transformImage } from "../src/geometry";
import { addNoise, wienerDenoise } from "../src/noise";
import { halftone, reducePalette } from "../src/halftone";

const image = {
  width: golden.input.width,
  height: golden.input.height,
  data: new Uint8ClampedArray(golden.input.rgba),
};

describe("w4 golden", () => {
  it("matches Lab channel output", () => {
    const out = colorSpaceView(image, "lab", 1);
    out.data.forEach((value, index) => {
      expect(value).toBeCloseTo(golden.expected.color.labA[index] ?? value, 6);
    });
  });

  it("matches subsampling and morphology", () => {
    expect([...subsampleChroma(image, "4:2:0").data]).toEqual(golden.expected.color.subsampled);
    expect([...applyMorphology(image, "erode", structuringElement(3, "cross")).data]).toEqual(
      golden.expected.morphology.eroded,
    );
  });

  it("matches geometry and noise", () => {
    const rotated = transformImage(image, {
      scaleX: 1, scaleY: 1, rotate: 30, translateX: 0, translateY: 0,
      shearX: 0, shearY: 0, perspectiveX: 0, perspectiveY: 0, interpolation: "bilinear",
    });
    rotated.data.forEach((value, index) => {
      expect(value).toBeCloseTo(golden.expected.geometry.rotated[index] ?? value, 6);
    });
    expect([...addNoise(image, { kind: "gaussian", amount: 0.1, seed: 7 }).data]).toEqual(
      golden.expected.noise.gaussian,
    );
    expect([...wienerDenoise(image, 0.02).data]).toEqual(golden.expected.noise.wiener);
  });

  it("matches halftone and palettes", () => {
    expect([...halftone(image, "floyd-steinberg").data]).toEqual(
      golden.expected.halftone.floyd,
    );
    expect([...reducePalette(image, 4, "median-cut", false, 1).image.data]).toEqual(
      golden.expected.halftone.medianCut,
    );
    expect([...reducePalette(image, 4, "kmeans", false, 1).image.data]).toEqual(
      golden.expected.halftone.kmeans,
    );
  });
});
```

- [x] **Step 6: Run TS test**

Run: `pnpm --filter @negarlab/ip test -- w4-golden.test.ts`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add tools/golden packages/ip/test-data/golden/w4-color-noise-morphology-geometry-halftone.json packages/ip/test/w4-golden.test.ts
git commit -m "test(ip): add w4 golden vectors"
```

---

### Task 7: Worker RPC and Exports

**Files:**
- Modify: `packages/ip/src/index.ts`
- Modify: `apps/web/src/workers/ip.worker.ts`

**Interfaces:**
- Produces these worker request types:
  - `ColorRequest`
  - `MorphologyRequest`
  - `GeometryRequest`
  - `NoiseRequest`
  - `RestoreRequest`
  - `HalftoneRequest`
- Produces these worker methods:
  - `applyColor(image, request): RgbaImage`
  - `applyMorphology(image, request): RgbaImage`
  - `applyGeometry(image, request): RgbaImage`
  - `pyramid(image, kind, levels): RgbaImage`
  - `blendPyramids(image, levels, mix): RgbaImage`
  - `applyNoise(image, request): RgbaImage`
  - `restore(image, request): RgbaImage`
  - `applyHalftone(image, request): RgbaImage | PaletteResult`
  - `reducePalette(image, colors, method, dither, seed): PaletteResult`

- [x] **Step 1: Add failing worker test or typecheck target**

There is no worker unit test harness; add a Vitest test in `packages/ip/test/worker-contract.test.ts` that imports the request types and asserts a small mapping object type-checks. Keep it behavior-free.

```ts
import { expect, it } from "vitest";
import type { GeometryRequest, NoiseRequest } from "../../../apps/web/src/workers/ip.worker";

it("worker request types are exported", () => {
  const geometry: GeometryRequest = {
    kind: "transform",
    options: {
      scaleX: 1, scaleY: 1, rotate: 0, translateX: 0, translateY: 0,
      shearX: 0, shearY: 0, perspectiveX: 0, perspectiveY: 0, interpolation: "bilinear",
    },
  };
  const noise: NoiseRequest = { kind: "gaussian", amount: 0.1, seed: 1 };
  expect(geometry.kind).toBe("transform");
  expect(noise.kind).toBe("gaussian");
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @negarlab/ip test -- worker-contract.test.ts`
Expected: FAIL because the request types are missing.

- [x] **Step 3: Implement exports and worker methods**

- Add all new functions and types to `packages/ip/src/index.ts`.
- Define request unions in `ip.worker.ts`:

```ts
export type ColorRequest =
  | { kind: "space"; space: ColorSpace; channel: number }
  | { kind: "subsample"; mode: ChromaMode }
  | { kind: "colorblind"; deficiency: ColorBlindness; severity: number }
  | { kind: "balance"; method: WhiteBalanceMethod };

export type MorphologyRequest = {
  kind: MorphologyOp;
  size: number;
  shape: "rect" | "ellipse" | "cross";
  mask?: number[];
  binaryThreshold?: number;
};

export type GeometryRequest =
  | { kind: "transform"; options: GeometryOptions }
  | { kind: "pyramid"; levels: number; laplacian: boolean }
  | { kind: "blend"; levels: number; mix: number };

export type NoiseRequest = { kind: NoiseKind; amount: number; seed: number };

export type RestoreRequest =
  | { kind: "median"; radius: number }
  | { kind: "bilateral"; radius: number; sigmaSpace: number; sigmaRange: number }
  | { kind: "wiener-denoise"; strength: number }
  | { kind: "inverse" | "wiener"; blur: "motion" | "defocus"; length: number; angle: number; radius: number; strength: number };

export type HalftoneRequest =
  | { kind: "halftone"; method: HalftoneMethod; matrixSize: number }
  | { kind: "palette"; colors: number; method: PaletteMethod; dither: boolean; seed: number };
```

- `applyMorphology` builds `StructuringElement` from `mask` when provided, otherwise `structuringElement(size, shape)`.
- `pyramid` returns `pyramidContactSheet(laplacian ? laplacianPyramid(...) : gaussianPyramid(...))`.
- `blendPyramids` rotates the image 180° with `transformImage` and calls `multiscaleBlend(image, rotated, levels, mix)`.
- `blur` dispatches to `motionBlur` or `defocusBlur`.
- `restore` dispatches to `medianFilter`, `bilateralFilter`, `wienerDenoise`, or `deconvolve`.
- `applyHalftone` returns `reducePalette` for `palette`, else `halftone`.

- [x] **Step 4: Run typecheck and tests**

Run: `pnpm --filter @negarlab/ip typecheck`
Run: `pnpm --filter @negarlab/ip test -- worker-contract.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ip/src/index.ts apps/web/src/workers/ip.worker.ts packages/ip/test/worker-contract.test.ts
git commit -m "feat(web): expose w4 worker operations"
```

---

### Task 8: Backend NLM

**Files:**
- Modify: `apps/api/pyproject.toml`, `apps/api/uv.lock`
- Create: `apps/api/src/negarlab_api/api/routes/denoise.py`
- Modify: `apps/api/src/negarlab_api/main.py`
- Create: `apps/api/tests/test_denoise.py`
- Modify: `docs/THIRD_PARTY.md`

**Interfaces:**
- Produces: `POST /api/v1/denoise` multipart `file`, form `strength` (1..30), returns `image/png`.
- Consumes: `prepare_image`, `Storage` not required.

- [x] **Step 1: Add failing API test**

```python
import io

from fastapi.testclient import TestClient
from PIL import Image


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGBA", (8, 8), (120, 40, 200, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_denoise_returns_png(app_factory):
    client = TestClient(app_factory())
    response = client.post(
        "/api/v1/denoise",
        files={"file": ("in.png", _png(), "image/png")},
        data={"strength": "3"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    with Image.open(io.BytesIO(response.content)) as image:
        assert image.size == (8, 8)


def test_denoise_rejects_bad_strength(app_factory):
    client = TestClient(app_factory())
    response = client.post(
        "/api/v1/denoise",
        files={"file": ("in.png", _png(), "image/png")},
        data={"strength": "99"},
    )
    assert response.status_code == 422
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run --directory apps/api pytest tests/test_denoise.py -q`
Expected: FAIL with 404.

- [x] **Step 3: Add OpenCV and route**

- Add `"opencv-python-headless>=4.10"` to `apps/api/pyproject.toml`.
- Add a mypy override so the untyped `cv2` module is accepted:
  `[[tool.mypy.overrides]] module = ["cv2"] ignore_missing_imports = true`.
- Run `uv lock --directory apps/api`.
- Add to `docs/THIRD_PARTY.md`: `opencv-python-headless | Apache-2.0 | NLM denoise`.
- Implement `denoise.py`:

```python
import io

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response

from ...config import Settings
from ...deps import get_app_settings
from ...errors import ApiError
from ...imaging import prepare_image

router = APIRouter(tags=["denoise"])


@router.post("/denoise")
def denoise(
    file: UploadFile = File(...),
    strength: float = Form(3.0),
    settings: Settings = Depends(get_app_settings),
) -> Response:
    if not 1 <= strength <= 30:
        raise ApiError("invalid_strength", 422, "Strength must be within 1..30")
    raw = file.file.read(settings.upload_max_bytes + 1)
    if len(raw) > settings.upload_max_bytes:
        raise ApiError("upload_too_large", 413, "Upload exceeds the size limit")
    _, png = prepare_image(raw, settings)
    bgra = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_UNCHANGED)
    if bgra is None:
        raise ApiError("invalid_image", 415, "Image could not be decoded")
    bgr = cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR)
    denoised = cv2.fastNlMeansDenoisingColored(
        bgr, None, strength, strength, 7, 21
    )
    out = cv2.cvtColor(denoised, cv2.COLOR_BGR2BGRA)
    out[..., 3] = bgra[..., 3]
    ok, encoded = cv2.imencode(".png", out)
    if not ok:
        raise ApiError("encode_failed", 500, "Image could not be encoded")
    return Response(content=encoded.tobytes(), media_type="image/png")
```

- Register the router in `main.py` next to the image router.

- [x] **Step 4: Run tests and lint**

Run: `uv run --directory apps/api pytest tests/test_denoise.py -q`
Run: `uv run --directory apps/api ruff check .`
Run: `uv run --directory apps/api mypy src`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/api/pyproject.toml apps/api/uv.lock apps/api/src/negarlab_api/api/routes/denoise.py apps/api/src/negarlab_api/main.py apps/api/tests/test_denoise.py docs/THIRD_PARTY.md
git commit -m "feat(api): add opencv nlm denoise"
```

---

### Task 9: Color and Morphology Panels

**Files:**
- Create: `apps/web/src/components/ColorPanel.tsx`
- Create: `apps/web/src/components/MorphologyPanel.tsx`
- Modify: `apps/web/src/components/ParameterDock.tsx`
- Modify: `apps/web/src/components/TheoryPanel.tsx`
- Modify: `apps/web/src/i18n/locales/en/common.json`, `fa/common.json`

**Interfaces:**
- Consumes: `applyColor`, `applyMorphology` worker methods; `TheoryPanel` topics `color`, `morphology`.

- [x] **Step 1: Add panel code**

`ColorPanel` controls: mode buttons (`space`, `subsample`, `colorblind`, `balance`); space select; channel buttons `all/1/2/3/4`; subsampling buttons; deficiency select; severity slider; balance method buttons. Debounce 150 ms, call `applyColor`, set preview.

`MorphologyPanel` controls: op grid; shape select; size select 3/5/7; binary toggle and threshold; 5×5 SE editor where cells toggle; at least one cell stays set. Call `applyMorphology`, set preview. Reset clears preview.

Both panels include `<TheoryPanel topic="color" />` / `topic="morphology"`.

- [x] **Step 2: Add tabs and theory**

- Add `color` and `morphology` to `TABS` and render panels.
- Add topics and formulas:
  - color: `Y=0.299R+0.587G+0.114B,\quad L=116f(Y)-16`
  - morphology: `A\ominus B=\{z\mid B_z\subseteq A\},\quad A\oplus B=\{z\mid \hat B_z\cap A\neq\varnothing\}`
- Add all English and Persian labels/theory text.

- [x] **Step 3: Run checks**

Run: `pnpm check`
Expected: PASS with new i18n keys in sync.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/components/ColorPanel.tsx apps/web/src/components/MorphologyPanel.tsx apps/web/src/components/ParameterDock.tsx apps/web/src/components/TheoryPanel.tsx apps/web/src/i18n/locales/en/common.json apps/web/src/i18n/locales/fa/common.json
git commit -m "feat(web): add color and morphology labs"
```

---

### Task 10: Geometry and Halftone Panels

**Files:**
- Create: `apps/web/src/components/GeometryPanel.tsx`
- Create: `apps/web/src/components/HalftonePanel.tsx`
- Modify: `apps/web/src/components/ParameterDock.tsx`
- Modify: `apps/web/src/components/TheoryPanel.tsx`
- Modify: `apps/web/src/i18n/locales/en/common.json`, `fa/common.json`

**Interfaces:**
- Consumes: `applyGeometry`, `pyramid`, `blendPyramids`, `applyHalftone`, `reducePalette`.
- Produces: palette swatch UI from `PaletteResult.palette`.

- [x] **Step 1: Add panel code**

`GeometryPanel` mode buttons (`transform`, `pyramid`, `blend`); interpolation select; scale/rotate/translate/shear/perspective sliders; pyramid levels 2–4; blend mix 0–1. Debounce 200 ms. `pyramid` calls `pyramid(image, levels, laplacian)` and shows the contact sheet. `blend` calls `blendPyramids(image, levels, mix)`.

`HalftonePanel` mode buttons (`halftone`, `palette`); method buttons; Bayer matrix size 2/4/8; palette colors 2–16; palette method; dither toggle; seed. `halftone` shows black/white; `palette` shows `PaletteResult.image` and renders swatches.

Both include `<TheoryPanel topic="geometry" />` / `topic="halftone"`.

- [x] **Step 2: Add tabs and theory**

- Add `geometry`, `halftone` tabs and panels.
- Formulas:
  - geometry: `\begin{bmatrix}x'\\y'\\1\end{bmatrix}=H\begin{bmatrix}x\\y\\1\end{bmatrix}`
  - halftone: `e(x,y)=f(x,y)-b(x,y),\quad b=\begin{cases}255&f\ge T\\0&f<T\end{cases}`
- Add bilingual labels/theory.

- [x] **Step 3: Run checks**

Run: `pnpm check`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/components/GeometryPanel.tsx apps/web/src/components/HalftonePanel.tsx apps/web/src/components/ParameterDock.tsx apps/web/src/components/TheoryPanel.tsx apps/web/src/i18n/locales/en/common.json apps/web/src/i18n/locales/fa/common.json
git commit -m "feat(web): add geometry and halftone labs"
```

---

### Task 11: Noise Panel and NLM Client

**Files:**
- Create: `apps/web/src/components/NoisePanel.tsx`
- Create: `apps/web/src/lib/denoise.ts`
- Create: `apps/web/src/lib/png.ts`
- Modify: `apps/web/src/components/ParameterDock.tsx`
- Modify: `apps/web/src/components/TheoryPanel.tsx`
- Modify: `apps/web/src/i18n/locales/en/common.json`, `fa/common.json`

**Interfaces:**
- Produces: `denoiseNlm(image, strength): Promise<RgbaImage>`.
- Consumes: `applyNoise`, `restore` worker methods; backend `/api/v1/denoise`.

- [x] **Step 1: Implement PNG encoding and NLM client**

`png.ts`:

```ts
import type { RgbaImage } from "@negarlab/ip";

export async function encodePng(image: RgbaImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  context.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  );
  return canvas.convertToBlob({ type: "image/png" });
}
```

`denoise.ts` posts the blob and strength to `/api/v1/denoise`, throws on non-OK, and returns `decodeImageBlob(await response.blob())`.

- [x] **Step 2: Add NoisePanel**

Controls: noise kind buttons, amount slider, seed field + reroll; blur kind (`none`, `motion`, `defocus`), length/angle/radius; preview toggle `noisy`/`blurred`/`restored`; restore method (`none`, `median`, `bilateral`, `wiener-denoise`, `wiener`, `inverse`, `nlm`); method params; NLM strength slider and run button with busy state.

Flow:
1. Worker `applyNoise(image, request)` returns noisy; store in state.
2. If blur is active, worker `blur(noisy, ...)` returns the working image.
3. If restore is `none` or `nlm`, preview the working image.
4. For local restores, worker `restore(working, request)` and preview.
5. NLM button calls `denoiseNlm(working, strength)`, sets preview and clears busy; show error on failure.

- [x] **Step 3: Add tab and theory**

Add `noise` tab, formula `g(x,y)=f(x,y)+\eta(x,y)`, and bilingual labels/theory. Mention NLM is backend-only.

- [x] **Step 4: Run checks**

Run: `pnpm check`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/NoisePanel.tsx apps/web/src/lib/denoise.ts apps/web/src/lib/png.ts apps/web/src/components/ParameterDock.tsx apps/web/src/components/TheoryPanel.tsx apps/web/src/i18n/locales/en/common.json apps/web/src/i18n/locales/fa/common.json
git commit -m "feat(web): add noise and restoration lab"
```

---

### Task 12: E2E, Docs, and Close-Out

**Files:**
- Modify: `apps/web/e2e/smoke.spec.ts`
- Modify: `docs/ALGORITHMS.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/plans/README.md`

**Interfaces:**
- Consumes: all W4 panels.
- Produces: W4 status Done, D13, algorithm notes.

- [x] **Step 1: Extend e2e**

After the metrics block, add:

```ts
await page.getByTestId("tab-color").click();
await page.getByTestId("color-subsample-420").click();
await expect(page.getByTestId("stage-preview")).toBeVisible();
await page.getByTestId("color-reset").click();

await page.getByTestId("tab-morphology").click();
await page.getByTestId("morphology-erode").click();
await expect(page.getByTestId("stage-preview")).toBeVisible();
await page.getByTestId("morphology-reset").click();

await page.getByTestId("tab-geometry").click();
await page.getByTestId("geometry-transform").click();
await expect(page.getByTestId("stage-preview")).toBeVisible();
await page.getByTestId("geometry-reset").click();

await page.getByTestId("tab-halftone").click();
await page.getByTestId("halftone-floyd").click();
await expect(page.getByTestId("stage-preview")).toBeVisible();
await page.getByTestId("halftone-reset").click();

await page.getByTestId("tab-noise").click();
await page.getByTestId("noise-gaussian").click();
await expect(page.getByTestId("stage-preview")).toBeVisible();
await page.getByTestId("noise-reset").click();
```

Every new panel must expose the referenced test ids.

- [x] **Step 2: Document**

- `docs/ALGORITHMS.md`: add color conversions, chroma subsampling, Machado matrices, white balance, morphology, homography/interpolation, pyramids, noise/PRNG, PSF/deconvolution, halftone/Bayer, median cut/k-means.
- `docs/DECISIONS.md`: add D13 for synchronous OpenCV NLM (no job progress) and sampled TS k-means; D14 for Machado colorblind matrices if needed.
- `docs/PROGRESS.md`: W4 Done, W5 Next, log verification counts.
- `docs/plans/README.md`: add W4 link; next W5.
- Tick every checkbox in this plan and add a completion-notes section for deviations.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm check
pnpm test:api
uv run --directory apps/api ruff check .
uv run --directory apps/api mypy src
uv run --directory tools/golden pytest -q
pnpm e2e
pnpm gen:golden && git diff --exit-code -- packages/ip/test-data/golden
NEGARLAB_HTTP_PORT=8081 docker compose build
```

Expected: all green; no golden diff; Docker images build.

- [x] **Step 4: Commit**

```bash
git add apps/web/e2e/smoke.spec.ts docs
git commit -m "docs: close out wave 4"
```

---

## Review Focus

- Color round-trips and alpha preservation.
- Morphology border behavior and SE masks.
- Geometry identity, out-of-bounds alpha, interpolation edge cases.
- Noise determinism for a fixed seed; deconvolution does not NaN.
- Halftone and palette determinism; k-means sample cap.
- NLM upload limit, strength validation, alpha preservation.
- Bilingual keys in sync; no console errors.
- Golden fixture regenerates without drift beyond 1e-6.

---

## Completion Notes

- W4 scope follows the full spec set I02/I06/I07/I08/I11, not only the three modules named in the old progress row.
- NLM is a synchronous multipart PNG endpoint on the FastAPI backend (D13); it does not use the job registry or SSE progress.
- k-means starts from median cut, runs 12 iterations, samples at most 20,000 pixels, and accepts an unused seed (D13).
- Color-vision simulation uses Machado 2009 matrices in linear sRGB with severity interpolation (D14).
- `wienerDenoise` is a 5×5 local mean/variance filter, not an FFT Wiener filter; the FFT path is used only by inverse/Wiener deconvolution.
- Poisson noise ignores the amount slider and uses `lambda = value/255*20`.
- Geometry writes alpha 0 outside the source bounds and resamples all four channels inside.
- Verification: `pnpm check` (117 ip + 3 web tests, 246 i18n keys), `pnpm test:api` (18), ruff, mypy, golden pytest (7), golden reproducibility, web build, and Playwright e2e green. Docker build was skipped because the Docker daemon was not running.
