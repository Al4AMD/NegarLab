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
W1_OUT = DEFAULT_OUT.with_name("w1-fundamentals.json")
W2_OUT = DEFAULT_OUT.with_name("w2-spatial-frequency.json")


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


def channels(rgba: np.ndarray) -> list[np.ndarray]:
    return [rgba[..., i].astype(np.float64) / 255.0 for i in range(3)]


def bins(channel: np.ndarray) -> np.ndarray:
    flat = np.asarray(channel).reshape(-1)
    return np.clip(np.floor(flat * 255), 0, 255).astype(np.int64)


def histogram(channel: np.ndarray) -> np.ndarray:
    return np.bincount(bins(channel), minlength=256).astype(np.int64)


def byte_histogram(channel: np.ndarray) -> np.ndarray:
    return np.bincount(np.asarray(channel).reshape(-1).astype(np.uint8), minlength=256).astype(np.int64)


def cdf(counts: np.ndarray) -> np.ndarray:
    total = counts.sum()
    if total == 0:
        return np.zeros(256)
    return np.cumsum(counts) / total


def byte(value: np.ndarray) -> np.ndarray:
    return np.clip(np.floor(value * 255 + 0.5), 0, 255).astype(np.uint8)


def apply_map(rgba: np.ndarray, fn) -> np.ndarray:
    out = rgba.copy()
    for i, channel in enumerate(channels(rgba)):
        out[..., i] = byte(fn(channel))
    return out


def equalize_lookup(counts: np.ndarray) -> np.ndarray:
    lookup = np.arange(256)
    occupied = np.flatnonzero(counts)
    if occupied.size == 0:
        return lookup
    cdf_values = cdf(counts)
    cdf_min = cdf_values[occupied[0]]
    scale = 1.0 - cdf_min
    if scale <= 0:
        return lookup
    mapped = np.floor((cdf_values - cdf_min) / scale * 255 + 0.5)
    return np.clip(mapped, 0, 255).astype(np.int64)


def equalize(rgba: np.ndarray) -> np.ndarray:
    out = rgba.copy()
    for i in range(3):
        lut = equalize_lookup(byte_histogram(rgba[..., i]))
        out[..., i] = lut[rgba[..., i]]
    return out


def stretch(rgba: np.ndarray, low: float, high: float) -> np.ndarray:
    out = rgba.copy()
    for i, channel in enumerate(channels(rgba)):
        flat = np.sort(channel.reshape(-1))
        n = flat.size
        lo = flat[int(np.floor(low * (n - 1)))]
        hi = flat[int(np.floor(high * (n - 1)))]
        if hi > lo:
            out[..., i] = byte(np.clip((channel - lo) / (hi - lo), 0, 1))
    return out


def quantize(rgba: np.ndarray, bits: int) -> np.ndarray:
    levels = 2**bits
    return apply_map(
        rgba,
        lambda channel: np.floor(channel * (levels - 1) + 0.5) / (levels - 1),
    )


def resize_nearest(rgba: np.ndarray, width: int, height: int) -> np.ndarray:
    src_h, src_w = rgba.shape[:2]
    ys = np.minimum(src_h - 1, np.floor(np.arange(height) * src_h / height).astype(int))
    xs = np.minimum(src_w - 1, np.floor(np.arange(width) * src_w / width).astype(int))
    return rgba[ys[:, None], xs[None, :]]


def otsu(rgba: np.ndarray) -> tuple[float, int]:
    luma32 = luma(rgba).astype(np.float32).astype(np.float64)
    counts = histogram(luma32).astype(np.float64)
    total = counts.sum()
    if total == 0:
        return 0.0, 0
    probabilities = counts / total
    omega = np.cumsum(probabilities)
    mu = np.cumsum(probabilities * np.arange(256))
    mu_total = mu[-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        between = (mu_total * omega - mu) ** 2 / (omega * (1 - omega))
    between[~np.isfinite(between)] = 0
    threshold = int(np.argmax(between))
    return threshold / 255.0, threshold


def threshold_image(rgba: np.ndarray, threshold: int) -> np.ndarray:
    luma32 = luma(rgba).astype(np.float32)
    mask = luma32 > threshold / 255.0
    out = np.zeros_like(rgba)
    out[..., :3] = np.where(mask[..., None], 255, 0)
    out[..., 3] = rgba[..., 3]
    return out


def match_histogram(image: np.ndarray, reference: np.ndarray) -> np.ndarray:
    out = image.copy()
    for i in range(3):
        src_cdf = cdf(byte_histogram(image[..., i]))
        ref_cdf = cdf(byte_histogram(reference[..., i]))
        lut = np.searchsorted(ref_cdf, src_cdf, side="left").clip(0, 255)
        out[..., i] = lut[image[..., i]]
    return out


def gray_ramp() -> np.ndarray:
    values = np.linspace(0, 255, SIZE * SIZE).round().astype(np.uint8).reshape(SIZE, SIZE)
    alpha = np.full((SIZE, SIZE), 255, dtype=np.uint8)
    return np.stack([values, values, values, alpha], axis=-1)



def clahe_tile_lut(channel: np.ndarray, x0: int, x1: int, y0: int, y1: int, clip_limit: float) -> np.ndarray:
    tile = channel[y0:y1, x0:x1].reshape(-1)
    counts = np.bincount(tile, minlength=256).astype(np.float64)
    total = counts.sum()
    if total == 0:
        return np.arange(256)
    clip = max(1, int(np.floor(clip_limit * total / 256)))
    excess = np.maximum(counts - clip, 0.0).sum()
    counts = np.minimum(counts, clip) + excess / 256
    integral = np.floor(np.cumsum(counts) + 0.5).astype(np.int64)
    grand = integral.sum()
    cdf_values = np.cumsum(integral) / grand
    occupied = np.flatnonzero(integral)
    cdf_min = cdf_values[occupied[0]]
    scale = 1.0 - cdf_min
    if scale <= 0:
        return np.arange(256)
    return np.clip(np.floor((cdf_values - cdf_min) / scale * 255 + 0.5), 0, 255).astype(np.int64)


def clahe(rgba: np.ndarray, tiles: int = 2, clip_limit: float = 1.5) -> np.ndarray:
    height, width = rgba.shape[:2]
    tile_count = min(tiles, width, height)
    out = rgba.copy()
    for channel_index in range(3):
        channel = rgba[..., channel_index]
        luts = np.zeros((tile_count, tile_count, 256), dtype=np.int64)
        for ty in range(tile_count):
            y0 = (ty * height) // tile_count
            y1 = ((ty + 1) * height) // tile_count
            for tx in range(tile_count):
                x0 = (tx * width) // tile_count
                x1 = ((tx + 1) * width) // tile_count
                luts[ty, tx] = clahe_tile_lut(channel, x0, x1, y0, y1, clip_limit)
        for y in range(height):
            fy = min(tile_count - 1, max(0.0, (y + 0.5) * tile_count / height - 0.5))
            ty0 = int(np.floor(fy))
            ty1 = min(tile_count - 1, ty0 + 1)
            ay = fy - ty0
            for x in range(width):
                fx = min(tile_count - 1, max(0.0, (x + 0.5) * tile_count / width - 0.5))
                tx0 = int(np.floor(fx))
                tx1 = min(tile_count - 1, tx0 + 1)
                ax = fx - tx0
                value = int(channel[y, x])
                top = luts[ty0, tx0, value] * (1 - ax) + luts[ty0, tx1, value] * ax
                bottom = luts[ty1, tx0, value] * (1 - ax) + luts[ty1, tx1, value] * ax
                out[y, x, channel_index] = int(np.floor(top * (1 - ay) + bottom * ay + 0.5))
    return out


def build_w1_vectors() -> dict:
    rgba = pattern_rgba()
    ch = channels(rgba)
    luma32 = luma(rgba).astype(np.float32).astype(np.float64)
    threshold_value, threshold_bin = otsu(rgba)
    reference = gray_ramp()
    return {
        "input": {"width": SIZE, "height": SIZE, "rgba": rgba.reshape(-1).tolist()},
        "reference": {
            "width": SIZE,
            "height": SIZE,
            "rgba": reference.reshape(-1).tolist(),
        },
        "expected": {
            "channels": {
                "r": [float(v) for v in ch[0].reshape(-1)],
                "g": [float(v) for v in ch[1].reshape(-1)],
                "b": [float(v) for v in ch[2].reshape(-1)],
            },
            "histograms": {
                "r": histogram(ch[0]).tolist(),
                "g": histogram(ch[1]).tolist(),
                "b": histogram(ch[2]).tolist(),
            },
            "lumaHistogram": histogram(luma32).tolist(),
            "negative": apply_map(rgba, lambda c: 1 - c).reshape(-1).tolist(),
            "log": apply_map(rgba, lambda c: np.log1p(255 * c) / np.log(256))
            .reshape(-1)
            .tolist(),
            "gamma": {
                "gamma": 0.5,
                "rgba": apply_map(rgba, lambda c: c**0.5).reshape(-1).tolist(),
            },
            "equalize": equalize(rgba).reshape(-1).tolist(),
            "stretch": {
                "low": 0.05,
                "high": 0.95,
                "rgba": stretch(rgba, 0.05, 0.95).reshape(-1).tolist(),
            },
            "quantize": {"bits": 3, "rgba": quantize(rgba, 3).reshape(-1).tolist()},
            "downsample": {
                "width": 4,
                "height": 4,
                "rgba": resize_nearest(rgba, 4, 4).reshape(-1).tolist(),
            },
            "match": match_histogram(rgba, reference).reshape(-1).tolist(),
            "otsu": threshold_value,
            "threshold": threshold_image(rgba, threshold_bin).reshape(-1).tolist(),
            "clahe": {
                "tiles": 2,
                "clipLimit": 1.5,
                "rgba": clahe(rgba, 2, 1.5).reshape(-1).tolist(),
            },
        },
        "tolerance": TOLERANCE,
        "source": "tools/golden/negarlab_golden/generate.py (numpy float64; float32 luma)",
    }



def gaussian_kernel(size: int, sigma: float) -> np.ndarray:
    center = (size - 1) / 2
    ys, xs = np.mgrid[0:size, 0:size]
    weights = np.exp(-((xs - center) ** 2 + (ys - center) ** 2) / (2 * sigma * sigma))
    return weights / weights.sum()


def convolve_channel(channel: np.ndarray, weights: np.ndarray) -> np.ndarray:
    size = weights.shape[0]
    half = size // 2
    padded = np.pad(channel, ((half, half), (half, half)), mode="edge").astype(np.float64)
    height, width = channel.shape
    out = np.zeros((height, width), dtype=np.float64)
    for ky in range(size):
        for kx in range(size):
            out += padded[ky : ky + height, kx : kx + width] * weights[ky, kx]
    return np.clip(np.floor(out + 0.5), 0, 255).astype(np.uint8)


def convolve(rgba: np.ndarray, weights: np.ndarray) -> np.ndarray:
    out = rgba.copy()
    for channel_index in range(3):
        out[..., channel_index] = convolve_channel(rgba[..., channel_index], weights)
    return out


def median3(rgba: np.ndarray) -> np.ndarray:
    out = rgba.copy()
    padded = np.pad(rgba[..., :3].astype(np.int64), ((1, 1), (1, 1), (0, 0)), mode="edge")
    height, width = rgba.shape[:2]
    for channel_index in range(3):
        windows = np.stack(
            [
                padded[dy : dy + height, dx : dx + width, channel_index]
                for dy in range(3)
                for dx in range(3)
            ],
            axis=-1,
        )
        out[..., channel_index] = np.median(windows, axis=-1).astype(np.uint8)
    return out


def sobel_magnitude(rgba: np.ndarray) -> np.ndarray:
    px = np.pad(luma(rgba).astype(np.float32), ((1, 1), (1, 1)), mode="edge").astype(np.float64)
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float64)
    ky = np.array([[1, 2, 1], [0, 0, 0], [-1, -2, -1]], dtype=np.float64)
    height, width = rgba.shape[:2]
    gx = np.zeros((height, width))
    gy = np.zeros((height, width))
    for row in range(3):
        for col in range(3):
            gx += px[row : row + height, col : col + width] * kx[row, col]
            gy += px[row : row + height, col : col + width] * ky[row, col]
    magnitude = np.clip(np.hypot(gx / 4, gy / 4), 0, 1)
    return np.floor(magnitude * 255 + 0.5).astype(np.uint8)


def sobel_rgba(rgba: np.ndarray) -> np.ndarray:
    out = rgba.copy()
    magnitude = sobel_magnitude(rgba)
    out[..., 0] = magnitude
    out[..., 1] = magnitude
    out[..., 2] = magnitude
    return out


def fft_magnitude(rgba: np.ndarray) -> np.ndarray:
    values = luma(rgba).astype(np.float32).astype(np.float64)
    magnitude = np.log1p(np.abs(np.fft.fft2(values)))
    maximum = magnitude.max()
    if maximum > 0:
        magnitude = magnitude / maximum
    return magnitude.astype(np.float32)


def gaussian_lowpass(rgba: np.ndarray, cutoff: float) -> np.ndarray:
    values = luma(rgba).astype(np.float32).astype(np.float64)
    spectrum = np.fft.fft2(values)
    height, width = values.shape
    mask = np.zeros((height, width))
    for y in range(height):
        shifted_y = (y + height // 2) % height
        dy = (shifted_y - height / 2) / (height / 2)
        for x in range(width):
            shifted_x = (x + width // 2) % width
            dx = (shifted_x - width / 2) / (width / 2)
            distance = float(np.hypot(dx, dy))
            mask[y, x] = np.exp(-(distance * distance) / (2 * cutoff * cutoff))
    restored = np.real(np.fft.ifft2(spectrum * mask))
    out = rgba.copy()
    bytes_channel = np.clip(np.floor(restored * 255 + 0.5), 0, 255).astype(np.uint8)
    out[..., 0] = bytes_channel
    out[..., 1] = bytes_channel
    out[..., 2] = bytes_channel
    return out


def build_w2_vectors() -> dict:
    rgba = pattern_rgba()
    mean_kernel = np.full((3, 3), 1 / 9, dtype=np.float64)
    return {
        "input": {"width": SIZE, "height": SIZE, "rgba": rgba.reshape(-1).tolist()},
        "expected": {
            "mean": convolve(rgba, mean_kernel).reshape(-1).tolist(),
            "gaussian": convolve(rgba, gaussian_kernel(5, 1.0)).reshape(-1).tolist(),
            "median": median3(rgba).reshape(-1).tolist(),
            "sobel": sobel_rgba(rgba).reshape(-1).tolist(),
            "fftMagnitude": fft_magnitude(rgba).reshape(-1).tolist(),
            "lowpass": gaussian_lowpass(rgba, 0.35).reshape(-1).tolist(),
        },
        "tolerance": TOLERANCE,
        "source": "tools/golden/negarlab_golden/generate.py (numpy float64, float32 luma)",
    }


def write_w2_vectors(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_w2_vectors(), indent=2) + "\n", encoding="utf-8")

def write_vectors(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_vectors(), indent=2) + "\n", encoding="utf-8")


def write_w1_vectors(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_w1_vectors(), indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m negarlab_golden")
    sub = parser.add_subparsers(dest="command", required=True)
    generate = sub.add_parser("generate")
    generate.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)

    if args.command == "generate":
        write_vectors(args.out)
        write_w1_vectors(W1_OUT)
        write_w2_vectors(W2_OUT)
        print(f"wrote {args.out} and {W1_OUT}")
        return 0
    return 1
