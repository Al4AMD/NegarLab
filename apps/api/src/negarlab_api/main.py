import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

from .api.routes.denoise import router as denoise_router
from .api.routes.health import router as health_router
from .api.routes.images import router as images_router
from .api.routes.jobs import router as jobs_router
from .config import Settings, get_settings
from .errors import ApiError, api_error_handler, validation_error_handler
from .jobs import JobRegistry
from .storage import Storage


async def _sweep_expired(storage: Storage, interval: float) -> None:
    while True:
        await asyncio.sleep(interval)
        storage.delete_expired()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    storage = Storage(settings.storage_dir, settings.ttl_minutes)
    jobs = JobRegistry(settings.job_max_concurrency, settings.job_step_delay_ms)
    interval = max(1.0, min(60.0, settings.ttl_minutes * 30.0))

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        sweeper = asyncio.create_task(_sweep_expired(storage, interval))
        try:
            yield
        finally:
            sweeper.cancel()
            with suppress(asyncio.CancelledError):
                await sweeper

    app = FastAPI(
        title="NegarLab API",
        version="0.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.storage = storage
    app.state.jobs = jobs
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, api_error_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    api = APIRouter(prefix="/api/v1")
    api.include_router(health_router)
    api.include_router(images_router)
    api.include_router(denoise_router)
    api.include_router(jobs_router)
    app.include_router(api)
    return app


app = create_app()
