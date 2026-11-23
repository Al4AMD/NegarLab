from pathlib import Path

import pytest
from fastapi import FastAPI

from negarlab_api.config import Settings
from negarlab_api.main import create_app


@pytest.fixture
def app_factory(tmp_path: Path):
    def build(**overrides: object) -> FastAPI:
        return create_app(Settings(storage_dir=tmp_path / "store", **overrides))

    return build
