from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path


@dataclass
class StoredImage:
    id: str
    meta: dict[str, object]
    path: Path
    created_at: datetime


class Storage:
    """In-memory image index backed by PNG files on disk.

    One API process per deployment (see compose.yaml). Horizontal scaling
    would need a shared index (database or Redis).
    """

    def __init__(self, root: Path, ttl_minutes: int) -> None:
        self.root = root
        self.ttl = timedelta(minutes=ttl_minutes)
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._items: dict[str, StoredImage] = {}

    def save(self, png: bytes, meta: dict[str, object]) -> dict[str, object]:
        image_id = uuid.uuid4().hex
        path = self.root / f"{image_id}.png"
        path.write_bytes(png)
        item = StoredImage(
            id=image_id,
            meta=meta,
            path=path,
            created_at=datetime.now(UTC),
        )
        with self._lock:
            self._items[image_id] = item
        return {"image_id": image_id, **meta}

    def get(self, image_id: str) -> tuple[dict[str, object], bytes] | None:
        with self._lock:
            item = self._items.get(image_id)
        if item is None:
            return None
        try:
            data = item.path.read_bytes()
        except FileNotFoundError:
            self.delete(image_id)
            return None
        return {"image_id": item.id, **item.meta}, data

    def delete(self, image_id: str) -> bool:
        with self._lock:
            item = self._items.pop(image_id, None)
        if item is None:
            return False
        item.path.unlink(missing_ok=True)
        return True

    def delete_expired(self, now: datetime | None = None) -> int:
        cutoff = now or datetime.now(UTC)
        with self._lock:
            expired = [
                image_id
                for image_id, item in self._items.items()
                if cutoff - item.created_at >= self.ttl
            ]
        return sum(1 for image_id in expired if self.delete(image_id))
