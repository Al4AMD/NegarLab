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

## Planned (later waves)

FFT/convolution, histograms/point ops, spatial filters, morphology, geometric transforms, JPEG pipeline, wavelets, metrics, dithering, segmentation, steganography, ML inference. Add the formula, reference, and test location when implemented.
