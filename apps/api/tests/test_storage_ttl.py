from datetime import UTC, datetime, timedelta
from pathlib import Path

from negarlab_api.imaging import summarize_exif
from negarlab_api.storage import Storage


def test_delete_expired_removes_only_aged_images(tmp_path: Path) -> None:
    storage = Storage(tmp_path, ttl_minutes=60)
    first = storage.save(b"png-a", {"width": 1})
    second = storage.save(b"png-b", {"width": 1})

    assert storage.delete_expired(datetime.now(UTC) + timedelta(minutes=30)) == 0
    assert storage.get(str(first["image_id"])) is not None

    later = datetime.now(UTC) + timedelta(minutes=61)
    assert storage.delete_expired(later) == 2
    assert storage.get(str(second["image_id"])) is None
    assert not list(tmp_path.glob("*.png"))


def test_summarize_exif_reports_gps_but_never_coordinates() -> None:
    summary = summarize_exif({271: "Cam", 34853: {1: "N", 2: (35.0, 41.0, 0.0)}})
    assert summary["make"] == "Cam"
    assert summary["gps_present"] is True
    assert "gps" not in summary
    assert all("35.0" not in str(value) for value in summary.values())
