# NegarLab W0 — Foundation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the working NegarLab skeleton — monorepo tooling, `@negarlab/ip` golden-tested TS core, FastAPI API with ingest/TTL/jobs/SSE, bilingual web shell, Docker stack, and project docs — all green in CI, merged to `main` via PR at wave end.

**Architecture:** pnpm workspace (`apps/web`, `packages/ip`, `apps/api`, `tools/*`). Browser contract is canonical RGBA PNG produced by the API. `@negarlab/ip` runs in Web Workers via Comlink; fast algorithms TS, heavy/lossy/ML Python `negarlab_api` under `/api/v1`. Golden vectors generated in Python define the TS library's definition of correct.

**Tech Stack:** Node 22 + pnpm 11, TypeScript strict, Vite + React 19, Tailwind v4, biome, Vitest, Playwright; Python 3.12 + uv, FastAPI, Pillow, NumPy; Docker Compose + Caddy; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-23-negarlab-design.md`

## Global Constraints

- Feature IDs `I00`–`I14`; W0 = foundation only. No module math beyond system check.
- Uploads ≤ 25 MiB, ≤ 64 MP, working cap 2048 px, TTL 60 min, canonical RGBA PNG.
- API JSON snake_case; errors `{ "error": { "code", "message" } }`; routes under `/api/v1`.
- Persian is default locale (`fa`, RTL); English (`en`, LTR); no hardcoded user-visible strings; `node scripts/i18n-check.mjs` fails on key drift.
- `Plane` values are floats 0..1; `RgbaImage` is `Uint8ClampedArray` RGBA; luma = BT.601.
- Never commit model weights or user images. License GPL-3.0 (copy text from AvaLab).
- Conventional Commits on `dev`; one commit per plan task; push `dev` and open PR `dev`→`main` at wave end.
- No new dependency without a line in `docs/THIRD_PARTY.md`.

## Review Focus (whole wave)

1. A `.png` that is actually a text file must return `unsupported_format`, not 500.
2. A >64 MP declared header must return `image_too_large` without allocating full bitmap.
3. EXIF GPS coordinates never appear in API responses; `gps_present` boolean only.
4. Adding a string to only one locale must make `pnpm i18n:check` exit 1.
5. Expired image TTL must yield 404 `image_not_found`; job cancel must emit terminal `done`.

---

### Task 1: Root workspace, tooling, i18n check

**Files**
- Create: `package.json`, `pnpm-workspace.yaml`, `biome.json`, `tsconfig.base.json`
- Create: `scripts/i18n-check.mjs`, `scripts/i18n-check.test.mjs`
- Generate/commit: `pnpm-lock.yaml`

**Interfaces**
- Produces npm scripts consumed by CI and all later tasks: `check`, `lint`, `format`, `typecheck`, `test`, `i18n:check`, `e2e`, `gen:golden`, `gen:demo`, `dev:web`, `dev:api`, `test:api`.

- [ ] Write root `package.json`: private, `engines.node >=22.22.0`, `packageManager pnpm@11.21.0`, scripts above (`check` = lint → typecheck → test → i18n:check; `test` = recursive package tests + `node --test "scripts/**/*.test.mjs"`).
- [ ] Write `pnpm-workspace.yaml` (`packages: ['apps/*', 'packages/*']`), `biome.json` (2-space, width 100, ignore `**/dist`, `packages/ip/test-data`, `docs/**`, `**/playwright-report`), `tsconfig.base.json` (ES2022, strict, `noUncheckedIndexedAccess`, bundler resolution).
- [ ] Write `scripts/i18n-check.mjs`: read `NEGARLAB_I18N_DIR` or `apps/web/src/i18n/locales`; flatten `fa/*.json` and `en/*.json` by dot key; print missing/unused per locale; exit 1 on drift; exit 0 with notice when directory absent.
- [ ] Write `scripts/i18n-check.test.mjs` with `node:test`: matching fixture exits 0; fixture with one missing key exits 1. Use `mkdtemp` + `spawnSync(process.execPath, [script], { env })`.
- [ ] Run `pnpm add -D -w @biomejs/biome` then `pnpm check` (expected: pass; no packages yet). Commit: `chore: set up pnpm workspace, biome, and i18n key check`.

**Verify:** `pnpm check` exits 0; `pnpm i18n:check` prints absence notice.

---

### Task 2: `@negarlab/ip` core — types, luma, stats

**Files**
- Create: `packages/ip/package.json`, `packages/ip/tsconfig.json`
- Create: `packages/ip/src/types.ts`, `src/luma.ts`, `src/stats.ts`, `src/index.ts`
- Create: `packages/ip/test/luma.test.ts`, `test/stats.test.ts`

**Interfaces (stable — later waves depend on these)**
```ts
interface RgbaImage { width: number; height: number; data: Uint8ClampedArray }
interface Plane { width: number; height: number; data: Float32Array }
function rgbaToLuma(img: RgbaImage): Plane            // 0.299R+0.587G+0.114B, /255
interface ImageStats { mean: number; variance: number; entropyBits: number }
function planeStats(plane: Plane): ImageStats          // entropy from 256-bin histogram, log2
```
- [ ] Write package (`@negarlab/ip`, ESM, exports `.`, scripts `typecheck: tsc --noEmit`, `test: vitest run`, deps none, devDeps typescript/vitest).
- [ ] Write failing tests first: luma of red/green/blue pixels = 0.299/0.587/0.114 (±1e-6); half-black half-white plane → mean 0.5, variance 0.25, entropy 1.0; constant plane → variance 0, entropy 0; empty plane (0 px) → all zeros.
- [ ] Implement `rgbaToLuma`, `planeStats` (population variance; bin = `min(255, floor(v*255))`; entropy in bits) and barrel `index.ts`.
- [ ] `pnpm install`; run `pnpm --filter @negarlab/ip test` and `typecheck`. Commit: `feat(ip): add luma conversion and plane statistics`.

**Verify:** tests pass; coverage of edge cases above.

---

### Task 3: Golden vectors (Python → committed JSON → TS test)

**Files**
- Create: `tools/golden/pyproject.toml`, `tools/golden/negarlab_golden/__init__.py`, `generate.py`
- Create: `tools/golden/tests/test_generate.py`
- Create: `packages/ip/test-data/golden/luma-stats.json` (generated, committed)
- Create: `packages/ip/test/golden.test.ts`

**Interfaces**
- JSON: `{ "input": { "width", "height", "rgba": number[] }, "expected": { "luma": number[], "stats": { mean, variance, entropyBits } }, "tolerance": 1e-6, "source": string }`.
- Input pattern (deterministic): for each pixel `x,y`: `r=(x*37+y*11)%256`, `g=(x*17+y*53)%256`, `b=(x*97+y*7)%256`, `a=255` except `(0,0)` alpha 128; 8×8.

- [ ] Write `pyproject.toml` (name `negarlab-golden`, requires-python ≥3.11, deps numpy, pillow; dev pytest), generator CLI `python -m negarlab_golden generate --out <path>` computing expected luma/stats with NumPy float64 (same formulas; alpha ignored).
- [ ] Write determinism test: generate twice into `tmp_path`, bytes equal.
- [ ] `uv sync --directory tools/golden`; `pnpm gen:golden`; commit JSON. Write `golden.test.ts` comparing TS output with tolerance 1e-6 and exact dimensions.
- [ ] Run `pnpm --filter @negarlab/ip test`. Commit: `test(ip): add golden luma and stats vectors from numpy`.

**Verify:** `uv run --directory tools/golden pytest -q` and ip tests pass; JSON stable across regeneration.

---

### Task 4: API skeleton — config, app factory, health

**Files**
- Create: `apps/api/pyproject.toml`, `apps/api/uv.lock` (generated)
- Create: `apps/api/src/negarlab_api/__init__.py`, `config.py`, `main.py`, `api/__init__.py`, `api/routes/__init__.py`, `api/routes/health.py`
- Create: `apps/api/tests/test_health.py`

**Interfaces**
```python
class Settings(BaseSettings):            # env prefix NEGARLAB_
    upload_max_bytes: int = 25 * 1024 * 1024
    image_max_pixels: int = 64_000_000
    working_cap_px: int = 2048
    ttl_minutes: int = 60
    storage_dir: Path                    # default tempfile.gettempdir()/negarlab
    cors_origins: list[str] = ["http://localhost:5173"]
    job_max_concurrency: int = 2
    job_step_delay_ms: int = 50
def create_app(settings: Settings | None = None) -> FastAPI
```
- [ ] Write `pyproject.toml`: `negarlab-api`, requires-python ≥3.11, deps fastapi, uvicorn[standard], pillow, numpy, pydantic-settings; dev deps pytest, pytest-asyncio, httpx, ruff, mypy; ruff line-length 100 + rules (`E,F,I,UP,B,SIM`), mypy strict-ish.
- [ ] Implement `Settings` (cached default via `lru_cache`), `create_app` (CORS from settings, routers mounted at `/api/v1`), health route returning `{ "status": "ok" }`.
- [ ] Test with `httpx.AsyncClient(transport=ASGITransport(app=create_app()))`: `GET /api/v1/health` → 200 `{"status": "ok"}`.
- [ ] `uv lock --directory apps/api && uv sync --directory apps/api`; `pnpm test:api`; lint/typecheck commands (`uv run --directory apps/api ruff check src tests`, `mypy src`). Commit: `feat(api): bootstrap FastAPI app with health endpoint and settings`.

**Verify:** health test passes; ruff/mypy clean.

---

### Task 5: Ingest, storage, TTL, EXIF

**Files**
- Create: `apps/api/src/negarlab_api/errors.py`, `storage.py`, `imaging.py`
- Create: `apps/api/src/negarlab_api/api/routes/images.py`
- Create: `apps/api/tests/test_ingest.py`, `apps/api/tests/test_storage_ttl.py`
- Modify: `main.py` (exception handlers, lifespan sweeper), `pyproject.toml` (nothing new)

**Interfaces**
```python
class ApiError(Exception): code: str; status: int; message: str
class Storage:
    def save(self, png: bytes, meta: dict) -> dict      # adds id, created_at
    def get(self, image_id: str) -> tuple[dict, bytes] | None
    def delete(self, image_id: str) -> bool
    def delete_expired(self, now: datetime | None = None) -> int
def summarize_exif(exif: Image.Exif) -> dict            # Make, Model, DateTime, ExposureTime, FNumber, ISO, FocalLength, gps_present
POST /api/v1/ingest (file) -> 201 { image_id, width, height, original_width, original_height, downscaled, source_format, exif }
GET /api/v1/images/{id} -> image/png | 404 image_not_found
DELETE /api/v1/images/{id} -> 204
```
- [ ] Write failing tests: text-as-PNG → 415 `unsupported_format`; JPEG 20×20 with `image_max_pixels=100` → 413 `image_too_large`; 20×20 with `working_cap_px=8` → `downscaled=true`, width 8; EXIF Make/DateTime returned and `gps_present=False`; roundtrip GET bytes decode to RGBA PNG; DELETE then GET 404.
- [ ] Implement errors + JSON handler; storage (uuid4 hex, `<dir>/{id}.png`, sidecar meta in memory, graceful missing-file delete); imaging: size guard while reading chunks, Pillow header pixel check before `load`, exif summary, `convert("RGBA")`, LANCZOS downscale > cap, PNG save; routes with `Response(media_type="image/png")`.
- [ ] Implement TTL: interval sweeper task in lifespan (every 60 s or ttl/2, min 1 s) calling `delete_expired`; storage unit test with manually aged `created_at` → deleted and GET 404.
- [ ] Run `pnpm test:api`, ruff, mypy. Commit: `feat(api): add image ingest, storage, ttl, and exif handling`.

**Verify:** review-focus items 1–3 covered by named tests.

---

### Task 6: Job manager, SSE progress, cancel

**Files**
- Create: `apps/api/src/negarlab_api/jobs.py`, `api/routes/jobs.py`
- Create: `apps/api/tests/test_jobs.py`

**Interfaces**
```python
class JobRegistry:
    async def submit(self, task: str, params: dict) -> str     # 422 unknown_task
    async def cancel(self, job_id: str) -> bool                # False if unknown/finished
    def get(self, job_id: str) -> dict | None                  # id, task, status, progress, message
def sse_events(registry, job_id) -> AsyncIterator[str]         # "event: progress|done\ndata: {...}\n\n"
POST /api/v1/jobs { task: "progress-demo", params: { steps: 1..20 } } -> 202 { job_id }
GET  /api/v1/jobs/{id} -> snapshot | 404 job_not_found
GET  /api/v1/jobs/{id}/events -> text/event-stream, ends after done
DELETE /api/v1/jobs/{id} -> { status: "cancelled" } | 404
```
- [ ] Write tests: submit demo job, stream events to completion (progress ends 100, `event: done`); unknown task → 422; unknown job → 404; cancel mid-run → terminal status `cancelled`.
- [ ] Implement registry (asyncio tasks, semaphore from settings, per-job `asyncio.Event`, in-memory dict, demo task loop honoring cancel and `job_step_delay_ms`), router, SSE `StreamingResponse` with no-cache headers.
- [ ] `pnpm test:api`, ruff, mypy. Commit: `feat(api): add job registry with sse progress and cancel`.

**Verify:** streaming test terminates; cancel event delivered.

---

### Task 7: Web shell — Vite, Tailwind tokens, fonts, i18n, layout

**Files**
- Create: `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`
- Create: `src/styles/globals.css`
- Create: `src/i18n/index.ts`, `src/i18n/locales/fa/common.json`, `src/i18n/locales/en/common.json`
- Create: `src/components/{AppShell,Header,ModuleRail,Stage,ParameterDock,TransportBar,Icons,ThemeToggle,LanguageToggle}.tsx`
- Create: `src/lib/theme.ts`, `src/lib/health.ts`
- Create: `src/lib/sessionStore.ts`, `src/lib/sessionStore.test.ts`

**Interfaces**
- Stores: theme (`dark|light`, `<html data-theme>`, localStorage `negarlab-theme`), language (`fa|en`, `<html lang dir>`, localStorage `negarlab-lang`; i18next + react-i18next).
- `useHealth(): { status: "online" | "offline" | "checking" }` polls `GET /api/v1/health` every 30 s with 3 s abort; non-JSON/error → offline.
- `sessionStore` (zustand): `{ source: SourceImage | null, setSource, clear, cacheKey(inputId, params) }`; `cacheKey` = stable sorted-JSON param hash; tests assert order-independent equality.
- Layout: header (brand, HealthBadge, LanguageToggle, ThemeToggle), right rail 14 module placeholder buttons (IDs I01–I14), stage empty state, right param dock placeholder, bottom transport with System check action.
- Tokens: ink/graphite/surface/paper/safelight/signal/chalk/slate; fonts Space Grotesk, IBM Plex Sans/Mono, Vazirmatn (fontsource); logical spacing utilities; no gradients.

- [ ] Scaffold package and install: React, react-dom, zustand, i18next, react-i18next, @negarlab/ip (workspace), fonts; dev: vite, @vitejs/plugin-react, typescript, tailwindcss, @tailwindcss/vite, vitest, jsdom, @testing-library/react if needed (prefer plain store tests).
- [ ] Write i18n catalogs (all keys for items above; fa default) + i18n init; language toggle updates `dir`; persist.
- [ ] Write globals.css with `@import "tailwindcss"`, `@theme inline` tokens, dark/light vars, focus-visible ring 2px safelight, reduced-motion media rule, `.numeric` mono LTR.
- [ ] Implement components/layout; run `pnpm --filter @negarlab/web typecheck` and `pnpm i18n:check`. Commit: `feat(web): add bilingual shell with design tokens and health badge`.

**Verify:** `pnpm build` passes; no hardcoded visible strings (`grep -n '>[A-Za-z]' src/components` spot check).

---

### Task 8: Worker vertical slice + Playwright smoke

**Files**
- Create: `apps/web/src/workers/ip.worker.ts`, `src/lib/ipClient.ts`, `src/components/SystemCheck.tsx`, `src/lib/testImage.ts`
- Create: `apps/web/vitest.config.ts` (or config in vite), `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `TransportBar.tsx` (wire System check), `package.json` (`test`, `e2e`)

**Interfaces**
- `createIpWorker(): { lumaAndStats(img: RgbaImage): Promise<ConversionsResult> }` over Comlink; result `{ mean, variance, entropyBits }` formatted to 4 decimals in `dir="ltr"` spans.
- `generateTestImage(): RgbaImage` = same deterministic 8×8 pattern as golden generator. System check asserts expected mean≈128.xx and entropy>0 (values from golden fixture or computed constants committed).
- E2E checks: page loads with fa/rtl; module I01 exists; language toggle → `lang=en`, `dir=ltr`; theme toggle sets `data-theme`; system check shows finite stats; zero `console.error`/`pageerror`.

- [ ] Implement worker (`Comlink.expose` calling `@negarlab/ip`), client, test image, SystemCheck with idle/running/result/error states (fa/en strings).
- [ ] Write Playwright config with `webServer` `pnpm preview --port 4173 --strictPort`; smoke spec with collectors for console errors.
- [ ] Add `pnpm --filter @negarlab/web exec playwright install chromium` locally; run `pnpm build`, `pnpm e2e`.
- [ ] Commit: `feat(web): wire worker system check and add e2e smoke`.

**Verify:** smoke passes in Chromium; stats finite; no console errors.

---

### Task 9: Docker + compose + Caddy

**Files**
- Create: `docker/api.Dockerfile`, `docker/web.Dockerfile`, `docker/Caddyfile`, `compose.yaml`, `.dockerignore`, `.env.example`

**Interfaces**
- `compose up` serves web on `${NEGARLAB_HTTP_PORT:-8080}`, proxies `/api/*` (SSE needs `flush_interval -1`) to `api:8000`, API storage volume `negarlab-data:/data` with `NEGARLAB_STORAGE_DIR=/data`.

- [ ] Write API image (python:3.12-slim, uv from official image copy, `uv sync --frozen --no-dev`, non-root, healthcheck via urllib) and web image (node:22-slim build with `pnpm --filter @negarlab/web build`, caddy runtime).
- [ ] Write Caddyfile (SPA fallback + API reverse proxy), compose (healthchecks, depends_on, restart unless-stopped), `.env.example` (port, TTL, upload limit).
- [ ] Run `docker compose build`; if it passes, `docker compose up -d`, curl health through Caddy and direct, then `docker compose down`. Commit: `chore: add docker compose stack with caddy`.

**Verify:** health via `http://localhost:8080/api/v1/health`; SSE proxy config present.

---

### Task 10: Docs, license, demo images, AGENTS.md

**Files**
- Create: `LICENSE` (GPL-3.0 text copied from AvaLab), `README.md`, `AGENTS.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/ALGORITHMS.md`, `docs/MODELS.md`, `docs/THIRD_PARTY.md`, `docs/DEPLOYMENT.md`, `docs/plans/README.md`
- Create: `tools/demo_images/pyproject.toml`, `generate.py`, `tests/test_generate.py`
- Create: `apps/web/public/demo/{zone-plate,gray-ramp,resolution-wedge}.png`, `color-checker.png` (generated, committed)

**Interfaces**
- Demo generator deterministic (fixed NumPy seeds), outputs listed above, 512×512 RGB/RGBA PNGs; test renders twice to tmp and compares bytes.
- `PROGRESS.md`: wave table W0–W7 with statuses; W0 marked done at close-out.
- `DECISIONS.md`: D1 stack mirror, D2 Rust rejected, D3 no OpenCV.js, D4 hybrid codecs, D5 GPL-3.0, D6 canonical RGBA PNG, D7 synthetic/CC0 demo images (never Lena), D8 Tailwind v4, D9 Comlink, D10 model policy deferral.
- `MODELS.md`: rules (≤400 MB/model, ≤2 GB total, license verified, CPU/offline, `NEGARLAB_RUN_ML_TESTS`).

- [ ] Copy GPL text, write README (bilingual intro, prerequisites, dev/checks/docker), AGENTS.md adapted from AvaLab with NegarLab feature catalogue and rules, remaining docs (concise, durable).
- [ ] Implement demo generator + test; `pnpm gen:demo`; commit PNGs.
- [ ] Verify docs links point to existing files. Commit per logical group: `docs: add project documentation set` and `feat(tools): add deterministic demo image generator`.

**Verify:** `pnpm gen:demo` reproducible; README commands actually run.

---

### Task 11: W0 close-out — full checks, push, PR

- [ ] Run all: `pnpm check`, `pnpm test:api`, `pnpm gen:golden && git diff --exit-code packages/ip/test-data/golden`, `pnpm --filter @negarlab/web build`, `pnpm e2e`, `docker compose build` (or record why skipped).
- [ ] Update `PROGRESS.md` (W0 done; W1 next) and commit `chore: close out wave 0`.
- [ ] `git push -u origin dev`; `gh pr create --base main --head dev --title "W0 — Foundation" --body-file <template-based body>`; return PR URL.
- [ ] Confirm CI green on PR; merge only when owner approves.

**Verify:** CI all jobs green; PR references spec and this plan; no secrets or env files tracked.
