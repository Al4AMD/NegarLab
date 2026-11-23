from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, code: str, status: int, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.message = message


async def api_error_handler(request: Request, exc: Exception) -> JSONResponse:
    error = exc if isinstance(exc, ApiError) else ApiError("internal_error", 500, "Internal error")
    return JSONResponse(
        status_code=error.status,
        content={"error": {"code": error.code, "message": error.message}},
    )


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        return await api_error_handler(request, exc)
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": "Invalid request"}},
    )
