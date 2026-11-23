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
W3_OUT = DEFAULT_OUT.with_name("w3-compression-metrics.json")


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



def pattern_rgba_at(width: int, height: int) -> np.ndarray:
    xs = np.arange(width)
    ys = np.arange(height)[:, None]
    r = (xs * 37 + ys * 11) % 256
    g = (xs * 17 + ys * 53) % 256
    b = (xs * 97 + ys * 7) % 256
    a = np.full((height, width), 255)
    a[0, 0] = 128
    return np.stack([r, g, b, a], axis=-1).astype(np.uint8)


def to_byte(values: np.ndarray) -> np.ndarray:
    return np.clip(np.floor(values + 0.5), 0, 255).astype(np.uint8)


def dct_matrix() -> np.ndarray:
    matrix = np.zeros((8, 8), dtype=np.float64)
    for u in range(8):
        scale = 1 / np.sqrt(2) if u == 0 else 1.0
        for x in range(8):
            matrix[u, x] = 0.5 * scale * np.cos((2 * x + 1) * u * np.pi / 16)
    return matrix


LUMA_QUANT = np.array(
    [
        [16, 11, 10, 16, 24, 40, 51, 61],
        [12, 12, 14, 19, 26, 58, 60, 55],
        [14, 13, 16, 24, 40, 57, 69, 56],
        [14, 17, 22, 29, 51, 87, 80, 62],
        [18, 22, 37, 56, 68, 109, 103, 77],
        [24, 35, 55, 64, 81, 104, 113, 92],
        [49, 64, 78, 87, 103, 121, 120, 101],
        [72, 92, 95, 98, 112, 100, 103, 99],
    ],
    dtype=np.float64,
)
CHROMA_QUANT = np.array(
    [
        [17, 18, 24, 47, 99, 99, 99, 99],
        [18, 21, 26, 66, 99, 99, 99, 99],
        [24, 26, 56, 99, 99, 99, 99, 99],
        [47, 66, 99, 99, 99, 99, 99, 99],
        [99, 99, 99, 99, 99, 99, 99, 99],
        [99, 99, 99, 99, 99, 99, 99, 99],
        [99, 99, 99, 99, 99, 99, 99, 99],
        [99, 99, 99, 99, 99, 99, 99, 99],
    ],
    dtype=np.float64,
)


def jpeg_quant_table(quality: int, base: np.ndarray) -> np.ndarray:
    scale = 5000 / quality if quality < 50 else 200 - 2 * quality
    return np.clip(np.floor((base * scale + 50) / 100), 1, 255).astype(np.int64)


def to_ycbcr(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rgb = rgba[..., :3].astype(np.float64)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    y = to_byte(0.299 * r + 0.587 * g + 0.114 * b)
    cb = to_byte(-0.168736 * r - 0.331264 * g + 0.5 * b + 128)
    cr = to_byte(0.5 * r - 0.418688 * g - 0.081312 * b + 128)
    return y, cb, cr


def from_ycbcr(
    y: np.ndarray, cb: np.ndarray, cr: np.ndarray, alpha: np.ndarray
) -> np.ndarray:
    yf = y.astype(np.float64)
    blue = cb.astype(np.float64) - 128
    red = cr.astype(np.float64) - 128
    r = to_byte(yf + 1.402 * red)
    g = to_byte(yf - 0.344136 * blue - 0.714136 * red)
    b = to_byte(yf + 1.772 * blue)
    return np.stack([r, g, b, alpha], axis=-1).astype(np.uint8)


def jpeg_channel(plane: np.ndarray, table: np.ndarray) -> np.ndarray:
    height, width = plane.shape
    blocks_y = (height + 7) // 8
    blocks_x = (width + 7) // 8
    pad_y = blocks_y * 8 - height
    pad_x = blocks_x * 8 - width
    padded = np.pad(plane.astype(np.float64), ((0, pad_y), (0, pad_x)), mode="edge")
    matrix = dct_matrix()
    out = np.zeros((height, width), dtype=np.float64)
    for by in range(blocks_y):
        for bx in range(blocks_x):
            block = padded[by * 8 : by * 8 + 8, bx * 8 : bx * 8 + 8] - 128
            coeffs = matrix @ block @ matrix.T
            quantized = np.floor(coeffs / table + 0.5)
            restored = matrix.T @ (quantized * table) @ matrix + 128
            y0, x0 = by * 8, bx * 8
            y1 = min(height, y0 + 8)
            x1 = min(width, x0 + 8)
            out[y0:y1, x0:x1] = np.clip(restored[: y1 - y0, : x1 - x0], 0, 255)
    return out


def jpeg_reconstruct(rgba: np.ndarray, quality: int) -> np.ndarray:
    luma_table = jpeg_quant_table(quality, LUMA_QUANT)
    chroma_table = jpeg_quant_table(quality, CHROMA_QUANT)
    y, cb, cr = to_ycbcr(rgba)
    restored_y = jpeg_channel(y, luma_table)
    restored_cb = jpeg_channel(cb, chroma_table)
    restored_cr = jpeg_channel(cr, chroma_table)
    return from_ycbcr(restored_y, restored_cb, restored_cr, rgba[..., 3])


def luma255(rgba: np.ndarray) -> np.ndarray:
    rgb = rgba[..., :3].astype(np.float64)
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def gaussian_1d() -> np.ndarray:
    offsets = np.arange(11) - 5
    weights = np.exp(-(offsets * offsets) / (2 * 1.5 * 1.5))
    return weights / weights.sum()


def blur_plane(plane: np.ndarray) -> np.ndarray:
    weights = gaussian_1d()
    height, width = plane.shape
    padded = np.pad(plane, ((0, 0), (5, 5)), mode="edge")
    horizontal = np.zeros_like(plane)
    for k in range(11):
        horizontal += weights[k] * padded[:, k : k + width]
    padded = np.pad(horizontal, ((5, 5), (0, 0)), mode="edge")
    vertical = np.zeros_like(plane)
    for k in range(11):
        vertical += weights[k] * padded[k : k + height, :]
    return vertical


def ssim_map(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    mean_a = blur_plane(a)
    mean_b = blur_plane(b)
    mean_square_a = blur_plane(a * a)
    mean_square_b = blur_plane(b * b)
    mean_product = blur_plane(a * b)
    variance_a = np.maximum(0, mean_square_a - mean_a * mean_a)
    variance_b = np.maximum(0, mean_square_b - mean_b * mean_b)
    covariance = mean_product - mean_a * mean_b
    return ((2 * mean_a * mean_b + c1) * (2 * covariance + c2)) / (
        (mean_a * mean_a + mean_b * mean_b + c1) * (variance_a + variance_b + c2)
    )


def pool2(plane: np.ndarray) -> np.ndarray:
    height, width = plane.shape
    height2 = height // 2
    width2 = width // 2
    return plane[: height2 * 2, : width2 * 2].reshape(height2, 2, width2, 2).mean(axis=(1, 3))


def ms_ssim(a: np.ndarray, b: np.ndarray) -> float:
    weights = [0.0448, 0.2856, 0.3001, 0.2363, 0.1333]
    current_a = a.astype(np.float64)
    current_b = b.astype(np.float64)
    values: list[float] = []
    for scale in range(5):
        height, width = current_a.shape
        if height == 0 or width == 0:
            break
        values.append(float(ssim_map(current_a, current_b).mean()))
        if scale == 4 or width < 2 or height < 2:
            break
        current_a = pool2(current_a)
        current_b = pool2(current_b)
    if not values:
        return 1.0
    total = sum(weights[: len(values)])
    product = 1.0
    for index, value in enumerate(values):
        product *= max(0.0, value) ** (weights[index] / total)
    return float(product)


def mse_rgb(a: np.ndarray, b: np.ndarray) -> float:
    difference = a[..., :3].astype(np.float64) - b[..., :3].astype(np.float64)
    return float((difference * difference).mean())


def psnr_rgb(a: np.ndarray, b: np.ndarray) -> float:
    error = mse_rgb(a, b)
    return float("inf") if error == 0 else float(10 * np.log10((255 * 255) / error))


def paeth(left: int, up: int, upper_left: int) -> int:
    estimate = left + up - upper_left
    distance_left = abs(estimate - left)
    distance_up = abs(estimate - up)
    distance_upper_left = abs(estimate - upper_left)
    if distance_left <= distance_up and distance_left <= distance_upper_left:
        return left
    if distance_up <= distance_upper_left:
        return up
    return upper_left


def png_filter(flat: np.ndarray, width: int, height: int, name: str) -> np.ndarray:
    out = np.zeros_like(flat)
    for y in range(height):
        for x in range(width):
            index = y * width + x
            value = int(flat[index])
            left = 0 if x == 0 else int(flat[index - 1])
            up = 0 if y == 0 else int(flat[index - width])
            upper_left = 0 if x == 0 or y == 0 else int(flat[index - width - 1])
            if name == "none":
                predictor = 0
            elif name == "sub":
                predictor = left
            elif name == "up":
                predictor = up
            elif name == "average":
                predictor = (left + up) // 2
            elif name == "paeth":
                predictor = paeth(left, up, upper_left)
            else:
                raise ValueError(f"unknown png filter {name}")
            out[index] = (value - predictor) & 0xFF
    return out


def png_adaptive(flat: np.ndarray, width: int, height: int) -> tuple[np.ndarray, list[str]]:
    names = ["none", "sub", "up", "average", "paeth"]
    filtered = np.zeros_like(flat)
    chosen: list[str] = []
    for y in range(height):
        best_name = "none"
        best_row = None
        best_score = None
        for name in names:
            candidate = png_filter(flat, width, height, name).reshape(height, width)[y]
            signed = candidate.astype(np.int64)
            signed[signed > 127] -= 256
            score = int(np.abs(signed).sum())
            if best_score is None or score < best_score:
                best_score = score
                best_name = name
                best_row = candidate
        assert best_row is not None
        filtered.reshape(height, width)[y] = best_row
        chosen.append(best_name)
    return filtered, chosen


def dpcm(flat: np.ndarray, width: int, height: int) -> np.ndarray:
    out = np.zeros_like(flat)
    for y in range(height):
        for x in range(width):
            index = y * width + x
            predictor = 0 if x == 0 else int(flat[index - 1])
            out[index] = (int(flat[index]) - predictor) & 0xFF
    return out


def build_w3_vectors() -> dict:
    rgba = pattern_rgba()
    odd = pattern_rgba_at(9, 7)
    y_plane = to_ycbcr(rgba)[0]
    luma_values = y_plane.astype(np.float64)
    matrix = dct_matrix()
    block = luma_values - 128
    jpeg50 = jpeg_reconstruct(rgba, 50)
    jpeg90 = jpeg_reconstruct(rgba, 90)
    jpeg_odd = jpeg_reconstruct(odd, 50)
    ssim_values = ssim_map(luma255(rgba), luma255(jpeg50))
    adaptive, filters = png_adaptive(y_plane.reshape(-1), SIZE, SIZE)
    return {
        "input": {
            "width": SIZE,
            "height": SIZE,
            "rgba": rgba.reshape(-1).tolist(),
            "oddWidth": 9,
            "oddHeight": 7,
            "oddRgba": odd.reshape(-1).tolist(),
        },
        "expected": {
            "luma": y_plane.reshape(-1).tolist(),
            "dct": (matrix @ block @ matrix.T).reshape(-1).tolist(),
            "quantLuma50": jpeg_quant_table(50, LUMA_QUANT).reshape(-1).tolist(),
            "quantChroma50": jpeg_quant_table(50, CHROMA_QUANT).reshape(-1).tolist(),
            "jpeg50": jpeg50.reshape(-1).tolist(),
            "jpeg90": jpeg90.reshape(-1).tolist(),
            "jpegOdd": jpeg_odd.reshape(-1).tolist(),
            "metrics": {
                "mse": mse_rgb(rgba, jpeg50),
                "psnr": psnr_rgb(rgba, jpeg50),
                "ssim": float(ssim_values.mean()),
                "msSsim": ms_ssim(luma255(rgba), luma255(jpeg50)),
                "ssimMap": ssim_values.reshape(-1).tolist(),
            },
            "png": {
                "none": png_filter(y_plane.reshape(-1), SIZE, SIZE, "none").tolist(),
                "sub": png_filter(y_plane.reshape(-1), SIZE, SIZE, "sub").tolist(),
                "up": png_filter(y_plane.reshape(-1), SIZE, SIZE, "up").tolist(),
                "average": png_filter(y_plane.reshape(-1), SIZE, SIZE, "average").tolist(),
                "paeth": png_filter(y_plane.reshape(-1), SIZE, SIZE, "paeth").tolist(),
                "adaptive": adaptive.tolist(),
                "filters": filters,
            },
            "dpcm": dpcm(y_plane.reshape(-1), SIZE, SIZE).tolist(),
        },
        "tolerance": TOLERANCE,
        "source": "tools/golden/negarlab_golden/generate.py (numpy float64, byte-exact JPEG/PNG)",
    }


def write_w3_vectors(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_w3_vectors(), indent=2) + "\n", encoding="utf-8")


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
        write_w3_vectors(W3_OUT)
        print(f"wrote {args.out}, {W1_OUT}, {W2_OUT}, and {W3_OUT}")
        return 0
    return 1
