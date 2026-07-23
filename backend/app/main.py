from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.request_guard import PdfRequestGuardMiddleware
from app.routers import health, pdf
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or get_settings()
    application = FastAPI(
        title=active_settings.PROJECT_NAME,
        version=active_settings.VERSION,
        description=active_settings.DESCRIPTION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        redoc_js_url=(
            "https://cdn.jsdelivr.net/npm/redoc@2.1.5/"
            "bundles/redoc.standalone.js"
        ),
    )
    application.state.settings = active_settings
    register_error_handlers(application)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
    application.add_middleware(
        PdfRequestGuardMiddleware,
        settings=active_settings,
    )

    application.include_router(health.router)
    application.include_router(pdf.router)
    return application


app = create_app()
