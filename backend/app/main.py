from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.container import get_container
from app.errors import AppError
from app.routes import dashboard, members, memberships, payments, system
from app.seed import seed_if_empty
from app.utils.file_handler import StorageError

logger = logging.getLogger("gym.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    container = get_container()  # creates any missing JSON files
    if settings.seed_demo_data and seed_if_empty(container):
        logger.info("Seeded demo data into %s", container.data_dir)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description=(
            "REST API for managing gym members, membership plans and payment records. "
            "Payments are record-keeping only; no real transactions are processed."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError):
        return JSONResponse({"detail": exc.message}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError):
        errors = []
        for err in exc.errors():
            location = [str(part) for part in err.get("loc", ()) if part not in ("body", "query", "path")]
            message = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
            errors.append({"field": ".".join(location), "message": message})
        first = errors[0] if errors else {"field": "", "message": "Invalid request"}
        detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
        return JSONResponse({"detail": detail, "errors": errors}, status_code=422)

    @app.exception_handler(StorageError)
    async def storage_handler(_: Request, exc: StorageError):
        logger.error("Storage failure: %s", exc)
        return JSONResponse(
            {"detail": "The data store is temporarily unavailable. Please try again."},
            status_code=503,
        )

    @app.exception_handler(Exception)
    async def unexpected_handler(_: Request, exc: Exception):
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse({"detail": "Something went wrong on the server."}, status_code=500)

    for module in (dashboard, members, memberships, payments, system):
        app.include_router(module.router)

    return app


app = create_app()
