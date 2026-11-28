# Decisions

Architecture decision records. Append new decisions; do not rewrite history. Any deviation from the spec belongs here.

## D1 — Mirror the AvaLab stack

Use the proven AvaLab architecture: pnpm monorepo, React/Vite shell, TS `packages/ip` in Web Workers, Python FastAPI + uv backend, NumPy golden vectors. Rationale: one maintainer, known tooling, students can run it offline. Consequence: image-processing algorithms are split between TS (interactive) and Python (codecs, ML).

## D2 — Rust rejected

A Rust core was evaluated and rejected. Rationale: WASM build/toolchain cost, duplicate implementations, no clear teaching benefit for this course. Consequence: stay with TypeScript + Python.

## D3 — No OpenCV.js

Do not ship OpenCV.js. Rationale: 8–10 MB WASM bundle, opaque errors, duplicated API surface. Use hand-written TS for pedagogy and Python OpenCV/scikit-image on the backend when needed.

## D4 — Hybrid codec strategy

Browser-native JPEG/PNG/WebP/AVIF via canvas; backend subprocesses for JPEG XL, HEIC, JPEG 2000. Rationale: browsers cannot encode those formats, but native codecs avoid unnecessary round-trips.

## D5 — GPL-3.0

Project license is GPL-3.0, matching AvaLab. Third-party licenses must be compatible and recorded in `docs/THIRD_PARTY.md`.

## D6 — Canonical ingest form

Every upload is decoded on the backend to RGBA PNG, working copy capped at 2048 px longest side (notice returned), original dimensions preserved in metadata. EXIF is summarized from an allowlist and stripped; GPS only as a boolean. Rationale: one predictable format for all browser tools, privacy by default.

## D7 — Synthetic/CC0 demo images only

Never commit Lena or other copyrighted test images. Generate deterministic synthetic images with `pnpm gen:demo`; any third-party image must be CC0 and documented.

## D8 — Tailwind CSS v4

Use Tailwind v4 with the Vite plugin and CSS-first theme tokens. Rationale: current stable, smaller config surface.

## D9 — Comlink for workers

Use Comlink to expose `packages/ip` from a module worker. Rationale: typed RPC with minimal boilerplate; replaceable later if transfer-heavy streaming needs a custom protocol.

## D10 — Model policy deferred to W6

No ML model ships before W6. Then: prefer ONNX/CPU, ≤400 MB per model, ≤2 GB total, licenses verified (code and weights), offline prefetch, lazy load, progress/cancel jobs, tests gated by `NEGARLAB_RUN_ML_TESTS=1`.

## D11 — JPEG teaching pipeline is 4:4:4 with estimated entropy

The W3 JPEG lab converts to BT.601 YCbCr at full resolution (4:4:4), pads partial 8×8 blocks by edge replication, and reports an entropy estimate (DC differential and AC run/size symbols, separate canonical Huffman tables, no headers) rather than a standards-compliant bitstream. Rationale: keeps the DCT/quantization lesson exact and testable without shipping an encoder; chroma subsampling belongs with color spaces (I02/W4). Consequence: `encodedBytes`, `bpp`, and `ratio` are comparative estimates; the compression theory note says the entropy size excludes headers.

## D12 — LZW uses fixed 16-bit codes

The lossless comparison LZW encoder emits 16-bit big-endian codes, starts at 256, and never emits a clear code. Rationale: simple deterministic teaching implementation with a bounded dictionary. Consequence: compressed size is worse than GIF/TIFF LZW on long inputs; replace only if a real LZW codec is required.

## D13 — NLM runs synchronously on the backend; k-means samples pixels

`POST /api/v1/denoise` accepts multipart RGBA PNG plus `strength` in 1..30, runs OpenCV `fastNlMeansDenoisingColored`, preserves alpha, and returns PNG in the same request. It does not use the job registry or SSE progress. Rationale: full-image NLM is too slow in JavaScript, and a single short request keeps the UI simple; the existing 25 MiB, 64 MP, and 2048 px limits bound the work. Consequence: the request blocks until OpenCV finishes and the panel shows a busy state; move it to a job only if large images or cancellation become requirements.

The TS k-means palette starts from median-cut centroids, runs 12 Lloyd iterations, and samples at most 20,000 pixels with an integer stride. The seed parameter is accepted for API symmetry but is unused because initialization is deterministic. Rationale: bounded CPU time and reproducible golden vectors. Consequence: palettes on very large images come from a subsample; increase the cap only if palette fidelity becomes a teaching issue.

## D14 — Color-vision simulation uses Machado matrices

Colorblind simulation applies the Machado 2009 protanopia, deuteranopia, and tritanopia matrices in linear sRGB and interpolates toward the identity by severity. Rationale: small, deterministic, and close enough for demonstration. Consequence: it is not a full spectral or physiological model, so severity values are illustrative rather than clinical.
