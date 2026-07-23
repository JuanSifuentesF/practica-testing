import logging
from collections.abc import Mapping

from app.models.schemas import ErrorResponse
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: str,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
        self.headers = dict(headers or {})
        super().__init__(error_code)


def error_response(
    status_code: int,
    detail: str,
    error_code: str,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body = ErrorResponse(detail=detail, error_code=error_code)
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(),
        headers=dict(headers or {}),
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(_request: Request, exc: ApiError) -> JSONResponse:
        return error_response(
            exc.status_code,
            exc.detail,
            exc.error_code,
            exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        missing_file = any(
            error.get("type") == "missing" and "file" in error.get("loc", ())
            for error in exc.errors()
        )
        if missing_file:
            return error_response(
                422,
                "El campo multipart 'file' es obligatorio.",
                "MISSING_FILE",
            )
        return error_response(
            422,
            "La solicitud no cumple el contrato esperado.",
            "REQUEST_VALIDATION_ERROR",
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(
        _request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        if isinstance(exc.detail, dict):
            detail = exc.detail.get("detail")
            error_code = exc.detail.get("error_code")
            if isinstance(detail, str) and isinstance(error_code, str):
                return error_response(exc.status_code, detail, error_code, exc.headers)
        return error_response(
            exc.status_code,
            "La solicitud no pudo completarse.",
            "HTTP_ERROR",
            exc.headers,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(
        _request: Request,
        exc: Exception,
    ) -> JSONResponse:
        logger.error("Excepción no controlada: %s", type(exc).__name__)
        return error_response(
            500,
            "Ocurrió un error interno al procesar la solicitud.",
            "INTERNAL_ERROR",
        )
