# NegarLab — Design Spec

- **Status:** Approved (design); implementation plan pending
- **Date:** 2026-11-23
- **Owner:** Aliakbar (sole human developer)
- **Sibling project:** AvaLab (آوالب) — the audio laboratory this project pairs with
- **Source brief:** `description.md` (Persian wishlist, 14 sections)

## 1. Purpose and audience

NegarLab (نگار = image) is a bilingual (Persian/English) web-based **image-processing
laboratory** for university teaching of *Multimedia Systems*. A student loads an image
(or generates a synthetic test image), applies an image-processing or compression
algorithm, and **sees the effect live**: pixels, histograms, spectra, kernels, JPEG
internals, real codecs, quality metrics, and lightweight AI models. Every tool is paired
with theory (formulas + short explanation) so the app is both an experiment bench and a
teaching aid.

Audience: students and instructors of the course, in class and online. The owner also
demonstrates locally on a laptop. Both source and deployment are **public, for
educational purposes** (open-source educational project). Everything committed must be
publication-ready.

## 2. Goals and non-goals

Goals, in priority order:

1. **Educational correctness** — algorithms, formulas, units, and results are right and
   verifiable.
2. **Live interactivity** — change a parameter, see the result with minimal delay.
3. **Clarity** — a student can understand *why* the result looks like that.
4. **Robustness** — arbitrary user images within limits; no freeze or crash.
5. **Completeness** — all 14 sections of the brief are in scope; nothing is cut for
   time. This is the delivery priority.

Non-goals: user accounts, social features, payments, a full photo editor, mobile-first
design (usable on tablet, desktop is the target), model training.

## 3. Inherited constraints (from AvaLab)

- Same owner, same course, same publication rules.
- Mirror AvaLab's engineering conventions where they serve images: pnpm monorepo,
  React + TypeScript + Vite shell, Tailwind + shadcn/ui, Zustand, i18next, KaTeX,
  uPlot, Web Workers, FastAPI + uv backend, Docker + Compose, docs discipline,
  golden-vector correctness, i18n/RTL rules, Definition of Done.
- **License: GPL-3.0** (same as AvaLab). No license headers until confirmed; keep
  `docs/THIRD_PARTY.md` and `docs/MODELS.md` current.
- CPU-only laptop baseline. ML models: lightweight-first, offline after one-time
  prefetch, honest "AI approximation" captions.
- Persian is the default language; English available. Full RTL.
- No hard-coded user-visible strings; `fa`/`en` key parity enforced in CI.

## 4. Architecture

### 4.1 Repository layout

```
negarlab/
├─ AGENTS.md                  # authoritative agent instructions (W0)
├─ docs/
│  ├─ PROGRESS.md             # living status log
│  ├─ DECISIONS.md            # ADR-style decisions
│  ├─ MODELS.md               # every ML model: HF id, license, size, revision
│  ├─ ALGORITHMS.md           # every hand-written algorithm: formula, reference, tests
│  ├─ THIRD_PARTY.md          # libraries, versions, licenses
│  ├─ DEPLOYMENT.md           # runbook
│  └─ plans/                  # wave plans
├─ apps/
│  ├─ web/                    # React + TS + Vite SPA
│  └─ api/                    # Python FastAPI backend
├─ packages/
│  └─ ip/                     # PURE TypeScript image-processing library (no DOM)
├─ tools/
│  ├─ golden/                 # Python reference vectors (NumPy/SciPy/scikit-image)
│  └─ demo_images/            # deterministic synthetic test-image generators
├─ docker/                    # Dockerfiles + Caddy config
├─ scripts/                   # repo tooling (i18n check, OpenAPI client)
└─ .github/                   # CI + PR template
```

### 4.2 Where each thing runs

| Concern | Runs in | Why |
|---|---|---|
| Decode any uploaded format; canonical form; limit enforcement; EXIF handling | Backend (Pillow/imageio) | Browsers do not decode every format; limits must be enforced server-side. |
| Live educational kernels: FFT, DCT/JPEG pipeline, convolution, morphology, histograms, dithering, metrics | Browser (`packages/ip` in Web Workers) | Live feedback, no server round-trip, scales for free. |
| Quick real-codec comparison: JPEG, PNG, WebP, AVIF encode/decode | Browser (`createImageBitmap` / `canvas.toBlob`) | Native platform feature; works offline. |
| Full-control real codecs: JPEG XL, HEIC, JPEG 2000, controlled JPEG/WebP sweeps | Backend (`cjxl`/`heif-enc`/`opj_compress` subprocess; Pillow/libvips) | Real encoders; we never reimplement them. |
| Heavy classical ops: NLM denoise, watershed, Hough circles, ORB/SIFT, k-means | Backend (OpenCV/scikit-image) | Not slider-live; jobs with progress. |
| ML models: super-res, depth, segmentation, OCR, neural codec, etc. | Backend (PyTorch/transformers/ONNX) | Heavy; CPU baseline. |
| Reference vectors for tests | `tools/golden` (Python) | Independent ground truth. |

Rule of thumb: **if it must react while a slider moves → browser; if it needs a real
codec, OpenCV-scale algorithm, or a neural network → backend.**

### 4.3 Hand-write vs library

Hand-write in `packages/ip` (TypeScript, golden-vector tested) — the educationally
valuable algorithms:

- 2D FFT (row-column radix-2 + Bluestein/zero-pad for non-power-of-2), fftshift,
  magnitude/phase, inverse FFT
- DCT/IDCT (8×8 and general), full JPEG pipeline: level shift, block split, DCT,
  quantization matrix with quality slider, zigzag, DC differential + RLE, Huffman
  coding, blocking-artifact view, 64 DCT basis functions
- Lossless: RLE, canonical Huffman, LZW, DPCM/predictors, PNG filters
  (none/sub/up/average/Paeth), Shannon entropy
- Histogram: stretch, equalization, CLAHE, matching, negative, log, gamma,
  threshold (Otsu + adaptive)
- Convolution (direct + FFT-based), mean/Gaussian/median/bilateral/sharpen/unsharp,
  Sobel/Prewitt/Laplacian/LoG/Canny
- Morphology (binary + grayscale): erosion, dilation, opening, closing, gradient,
  top-hat, with structuring-element editor
- Geometry: scale, rotate, affine, perspective; nearest/bilinear/bicubic/Lanczos;
  Gaussian/Laplacian pyramids; multi-scale blending
- Noise generators (Gaussian, salt & pepper, speckle, Poisson); inverse and Wiener
  deconvolution
- Color conversions (RGB/HSV/HSL/YCbCr/CMYK/CIE Lab/gray), chroma subsampling,
  colorblind simulation, white balance
- Dithering (Floyd–Steinberg, Bayer/ordered), palette reduction (median cut, k-means)
- Metrics: MSE, PSNR, SSIM (with map), MS-SSIM, compression ratio, bpp
- Wavelets: Haar and Daubechies, multi-level decomposition/reconstruction
- LSB steganography, DCT watermarking, Error Level Analysis (ELA)

Use libraries (do not hand-write):

- Decoding/encoding and codec subprocesses: Pillow, libvips, libjxl, libheif,
  OpenJPEG
- Heavy classical: OpenCV, scikit-image (watershed, Hough, ORB/SIFT, NLM,
  template matching, connected components where not hand-written)
- Reference values for tests: NumPy/SciPy/scikit-image/OpenCV in `tools/golden`
- Charts: uPlot; formulas: KaTeX
- ML: see §6

**Decision:** no OpenCV.js. Python already needs OpenCV for ML pre/post; heavy
classical ops are backend jobs (not slider-live), so an extra 8–10 MB WASM dependency
buys nothing.

### 4.4 Hybrid real-codec strategy

- Browser: JPEG/PNG/WebP/AVIF quick encode via `canvas.toBlob`; decode via
  `createImageBitmap`. Zero backend dependency; lab stays usable offline.
- Backend: JPEG XL (`cjxl`/`djxl`), HEIC (`heif-enc`/`heif-dec`), JPEG 2000
  (`opj_compress`/`opj_decompress`) as subprocesses with fixed argument arrays
  (never shell interpolation), timeouts, and server-generated filenames. For
  reproducible rate–distortion sweeps, use backend Pillow/libvips with explicit
  encoder parameters.
- Subprocess codecs keep licenses at arm's length: libjxl (BSD-3), libheif (LGPL),
  OpenJPEG (BSD-2). Record in `docs/THIRD_PARTY.md`.

### 4.5 Naming

- Product: **NegarLab** (Latin), **نگارلب** (Persian).
- Package scope `@negarlab/*`; Python package `negarlab_api`; environment prefix
  `NEGARLAB_`. Demo image provenance and licenses recorded in `docs/THIRD_PARTY.md`.

## 5. Feature catalogue

Every feature has an ID. Reference IDs in commits, PRs, and `docs/PROGRESS.md`.
Priorities: **P0** = MVP, **P1** = core, **P2** = planned, **P3** = stretch.
Runs: **B** = browser, **K** = backend, **H** = hybrid.

| ID | Feature | P | Runs |
|---|---|---|---|
| I00 | Ingest: decode limits, canonical form, downscale cap with notice, EXIF shown then stripped, bundled demo images, deterministic synthetic generators | P0 | K+B |
| I01 | Fundamentals: pixel inspector (zoom to pixel, 8×8 numeric matrix), sampling/quantization (resolution reduction, bit-depth reduction, false contouring, aliasing/moiré), channel views, image statistics (mean, variance, entropy) | P0 | B |
| I02 | Color spaces: RGB, HSV/HSL, YCbCr, CMYK, CIE Lab, grayscale, channel separation; chroma subsampling 4:4:4/4:2:2/4:2:0; colorblind simulation; white balance | P1 | B |
| I03 | Histogram and point ops: live histogram, contrast stretch, equalization, CLAHE, matching; negative, log, gamma, Otsu + adaptive threshold | P0 | B |
| I04 | Spatial filters: kernel editor with step-by-step sliding-window animation; mean, Gaussian, median, bilateral, sharpen, unsharp masking; Sobel, Prewitt, Laplacian, LoG, Canny | P0 | B |
| I05 | Frequency domain: 2D FFT magnitude/phase, fftshift, log display; LP/HP/BP filters (ideal, Butterworth, Gaussian) with ringing demo; Re/Im editing and spectrum painting; notch filter; magnitude/phase swap experiment | P0 | B |
| I06 | Noise and restoration: Gaussian, salt & pepper, speckle, Poisson noise; median, bilateral, NLM, Wiener denoise; motion/defocus blur; inverse and Wiener deconvolution | P1 | B+K |
| I07 | Morphology: erosion, dilation, opening, closing, gradient, top-hat, structuring-element editor | P1 | B |
| I08 | Geometric transforms: scale, rotate, affine, perspective; interpolation comparison (nearest, bilinear, bicubic, Lanczos); Gaussian/Laplacian pyramids; multi-scale blending | P1 | B |
| I09 | Compression (heart of the course): lossless RLE/Huffman/LZW/DPCM/PNG filters + entropy; step-by-step JPEG pipeline (8×8 blocks, DCT, quantization matrix with quality slider, zigzag, entropy coding, blocking artifacts, 64 basis functions); wavelets (Haar, Daubechies, multi-level); real codecs JPEG/PNG/WebP/AVIF/JPEG XL/HEIC; JPEG vs JPEG 2000; rate–distortion + error heatmap | P0 core, P1 rest | H |
| I10 | Quality metrics: MSE, PSNR, SSIM (map), MS-SSIM, compression ratio, bpp; rate–distortion charts; error heatmap; LPIPS (P3) | P0 | B+K |
| I11 | Color reduction and halftoning: Floyd–Steinberg and Bayer/ordered dithering; palettes via median cut and k-means; GIF simulation | P2 | B |
| I12 | Segmentation and features: k-means, watershed, region growing, connected components; Hough (lines, circles), Harris corners, template matching, ORB/SIFT | P2 | K |
| I13 | Multimedia security: LSB steganography, DCT watermarking, ELA (including its limits as a forensic tool), EXIF display | P2 | B+K |
| I14 | AI tools (lightweight HF models): super-resolution vs classical interpolation; learned denoising; background removal; interactive segmentation (SAM-lite); depth estimation; classification and detection; OCR; neural image codec vs JPEG on rate–distortion; colorization/inpainting/LPIPS (P3) | P1→P2 | K |
| I15 | Education layer: theory panels (KaTeX), guided lab sheets, share-by-URL, PNG/PDF report export | P0 skeleton, P1 content | B |
| I16 | i18n/RTL: fa (default, RTL) + en, logical CSS properties, LTR plots and Latin digits in technical readouts | P0 | B |
| I17 | Quality of life: A/B comparison slider, residual/error view, light/dark theme, keyboard shortcuts, URL-synced parameters | P1 | B |
| I18 | Pipeline builder: chain operations, per-stage views and metrics; save/load JSON | P3 | B |

## 6. AI/ML rules and shortlist

Never train. Never invent a model ID. Verify each model repo, read the card, pin a
revision, and record in `docs/MODELS.md`: task, HF id, revision, size, license (code
and weights), CPU speed, input format, limitations. If a license forbids public
educational redistribution, do not use it.

Budget: each model ≤ ~400 MB on disk; all models together ≤ ~2 GB. Offline after
`scripts/download_models.py`. Lazy-load; cache in a volume; never block the event
loop. Jobs run with progress and cancel; slow CPU jobs cap the excerpt and offer
"process whole image".

| Task | Candidate | Notes |
|---|---|---|
| Super-resolution | realesr-general-x4v3 (SRVGGNetCompact) | ~5 MB, BSD-3; compare with bilinear/bicubic/Lanczos |
| Depth estimation | Depth-Anything-V2-**Small** | Apache-2.0; Base/Large are CC-BY-NC — do not use |
| Interactive segmentation | MobileSAM (VIP-UNet) or EdgeSAM | Apache-2.0; ~35 MB encoder+decoder; prompt loop in app code |
| OCR | RapidOCR (PP-OCRv4 mobile) | ONNX-native; English demo images by default; Persian only with owner approval |
| Background removal | U2Netp | ~5 MB, Apache-2.0; avoid non-commercial weights |
| Learned denoising | DnCNN/FFDNet small | Verify license; optional, P2 |
| Classification | MobileNetV3 (torchvision) | BSD-3, small |
| Detection | SSDLite-MobileNetV3 or YOLOX | Verify license; avoid AGPL weights |
| Neural image codec | CompressAI (bmshj2018-factorized, cheng2020) | Native Python; verify license; entropy coding is Python-side and that is fine here |
| Perceptual metric | LPIPS small | P3; verify weights license |

## 7. Frontend design direction

### 7.1 Concept — "a light table in a darkroom"

The subject's own world: darkrooms, negative film, loupes, calibration charts,
optical benches. The workspace is a dark, quiet room; images sit on a luminous,
warm-white **light table**. Chrome is ink and graphite; the image stage is the one
bright surface. This gives NegarLab its own identity as AvaLab's sibling, not a clone.

Deliberately avoided defaults: cream-page + serif + terracotta; near-black + acid
accent; broadsheet hairlines. The light-table surface is warm paper, but the page is
dark, so it is a stage material, not a generic background.

### 7.2 Tokens (initial; refined in W0)

Color (dark theme default):

- `ink` `#14161A` — page background
- `graphite` `#1E2227` — panels, raised surfaces
- `light-table` `#F1EBDD` — image stage surface
- `safelight` `#E09A3E` — primary accent: active module, loupe ring, primary actions
- `signal` `#63B3A6` — data accent: plot series, secondary selection
- `chalk` `#E8E5DE` — primary text; `slate` `#9AA0A6` — muted text
- Light theme: `daylight` `#F5F4F0` page, `ink` text, same accents.

Type roles (all OFL, self-hosted):

- Display (Latin): **Space Grotesk** — lab labels, section titles, restrained.
- Body (Latin): **IBM Plex Sans**; utility/data: **IBM Plex Mono** for numbers,
  matrices, units.
- Persian: **Vazirmatn** for all fa roles; sizes tuned for Persian metrics.
- Type scale ≈ 1.25; captions 12, body 14–16, section 20, display 28–40.

Layout: persistent instrument bench (see wireframe). Spacing on a 4 px base with
generous stage margins. No decorative numbering; module numbering is real (order of
the course) and carries completion state.

```
┌──────────────────────────────────────────────────────────────────┐
│ NegarLab   [fa|en] [theme]                 demo image ▾   ⌘K     │
├──────────┬──────────────────────────────────────┬───────────────┤
│ modules  │                                      │ parameters    │
│ I00 ›    │          light-table stage           │ ┌───────────┐ │
│ I01 ✓    │                                      │ │ slider    │ │
│ I02 ✓    │          image + loupe               │ │ slider    │ │
│ …        │                                      │ └───────────┘ │
│ I14      │          before ◀ | ▶ after          │ tabs: Theory  │
│          │                                      │       Data    │
├──────────┴──────────────────────────────────────┴───────────────┤
│ transport: demo ▾   zoom 100%   1024 px cap   ·  history strip   │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 Signature — the loupe

One memorable element, everything around it quiet: a **draggable optical loupe** that
magnifies to pixel level and shows the 8×8 pixel matrix in its rim. The same ring
doubles as the before/after divider: drag it across the stage to compare original and
processed. It is the pixel inspector, the A/B slider, and the visual identity in one.
Optional first-load moment: the image "develops" on the light table (short, ≤600 ms,
once, disabled under reduced motion).

### 7.4 Motion, SVG, Lottie

- Micro-interactions: 120–200 ms, ease-out, transform/opacity only. No animated
  filters/blur on large canvases.
- Orchestrated motion: module switching with shared-element transition of the stage;
  step-through players (play/pause/step/speed 0.5–4×) for sliding kernel window,
  JPEG block pipeline, zigzag, Huffman tree, error diffusion, morphological probe.
  These are educational controls, not decoration.
- SVG: custom 24 px icon set and diagram primitives, hand-built, usable static;
  animate with CSS/WAAPI for control.
- Lottie: empty states, loading, and phase-complete moments only;
  `@lottiefiles/dotlottie-react`; lazy-loaded; ≤100 KB per file; final frame shown
  under reduced motion.
- Motion library: CSS + WAAPI first; `motion` (React) only where shared-layout or
  orchestration genuinely needs it, recorded in `docs/DECISIONS.md`.
- Respect `prefers-reduced-motion`, keyboard focus, contrast, and colorblind-safe
  plot palettes. Never convey information by color alone.

### 7.5 Copy and voice

Plain verbs, sentence case, units always (px, dB, bpp, bit, ms). Persian is standard
academic Persian; first use of a technical term shows «فارسی (English)». Errors say
what happened and how to recover; empty states invite the next action.

## 8. Correctness and testing

- `packages/ip`: pure, deterministic, DOM-free TypeScript. Public shape
  `(input, params) => result` with explicit result types; no mutation; Float64
  internally where precision matters.
- Every algorithm has tests against **golden vectors** produced by `tools/golden`
  (NumPy/SciPy/scikit-image/OpenCV), with documented tolerances. Plus property tests:
  FFT∘IFFT = identity, Parseval, convolution theorem, morphological duality, lossless
  codec bit-exact round-trip, JPEG pipeline shape/energy sanity, SSIM bounds.
- Every algorithm documented in `docs/ALGORITHMS.md` (formula, reference, complexity,
  edge cases).
- UI: at least one Playwright smoke test per tool: load a demo image, run, assert no
  console errors. E2E runs on phase PRs to `main`.
- Backend: pytest; ML tests skipped unless `NEGARLAB_RUN_ML_TESTS=1`; ruff + mypy.
- Never claim "tests pass" without running them in the session.

## 9. Performance and robustness budgets

- Live tools operate on a capped working image: longest side ≤ **2048 px** by
  default (settings may lower to 1024). Ingest downscales above the cap with a clear
  notice; "process full resolution" is an explicit background job.
- No DSP on the main thread: all kernels run in Web Workers; transferable buffers;
  release full-length buffers; tiled pyramid for zoom/pixel inspector.
- Targets (mid-range laptop, 1024 px working image): parameter change → preview
  < 300 ms where mathematically possible; 2D FFT/DCT overview < 1 s; full-res jobs
  show progress + cancel.
- No spinner without an exit; every long operation has progress, cancel, error.
- Graceful degradation: corrupted image, unsupported codec, backend offline → clear
  bilingual message; browser-only tools keep working offline.
- Accessibility: keyboard operable, visible focus, ARIA labels translated, contrast,
  reduced motion, colorblind-safe palettes.

## 10. Privacy, security, openness

- Uploads are untrusted. Probe real format (not extension), enforce size/duration/
  pixel limits before heavy work, sanitize filenames, store under server-generated
  IDs, TTL auto-delete (default 60 min) + explicit delete. No logging of image
  content or filenames. No accounts, no identifying analytics. State this in the UI.
- EXIF: display for the forensics lesson, then strip on ingest by default.
- Codec subprocesses: fixed argument arrays, timeouts, resource limits, never shell
  interpolation.
- Public, publication-ready commits: no secrets, no personal paths, no copyrighted
  images. Demo images: synthetic generators + Kodak PhotoCD (public domain) / CC0.
  **Never Lena.** Theory text original; cite textbooks by reference only.
- License GPL-3.0; `docs/THIRD_PARTY.md` and `docs/MODELS.md` current. Copyleft care:
  codec binaries invoked as subprocesses, not linked.

## 11. Git, CI, and delivery process

### 11.1 Branches and commits

- `main` — stable, always green, merged only from `dev` via phase PRs.
- `dev` — all work happens here. Never commit directly to `main` (branch protection
  set in GitHub settings: require PR, require CI, no force-push).
- Conventional Commits with feature ID: `feat(I05): add radix-2 2D FFT with golden
  tests`, `fix(I09): correct zigzag order`, `docs: ...`, `ci: ...`, `chore(I00): ...`.
- Small, vertical commits; one concern each. No generated build output, model
  weights, or `.env`.
- Initial seed commit on `main` (project brief + gitignore) establishes the PR base;
  all subsequent work is committed on `dev`.

### 11.2 CI (`.github/workflows/ci.yml`)

Triggers: push to `dev`/`main`, pull requests to `dev`/`main`, manual dispatch.
A `changes` job uses path filters so jobs run only for affected areas (keeps the
bootstrap commit green and docs-only pushes cheap). Jobs:

| Job | Runs | Checks |
|---|---|---|
| `web` | when web/ip/tooling paths change | pnpm install (frozen lockfile), `pnpm check` (Biome lint/format, TS typecheck, Vitest, i18n key parity), web production build |
| `api` | when `apps/api` changes | uv sync (locked), ruff, mypy, pytest (ML tests self-skip unless env flag) |
| `golden` | when `tools/golden` or `packages/ip/test-data` changes | uv sync, pytest |
| `e2e` | phase PRs to `main` and manual dispatch | Playwright chromium smoke against the built web app; report uploaded on failure |

- Node 22, pnpm 11.21.0 (Corepack/pnpm action), Python 3.12 via uv.
- Concurrency cancels superseded runs; `permissions: contents: read`; job timeouts.
- CI does not install ML extras or download models; model checks live behind the
  env-gated tests.
- Hardening before public launch: pin all third-party actions by commit SHA (record
  in `docs/DECISIONS.md`).

### 11.3 Definition of Done (every task)

- Works in fa (RTL) and en (LTR).
- All checks pass: `pnpm check`, API `pytest` + ruff + mypy when touched; actually run.
- New algorithms in `docs/ALGORITHMS.md` with golden/property tests.
- Theory panel exists for new tools (fa + en; fa flagged for owner review).
- Performance budgets respected; no main-thread DSP.
- No console errors/warnings for the exercised flow.
- `docs/PROGRESS.md` updated; open items recorded.

### 11.4 Phase PRs

At the end of each wave W0–W7, push `dev` and open a PR to `main` titled
`W0 — Foundation` (wave number + name), body using the PR template: wave scope,
feature IDs completed, completeness/deviations table, verification evidence (CI,
local checks), known issues, next wave. Merge with a merge commit to preserve
history. Do not merge with failing checks.

## 12. Delivery waves (completeness-first)

| Wave | Scope |
|---|---|
| W0 Foundation | Monorepo, tooling, CI, i18n/RTL shell, design tokens + bench layout, `packages/ip` skeleton + golden pipeline, `apps/api` skeleton + ingest + job manager/SSE, docker, docs set, demo image generators |
| W1 Fundamentals + point ops | I00, I01, I03 |
| W2 Spatial + frequency | I04, I05 |
| W3 Compression core + metrics | I09 (lossless + JPEG pipeline), I10 |
| W4 Color, noise, morphology, geometry, halftone | I02, I06, I07, I08, I11 |
| W5 Real codecs, wavelets, security, segmentation | I09 (real codecs + wavelets), I12, I13 |
| W6 AI tools | I14 (incl. neural codec vs JPEG on RD) |
| W7 Education content, QoL, pipeline, polish, release | I15 content, I17, I18, Persian review, perf/a11y pass, report + slides, deploy |

Nothing is cut for time. P3 items land last. If a wave reveals hidden complexity, say
so and re-plan; do not silently drop scope.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| 14-section scope is large for one month | Waves are order, not cuts; P0 first; owner prioritizes completeness; P3 last |
| Browser memory at high resolution | Hard working cap (1024–2048 px), tiling, background jobs for full-res |
| Canvas codec params are implementation-dependent | Backend Pillow/libvips for controlled RD sweeps; canvas for quick comparison |
| ML license traps (CC-BY-NC, AGPL) | Verify per model, record in MODELS.md, avoid non-permissive weights |
| Persian content quality | Native-review flag in PROGRESS.md; owner reviews fa copy |
| Lottie bloat | Size budget, lazy load, reduced-motion final frame |
| Backend offline during demo | All core tools browser-side; backend features disabled with explanation |
| Single-owner bus factor | AGENTS.md, plans, PROGRESS.md discipline; everything documented |

## 14. Open questions

1. Hosting target (university server vs cloud) and GPU availability — decides ML
   defaults; CPU + offline must always work.
2. Instructor deliverable template (report/slides) — defaults to AvaLab's pipeline
   until specified.
3. CompressAI license confirmation for chosen pretrained weights.
4. Final Lottie library choice (DotLottie first; fall back to lottie-web).
5. Whether NegarLab adopts AvaLab design tokens wholesale or keeps a shared
   spacing/type scale only (current direction: shared scale, distinct palette).
