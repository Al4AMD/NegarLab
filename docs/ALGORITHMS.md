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

## Implemented (W4)

### Color conversions and views — `packages/ip/src/color.ts`

sRGB↔linear transfer, XYZ with D65 white, CIE Lab, HSV, HSL, BT.601 YCbCr, CMYK, and gray. Channel views render one component as grayscale or reconstruct all components; alpha is preserved. Chroma subsampling averages Cb/Cr over 2×1 (4:2:2) or 2×2 (4:2:0) blocks, then converts back to RGB. Color-vision simulation applies the Machado protanopia/deuteranopia/tritanopia matrices in linear sRGB, interpolated by severity. Gray-world scales channels to the global mean; white-patch uses the 99th-percentile rank per channel and scales to the brightest channel. Reference: ITU-R BT.601/BT.709, CIE Lab, Machado et al. 2009. Golden: `w4-color-noise-morphology-geometry-halftone.json`; tests cover round-trips, alpha, and invalid inputs.

### Morphology — `packages/ip/src/morphology.ts`

Structuring elements of odd size 1..9 with rectangle, ellipse, or cross masks; arbitrary masks are accepted when their length matches. Binary mode thresholds luma at 0..255; grayscale mode runs each RGB channel. Erosion takes the neighborhood minimum over active cells, dilation the maximum; opening, closing, gradient, top-hat, and black-hat compose them. Borders clamp to the edge and alpha is preserved. Reference: Gonzalez & Woods, digital image processing. Golden covers 3×3 cross erosion, dilation, and opening; tests cover every op, masks, and border behavior.

### Geometry and pyramids — `packages/ip/src/geometry.ts`

Forward homography composes scale, center rotation, translation, shear, and perspective; output pixels are inverse-mapped and sampled with nearest, bilinear, bicubic, or Lanczos kernels. Pixels mapping outside the source get alpha 0; inside, all four channels are resampled. The Gaussian pyramid blurs with the separable `[1,4,6,4,1]/16` kernel and takes every second sample; the Laplacian pyramid stores `current − upsample(next) + 128`; the contact sheet tiles levels; multiscale blending mixes Laplacian levels and reconstructs. Golden covers a 30° bilinear rotation, 8→4→2 widths, and a 50/50 self-blend; tests cover identity, out-of-bounds alpha, interpolation, and invalid levels.

### Noise and restoration — `packages/ip/src/noise.ts`

Seeded mulberry32 PRNG with Box–Muller Gaussian samples. Gaussian noise adds `amount·255·N(0,1)` per channel, salt-and-pepper sets whole pixels to 0 or 255 with probability `amount`, speckle multiplies by `1+amount·N(0,1)`, and Poisson uses Knuth sampling with `λ = value/255·20` (the amount slider is ignored). Motion and defocus PSFs are normalized and convolved with clamp-to-edge borders. Inverse and Wiener deconvolution run an FFT with inverse epsilon `1e-3`; the local Wiener denoiser uses a 5×5 window and `gain = max(0, σ²−σn²)/σ²`. Alpha is preserved. Golden covers all four noise kinds and local Wiener; tests cover determinism, PSF energy, and finite deconvolution output.

### Halftone and palette reduction — `packages/ip/src/halftone.ts`

Floyd–Steinberg diffuses the luma quantization error with the 7/16, 3/16, 5/16, 1/16 weights; ordered dithering compares luma against recursive 2/4/8 Bayer thresholds `((M+0.5)/n²)·255`. Median cut repeatedly splits the color box with the widest channel range and averages each box. k-means starts from the median-cut palette and runs 12 Lloyd iterations. Both sample at most 20,000 pixels with an integer stride and map every pixel to the nearest palette color in RGB; optional error-diffusion dithering runs during mapping. Golden covers Floyd–Steinberg, Bayer 4×4, median cut, and k-means with four colors; tests cover determinism, sample caps, and palette bounds.

## Planned (later waves)

Wavelets, segmentation, steganography, ML inference. Add the formula, reference, and test location when implemented.
