from __future__ import annotations

import io
from collections.abc import Mapping

from PIL import Image, UnidentifiedImageError

from .config import Settings
from .errors import ApiError

EXIF_FIELDS: dict[str, int] = {
    "make": 271,
    "model": 272,
    "datetime": 306,
    "exposure_time": 33434,
    "f_number": 33437,
    "iso": 34855,
    "focal_length": 37386,
}
GPS_IFD_TAG = 34853


def _jsonable(value: object) -> object:
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def summarize_exif(exif: Mapping[int, object]) -> dict[str, object]:
    summary: dict[str, object] = {}
    for name, tag in EXIF_FIELDS.items():
        if tag in exif:
            summary[name] = _jsonable(exif[tag])
    summary["gps_present"] = GPS_IFD_TAG in exif and bool(exif.get(GPS_IFD_TAG))
    return summary


def prepare_image(raw: bytes, settings: Settings) -> tuple[dict[str, object], bytes]:
    try:
        image: Image.Image = Image.open(io.BytesIO(raw))
    except Image.DecompressionBombError as exc:
        raise ApiError("image_too_large", 413, "Image exceeds the pixel limit") from exc
    except UnidentifiedImageError as exc:
        raise ApiError("unsupported_format", 415, "Unsupported image format") from exc

    original_width, original_height = image.size
    if original_width * original_height > settings.image_max_pixels:
        raise ApiError("image_too_large", 413, "Image exceeds the pixel limit")

    try:
        summary = summarize_exif(image.getexif())
        source_format = image.format or "unknown"
        downscaled = False
        longest = max(original_width, original_height)
        if settings.working_cap_px > 0 and longest > settings.working_cap_px:
            scale = settings.working_cap_px / longest
            image = image.resize(
                (max(1, round(original_width * scale)), max(1, round(original_height * scale))),
                Image.Resampling.LANCZOS,
            )
            downscaled = True
        rgba = image.convert("RGBA")
        out = io.BytesIO()
        rgba.save(out, format="PNG")
    except OSError as exc:
        raise ApiError("invalid_image", 415, "Image could not be decoded") from exc

    meta: dict[str, object] = {
        "width": rgba.width,
        "height": rgba.height,
        "original_width": original_width,
        "original_height": original_height,
        "downscaled": downscaled,
        "source_format": source_format,
        "exif": summary,
    }
    return meta, out.getvalue()
