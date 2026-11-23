from typing import cast

from fastapi import Request

from .config import Settings
from .storage import Storage


def get_storage(request: Request) -> Storage:
    return cast(Storage, request.app.state.storage)


def get_app_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)
