"""Golden vector generator for @negarlab/ip.

The TS library must reproduce these NumPy results within the published
tolerance. Regenerate with `pnpm gen:golden` and commit the JSON.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

SIZE = 8
TOLERANCE = 1e-6
DEFAULT_OUT = (
    Path(__file__).resolve().parents[3] / "packages/ip/test-data/golden/luma-stats.json"
)


def pattern_rgba() -> np.ndarray:
    """Deterministic RGBA test pattern (row-major, interleaved)."""
    xs = np.arange(SIZE)
    ys = np.arange(SIZE)[:, None]
    r = (xs * 37 + ys * 11) % 256
    g = (xs * 17 + ys * 53) % 256
    b = (xs * 97 + ys * 7) % 256
    a = np.full((SIZE, SIZE), 255)
    a[0, 0] = 128
    return np.stack([r, g, b, a], axis=-1).astype(np.uint8)


def luma(rgba: np.ndarray) -> np.ndarray:
    rgb = rgba[..., :3].astype(np.float64)
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0


def summarize(values: np.ndarray) -> dict[str, float]:
    values = values.astype(np.float64).reshape(-1)
    n = values.size
    mean = float(values.mean())
    variance = float(values.var())
    bins = np.clip(np.floor(values * 255), 0, 255).astype(np.int64)
    counts = np.bincount(bins, minlength=256).astype(np.float64)
    probabilities = counts[counts > 0] / n
    entropy = float(-(probabilities * np.log2(probabilities)).sum())
    return {"mean": mean, "variance": variance, "entropyBits": entropy}


def build_vectors() -> dict:
    rgba = pattern_rgba()
    luma_values = luma(rgba)
    # The TS library stores luma in Float32; derive stats from that view so
    # histogram bin boundaries agree with the implementation.
    luma32 = luma_values.astype(np.float32).astype(np.float64)
    return {
        "input": {
            "width": SIZE,
            "height": SIZE,
            "rgba": rgba.reshape(-1).tolist(),
        },
        "expected": {
            "luma": [float(value) for value in luma_values.reshape(-1)],
            "stats": summarize(luma32),
        },
        "tolerance": TOLERANCE,
        "source": "tools/golden/negarlab_golden/generate.py (numpy float64, float32 luma view)",
    }


def write_vectors(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_vectors(), indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m negarlab_golden")
    sub = parser.add_subparsers(dest="command", required=True)
    generate = sub.add_parser("generate")
    generate.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)

    if args.command == "generate":
        write_vectors(args.out)
        print(f"wrote {args.out}")
        return 0
    return 1
