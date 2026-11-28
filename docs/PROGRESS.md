# Progress

Living status log. Update after every task; keep claims verified.

| Wave | Scope | Status |
|---|---|---|
| W0 | Foundation: monorepo, shell, ingest, jobs, golden vectors, Docker, docs | Done |
| W1 | I01 fundamentals, I03 histogram/point ops | Done |
| W2 | I04 spatial filters, I05 frequency domain | Done |
| W3 | I09 compression, I10 quality metrics | Done |
| W4 | I02 color spaces, I06 restoration, I07 morphology, I08 geometry, I11 color reduction/halftone | Done |
| W5 | I12 segmentation, I13 security | Next |
| W6 | I14 AI tools | Planned |
| W7 | I15 education layer, I17 quality of life, polish and hardening | Planned |

## Next session

**Start here:** W5 — I12 segmentation/features and I13 multimedia security. W4 is complete on `dev`.

1. Pull, install, verify baseline: `git pull`, `pnpm install`, `pnpm check && pnpm test:api`.
2. Read the spec sections for I12/I13 (`docs/superpowers/specs/2026-11-23-negarlab-design.md` §5) and the W5 row above.
3. Write the W5 plan before coding.
4. Keep real codec subprocesses (JXL/HEIC/J2K) behind their own task; record encoders and licenses in `docs/THIRD_PARTY.md` before adding them.
5. Environment notes: `gh` is not installed (use the GitHub REST API); host port 8080 is occupied, so verify Docker on `NEGARLAB_HTTP_PORT=8081`.

## Log

### 2026-11-28 — W4

- W4 plan committed (`docs/superpowers/plans/2026-11-28-w4-color-noise-morphology-geometry-halftone.md`); scope is the full spec set I02/I06/I07/I08/I11, wider than the earlier table row.
- `@negarlab/ip`: color conversions/views, chroma subsampling, Machado colorblind simulation, gray-world/white-patch balance; morphology with custom SE masks and binary mode; inverse-mapped homography with four interpolation kernels, Gaussian/Laplacian pyramids, contact sheet, multiscale blend; seeded Gaussian/salt-pepper/speckle/Poisson noise, motion/defocus PSFs, local Wiener, FFT inverse/Wiener deconvolution; Floyd–Steinberg/Bayer halftone, median cut, sampled k-means, palette mapping and dithering; NumPy golden fixture `w4-color-noise-morphology-geometry-halftone.json`; 117 ip tests green.
- API: synchronous OpenCV NLM endpoint `POST /api/v1/denoise` with strength 1..30, RGBA PNG in/out, alpha preserved, upload and pixel limits reused; 18 API tests green.
- Web: worker RPC for all W4 operations; Color, Morphology, Geometry, Halftone, and Noise dock tabs with live previews, palette swatches, NLM busy state, bilingual theory; e2e exercises all five tabs with zero console errors.
- Close-out: `pnpm check` (117 ip + 3 web tests, i18n 246 keys), API pytest (18), ruff/mypy, golden reproducibility, golden generator pytest (7), web build, Playwright e2e green. Docker build skipped: Docker daemon was not running on the verification host.

### 2026-11-23 — W3

- W3 plan committed (`docs/superpowers/plans/2026-11-23-w3-compression-metrics.md`).
- `@negarlab/ip`: separable DCT/IDCT, zigzag, Annex K JPEG tables, 4:4:4 JPEG reconstruct with edge padding and Huffman entropy estimate, block stages; RLE, canonical Huffman, fixed 16-bit LZW, DPCM, PNG filters with adaptive choice; MSE/PSNR/SSIM map/MS-SSIM/error heatmap/compare; NumPy golden fixture; 90 tests green.
- Web: worker compression/metrics RPC; compression dock tab with quality slider, lossless table, quantization table, stage matrices, 64 basis images; metrics tab with quality slider, metrics readout, SSIM map, error heatmap, RD chart; bilingual theory; e2e exercises both tabs with zero console errors.
- Close-out: `pnpm check` (90 ip + 3 web tests, i18n 150 keys), API pytest (15), ruff/mypy, golden reproducibility, web build, Playwright e2e, `docker compose build` green.

### 2026-11-23 — W2 merged

- PR #3 merged to `main` (`65657c6`); `dev` fast-forwarded and pushed.
- W0–W2 done; all documented checks green at merge (44 ip + 3 web tests, 15 API tests, e2e, build, Docker).
- No W3 plan or code started.

### 2026-11-23 — W2

- W2 plan committed (`docs/superpowers/plans/2026-11-23-w2-spatial-frequency.md`).
- `@negarlab/ip`: convolution kernels, mean/Gaussian/sharpen/unsharp, median, bilateral, Sobel/Prewitt/Laplacian/LoG/Canny, 2D radix-2 FFT, magnitude/phase, low/high/band/notch filters; NumPy golden fixture; 44 tests green.
- Web: spatial and frequency dock tabs with live previews, spectrum view, filter controls, bilingual theory; e2e exercises spatial and frequency previews.
- Close-out: `pnpm check`, API pytest (15), ruff/mypy, web build, Playwright e2e, golden reproducibility, `docker compose build` green.

### 2026-11-23 — W1

- W1 plan committed (`docs/superpowers/plans/2026-11-23-w1-fundamentals.md`).
- `@negarlab/ip`: channels/histograms, negative/log/gamma, stretch/equalize, Otsu/threshold, quantization, nearest resize, histogram matching, CLAHE; NumPy golden fixture; 27 tests green.
- Web: demo and upload loading, canonical RGBA decode, stage canvas, bilingual errors.
- Web: worker-side stats and channel histograms; pixel inspector with clamped 8×8 matrix.
- Web: point-op and sampling panels with live worker previews, CLAHE controls, KaTeX theory panels; e2e exercises preview and reset.
- Close-out: `pnpm check` (27 ip, 3 web tests, i18n), API pytest (15), ruff/mypy, web build, Playwright e2e, golden reproducibility, `docker compose build` green.

### 2026-11-23 — W0

- Workspace, Biome, i18n key check.
- `@negarlab/ip` luma/stats with golden vectors from NumPy.
- FastAPI skeleton, health, ingest/storage/TTL/EXIF, job registry with SSE and cancel.
- Web shell: bilingual RTL/LTR, light/dark tokens, health badge, worker system check, Playwright smoke.
- Docker: API + Caddy web + compose.
- Docs, license, demo image generator.
- Close-out: `pnpm check`, API pytest (15), golden reproducibility, web build, Playwright e2e, Docker build all green.
