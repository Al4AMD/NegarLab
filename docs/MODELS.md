# Models

No ML model ships before W6. This file will be the single source of truth for every model: task, source, revision, size, license (code and weights), CPU speed, input format, limitations.

## Rules

- Never train; never invent a model ID. Verify the repository card and pin a revision.
- ≤400 MB per model on disk; ≤2 GB across all models.
- CPU inference is the baseline; lazy-load; cache in a volume; never block the event loop.
- Offline after a one-time download (`scripts/download_models.py`, added in W6).
- If a license forbids public educational redistribution, do not use the model.
- Jobs show progress and can be cancelled; slow jobs cap the excerpt and offer full processing.
- ML tests are gated by `NEGARLAB_RUN_ML_TESTS=1`.

## Shortlist (candidates, not yet verified or integrated)

| Task | Candidate | Status |
|---|---|---|
| Super-resolution | realesr-general-x4v3 (SRVGGNetCompact) | Candidate |
| Depth estimation | Depth-Anything-V2-Small only | Candidate |
| Interactive segmentation | MobileSAM or EdgeSAM | Candidate |
| OCR | RapidOCR (PP-OCRv4 mobile) | Candidate; English demo default |
| Background removal | U2Netp | Candidate |
| Learned denoising | DnCNN/FFDNet small | Candidate (P2) |
| Classification | MobileNetV3 (torchvision) | Candidate |
| Detection | SSDLite-MobileNetV3 | Candidate |
| Neural codec | CompressAI bmshj2018-factorized | Candidate |
| Perceptual metric | LPIPS small | Candidate (P3) |

None are approved until verified and recorded here with license and revision.
