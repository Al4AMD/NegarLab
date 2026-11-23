import io

import httpx
from fastapi import FastAPI
from PIL import Image


def png_bytes(
    size: tuple[int, int] = (20, 10), color: tuple[int, int, int] = (200, 30, 30)
) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    return buffer.getvalue()


def jpeg_with_exif() -> bytes:
    image = Image.new("RGB", (20, 10), (10, 120, 200))
    exif = Image.Exif()
    exif[271] = "NegarLab"
    exif[272] = "TestCam"
    exif[306] = "2026:11:23 10:00:00"
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


async def post_file(
    app: FastAPI, content: bytes, filename: str, content_type: str
) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(
            "/api/v1/ingest", files={"file": (filename, content, content_type)}
        )


async def test_rejects_text_disguised_as_png(app_factory):
    response = await post_file(app_factory(), b"this is not an image", "fake.png", "image/png")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_format"


async def test_rejects_too_many_pixels(app_factory):
    response = await post_file(
        app_factory(image_max_pixels=100), png_bytes((20, 20)), "big.png", "image/png"
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "image_too_large"


async def test_rejects_oversized_upload(app_factory):
    response = await post_file(
        app_factory(upload_max_bytes=8), b"longer than eight", "a.png", "image/png"
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "upload_too_large"


async def test_downscales_to_working_cap(app_factory):
    app = app_factory(working_cap_px=8)
    response = await post_file(app, png_bytes((20, 10)), "wide.png", "image/png")
    assert response.status_code == 201
    body = response.json()
    assert body["downscaled"] is True
    assert (body["width"], body["height"]) == (8, 4)
    assert (body["original_width"], body["original_height"]) == (20, 10)


async def test_reports_exif_without_gps_coordinates(app_factory):
    response = await post_file(app_factory(), jpeg_with_exif(), "photo.jpg", "image/jpeg")
    assert response.status_code == 201
    body = response.json()
    assert body["source_format"] == "JPEG"
    assert body["exif"]["make"] == "NegarLab"
    assert body["exif"]["datetime"] == "2026:11:23 10:00:00"
    assert body["exif"]["gps_present"] is False
    assert "gps" not in body["exif"]


async def test_roundtrip_and_delete(app_factory):
    app = app_factory()
    upload = await post_file(app, png_bytes(), "image.png", "image/png")
    image_id = upload.json()["image_id"]

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        fetched = await client.get(f"/api/v1/images/{image_id}")
        assert fetched.status_code == 200
        assert fetched.headers["content-type"] == "image/png"
        decoded = Image.open(io.BytesIO(fetched.content))
        assert decoded.mode == "RGBA"
        assert decoded.size == (20, 10)

        deleted = await client.delete(f"/api/v1/images/{image_id}")
        assert deleted.status_code == 204

        missing = await client.get(f"/api/v1/images/{image_id}")
        assert missing.status_code == 404
        assert missing.json()["error"]["code"] == "image_not_found"


async def test_expired_image_returns_404(app_factory):
    app = app_factory(ttl_minutes=0)
    upload = await post_file(app, png_bytes(), "image.png", "image/png")
    image_id = upload.json()["image_id"]
    assert app.state.storage.delete_expired() == 1

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        missing = await client.get(f"/api/v1/images/{image_id}")

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "image_not_found"
