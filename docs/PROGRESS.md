# Progress

Living status log. Update after every task; keep claims verified.

| Wave | Scope | Status |
|---|---|---|
| W0 | Foundation: monorepo, shell, ingest, jobs, golden vectors, Docker, docs | Done |
| W1 | I01 fundamentals, I03 histogram/point ops | In progress |
| W2 | I04 spatial filters, I05 frequency domain | Planned |
| W3 | I09 compression, I10 quality metrics | Planned |
| W4 | I02 color spaces, I06 restoration, I07 morphology | Planned |
| W5 | I08 geometric, I11 color reduction, I12 segmentation, I13 security | Planned |
| W6 | I14 AI tools | Planned |
| W7 | I15 education layer, I17 quality of life, polish and hardening | Planned |

## Log

### 2026-11-23 — W1 in progress

- W1 plan committed (`docs/superpowers/plans/2026-11-23-w1-fundamentals.md`).
- `@negarlab/ip`: channels/histograms, negative/log/gamma, stretch/equalize, Otsu/threshold, quantization, nearest resize, histogram matching; NumPy golden fixture; 24 tests green.
- Web: demo and upload loading, canonical RGBA decode, stage canvas, bilingual errors; e2e loads zone plate.
- Web: pixel inspector with clamped 8×8 matrix, worker-side stats and channel histograms.
- Pending in W1: point-op and sampling panels, theory panel, CLAHE.

### 2026-11-23 — W0

- Workspace, Biome, i18n key check.
- `@negarlab/ip` luma/stats with golden vectors from NumPy.
- FastAPI skeleton, health, ingest/storage/TTL/EXIF, job registry with SSE and cancel.
- Web shell: bilingual RTL/LTR, light/dark tokens, health badge, worker system check, Playwright smoke.
- Docker: API + Caddy web + compose.
- Docs, license, demo image generator.
- Close-out: `pnpm check`, API pytest (15), golden reproducibility, web build, Playwright e2e, Docker build all green.
