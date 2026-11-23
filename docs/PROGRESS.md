# Progress

Living status log. Update after every task; keep claims verified.

| Wave | Scope | Status |
|---|---|---|
| W0 | Foundation: monorepo, shell, ingest, jobs, golden vectors, Docker, docs | Done |
| W1 | I01 fundamentals, I03 histogram/point ops | Done |
| W2 | I04 spatial filters, I05 frequency domain | Done |
| W3 | I09 compression, I10 quality metrics | Planned |
| W4 | I02 color spaces, I06 restoration, I07 morphology | Planned |
| W5 | I08 geometric, I11 color reduction, I12 segmentation, I13 security | Planned |
| W6 | I14 AI tools | Planned |
| W7 | I15 education layer, I17 quality of life, polish and hardening | Planned |

## Next session

**Start here:** W3 — I09 compression and I10 quality metrics. W2 is merged and `dev` is synced with `main`.

1. Pull, install, verify baseline: `git pull`, `pnpm install`, `pnpm check && pnpm test:api`.
2. Read the spec sections for I09/I10 (`docs/superpowers/specs/2026-11-23-negarlab-design.md` §5) and the W3 row in the table above.
3. Write `docs/superpowers/plans/YYYY-MM-DD-w3-compression-metrics.md` before coding. Suggested first slice: MSE/PSNR/SSIM + maps and error heatmap (I10, pure `@negarlab/ip`), then lossless RLE/Huffman and the JPEG pipeline steps (I09).
4. Keep backend codec work (JXL/HEIC/J2K subprocesses) behind its own task; record encoders and licenses in `docs/THIRD_PARTY.md` before adding them.
5. Environment notes: `gh` is not installed (use the GitHub REST API); host port 8080 is occupied, so verify Docker on `NEGARLAB_HTTP_PORT=8081`.

## Log

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
