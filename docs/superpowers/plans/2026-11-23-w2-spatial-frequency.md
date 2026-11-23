# W2 — Spatial Filters and Frequency Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver I04 and I05: convolution, smoothing/sharpening filters, edge detectors, 2D FFT display, and low/high/band frequency filters with live previews and theory.

**Architecture:** Pure algorithms in `packages/ip`, verified against a NumPy fixture. Worker RPC exposes spatial and frequency operations; React dock tabs render controls, spectrum, and theory. No DSP on the main thread.

**Tech Stack:** TypeScript, Vitest, NumPy golden generator, React, Comlink, Tailwind v4, KaTeX, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-negarlab-design.md` (§5 I04/I05, §8, §9)

## Global Constraints

- Working image cap 2048 px; FFT zero-pads each side to the next power of two.
- Float golden tolerance 1e-6; byte outputs bit-exact unless documented.
- fa default RTL / en LTR; theory panels bilingual.
- No console errors in exercised flows.

## Review Focus

1. Convolution at borders must clamp, never read out of bounds.
2. FFT∘IFFT must reconstruct the input within 1e-6; Parseval holds.
3. Median must ignore color channels when computing one channel.
4. Frequency filters must preserve image dimensions and alpha.
5. Zero/one-pixel images and constant images must not divide by zero.

---

### Task 1: Convolution core and kernels

**Files:** Create `packages/ip/src/filters.ts`, `packages/ip/test/filters.test.ts`; extend golden fixture.

**Interfaces:**
- `Kernel { size: number; weights: Float64Array }`
- `convolve(image, kernel, border = "clamp"): RgbaImage`
- `meanKernel(size)`, `gaussianKernel(size, sigma)`, `sharpenKernel()`
- `meanFilter`, `gaussianFilter`, `sharpenFilter`, `unsharpMask(image, sigma, amount)`

- [x] Tests: identity kernel; 3×3 mean on a constant image is identity; edge clamp.
- [x] Golden: 3×3 mean and Gaussian σ=1 on the 8×8 pattern.
- [x] Commit `feat(ip): add convolution filters`.

### Task 2: Median, bilateral, and edge detectors

**Files:** Extend `filters.ts`, tests, golden.

**Interfaces:**
- `medianFilter(image, radius)`
- `bilateralFilter(image, radius, sigmaSpace, sigmaRange)`
- `sobelMagnitude(image)`, `prewittMagnitude(image)`, `laplacianImage(image)`, `logImage(image, sigma)`
- `cannyEdges(image, low, high, sigma)`

- [x] Tests: median removes salt noise; Sobel of a vertical step has a single strong column; constant image gives zero edges.
- [x] Golden: median radius 1, Sobel magnitude.
- [x] Commit `feat(ip): add median bilateral and edge detectors`.

### Task 3: FFT

**Files:** Create `packages/ip/src/fft.ts`, tests, golden.

**Interfaces:**
- `ComplexImage { width; height; re: Float64Array; im: Float64Array }`
- `fft2(plane: Plane): ComplexImage` — zero-pads to powers of two.
- `ifft2(spectrum): Plane`
- `fftShift(spectrum): ComplexImage`
- `fftMagnitude(spectrum): Plane` — `log(1 + |F|)` normalized by max for display.
- `fftPhase(spectrum): Plane`

- [x] Tests: known 2×2 DFT; FFT∘IFFT identity; Parseval; shift involution.
- [x] Golden: magnitude of the 8×8 luma pattern (float, 1e-6).
- [x] Commit `feat(ip): add 2d fft`.

### Task 4: Frequency filters

**Files:** Create `packages/ip/src/frequencyFilters.ts`, tests, golden.

**Interfaces:**
- `FrequencyFilterOptions { kind: "low"|"high"|"band"|"notch"; family: "ideal"|"butterworth"|"gaussian"; cutoff; width?; order?; notchX?; notchY?; notchRadius? }`
- `applyFrequencyFilter(image, options): RgbaImage` — luma-driven, alpha preserved.
- `frequencyMask(width, height, options): Float64Array` — shifted coordinates.

- [x] Tests: lowpass on constant image is identity; highpass removes DC; mask values in 0..1.
- [x] Golden: Gaussian lowpass cutoff 0.25 output bytes.
- [x] Commit `feat(ip): add frequency filters`.

### Task 5: Worker and store integration

**Files:** Modify `apps/web/src/workers/ip.worker.ts`, `apps/web/src/lib/imageStore.ts`.

**Interfaces:**
- `WorkerApi.spectrum(image): { magnitude, phase, width, height }`
- `WorkerApi.applySpatial(image, request)`
- `WorkerApi.applyFrequency(image, options)`

- [x] Add requests and tests where testable.
- [x] Commit `feat(web): extend worker for spatial and frequency`.

### Task 6: Spatial panel and theory

**Files:** Create `apps/web/src/components/SpatialPanel.tsx`; modify `ParameterDock.tsx`, `TheoryPanel.tsx`, catalogs.

- [x] Filter select (mean/Gaussian/median/bilateral/sharpen/unsharp/Sobel/Prewitt/Laplacian/LoG/Canny), size/sigma/amount/radius controls, live preview, reset.
- [x] Theory topic `spatial`.
- [x] Commit `feat(web): add spatial filter panel`.

### Task 7: Frequency panel, spectrum, and theory

**Files:** Create `apps/web/src/components/FrequencyPanel.tsx`, `SpectrumView.tsx`; modify dock, theory, catalogs.

- [x] Compute spectrum in worker; show log magnitude and phase; low/high/band filter select, family, cutoff, order; notch controls; live preview.
- [x] Theory topic `frequency`.
- [x] Commit `feat(web): add frequency panel`.

### Task 8: E2E, docs, and close-out

**Files:** `apps/web/e2e/smoke.spec.ts`, `docs/{PROGRESS,ALGORITHMS,THIRD_PARTY}.md`, this plan.

- [x] E2E: spatial mean preview, frequency spectrum visible, lowpass preview, reset; no console errors.
- [x] `pnpm check`, API tests, golden reproducibility, web build, e2e, Docker build.
- [x] Update PROGRESS/ALGORITHMS, tick checkboxes, push `dev`, PR to `main`.
