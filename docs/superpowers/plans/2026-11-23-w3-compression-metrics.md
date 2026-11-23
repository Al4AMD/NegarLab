# W3 — Compression Core and Quality Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver I09 core (lossless codecs, PNG filters, full JPEG teaching pipeline) and I10 (MSE, PSNR, SSIM map, MS-SSIM, error heatmap, rate–distortion chart) in `@negarlab/ip`, the worker, and the bilingual dock.

**Architecture:** Pure DOM-free algorithms in `packages/ip`, verified by NumPy golden vectors and round-trip property tests. Worker RPC exposes compression and metric calls; React dock panels render JPEG stages, basis functions, lossless sizes, metric readouts, heatmap, and RD chart. No DSP on the main thread.

**Tech Stack:** TypeScript, Vitest, NumPy golden generator, React, Comlink, Tailwind v4, KaTeX, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-negarlab-design.md` (§5 I09/I10, §8, §9)

## Global Constraints

- Working image cap 2048 px; all pixel work in the worker.
- Float golden tolerance 1e-6; byte outputs bit-exact unless documented.
- fa default RTL / en LTR; Latin digits in technical readouts (`.numeric`); theory panels bilingual.
- No console errors in exercised flows; no new runtime dependency.
- JPEG lab is YCbCr 4:4:4 (no chroma subsampling yet; I02/W4 owns subsampling). LZW uses fixed 16-bit codes. Both documented in `ALGORITHMS.md` and `DECISIONS.md`.

## Review Focus

1. DCT∘IDCT reconstructs a block within 1e-6; JPEG quality 1 and 100 do not divide by zero.
2. Quantization at quality 100 must not produce zero coefficients everywhere; at quality 1 the image still decodes.
3. Every lossless codec must round-trip bit-exact on random bytes, including empty and single-byte input.
4. SSIM of an image with itself is 1; SSIM map stays in [-1, 1]; PSNR of identical images is Infinity, not NaN.
5. Odd image sizes (not multiples of 8) must JPEG-encode without dropping edge pixels.
6. PNG Paeth filter must invert exactly at row and column edges.

---

### Task 1: DCT, zigzag, and JPEG quantization tables

**Files:**
- Create: `packages/ip/src/dct.ts`
- Create: `packages/ip/test/dct.test.ts`
- Modify: `packages/ip/src/index.ts`
- Modify: `tools/golden/negarlab_golden/generate.py`, `tools/golden/tests/test_generate.py`

**Interfaces:**
- `dct8(block: Float64Array): Float64Array` — orthonormal 8×8 DCT-II, row-major.
- `idct8(coeffs: Float64Array): Float64Array` — inverse.
- `dctBasis(u: number, v: number): Float64Array` — 8×8 basis image.
- `ZIGZAG: readonly number[]` — 64 row-major indices in zigzag order.
- `zigzag(coeffs: Float64Array | Int32Array): number[]`.

- [x] Failing tests: DC-only block `[100, ...0]` → all coefficients `12.5`; DCT∘IDCT round-trip 1e-6; basis count 64; zigzag first/last indices.
- [x] Implement with cosine tables; export from barrel.
- [x] Add NumPy DCT/IDCT/zigzag of the deterministic pattern to `w3-compression-metrics.json`; golden test.
- [x] Commit `feat(ip): add dct zigzag and jpeg quantization tables`.

### Task 2: JPEG pipeline and block inspector

**Files:**
- Create: `packages/ip/src/jpeg.ts`
- Create: `packages/ip/test/jpeg.test.ts`
- Modify: barrel, golden generator/test.

**Interfaces:**
- `jpegQuantTable(quality: number): { luma: Int32Array; chroma: Int32Array }` — standard Annex K tables scaled by quality 1..100.
- `jpegReconstruct(image: RgbaImage, quality: number): JpegResult` where
  `JpegResult { image, quality, lumaTable, chromaTable, encodedBytes, bpp, ratio }`.
- `jpegBlock(image, blockX, blockY, quality, channel: "y"|"cb"|"cr"): JpegBlockStages` with `source`, `levelShifted`, `dct`, `quantized`, `zigzag`, `reconstructed`, `dcDiff`, `rle`.
- `estimateJpegBits` internal via shared canonical Huffman.

- [x] Failing tests: identical image quality 100 has high PSNR; odd 9×7 image keeps dimensions; quality 10 bytes < quality 90 bytes; block stages have 64 values; alpha preserved.
- [x] Implement BT.601 YCbCr, edge-replicated 8×8 padding, quantize/dequantize, DC differential + AC RLE symbol histogram, canonical Huffman bit estimate.
- [x] Golden: quality 50 reconstruction bytes and quality 50 tables on the 8×8 pattern.
- [x] Commit `feat(ip): add jpeg pipeline and block inspector`.

### Task 3: Lossless codecs and PNG filters

**Files:**
- Create: `packages/ip/src/huffman.ts`
- Create: `packages/ip/src/lossless.ts`
- Create: `packages/ip/test/lossless.test.ts`
- Modify: barrel, golden generator/test.

**Interfaces:**
- `rleEncode/rleDecode`, `huffmanEncode/huffmanDecode`, `lzwEncode/lzwDecode` — `Uint8Array` in/out; encoders return `{ bytes, encodedBytes }`.
- `dpcmResiduals/dpcmDecode(bytes, width, height)`.
- `pngFilter/pngUnfilter(bytes, width, height, filter)`, `pngAdaptiveFilter`.
- `byteEntropyBits(bytes)`, `lumaBytes(image)`.
- `losslessReport(image): { rawBytes, entropyBits, methods: { id, encodedBytes }[] }` with ids `rle | huffman | lzw | dpcm | png`.

- [x] Failing tests: each codec round-trips random bytes; empty/single byte; PNG filters invert; Paeth edge values; adaptive picks identity on zero rows; DPCM round-trip.
- [x] Implement canonical Huffman (shared with JPEG), byte-pair RLE, fixed 16-bit LZW, modulo-256 DPCM, five PNG filters.
- [x] Golden: DPCM residuals, each PNG filter output, and adaptive row filter choice on the pattern.
- [x] Commit `feat(ip): add lossless codecs and png filters`.

### Task 4: Quality metrics and error heatmap

**Files:**
- Create: `packages/ip/src/metrics.ts`
- Create: `packages/ip/test/metrics.test.ts`
- Modify: barrel, golden generator/test.

**Interfaces:**
- `mse(a, b): number` over RGB, 0..255 scale; `psnr(a, b): number` (Infinity on identical).
- `ssim(a, b): { mean, map: Float32Array, width, height }` — luma, 11×11 Gaussian σ=1.5, clamped borders, C1/C2 from K1=0.01, K2=0.03.
- `msSsim(a, b): number` — SSIM per scale, average 2×2 pooling, standard weights, renormalized when fewer than 5 scales.
- `errorHeatmap(a, b, gain = 4): RgbaImage`.
- `compareMetrics(a, b): { mse, psnr, ssim, msSsim }`.

- [x] Failing tests: identical → MSE 0, PSNR Infinity, SSIM 1; map bounds; degraded image lower SSIM; odd sizes; MS-SSIM ≤ 1.
- [x] Implement separable Gaussian blur for local statistics.
- [x] Golden: MSE/PSNR/SSIM mean and map for pattern vs pattern shifted by one pixel; MS-SSIM property only.
- [x] Commit `feat(ip): add quality metrics and error heatmap`.

### Task 5: Worker API, dock panels, theory, i18n

**Files:**
- Modify: `apps/web/src/workers/ip.worker.ts`, `apps/web/src/components/ParameterDock.tsx`, `apps/web/src/components/TheoryPanel.tsx`, i18n catalogs.
- Create: `apps/web/src/components/CompressionPanel.tsx`, `apps/web/src/components/MetricsPanel.tsx`.

**Interfaces:**
- Worker: `lossless(image)`, `jpeg(image, quality)`, `jpegBlock(image, request)`, `jpegMetrics(image, quality)`, `rateDistortion(image, qualities)`.
- Dock tabs `compression` and `metrics`; theory topics `compression`, `metrics`.

- [x] Implement worker methods with types.
- [x] Compression panel: quality slider + live JPEG preview, lossless size table, block X/Y/channel pickers, stage matrices (source, level-shifted, DCT, quantized, zigzag, reconstructed), 64-basis grid toggle, reset.
- [x] Metrics panel: quality slider, MSE/PSNR/SSIM/MS-SSIM readout, SSIM map, error heatmap, RD chart, reset.
- [x] Bilingual keys for every new string; theory formulas.
- [x] Commit `feat(web): add compression and metrics panels`.

### Task 6: E2E, docs, close-out

- [x] E2E: compression tab shows lossless table and JPEG preview, block matrices visible; metrics tab shows metrics and RD chart; resets clear preview; zero console errors.
- [x] Update `ALGORITHMS.md`, `PROGRESS.md`, `DECISIONS.md` (D11 JPEG 4:4:4 + estimated entropy, D12 fixed 16-bit LZW), `plans/README.md`.
- [x] Run `pnpm check`, `pnpm test:api`, `pnpm gen:golden` + reproducibility diff, web build, `pnpm e2e`, Docker build.
- [x] Commit `chore: close out wave 3`; push `dev`; open PR to `main`.


## Completion Notes

- The Task 1 test description “DC-only block `[100, ...0]` → all coefficients `12.5`” was mathematically wrong: a single nonzero DC sample is not a constant block. The test uses a constant 100 block, whose orthonormal DCT is DC 800 and zero elsewhere.
- Golden metrics compare the deterministic pattern against its JPEG quality-50 reconstruction, not a one-pixel shift; this exercises the full I09→I10 path and includes the SSIM map.
- Worker method names are `compressJpeg`, `metricsCompare`, and `rateDistortion`. The metrics panel is self-contained: it compresses the source at the selected quality and compares it with the original, so it does not depend on the current preview.
- JPEG remains YCbCr 4:4:4 with estimated entropy (D11); LZW uses fixed 16-bit codes (D12).
