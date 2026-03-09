from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


@dataclass
class AppException(Exception):
    status_code: int
    message: str
    code: str = "app_error"


class NotFoundError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(status_code=404, message=message, code="not_found")


class ValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(status_code=400, message=message, code="validation_error")


class ExternalDependencyError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(status_code=502, message=message, code="external_dependency_error")


class QuantComputationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(status_code=422, message=message, code="quant_computation_error")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        logger.warning("application error: %s", exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": exc.message, "errorCode": exc.code},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled exception", exc_info=exc)
        return JSONResponse(status_code=500, content={"success": False, "message": "internal server error"})
