import io

from fastapi.testclient import TestClient
from PIL import Image


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGBA", (8, 8), (120, 40, 200, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_denoise_returns_png(app_factory):
    client = TestClient(app_factory())
    response = client.post(
        "/api/v1/denoise",
        files={"file": ("in.png", _png(), "image/png")},
        data={"strength": "3"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    with Image.open(io.BytesIO(response.content)) as image:
        assert image.size == (8, 8)
        assert image.mode == "RGBA"
        assert image.getpixel((0, 0))[3] == 255


def test_denoise_rejects_bad_strength(app_factory):
    client = TestClient(app_factory())
    response = client.post(
        "/api/v1/denoise",
        files={"file": ("in.png", _png(), "image/png")},
        data={"strength": "99"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_strength"


def test_denoise_rejects_non_image(app_factory):
    client = TestClient(app_factory())
    response = client.post(
        "/api/v1/denoise",
        files={"file": ("in.txt", b"not an image", "text/plain")},
        data={"strength": "3"},
    )
    assert response.status_code == 415
