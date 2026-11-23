# W1 — Fundamentals and Point Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver I00, I01, and I03 end to end: image loading, pixel inspection, statistics/histograms, channel views, sampling/quantization demos, point transforms, equalization/CLAHE/matching, and thresholding, with theory panels and e2e smoke.

**Architecture:** Extend `@negarlab/ip` with pure, DOM-free image/histogram/point-op functions verified by NumPy golden vectors. Add a Zustand image session store, demo/upload loading through `createImageBitmap` and the ingest API, then wire canvas visualization and tool docks into the existing shell. All pixel work runs in the `ip.worker`.

**Tech Stack:** TypeScript, Vitest, NumPy golden generator, React, Zustand, Comlink worker, Tailwind v4, KaTeX, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-negarlab-design.md` (§5 I00/I01/I03, §7, §8, §9)

## Global Constraints

- Upload ≤25 MiB, ≤64 MP, working cap 2048 px, TTL 60 min; EXIF stripped, GPS never returned.
- fa default RTL / en LTR; Latin digits in technical readouts (`.numeric`).
- No DSP on the main thread; worker RPC via Comlink.
- Golden tolerance 1e-6 for floats; integer outputs must be bit-exact.
- No console errors in exercised flows; reduced motion respected.
- Theory panel shipped with each tool (fa + en).

## Review Focus

1. Equalization of an already-uniform image must be identity, not NaN.
2. Otsu on a constant image must be deterministic (threshold 0) and not divide by zero.
3. Quantization at 8 bits must be identity; at 1 bit must produce exactly 0/255.
4. Upload while API offline must show a bilingual error, not crash the shell.
5. Pixel inspector at image edges must clamp, never read out of bounds.

---

### Task 1: Channels, histograms, and golden fixture extension

**Files:** Modify `packages/ip/src/types.ts`, `packages/ip/src/index.ts`; Create `packages/ip/src/channels.ts`, `packages/ip/src/histogram.ts`, `packages/ip/test/channels.test.ts`, `packages/ip/test/histogram.test.ts`, `tools/golden/negarlab_golden/generate.py`, `tools/golden/tests/test_generate.py`, `packages/ip/test-data/golden/w1-fundamentals.json`, `packages/ip/test/w1-golden.test.ts`.

**Interfaces:**
- `rgbaToPlanes(image: RgbaImage): RgbPlanes`, `planesToRgba(planes: RgbPlanes): RgbaImage`.
- `channelHistogram(plane: Plane): Uint32Array` (256 bins, `min(255, floor(v*255))` on float32).
- `histogramCdf(hist: Uint32Array): Float64Array`.
- `RgbPlanes { r: Plane; g: Plane; b: Plane }`.

- [x] **Step 1: Write failing tests** for plane round-trip with `(0,0)` alpha 128 → 255 and histogram of `[0,0,1,1]` → bins 0 and 255 equal 2.
- [x] **Step 2: Run** `pnpm --filter @negarlab/ip test` → FAIL module not found.
- [x] **Step 3: Implement** normalized float32 channels and histogram binning.
- [x] **Step 4: Extend NumPy generator** with `w1-fundamentals.json` holding input, `histogramR/G/B`, `lumaHistogram`, and expected outputs for Tasks 2–4; fixture reproducible test compares committed bytes.
- [x] **Step 5: Add golden test** loading the fixture; assert channels/histograms exactly.
- [x] **Step 6: Run** `pnpm gen:golden && pnpm --filter @negarlab/ip test` → PASS. **Commit** `feat(ip): add rgb planes and histograms`.

### Task 2: Negative, log, and gamma transforms

**Files:** Create `packages/ip/src/pointOps.ts`, `packages/ip/test/pointOps.test.ts`; modify golden generator/test.

**Interfaces:**
- `negative(image: RgbaImage): RgbaImage`
- `logTransform(image: RgbaImage): RgbaImage` — `s = log(1 + 255*v) / log(256)`
- `gammaCorrect(image: RgbaImage, gamma: number): RgbaImage` — `s = v**gamma`
- All keep alpha; clamp and `Math.round(v*255)` before writing.

- [x] **Step 1: Failing tests** — negative twice is identity; gamma 1.0 identity; gamma 0.5 maps 0.25 → 0.5; log(0) = 0, log(1) = 1.
- [x] **Step 2: Run test → FAIL.**
- [x] **Step 3: Implement** shared LUT path; alpha copied.
- [x] **Step 4: Golden fixture** adds `negative`, `gamma` (0.5), `log` arrays; golden test asserts exact integer equality for the 8×8 pattern.
- [x] **Step 5: Run tests; commit** `feat(ip): add negative log and gamma point ops`.

### Task 3: Contrast stretch, equalization, Otsu, threshold

**Files:** Create `packages/ip/src/equalize.ts`, `packages/ip/src/threshold.ts`, tests; extend golden fixture.

**Interfaces:**
- `contrastStretch(image, low = 0, high = 1): RgbaImage` — per channel, low/high are quantiles `0..1`; nearest-rank `floor(p*(n-1))`; clamp.
- `equalize(image): RgbaImage` — per channel: 256-bin CDF, `lut[k] = round(cdf[k]*255)`, output `lut[bin(v)]/255`.
- `otsuThreshold(plane: Plane): number` — 0..1, between-class variance over 256 bins; constant plane → 0.
- `threshold(image, cutoff, invert = false): RgbaImage` — binarize luma (`> cutoff` white), RGB all equal.

- [x] **Step 1: Failing tests** — stretch of `[0.2,0.4,0.6,0.8]` with `low=0.25, high=0.75` → `[0,0,1,1]`; equalize of uniform → identity; Otsu of half-black/half-white → `0.5` ± one bin; threshold output only 0/255.
- [x] **Step 2: Run → FAIL.**
- [x] **Step 3: Implement** and handle empty images, zero-range stretch (return copy), zero-total Otsu.
- [x] **Step 4: Golden** adds `stretch` (0.05/0.95), `equalize`, `otsu`, `threshold`; exact integer comparison.
- [x] **Step 5: Run tests; commit** `feat(ip): add stretch equalization and otsu`.

### Task 4: Bit-depth quantization, nearest resizing, histogram matching

**Files:** Create `packages/ip/src/sampling.ts`, `packages/ip/src/match.ts`, tests; extend golden.

**Interfaces:**
- `quantizeBits(image, bits: 1..8): RgbaImage` — `levels = 2**bits`, `round(v*(levels-1))/(levels-1)`.
- `resizeNearest(image, width: number, height: number): RgbaImage` — source index `min(src-1, floor(dst * src / dstSize))`.
- `matchHistogram(image, reference): RgbaImage` — per channel map source CDF bin to smallest reference bin with `refCdf >= srcCdf`.

- [x] **Step 1: Failing tests** — 8-bit identity; 1-bit values ∈ {0,255}; 8×8 → 4×4 takes even rows/cols; same image as reference → identical.
- [x] **Step 2: Run → FAIL.**
- [x] **Step 3: Implement**, reject non-finite dimensions with `RangeError`.
- [x] **Step 4: Golden** adds `quantize` (3 bits), `downsample` (4×4), `match` (reference = gray ramp 8×8); exact.
- [x] **Step 5: Run tests; commit** `feat(ip): add quantization resampling and histogram matching`.

### Task 5: CLAHE

**Files:** Create `packages/ip/src/clahe.ts`, test; extend golden.

**Interfaces:** `clahe(image, { tiles = 8, clipLimit = 2 }): RgbaImage` — luma-driven per-tile equalization, bilinear interpolation between tile mappings, clipped CDF redistributed before mapping.

- [x] **Step 1: Failing tests** — uniform image unchanged; output mean within 0.02 of input mean; tile boundary continuity (max adjacent delta < 0.2 on a ramp).
- [x] **Step 2: Implement**, clamp tiles to image size, handle tiles smaller than 1 px.
- [x] **Step 3: NumPy reference in generator** mirrors tile/clip/interpolation; golden exact bytes.
- [x] **Step 4: Run tests; commit** `feat(ip): add clahe`.

### Task 6: Image session store and loading

**Files:** Create `apps/web/src/lib/imageStore.ts`, `apps/web/src/lib/decodeImage.ts`, tests; modify `apps/web/src/components/Stage.tsx`, `TransportBar.tsx`, i18n catalogs.

**Interfaces:**
- `useImageStore`: `image: RgbaImage | null`, `name`, `loading`, `errorKey`, `loadDemo(name)`, `loadFile(file)`, `clear()`.
- Demo names `zone-plate | gray-ramp | resolution-wedge | color-checker`; upload posts `/api/v1/ingest`, fetches `image_url`, decodes via `createImageBitmap`.

- [x] **Step 1: Failing test** for `decodeImage` dimensional/error mapping with mocked fetch.
- [x] **Step 2: Implement store/loading** with bilingual errors; add demo buttons to empty Stage.
- [x] **Step 3: Stage renders loaded image** with checkerboard backdrop and fit-to-stage canvas.
- [x] **Step 4: Playwright** loads `zone-plate`, asserts canvas visible and zero console errors. **Commit** `feat(web): add image loading and stage canvas`.

### Task 7: Inspector, statistics, histogram, channel views

**Files:** Create `Inspector.tsx`, `HistogramView.tsx`, `StatsPanel.tsx`, `ChannelTabs.tsx`; modify `Stage.tsx`, `ParameterDock.tsx`; tests.

**Interfaces:** Click pixel → `{x,y, rgba, luma}`; 8×8 matrix around cursor clamped at edges; channel selector `rgb|r|g|b|luma`; stats from `planeStats`; histogram counts as SVG bars.

- [x] **Step 1: Unit tests** for clamped 8×8 window extraction and matrix formatting.
- [x] **Step 2: Implement UI**, wire to store, keep plots LTR/`numeric`.
- [x] **Step 3: e2e** asserts matrix appears and stats show 4-decimal values. **Commit** `feat(web): add pixel inspector stats and histogram`.

### Task 8: Point ops, sampling panels, theory

**Files:** Create `PointOpsPanel.tsx`, `SamplingPanel.tsx`, `TheoryPanel.tsx`; modify `ParameterDock.tsx`; add `katex`; i18n.

**Interfaces:** Dock tabs Inspect / Histogram / Point ops / Sampling. Ops run in worker and replace preview; reset restores source. Sampling sliders: factor 1–8 (nearest) and bits 1–8, both live.

- [x] **Step 1: Extend worker API** with point ops, quantize, resize; unit test client typing.
- [x] **Step 2: Implement panels** with sliders/buttons and disabled states while running; errors surfaced in dock.
- [x] **Step 3: TheoryPanel** renders KaTeX formulas fa/en, collapsible; reduced motion respected.
- [x] **Step 4: e2e** applies gamma + 2-bit quantization and asserts canvas changes without console errors. **Commit** `feat(web): add point ops sampling and theory panels`.

### Task 9: Docs and close-out

- [x] Update `docs/ALGORITHMS.md` with every formula/reference; `docs/PROGRESS.md` W1 status and known gaps; plan checkboxes.
- [x] Run `pnpm check`, `pnpm test:api`, golden reproducibility, `pnpm e2e`, web build.
- [x] Commit `chore: close out wave 1`; push; open PR to `main`.

**Verify:** all checks green; each tool has a Playwright smoke and theory panel; no console errors.
