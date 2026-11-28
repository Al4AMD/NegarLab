import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response

from ...config import Settings
from ...deps import get_app_settings
from ...errors import ApiError
from ...imaging import prepare_image

router = APIRouter(tags=["denoise"])


@router.post("/denoise")
def denoise(
    file: UploadFile = File(...),
    strength: float = Form(3.0),
    settings: Settings = Depends(get_app_settings),
) -> Response:
    if not 1 <= strength <= 30:
        raise ApiError("invalid_strength", 422, "Strength must be within 1..30")
    raw = file.file.read(settings.upload_max_bytes + 1)
    if len(raw) > settings.upload_max_bytes:
        raise ApiError("upload_too_large", 413, "Upload exceeds the size limit")
    _, png = prepare_image(raw, settings)
    bgra = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_UNCHANGED)
    if bgra is None or bgra.ndim != 3 or bgra.shape[2] != 4:
        raise ApiError("invalid_image", 415, "Image could not be decoded")
    bgr = cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR)
    denoised = cv2.fastNlMeansDenoisingColored(bgr, None, strength, strength, 7, 21)
    out = cv2.cvtColor(denoised, cv2.COLOR_BGR2BGRA)
    out[..., 3] = bgra[..., 3]
    ok, encoded = cv2.imencode(".png", out)
    if not ok:
        raise ApiError("encode_failed", 500, "Image could not be encoded")
    return Response(content=encoded.tobytes(), media_type="image/png")
