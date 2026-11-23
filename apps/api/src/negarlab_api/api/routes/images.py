from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response

from ...config import Settings
from ...deps import get_app_settings, get_storage
from ...errors import ApiError
from ...imaging import prepare_image
from ...storage import Storage

router = APIRouter(tags=["images"])


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    data = bytearray()
    while chunk := await file.read(1024 * 1024):
        data.extend(chunk)
        if len(data) > limit:
            raise ApiError("upload_too_large", 413, "Upload exceeds the size limit")
    return bytes(data)


@router.post("/ingest", status_code=201)
async def ingest_image(
    file: UploadFile = File(...),
    storage: Storage = Depends(get_storage),
    settings: Settings = Depends(get_app_settings),
) -> dict[str, object]:
    raw = await _read_limited(file, settings.upload_max_bytes)
    meta, png = prepare_image(raw, settings)
    return storage.save(png, meta)


@router.get("/images/{image_id}")
def get_image(image_id: str, storage: Storage = Depends(get_storage)) -> Response:
    record = storage.get(image_id)
    if record is None:
        raise ApiError("image_not_found", 404, "Image not found or expired")
    _, data = record
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=0, must-revalidate"},
    )


@router.delete("/images/{image_id}", status_code=204)
def delete_image(image_id: str, storage: Storage = Depends(get_storage)) -> Response:
    if not storage.delete(image_id):
        raise ApiError("image_not_found", 404, "Image not found or expired")
    return Response(status_code=204)
