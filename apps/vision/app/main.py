"""FastAPI application entrypoint.

Wires CORS, a consistent JSON error envelope, the routers, and health/version
endpoints. All heavy CV work lives in the pipeline/grading packages; this module
stays thin.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .config import get_settings
from .routers import cards, images

app = FastAPI(
    title="Pokemon Stock Radar - Vision Service",
    version=__version__,
    description="Computer-vision grade-potential estimation for Pokemon trading cards.",
)

# CORS: permissive by default for a public-ish demo API. Tighten in production
# by setting explicit origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    code = {
        400: "bad_request",
        401: "unauthorized",
        413: "payload_too_large",
        415: "unsupported_media_type",
        422: "unprocessable_entity",
    }.get(exc.status_code, "error")
    return _error_response(exc.status_code, code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return _error_response(422, "validation_error", str(exc.errors()))


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    # Do not leak internals; log-worthy in a real deployment.
    return _error_response(500, "internal_error", "An unexpected error occurred.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/version")
async def version() -> dict[str, str]:
    settings = get_settings()
    return {
        "version": __version__,
        "model_version": settings.model_version,
        "rules_version": settings.rules_version,
    }


app.include_router(images.router)
app.include_router(cards.router)
