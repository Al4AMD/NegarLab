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

## Implemented (W3)

### DCT and JPEG pipeline — `packages/ip/src/dct.ts`, `jpeg.ts`

Orthonormal 8×8 DCT-II with separable row/column passes, inverse transform, zigzag scan, and the Annex K luminance/chrominance quantization tables scaled by `q < 50 ? 5000/q : 200 − 2q`. JPEG converts RGB to BT.601 YCbCr (4:4:4, no chroma subsampling), edge-replicates partial blocks, subtracts 128, transforms, quantizes with `floor(x + 0.5)`, dequantizes, inverse-transforms, and clips. Entropy size is an estimate: DC differential and AC run/size symbols use separate canonical Huffman tables; headers are excluded. Alpha is preserved. Golden: `w3-compression-metrics.json` (DCT, tables, quality 50/90, 9×7 odd size); tests cover quality 1/100, odd sizes, and block stages.

### Lossless codecs and PNG filters — `packages/ip/src/huffman.ts`, `lossless.ts`

Byte-pair RLE, canonical Huffman, fixed 16-bit LZW (clear-free, dictionary grows to 65536), modulo-256 DPCM with the left predictor, and PNG None/Sub/Up/Average/Paeth filters. Adaptive filtering picks the row filter with the smallest sum of absolute signed residuals; PNG filtering always uses original bytes for left/up predictors. Huffman decode needs symbol lengths and the expected byte count because lengths are not serialized. Golden: DPCM, every PNG filter, and adaptive row choices; tests cover empty, single-byte, constant, and random round-trips plus Paeth edges.

### Quality metrics — `packages/ip/src/metrics.ts`

MSE over RGB (0..255), PSNR with Infinity for identical images, SSIM on luma with an 11×11 Gaussian window (σ=1.5), C1=(0.01·255)², C2=(0.03·255)², and clamped borders; MS-SSIM uses the standard five weights, 2×2 average pooling, and renormalizes when fewer scales exist. Error heatmap maps mean absolute RGB error through a black→red→yellow→white ramp with gain 4. Golden: MSE/PSNR/SSIM mean and map for the pattern vs JPEG quality 50; tests cover identical images, constant shifts, small images, and heatmap saturation.

## Planned (later waves)

Morphology, geometric transforms, wavelets, dithering, segmentation, steganography, ML inference. Add the formula, reference, and test location when implemented.
