from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 512
OUT_DIR = Path(__file__).resolve().parents[2] / "apps" / "web" / "public" / "demo"

COLOR_CHECKER = [
    (115, 82, 68),
    (194, 150, 130),
    (98, 122, 157),
    (87, 108, 67),
    (133, 128, 177),
    (103, 189, 170),
    (214, 126, 44),
    (80, 91, 166),
    (193, 90, 99),
    (94, 60, 108),
    (157, 188, 64),
    (224, 163, 46),
    (56, 61, 150),
    (70, 148, 73),
    (175, 54, 60),
    (231, 199, 31),
    (187, 86, 149),
    (8, 133, 161),
    (243, 243, 242),
    (200, 200, 200),
    (160, 160, 160),
    (122, 122, 121),
    (85, 85, 85),
    (52, 52, 52),
]


def zone_plate(size: int = SIZE) -> np.ndarray:
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    center = (size - 1) / 2
    radius_sq = (x - center) ** 2 + (y - center) ** 2
    value = 0.5 + 0.5 * np.sin(radius_sq * (2 * np.pi * 20 / size**2))
    return np.repeat((value * 255)[..., None], 3, axis=-1)


def gray_ramp(size: int = SIZE) -> np.ndarray:
    ramp = np.linspace(0, 255, size)
    value = np.tile(ramp, (size, 1))
    return np.repeat(value[..., None], 3, axis=-1)


def resolution_wedge(size: int = SIZE) -> np.ndarray:
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    center = (size - 1) / 2
    radius = np.hypot(x - center, y - center)
    theta = np.arctan2(y - center, x - center)
    sectors = 0.5 + 0.5 * np.cos(18 * theta)
    value = np.where(radius < size * 0.46, sectors, 0.5)
    return np.repeat((value * 255)[..., None], 3, axis=-1)


def color_checker(size: int = SIZE) -> np.ndarray:
    margin, gap = 24, 8
    cols, rows = 6, 4
    patch_w = (size - 2 * margin - (cols - 1) * gap) / cols
    patch_h = (size - 2 * margin - (rows - 1) * gap) / rows
    image = np.full((size, size, 3), 96.0)
    for index, color in enumerate(COLOR_CHECKER):
        row, col = divmod(index, cols)
        x0 = int(round(margin + col * (patch_w + gap)))
        y0 = int(round(margin + row * (patch_h + gap)))
        x1 = int(round(x0 + patch_w))
        y1 = int(round(y0 + patch_h))
        image[y0:y1, x0:x1] = color
    return image


def generate_all(out_dir: Path = OUT_DIR) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    images = {
        "zone-plate.png": zone_plate(),
        "gray-ramp.png": gray_ramp(),
        "resolution-wedge.png": resolution_wedge(),
        "color-checker.png": color_checker(),
    }
    for name, pixels in images.items():
        Image.fromarray(pixels.astype(np.uint8), mode="RGB").save(
            out_dir / name, format="PNG"
        )
    return sorted(images)


if __name__ == "__main__":
    for name in generate_all():
        print(name)
