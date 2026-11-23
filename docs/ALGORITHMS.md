# Algorithms

Each hand-implemented algorithm: formula/definition, reference, tests, and known limits. Keep entries short and current.

## Implemented (W0)

### Luma conversion — `packages/ip/src/luma.ts`

BT.601 luma: `Y = 0.299R + 0.587G + 0.114B`, alpha ignored, channels normalized to 0..1 (float32). Reference: ITU-R BT.601. Tests: unit vectors and NumPy golden fixture.

### Plane statistics — `packages/ip/src/stats.ts`

Mean, population variance, and Shannon entropy over 256 bins. Bin index is `min(255, floor(v * 255))` after casting to float32 so TS and NumPy agree; entropy is `-Σ p log2 p` over occupied bins. Tests: analytic cases and golden fixture.

### Ingest and EXIF — `apps/api/src/negarlab_api/imaging.py`

Header pixel check before decode (64 MP limit), canonical RGBA PNG, capped working copy (2048 px, LANCZOS), EXIF allowlist and GPS boolean. Tests: API ingest/storage suite.

### Job progress — `apps/api/src/negarlab_api/jobs.py`

Bounded async job pool, SSE progress events, cooperative cancel; terminal `done` event on every path. Tests: job suite including cancel of queued and finished jobs.

### Channels and histograms — `packages/ip/src/channels.ts`, `histogram.ts`

Per-channel Float32 planes normalized to 0..1; 256-bin histograms with `floor(v*255)`; CDF. Golden: `w1-fundamentals.json`. Tests: round-trip, bin counts.

### Point transforms — `packages/ip/src/pointOps.ts`

Negative `1-v`, log `log(1+255v)/log(256)`, gamma `v^γ` (γ>0), alpha preserved, bytes rounded half-up. Golden covers negative, log, gamma 0.5.

### Contrast stretch and equalization — `packages/ip/src/equalize.ts`

Stretch uses nearest-rank quantiles `floor(p*(n-1))` per channel. Equalization uses clipped-offset CDF: `lut[k] = round(((cdf[k]-cdfMin)/(1-cdfMin))*255)`; uniform images are identity. Golden covers 0.05/0.95 stretch and equalization.

### Otsu and threshold — `packages/ip/src/threshold.ts`

Otsu maximizes between-class variance over 256 luma bins; threshold keeps original alpha and emits only 0/255. Constant planes yield 0. Golden covers threshold on the test pattern.

### CLAHE — `packages/ip/src/clahe.ts`

Per-channel contrast-limited adaptive equalization with uniform tiles, clipped histogram redistribution (`excess/256`), cumulative lookup, and bilinear interpolation between tile LUTs. Defaults tiles 8, clip 2; invalid tiles/clip raise `RangeError`. Golden covers 2 tiles at clip 1.5 with a one-byte tolerance; tests cover flat-image identity and invalid options.

### Quantization, nearest resize, histogram matching — `packages/ip/src/sampling.ts`

Quantization to `2^bits` levels, integer bits 1..8; nearest-neighbor resize with clamped source indices; per-channel CDF matching to the reference image. Golden covers 3-bit, 8→4 resize, and matching.

### Spatial convolution and filters — `packages/ip/src/filters.ts`

Direct 2D convolution with clamped borders over `[-1,0,1]`-style kernels; mean, Gaussian, sharpen, unsharp mask, median, bilateral, Sobel/Prewitt/Laplacian/LoG, and Canny (gradient, non-maximum suppression, hysteresis). Alpha is preserved. Golden covers mean 3×3, Gaussian 5×5 σ=1, median radius 1, and Sobel magnitude; Canny and bilateral are unit/property tested.

### 2D FFT — `packages/ip/src/fft.ts`

Row-column iterative radix-2 FFT, zero-padding each dimension to the next power of two. Provides inverse, `fftShift`, log-normalized magnitude, and phase. Tests: known 2×2 DFT, FFT∘IFFT identity, Parseval, shift involution; golden covers log magnitude of the 8×8 luma pattern.

### Frequency filters — `packages/ip/src/frequencyFilters.ts`

Luma-driven frequency masks in shifted coordinates: ideal, Butterworth, and Gaussian low/high/band filters plus symmetric notch suppression; inverse FFT restores RGBA with alpha preserved. Golden covers Gaussian lowpass at cutoff 0.35.

## Planned (later waves)

Morphology, geometric transforms, JPEG pipeline, wavelets, metrics, dithering, segmentation, steganography, ML inference. Add the formula, reference, and test location when implemented.
